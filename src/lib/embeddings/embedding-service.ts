/**
 * Embedding Service
 *
 * Provides semantic similarity filtering using OpenAI text-embedding-3-large.
 * Uses 1536 dimensions (reduced from 3072 for pgvector HNSW compatibility).
 *
 * Features:
 * - Single text and batch embedding generation
 * - Caching via Supabase embedding_cache table
 * - Cosine similarity calculation
 * - Graceful error handling with fallback
 */

import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

// Lazy-initialized Anthropic client for problem extraction
let anthropicClient: Anthropic | null = null
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic()
  }
  return anthropicClient
}

// Configuration
const EMBEDDING_MODEL = 'text-embedding-3-large'
const EMBEDDING_DIMENSIONS = 1536  // Reduced for HNSW index compatibility
const MAX_BATCH_SIZE = 100  // OpenAI limit per request

// Similarity thresholds - CALIBRATED from ground truth (14 gold nuggets)
// Dec 2025: Calibrated against verified relevant posts for "freelancer payment" hypothesis.
// Gold nugget scores ranged 0.399-0.625, lowest was 0.399.
// Threshold set at 0.35 to catch all gold nuggets with margin.
export const SIMILARITY_THRESHOLDS = {
  HIGH: 0.50,    // Strong semantic match (above median of gold nuggets)
  MEDIUM: 0.35,  // Calibrated threshold - all 14 gold nuggets score above this
  LOW: 0.35,     // Below this = reject
  // Coverage boost mode: lower threshold for thin-data hypotheses
  BOOSTED_MEDIUM: 0.30,  // Lower threshold when using keyword boost
} as const

// Coverage boost configuration
// When initial search returns < MIN_COVERAGE signals, we lower threshold and add keyword boost
export const COVERAGE_BOOST_CONFIG = {
  MIN_COVERAGE: 10,      // Minimum signals before triggering boost
  KEYWORD_BOOST: 0.08,   // Bonus score for posts containing hypothesis-specific keywords
} as const

export type SimilarityTier = 'HIGH' | 'MEDIUM' | 'LOW'

/**
 * Problem focus extraction result
 * Used for keyword gating + problem-focused embeddings
 */
export interface ProblemFocus {
  // Keywords that MUST appear in a post for it to be relevant
  // E.g., for "late payments": ["paid", "pay", "payment", "invoice", "owed", "late", "overdue"]
  keywords: string[]

  // Problem-dense text for embedding (excludes audience, focuses on the ACTION)
  // E.g., "Late payment from client. Invoice overdue. Not getting paid on time. Chasing payments."
  problemText: string

  // The original hypothesis for reference
  originalHypothesis: string
}

export interface EmbeddingResult {
  text: string
  embedding: number[]
  cached: boolean
}

export interface SimilarityResult {
  text: string
  similarity: number
  tier: SimilarityTier
}

// Lazy-initialized OpenAI client
let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

/**
 * Generate SHA256 hash of text for cache lookup
 */
function hashText(text: string): string {
  const normalized = text.trim().toLowerCase()
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

/**
 * Check cache for existing embeddings
 */
async function getCachedEmbeddings(
  textHashes: string[]
): Promise<Map<string, number[]>> {
  if (textHashes.length === 0) return new Map()

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('embedding_cache')
      .select('text_hash, embedding')
      .in('text_hash', textHashes)

    if (error) {
      console.warn('[EmbeddingService] Cache lookup failed:', error.message)
      return new Map()
    }

    const cache = new Map<string, number[]>()
    for (const row of data || []) {
      // Parse the vector string from Supabase into number array
      // pgvector returns as string like "[0.1,0.2,...]"
      const embedding = typeof row.embedding === 'string'
        ? JSON.parse(row.embedding)
        : row.embedding
      cache.set(row.text_hash, embedding)
    }
    return cache
  } catch (error) {
    console.warn('[EmbeddingService] Cache error:', error)
    return new Map()
  }
}

/**
 * Store embeddings in cache
 */
async function cacheEmbeddings(
  items: Array<{ text: string; hash: string; embedding: number[] }>
): Promise<void> {
  if (items.length === 0) return

  try {
    const supabase = createAdminClient()
    const rows = items.map(({ text, hash, embedding }) => ({
      text_hash: hash,
      text_preview: text.slice(0, 200),
      embedding: `[${embedding.join(',')}]`,  // Format for pgvector
      model: EMBEDDING_MODEL,
    }))

    const { error } = await supabase
      .from('embedding_cache')
      .upsert(rows, { onConflict: 'text_hash' })

    if (error) {
      console.warn('[EmbeddingService] Cache write failed:', error.message)
    }
  } catch (error) {
    console.warn('[EmbeddingService] Cache write error:', error)
  }
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const results = await generateEmbeddings([text])
  return results[0]?.embedding ?? null
}

/**
 * Generate embeddings for multiple texts (batch processing)
 * Uses caching to avoid redundant API calls
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<EmbeddingResult[]> {
  if (texts.length === 0) return []

  // Normalize and hash texts
  const items = texts.map(text => ({
    original: text,
    normalized: text.trim(),
    hash: hashText(text),
  }))

  // Check cache first
  const hashes = items.map(i => i.hash)
  const cached = await getCachedEmbeddings(hashes)

  // Separate cached and uncached
  const results: EmbeddingResult[] = []
  const toEmbed: Array<{ index: number; text: string; hash: string }> = []

  items.forEach((item, index) => {
    const cachedEmbedding = cached.get(item.hash)
    if (cachedEmbedding) {
      results[index] = {
        text: item.original,
        embedding: cachedEmbedding,
        cached: true,
      }
    } else {
      toEmbed.push({ index, text: item.normalized, hash: item.hash })
    }
  })

  // Generate embeddings for uncached texts
  if (toEmbed.length > 0) {
    try {
      const openai = getOpenAIClient()

      // Process in batches
      for (let i = 0; i < toEmbed.length; i += MAX_BATCH_SIZE) {
        const batch = toEmbed.slice(i, i + MAX_BATCH_SIZE)
        const textsToEmbed = batch.map(b => b.text)

        const response = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: textsToEmbed,
          dimensions: EMBEDDING_DIMENSIONS,
        })

        // Map results back
        const toCache: Array<{ text: string; hash: string; embedding: number[] }> = []

        response.data.forEach((embeddingData, batchIndex) => {
          const item = batch[batchIndex]
          const embedding = embeddingData.embedding

          results[item.index] = {
            text: items[item.index].original,
            embedding,
            cached: false,
          }

          toCache.push({
            text: item.text,
            hash: item.hash,
            embedding,
          })
        })

        // Cache new embeddings (fire and forget)
        cacheEmbeddings(toCache).catch(() => {})
      }
    } catch (error) {
      console.error('[EmbeddingService] OpenAI API error:', error)
      // Return partial results with nulls for failed embeddings
      toEmbed.forEach(item => {
        if (!results[item.index]) {
          results[item.index] = {
            text: items[item.index].original,
            embedding: [],
            cached: false,
          }
        }
      })
    }
  }

  return results
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) return 0

  return dotProduct / denominator
}

/**
 * Calculate keyword boost for a text based on dynamic keywords.
 * Used in coverage boost mode when initial search returns < MIN_COVERAGE signals.
 *
 * @param text - The text to check for keywords
 * @param keywords - Dynamic keywords generated by Haiku for the specific hypothesis
 * @returns KEYWORD_BOOST if any keyword matches, 0 otherwise
 */
export function calculateKeywordBoost(text: string, keywords: string[]): number {
  if (!keywords || keywords.length === 0) return 0
  const lowerText = text.toLowerCase()
  for (const term of keywords) {
    if (lowerText.includes(term.toLowerCase())) {
      return COVERAGE_BOOST_CONFIG.KEYWORD_BOOST
    }
  }
  return 0
}

/**
 * Calculate final similarity score with keyword boost.
 * score = embedding_similarity + keyword_boost
 *
 * @param embedding1 - First embedding vector
 * @param embedding2 - Second embedding vector
 * @param text - Text to check for keyword matches
 * @param keywords - Dynamic keywords for boost (empty = no boost)
 */
export function calculateBoostedSimilarity(
  embedding1: number[],
  embedding2: number[],
  text: string,
  keywords: string[] = []
): number {
  const baseSimilarity = cosineSimilarity(embedding1, embedding2)
  const boost = calculateKeywordBoost(text, keywords)
  return baseSimilarity + boost
}

/**
 * Classify similarity score into tier
 */
export function classifySimilarity(score: number): SimilarityTier {
  if (score >= SIMILARITY_THRESHOLDS.HIGH) return 'HIGH'
  if (score >= SIMILARITY_THRESHOLDS.MEDIUM) return 'MEDIUM'
  return 'LOW'
}

/**
 * Classify similarity score with custom threshold (for coverage boost mode)
 * @param score - Similarity score (possibly boosted)
 * @param mediumThreshold - Custom threshold for MEDIUM tier (default: 0.35)
 */
export function classifySimilarityWithThreshold(
  score: number,
  mediumThreshold: number = SIMILARITY_THRESHOLDS.MEDIUM
): SimilarityTier {
  if (score >= SIMILARITY_THRESHOLDS.HIGH) return 'HIGH'
  if (score >= mediumThreshold) return 'MEDIUM'
  return 'LOW'
}

/**
 * Generate hypothesis-specific keywords using Haiku.
 * Called when initial embedding search returns < MIN_COVERAGE signals.
 *
 * @param hypothesis - The business hypothesis
 * @returns Array of 10-15 keywords/phrases for boosting borderline posts
 */
export async function generateHypothesisKeywords(hypothesis: string): Promise<string[]> {
  try {
    const client = getAnthropicClient()

    const prompt = `Given this business hypothesis: "${hypothesis}"

Generate 10-15 specific keywords/phrases that would appear in posts from people experiencing this problem. Focus on:
- Pain language (frustrated, struggling, broken, failed, hate, nightmare)
- Domain-specific terms (unique to this problem space)
- Action words (trying to, looking for, need help with, can't figure out)
- Emotional expressions (at my wit's end, driving me crazy, so tired of)

Return ONLY a JSON array of strings, no explanation:
["keyword1", "keyword2", "keyword phrase 3", ...]`

    const response = await client.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      console.warn('[generateHypothesisKeywords] Non-text response')
      return []
    }

    // Extract JSON array from response
    const match = content.text.match(/\[[\s\S]*\]/)
    if (!match) {
      console.warn('[generateHypothesisKeywords] No JSON array found:', content.text)
      return []
    }

    const keywords = JSON.parse(match[0]) as string[]
    console.log(`[generateHypothesisKeywords] Generated ${keywords.length} keywords for "${hypothesis.slice(0, 40)}..."`)
    return keywords
  } catch (error) {
    console.error('[generateHypothesisKeywords] Error:', error)
    return []
  }
}

/**
 * Compare multiple texts against a reference embedding
 * Returns similarity scores and tier classifications
 */
export function compareSimilarities(
  referenceEmbedding: number[],
  candidateEmbeddings: EmbeddingResult[]
): SimilarityResult[] {
  return candidateEmbeddings.map(candidate => {
    const similarity = candidate.embedding.length > 0
      ? cosineSimilarity(referenceEmbedding, candidate.embedding)
      : 0

    return {
      text: candidate.text,
      similarity,
      tier: classifySimilarity(similarity),
    }
  })
}

/**
 * Filter texts by semantic similarity to hypothesis
 * Returns texts grouped by tier (HIGH, MEDIUM) - LOW is filtered out
 */
export async function filterBySimilarity(
  hypothesisText: string,
  candidateTexts: string[],
  sendProgress?: (msg: string) => void
): Promise<{
  high: Array<{ text: string; similarity: number }>
  medium: Array<{ text: string; similarity: number }>
  filtered: number
  hypothesisEmbedding: number[]
}> {
  sendProgress?.(`Generating embeddings for ${candidateTexts.length} candidates...`)

  // Generate hypothesis embedding
  const hypothesisEmbedding = await generateEmbedding(hypothesisText)
  if (!hypothesisEmbedding || hypothesisEmbedding.length === 0) {
    // Fallback: return all as medium tier if embedding fails
    console.warn('[EmbeddingService] Hypothesis embedding failed, passing all candidates')
    return {
      high: [],
      medium: candidateTexts.map(text => ({ text, similarity: 0.5 })),
      filtered: 0,
      hypothesisEmbedding: [],
    }
  }

  // Generate candidate embeddings
  const candidateResults = await generateEmbeddings(candidateTexts)

  // Compare similarities
  const similarities = compareSimilarities(hypothesisEmbedding, candidateResults)

  // Group by tier
  const high: Array<{ text: string; similarity: number }> = []
  const medium: Array<{ text: string; similarity: number }> = []
  let filtered = 0

  for (const result of similarities) {
    if (result.tier === 'HIGH') {
      high.push({ text: result.text, similarity: result.similarity })
    } else if (result.tier === 'MEDIUM') {
      medium.push({ text: result.text, similarity: result.similarity })
    } else {
      filtered++
    }
  }

  sendProgress?.(`Embedding filter: ${high.length} HIGH, ${medium.length} MEDIUM, ${filtered} filtered`)

  return { high, medium, filtered, hypothesisEmbedding }
}

// Cache for problem focus extraction (hypothesis -> ProblemFocus)
const problemFocusCache = new Map<string, ProblemFocus>()

/**
 * Extract problem-specific keywords and embedding text from a hypothesis.
 *
 * This is the KEY function for quality filtering:
 * 1. Keywords are used for KEYWORD GATING (posts must contain at least 1)
 * 2. ProblemText is used for EMBEDDING (focuses on the action, not audience)
 *
 * Dec 2025 IMPROVEMENT: Now extracts more specific keywords and phrases
 * to avoid matching generic posts about the domain.
 *
 * Example:
 * Input: "Freelancers struggling to get paid on time by clients"
 * Output:
 *   keywords: ["late payment", "overdue", "not paid", "unpaid invoice", "chasing payment", "owed", "delayed payment"]
 *   problemText: "Not getting paid on time. Client payment is late or overdue. Invoice remains unpaid..."
 */
export async function extractProblemFocus(hypothesis: string): Promise<ProblemFocus> {
  // Check cache first
  const cached = problemFocusCache.get(hypothesis)
  if (cached) {
    return cached
  }

  const prompt = `Extract PROBLEM-SPECIFIC keywords from this hypothesis.

HYPOTHESIS: "${hypothesis}"

I need TWO things:

1. KEYWORDS: A list of 8-15 keywords/phrases that indicate THIS SPECIFIC PROBLEM (not just the domain).

   CRITICAL RULES:
   - Include MULTI-WORD PHRASES where they're more specific (e.g., "late payment" not just "late" or "payment")
   - Focus on PROBLEM INDICATORS - words that show frustration, delay, difficulty
   - EXCLUDE generic audience terms (e.g., don't include "freelancer", "client", "business")
   - Include both the problem state AND solution-seeking terms

   Good examples for "late payment" problem:
   - "late payment", "not paid", "overdue", "unpaid invoice", "chasing payment", "owed money"
   - "payment delay", "waiting to be paid", "still haven't paid", "won't pay"

   BAD examples (too generic):
   - "pay" (matches "payday", "paying rent", "pay taxes")
   - "payment" (matches any financial discussion)
   - "money" (matches everything)

2. PROBLEM_TEXT: A dense paragraph (3-5 sentences) describing the PROBLEM using problem-specific vocabulary.
   - DO NOT mention the audience
   - Focus on the ACTION/STATE that causes frustration
   - Use first-person expressions of the problem

Example for "Freelancers struggling to get paid on time by clients":
KEYWORDS: late payment, not paid, unpaid invoice, owed money, won't pay, invoice, payment, paid, late, unpaid, owed, overdue, delay, chase, outstanding
PROBLEM_TEXT: Not getting paid on time. Client payment is late or overdue. Invoice remains unpaid for weeks or months. Chasing payments from clients who owe money. Waiting to be paid while bills pile up. Haven't been paid for work completed. The client won't pay.

CRITICAL: You MUST include BOTH types:
1. Multi-word phrases (5-7): "late payment", "not paid", "unpaid invoice", "owed money", "won't pay"
2. Single words (8-10): MUST include common words like "invoice", "payment", "paid" plus problem indicators like "late", "unpaid", "owed", "overdue", "delay"

The single words are ESSENTIAL - they let us match posts that say things like "can't get paid" + "invoice" or "payment" + "delay".

Now extract for the given hypothesis:

Respond in this exact JSON format:
{
  "keywords": ["phrase1", "phrase2", ...],
  "problemText": "Problem description..."
}`

  try {
    const anthropic = getAnthropicClient()
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    // Parse JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0]) as { keywords: string[]; problemText: string }

    const result: ProblemFocus = {
      keywords: parsed.keywords.map(k => k.toLowerCase()),
      problemText: parsed.problemText,
      originalHypothesis: hypothesis,
    }

    // Cache the result
    problemFocusCache.set(hypothesis, result)
    console.log(`[ProblemFocus] Extracted ${result.keywords.length} keywords for: "${hypothesis.slice(0, 50)}..."`)
    console.log(`[ProblemFocus] Keywords: ${result.keywords.join(', ')}`)

    return result
  } catch (error) {
    console.error('[ProblemFocus] Extraction failed:', error)
    // Fallback: use simple word extraction
    const words = hypothesis.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)

    return {
      keywords: words,
      problemText: hypothesis,
      originalHypothesis: hypothesis,
    }
  }
}

// Problem indicator words - words that strongly suggest frustration or issues
// Dec 2025: Added "lost", "kill", "killed", "bad", "red flag", "stall", "learned"
// after diagnosing gold nugget losses (5/8 filtered by keyword gate)
const PROBLEM_INDICATORS = new Set([
  'late', 'overdue', 'unpaid', 'owed', 'delay', 'delayed', 'chase', 'chasing',
  'outstanding', 'waiting', 'waited', 'slow', 'behind', 'miss', 'missed', 'missing',
  'struggle', 'struggling', 'frustrated', 'frustrating', 'problem', 'issue',
  'difficult', 'hard', 'impossible', 'nightmare', 'terrible', 'awful', 'stuck',
  'help', 'advice', 'tips', 'how do', 'anyone else', 'am i', 'is this normal',
  // Added Dec 2025 - common pain expressions missed in gold nuggets:
  'lost', 'lose', 'losing', 'kill', 'killed', 'killing', 'bad', 'red flag',
  'stall', 'stalled', 'learned', 'lesson', 'zero', '$0', 'nothing', 'never'
])

// Problem indicator phrases - multi-word expressions of frustration
const PROBLEM_PHRASES = [
  "won't pay", "didn't pay", "hasn't paid", "haven't paid", "never paid",
  "not paying", "not paid", "still waiting", "can't get", "won't respond",
  "no response", "ghosted", "ignored", "what do i do", "any advice"
]

/**
 * Check if a text passes the keyword gate.
 *
 * Dec 2025: LOOSENED after observing 246 posts filtered by keyword gate.
 * Dec 2025: FURTHER LOOSENED after gold nugget diagnosis showed 5/8 false negatives.
 *
 * Now passes if ANY of these conditions are met:
 * 1. Contains any multi-word phrase from extracted keywords
 * 2. Contains any problem indicator word from extracted keywords
 * 3. Contains any problem phrase directly in text
 * 4. Contains any extracted keyword (domain word) + any problem indicator
 * 5. Contains any significant keyword (>=4 chars) - lets embedding filter decide
 * 6. Contains 2+ problem indicators - suggests genuine pain worth passing to embedding
 *
 * The embedding filter will catch semantic irrelevance.
 */
export function passesKeywordGate(text: string, keywords: string[]): boolean {
  const lowerText = text.toLowerCase()

  // Separate multi-word phrases from single words
  const phrases = keywords.filter(k => k.includes(' '))
  const singleWords = keywords.filter(k => !k.includes(' '))

  // Check 1: Does the text contain ANY multi-word phrase from keywords?
  const matchedPhrases = phrases.filter(phrase => lowerText.includes(phrase))
  if (matchedPhrases.length > 0) {
    return true
  }

  // Check 2: Does the text contain ANY problem indicator from keywords?
  for (const word of singleWords) {
    if (PROBLEM_INDICATORS.has(word) && lowerText.includes(word)) {
      return true
    }
  }

  // Check 3: Does the text contain a problem indicator phrase directly?
  for (const phrase of PROBLEM_PHRASES) {
    if (lowerText.includes(phrase)) {
      return true
    }
  }

  // Check 4: Does the text contain BOTH a domain keyword AND a problem indicator?
  // This catches posts like "my invoice is overdue" where "invoice" is from keywords
  // and "overdue" is a problem indicator
  const hasKeyword = singleWords.some(word => lowerText.includes(word))
  if (hasKeyword) {
    for (const indicator of PROBLEM_INDICATORS) {
      if (lowerText.includes(indicator)) {
        return true
      }
    }
  }

  // Check 5: Does the text contain ANY significant keyword (>=4 chars)?
  // Dec 2025: Added after diagnosing gold nugget losses. Embedding filter handles relevance.
  // This catches posts like "Nonpayment" where substring doesn't match but topic is relevant.
  for (const word of singleWords) {
    if (word.length >= 4 && lowerText.includes(word)) {
      return true
    }
  }

  // Check 6: Does the text contain MULTIPLE problem indicators?
  // Dec 2025: Added after gold nuggets like "lost money to bad clients" failed -
  // they express pain about the topic but don't use the exact domain keywords.
  // Multiple problem indicators suggest genuine frustration worth passing to embedding filter.
  let indicatorCount = 0
  for (const indicator of PROBLEM_INDICATORS) {
    if (lowerText.includes(indicator)) {
      indicatorCount++
      if (indicatorCount >= 2) {
        return true
      }
    }
  }

  return false
}

/**
 * Filter an array of texts using the keyword gate.
 * Returns texts that contain at least one problem keyword.
 */
export function applyKeywordGate<T extends { text: string }>(
  items: T[],
  keywords: string[]
): { passed: T[]; filtered: number } {
  const passed: T[] = []
  let filtered = 0

  for (const item of items) {
    if (passesKeywordGate(item.text, keywords)) {
      passed.push(item)
    } else {
      filtered++
    }
  }

  return { passed, filtered }
}

/**
 * Generate problem-focused embeddings for semantic comparison.
 *
 * Unlike the old approach that embedded the full hypothesis,
 * this creates embeddings focused on the PROBLEM ACTION only.
 *
 * Creates 3 facets:
 * - Pain: First-person frustration with the problem
 * - Complaint: Third-person complaints about the issue
 * - Solution: Seeking help with the specific problem
 */
export async function generateProblemFocusedEmbeddings(
  problemFocus: ProblemFocus
): Promise<{ embeddings: number[][]; facets: string[] } | null> {
  const { problemText } = problemFocus

  // Create facets focused on the PROBLEM, not the audience
  const facets = [
    // Pain facet: First-person frustration
    `I am so frustrated. ${problemText} This keeps happening to me and I don't know what to do.`,
    // Complaint facet: General complaints
    `${problemText} This is such a common problem. Why does this keep happening? So tired of dealing with this.`,
    // Solution facet: Looking for help
    `How do I deal with this? ${problemText} Looking for any advice or tips. Need help solving this problem.`,
  ]

  const results = await generateEmbeddings(facets)

  const validEmbeddings = results.filter(r => r.embedding.length > 0)
  if (validEmbeddings.length === 0) {
    return null
  }

  return {
    embeddings: results.map(r => r.embedding),
    facets,
  }
}

/**
 * Generate multi-facet embeddings for a hypothesis
 * Creates 3 embeddings capturing different angles:
 * - Pain facet: "People struggling with X, frustrated by X"
 * - Solution facet: "Looking for solutions to X, need help with X"
 * - Experience facet: "My experience with X, dealing with X"
 *
 * This improves recall by matching posts that express the problem
 * in different ways (some express pain, some seek solutions, some share experiences)
 *
 * @deprecated Use generateProblemFocusedEmbeddings with extractProblemFocus instead
 */
export async function generateMultiFacetEmbeddings(
  hypothesisText: string
): Promise<{ embeddings: number[][]; facets: string[] } | null> {
  // Create 3 facets that capture different angles of experiencing the problem
  // Each facet emphasizes the SPECIFIC PROBLEM, not just the domain/audience
  const facets = [
    // Pain facet: First-person frustration with THIS problem
    `I am frustrated because ${hypothesisText}. This is a major problem for me. I am struggling with ${hypothesisText} and it's affecting my work.`,
    // Complaint facet: Explicit complaints about the specific issue
    `${hypothesisText} is a huge issue. Why does ${hypothesisText} keep happening? So tired of dealing with ${hypothesisText}.`,
    // Solution-seeking facet: Looking for help with THIS specific problem
    `How do I solve ${hypothesisText}? Any tips for ${hypothesisText}? Looking for advice on ${hypothesisText} because I'm stuck.`,
  ]

  const results = await generateEmbeddings(facets)

  // Check if all embeddings were generated successfully
  const validEmbeddings = results.filter(r => r.embedding.length > 0)
  if (validEmbeddings.length === 0) {
    return null
  }

  return {
    embeddings: results.map(r => r.embedding),
    facets,
  }
}

/**
 * Compare a candidate against multiple facet embeddings and return max similarity
 * This ensures posts expressing the problem in ANY way (pain, solution-seeking, experience)
 * get matched, improving recall
 */
export function maxSimilarityAcrossFacets(
  facetEmbeddings: number[][],
  candidateEmbedding: number[]
): number {
  if (facetEmbeddings.length === 0 || candidateEmbedding.length === 0) {
    return 0
  }

  let maxSim = 0
  for (const facetEmb of facetEmbeddings) {
    if (facetEmb.length > 0) {
      const sim = cosineSimilarity(facetEmb, candidateEmbedding)
      if (sim > maxSim) {
        maxSim = sim
      }
    }
  }
  return maxSim
}

/**
 * Filter texts by multi-facet semantic similarity to hypothesis
 * Uses 3 facets (pain, solution, experience) and takes MAX similarity
 * Returns texts grouped by tier (HIGH, MEDIUM) - LOW is filtered out
 *
 * This is the main entry point for multi-facet filtering, improving recall
 * over single-embedding filtering
 */
export async function filterByMultiFacetSimilarity(
  hypothesisText: string,
  candidateTexts: string[],
  sendProgress?: (msg: string) => void
): Promise<{
  high: Array<{ text: string; similarity: number }>
  medium: Array<{ text: string; similarity: number }>
  filtered: number
  hypothesisEmbeddings: number[][]
}> {
  sendProgress?.(`Generating multi-facet embeddings for hypothesis...`)

  // Generate multi-facet hypothesis embeddings
  const facetResult = await generateMultiFacetEmbeddings(hypothesisText)
  if (!facetResult || facetResult.embeddings.every(e => e.length === 0)) {
    // Fallback: return all as medium tier if embedding fails
    console.warn('[EmbeddingService] Multi-facet embedding failed, passing all candidates')
    return {
      high: [],
      medium: candidateTexts.map(text => ({ text, similarity: 0.5 })),
      filtered: 0,
      hypothesisEmbeddings: [],
    }
  }

  sendProgress?.(`Generating embeddings for ${candidateTexts.length} candidates...`)

  // Generate candidate embeddings
  const candidateResults = await generateEmbeddings(candidateTexts)

  // Compare against all facets and take max similarity
  const high: Array<{ text: string; similarity: number }> = []
  const medium: Array<{ text: string; similarity: number }> = []
  let filtered = 0

  for (let i = 0; i < candidateResults.length; i++) {
    const candidate = candidateResults[i]
    if (candidate.embedding.length === 0) {
      // If candidate embedding failed, pass through as medium
      medium.push({ text: candidate.text, similarity: 0.4 })
      continue
    }

    const similarity = maxSimilarityAcrossFacets(facetResult.embeddings, candidate.embedding)
    const tier = classifySimilarity(similarity)

    if (tier === 'HIGH') {
      high.push({ text: candidate.text, similarity })
    } else if (tier === 'MEDIUM') {
      medium.push({ text: candidate.text, similarity })
    } else {
      filtered++
    }
  }

  sendProgress?.(`Multi-facet filter: ${high.length} HIGH, ${medium.length} MEDIUM, ${filtered} filtered`)

  return { high, medium, filtered, hypothesisEmbeddings: facetResult.embeddings }
}

/**
 * Check if embedding service is available
 */
export function isEmbeddingServiceAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY
}
