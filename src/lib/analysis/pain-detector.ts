// Pain Signal Detection
// Analyzes Reddit posts/comments to identify and score pain signals
// Based on PVRE Scoring Framework - Pain Score (35% weight in Viability Verdict)
//
// v2.0 - Enhanced scoring with negative context patterns and WTP exclusions
// v11.0 - Embedding-based praise filter (replaces regex-based v10.1)

import { RedditPost, RedditComment } from '../data-sources/types'
import { generateEmbedding, generateEmbeddings, cosineSimilarity } from '../embeddings/embedding-service'

// =============================================================================
// NEGATIVE CONTEXT PATTERNS - Reduce false positives
// =============================================================================
// These patterns indicate the pain keyword is used in a non-pain context
// e.g., "hate the competition" is about competitors, not user pain

const NEGATIVE_CONTEXT_PATTERNS = [
  // Talking about competition, not personal pain
  /hate\s+(?:the\s+)?(?:competition|competitor|rivals?)/i,
  /frustrated\s+(?:with\s+)?(?:the\s+)?(?:competition|competitor)/i,

  // General statements, not personal experience
  /it's\s+(?:not\s+)?(?:terrible|awful|horrible)\s+(?:that|when)/i,
  /(?:some|many|most)\s+people\s+(?:are\s+)?(?:frustrated|struggling)/i,

  // Asking about others' experience, not expressing own pain
  /(?:is\s+it|are\s+you)\s+(?:frustrated|struggling|having\s+trouble)/i,
  /anyone\s+else\s+(?:frustrated|struggling|tired\s+of)/i,

  // Hypothetical or conditional statements
  /(?:would|could|might)\s+be\s+(?:frustrated|terrible|awful)/i,
  /if\s+(?:you|they|one)\s+(?:were|are)\s+(?:frustrated|struggling)/i,

  // Past tense resolved issues
  /used\s+to\s+(?:be\s+)?(?:frustrated|struggle|hate)/i,
  /was\s+(?:frustrated|struggling)\s+(?:but|until)/i,

  // Talking about a product they like having issues
  /(?:love|like)\s+(?:it|this|the\s+app)\s+(?:but|even\s+though)/i,
]

// =============================================================================
// WTP EXCLUSION PATTERNS - Reduce false positives for willingness to pay
// =============================================================================
// These patterns contain WTP keywords but don't indicate actual purchase intent

const WTP_EXCLUSION_PATTERNS = [
  // Budget as organizational/planning term
  /budget\s+(?:cut|meeting|review|planning|approval|constraint|limit)/i,
  /(?:company|department|team)\s+budget/i,
  /budget\s+(?:was|is|has\s+been)\s+(?:cut|reduced|slashed)/i,

  // Pricing complaints (opposite of WTP)
  /pricing\s+is\s+(?:crazy|insane|ridiculous|absurd)/i,
  /(?:too\s+)?expensive\s+(?:for|to)/i,
  /(?:can't|cannot)\s+afford/i,
  /(?:price|cost)\s+(?:is\s+)?(?:too\s+)?(?:high|steep)/i,

  // ROI skepticism
  /(?:not\s+)?(?:sure|certain)\s+(?:about\s+)?(?:the\s+)?roi/i,
  /roi\s+(?:is|seems)\s+(?:unclear|questionable|not\s+clear)/i,

  // Investment as general term (not purchase intent)
  /(?:time|emotional)\s+investment/i,
  /invest(?:ing)?\s+(?:in\s+)?(?:yourself|learning|skills)/i,

  // Subscription complaints
  /(?:too\s+many|another)\s+subscription/i,
  /subscription\s+fatigue/i,
  /(?:cancel|cancelled|canceling)\s+(?:my\s+)?subscription/i,

  // Worth/value in negative context
  /(?:not|isn't|wasn't)\s+worth\s+(?:it|the\s+money|paying)/i,

  // === v7.0: PURCHASE REGRET PATTERNS ===
  // These indicate unhappiness with a PAST purchase, not intent to pay for alternative

  // Refund requests (clear regret signal)
  /(?:get|want|need|requesting?)\s+(?:my\s+)?(?:money\s+back|refund)/i,
  /(?:ask|asking)\s+for\s+(?:a\s+)?refund/i,
  /refund\s+(?:request|policy|please)/i,

  // Buyer's remorse / regret language
  /regret\s+(?:buying|purchasing|paying|upgrading|subscribing)/i,
  /(?:shouldn't|should\s+not)\s+have\s+(?:bought|paid|upgraded|subscribed)/i,
  /(?:wish|wished)\s+I\s+(?:hadn't|had\s+not)\s+(?:bought|paid|upgraded)/i,

  // Questioning past purchase value (retrospective doubt)
  /(?:debating|wondering|questioning)\s+(?:if|whether)\s+(?:it\s+was|that\s+was)\s+worth/i,
  /was\s+(?:it|that|this)\s+(?:really\s+)?worth\s+(?:it|the\s+money|paying)/i,
  /(?:starting\s+to\s+)?(?:think|feel)\s+(?:like\s+)?I\s+(?:wasted|threw\s+away)\s+(?:my\s+)?money/i,

  // Past tense payment + negative sentiment
  /(?:paid|spent|invested)\s+(?:for|on|in)\s+(?:this|it).*(?:disappointed|regret|waste|terrible|awful|useless)/i,
  /(?:disappointed|regret|waste).*(?:paid|spent|invested)/i,

  // Explicit statements of purchase dissatisfaction
  /(?:biggest|worst)\s+(?:waste|mistake)\s+of\s+(?:money|my\s+money)/i,
  /(?:threw|throwing)\s+(?:away\s+)?money/i,
  /money\s+(?:down\s+the\s+drain|wasted)/i,
]

// =============================================================================
// PRAISE-ONLY DETECTION - Filter out pure testimonials before they become pain signals
// =============================================================================
// v10.0: Expanded patterns to catch more testimonials
// IMPORTANT: Mixed reviews (praise + complaint) should NOT be filtered

const PRAISE_PATTERNS = [
  // Superlative praise phrases
  /i(?:'m| am) obsessed with/i,
  /game changer/i,
  /life.?changing/i,
  /nothing bad to say/i,
  /changed (?:my|our|the way)/i,
  /never going back/i,
  /no idea how i (?:lived|survived|managed)/i,
  /hands[ -]?down (?:the )?(?:best|easiest|greatest)/i,

  // Pure endorsement patterns - v10.1: standalone praise words
  /i love (?:this|it|using|the)/i,
  /\brecommend(?:ed|ing)?\b/i,           // Any form of recommend
  /\bbrilliant\b/i,                       // Brilliant alone
  /\bamazing\b/i,                         // Amazing alone
  /\bfantastic\b/i,                       // Fantastic alone
  /\bwonderful\b/i,                       // Wonderful alone
  /\bperfect\b/i,                         // Perfect alone
  /\bexcellent\b/i,                       // v10.1: Excellent alone
  /\bawesome\b/i,                         // v10.1: Awesome alone
  /\bloved?\b/i,                          // v10.1: Love/Loved alone
  /\bgreat\b/i,                           // v10.1: Great alone (very common in praise)
  /\bcool\b/i,                            // v10.1: Cool alone
  /\bincredible\b/i,                      // v10.1: Incredible alone
  /\bsuperb\b/i,                          // v10.1: Superb alone
  /\boutstanding\b/i,                     // v10.1: Outstanding alone
  /\bexceptional\b/i,                     // v10.1: Exceptional alone

  // Rating expressions - v10.1: new
  /\b(?:5|five)[\s\/]?(?:out of[\s\/]?)?(?:5|five)\b/i, // 5/5, 5 out of 5
  /\b10[\s\/]?(?:out of[\s\/]?)?10\b/i,   // 10/10, 10 out of 10
  /\b(?:5|five) stars?\b/i,               // 5 stars

  // Phrase patterns with flexible structure
  /absolutely (?:love|amazing|fantastic|brilliant|wonderful)/i,
  /best (?:app|tool|software|product|thing|experience|decision)/i,
  /so (?:helpful|useful|easy|simple|convenient|fun|good|great|much fun)/i,
  /(?:really|truly|genuinely) (?:enjoyed|loved|like|appreciate)/i,
  /incredibly (?:enjoyable|helpful|useful|easy|fun)/i,
  /very (?:friendly|helpful|cool|nice|good|easy|fun)/i,
  /super (?:fun|cool|easy|helpful|nice)/i,  // v10.1: super + positive

  // Satisfaction statements
  /exactly what i (?:needed|wanted|was looking for)/i,
  /works (?:perfectly|flawlessly|beautifully|great|well)/i,
  /couldn't (?:be|ask for) (?:happier|better)/i,
  /made my (?:life|job|work) (?:so much )?easier/i,
  /had a (?:great|amazing|wonderful|fantastic|good|fun) (?:time|experience)/i,
  /such a (?:fun|great|good|nice|cool) (?:way|experience|app|thing)/i,

  // Gratitude and forward-looking patterns
  /\bgrateful\b/i,
  /\bthankful\b/i,
  /looking forward to/i,
  /(?:will|i'll|going to) (?:definitely )?(?:do (?:it|this) again|use|try|come back)/i,
  /(?:super|so|really) glad/i,
  /no.?hassle/i,

  // Value affirmation (no pain implied)
  /(?:totally|absolutely|definitely|well) worth (?:it|the money|every penny)/i,
  /wish i (?:had found|discovered|started using) (?:this|it) (?:sooner|earlier)/i,

  // Excitement expressions - v10.1: new
  /\bomg\b/i,                             // OMG
  /\bwow\b/i,                             // Wow
  /can't (?:wait|believe how (?:good|great|easy|fun))/i,
  /(?:so |really |very )?excited/i,
]

// =============================================================================
// POSITIVE CAN'T PATTERNS - These use "can't" in POSITIVE contexts
// =============================================================================
// When these match, the "can't" is expressing satisfaction, not complaint
const POSITIVE_CANT_PATTERNS = [
  /can't imagine .*(without|doing again|going back|ever)/i,
  /can't (?:go back|live without|do without)/i,
  /can't recommend .* enough/i,
  /can't believe (?:how|I) (?:easy|simple|fast|good|great)/i,
  /can't stop using/i,
  /can't wait (?:to|for)/i,
]

// =============================================================================
// EXPLICIT NO-COMPLAINT PATTERNS - Definitely not a complaint
// =============================================================================
// These patterns explicitly state there's no complaint
const EXPLICIT_NO_COMPLAINT_PATTERNS = [
  /nothing bad to say/i,
  /no complaints?/i,
  /no issues? (?:at all|whatsoever)?/i,
  /couldn't be (?:happier|more satisfied)/i,
  /wouldn't change (?:a thing|anything)/i,
  /no problems? (?:at all|whatsoever)?/i,
]

// =============================================================================
// POSITIVE "BUT" PATTERNS - These use "but" in POSITIVE contexts
// =============================================================================
// When these match, the "but" is not introducing a complaint
// v10.0: More flexible patterns to catch variations like "but I'm super glad"
const POSITIVE_BUT_PATTERNS = [
  // "but [I'm] [really/super] glad/happy" - flexible modifiers
  /but (?:i'm |i am )?(?:super |so |really |very )?(?:glad|happy|pleased|satisfied|grateful)/i,
  // "but it was/it's worth it" - positive outcome despite preceding context
  /but (?:it was|it's|that's|it is) (?:still )?(?:worth|great|amazing|fun|good|nice|cool)/i,
  // "but overall" - summary that's usually positive
  /but (?:overall|in the end|at the end|all in all)/i,
  // "but still/definitely recommend" - endorsement despite issues
  /but (?:i )?(?:still|definitely|totally|absolutely|would) (?:recommend|love|worth|use)/i,
  // "but everyone was cool/great" - positive social outcome
  /but (?:everyone|everybody|people|the group) (?:was|were) (?:really |super |very )?(?:cool|great|nice|friendly|fun)/i,
  // "but we had a great time" - positive experience despite issues
  /but (?:we |i )?had a (?:great|good|amazing|wonderful|fun) (?:time|experience)/i,
]

// =============================================================================
// REAL COMPLAINT PATTERNS - These indicate actionable feedback
// =============================================================================
// v10.0: Removed simple "but" - now handled with positive-but detection
const COMPLAINT_PATTERNS = [
  // Transition words that introduce complaints (handled specially)
  /\bhowever\b/i,           // "Great however..."

  // Issue/problem indicators
  /\bissue/i,               // Has an issue
  /\bproblem/i,             // Has a problem
  /\bbug/i,                 // Bug report
  /\bcrash/i,               // Crashes
  /\berror/i,               // Has errors
  /\bglitch/i,              // Has glitches

  // Feature requests/wishes
  /\bwish\b/i,              // Feature request "I wish..."
  /\bwould be (?:nice|great|better)/i,  // Feature request
  /\bshould (?:have|be|add|fix)/i,      // Should do something
  /\bcould (?:be|use) (?:better|improvement)/i,    // Could be better
  /\bonly (?:issue|problem|complaint|thing|downside)/i,

  // Negative emotions
  /\bfrustrat/i,            // Frustrated
  /\bannoying/i,            // Something annoying
  /\bdisappoint/i,          // Disappointed
  /\bterrible\b/i,          // Terrible
  /\bhorrible\b/i,          // Horrible
  /\bawful\b/i,             // Awful
  /\bwaste/i,               // Waste of time/money

  // UX complaints
  /\bconfusing/i,           // Confusing
  /\bdifficult\b/i,         // Difficult to use (not "difficult to make friends" context)
  /\bhard to (?:use|navigate|understand|figure)/i,

  // Performance complaints
  /\bslow\b/i,              // Performance complaint
  /\blag/i,                 // Lag complaint
  /\bfreezes?/i,            // Freezing complaint

  // Price complaints
  /\bexpensive/i,           // Price complaint
  /\boverpriced/i,          // Overpriced
  /\brip.?off/i,            // Rip off

  // Functionality complaints - v10.0: more specific
  /(?:can't|cannot|couldn't) (?:get|figure|find|use|access|login|sign)/i, // Can't do something specific
  /(?:doesn't|does not|didn't|won't) (?:work|load|open|save|sync)/i, // Doesn't work
  /\bmissing (?:feature|option|function)/i,  // Missing feature
  /\black(?:s|ing)? (?:feature|option|function)/i,  // Lacks feature
  /\bneed(?:s|ed)?\s+(?:to fix|improvement|more|better)/i, // Needs improvement

  // Specific negative experiences
  /\blet down\b/i,
  /\bexpected (?:more|better)/i,
  /not (?:what i expected|worth|good|great)/i,
  /\bregret/i,
  /\brefund/i,
]

/**
 * Check if a review is praise-only (no actionable pain)
 * Returns true if the review should be EXCLUDED from pain signals
 *
 * IMPORTANT: Mixed reviews (praise + complaint) return FALSE and are kept
 * We only filter pure testimonials with no actionable feedback
 *
 * @deprecated Use PraiseFilter.isPraise() for embedding-based detection (v11.0)
 * This regex-based filter is kept for backward compatibility and as a fast pre-filter.
 *
 * @param text - The review text to analyze
 * @param rating - Optional star rating (1-5) from app store reviews
 */
function isPraiseOnly(text: string, rating?: number): boolean {
  // Low ratings (1-3) always have pain, even if praise patterns match
  if (rating !== undefined && rating <= 3) {
    return false
  }

  const lowerText = text.toLowerCase()

  // Step 1: Check for explicit "no complaint" statements - these are definitely praise
  const hasExplicitNoComplaint = EXPLICIT_NO_COMPLAINT_PATTERNS.some(pattern => pattern.test(lowerText))

  // Step 2: Check for positive "can't" usage (satisfaction, not complaint)
  // These are ALSO praise indicators (e.g., "can't recommend enough")
  const hasPositiveCant = POSITIVE_CANT_PATTERNS.some(pattern => pattern.test(lowerText))

  // Step 2b: Check for positive "but" usage (e.g., "but I'm super glad")
  // v10.1: These are transitions that DON'T introduce complaints
  const hasPositiveBut = POSITIVE_BUT_PATTERNS.some(pattern => pattern.test(lowerText))

  // Step 3: Check for REAL complaints (exclude positive can't from complaint detection)
  // We need to check each complaint pattern individually
  let hasRealComplaint = false
  for (const pattern of COMPLAINT_PATTERNS) {
    if (!pattern.test(lowerText)) continue

    // Special handling for can't/cannot/couldn't patterns
    if (/can't|cannot|couldn't/.test(pattern.source)) {
      // Only count as complaint if NOT a positive can't
      if (!hasPositiveCant) {
        hasRealComplaint = true
        break
      }
      // If positive can't, skip this pattern and continue checking others
      continue
    }

    // All other complaint patterns are real complaints
    hasRealComplaint = true
    break
  }

  // Step 3b: Check for "but" that's NOT a positive-but
  // v10.1: "but" often introduces complaints, unless it's a positive-but pattern
  // Note: We're LENIENT here - only functional issues count as complaints
  // User-base issues ("didn't find anyone nearby") are filtered as praise
  if (!hasRealComplaint && /\bbut\b/i.test(lowerText) && !hasPositiveBut) {
    const afterBut = lowerText.split(/\bbut\b/i)[1] || ''
    // Only mark as complaint if it's a clear FUNCTIONAL issue with the app
    // Not user-base ("didn't find anyone") or social issues
    const isFunctionalComplaint = /(?:doesn't|didn't|won't|can't|couldn't) (?:work|load|open|save|sync|connect|start|play|run)/i.test(afterBut) ||
      /(?:bug|crash|error|freeze|glitch|slow|lag)/i.test(afterBut)
    if (isFunctionalComplaint) {
      hasRealComplaint = true
    }
  }

  // If there's an explicit "nothing bad to say" AND high rating → definitely filter
  if (hasExplicitNoComplaint && (rating === undefined || rating >= 4)) {
    // But still check for other real complaints (mixed review case)
    if (!hasRealComplaint) {
      return true // Filter: explicit no-complaint + no other issues
    }
  }

  // If there's a real complaint, this is a mixed review - keep it
  if (hasRealComplaint) {
    return false
  }

  // Check if any praise patterns match (PRAISE_PATTERNS or POSITIVE_CANT_PATTERNS)
  const hasPraise = PRAISE_PATTERNS.some(pattern => pattern.test(lowerText)) || hasPositiveCant

  // Only filter if it's praise-only (has praise, no real complaints)
  if (hasPraise) {
    // Extra check: very short reviews with praise patterns are likely pure testimonials
    const wordCount = text.split(/\s+/).length
    if (wordCount < 50) {
      return true // Short praise = filter out
    }

    // Longer reviews - only filter if 4-5 stars AND no complaint patterns
    if (rating !== undefined && rating >= 4) {
      return true // High rating + praise + no complaints = filter out
    }
  }

  return false
}

// =============================================================================
// EMBEDDING-BASED PRAISE FILTER (v11.0)
// =============================================================================
// Replaces regex-based detection with semantic similarity using embeddings.
// Follows the same pattern as signal-categorizer.ts for consistency.

/**
 * Anchor text for praise detection.
 * These phrases capture the semantic space of pure testimonials/positive reviews.
 */
const PRAISE_ANCHOR = `
  Amazing app, absolutely love it, perfect solution, highly recommend to everyone,
  game changer for my workflow, best app I've ever used, exceeded all expectations,
  brilliant design, couldn't be happier, five stars, must have app, life changing,
  so glad I found this, exactly what I needed, flawless experience, works perfectly,
  wonderful experience, fantastic product, excellent service, superb quality,
  10 out of 10, totally worth it, love love love, best decision ever
`.trim()

/**
 * Anchor text for complaint detection.
 * These phrases capture the semantic space of user problems and complaints.
 */
const COMPLAINT_ANCHOR = `
  App crashes constantly, doesn't work properly, frustrating experience,
  missing basic features, wish it had more options, needs serious improvement,
  terrible user interface, waste of money, bugs everywhere, very disappointing,
  can't figure out how to use it, broken functionality, poor performance,
  should have never bought this, requesting refund, doesn't do what I need,
  too expensive for what it offers, missing feature, needs to fix, laggy and slow,
  freezes all the time, error messages, stopped working, terrible support
`.trim()

/**
 * Praise filter result for a single text
 */
export interface PraiseFilterResult {
  isPraise: boolean
  confidence: number
  praiseSim: number
  complaintSim: number
}

/**
 * Embedding-based Praise Filter
 *
 * Uses semantic similarity to detect pure testimonials vs. actionable feedback.
 * Pre-computes anchor embeddings on initialization and uses them to classify signals.
 *
 * v11.0: Follows the same pattern as SignalCategorizer for architectural consistency.
 */
export class PraiseFilter {
  private praiseEmbedding: number[] | null = null
  private complaintEmbedding: number[] | null = null
  private initPromise: Promise<void> | null = null

  // Thresholds for praise detection
  // Calibrated based on expected behavior:
  // - Praise should be clearly more similar to PRAISE_ANCHOR than COMPLAINT_ANCHOR
  // - Must have a minimum similarity to praise anchor to be considered
  private readonly MINIMUM_PRAISE_SIMILARITY = 0.45
  private readonly PRAISE_MARGIN = 0.10 // Must be this much more similar to praise than complaint

  /**
   * Initialize anchor embeddings (called once, cached)
   */
  private async init(): Promise<void> {
    if (this.praiseEmbedding && this.complaintEmbedding) return
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      console.log('[PraiseFilter] Computing anchor embeddings...')

      const [praiseEmb, complaintEmb] = await Promise.all([
        generateEmbedding(PRAISE_ANCHOR),
        generateEmbedding(COMPLAINT_ANCHOR),
      ])

      if (!praiseEmb || !complaintEmb) {
        console.warn('[PraiseFilter] Failed to generate anchor embeddings')
        return
      }

      this.praiseEmbedding = praiseEmb
      this.complaintEmbedding = complaintEmb
      console.log('[PraiseFilter] Anchor embeddings initialized')
    })()

    return this.initPromise
  }

  /**
   * Check if a single text is praise-only using embeddings
   *
   * @param text - The review/signal text to analyze
   * @param rating - Optional star rating (1-5) from app store reviews
   * @returns PraiseFilterResult with similarity scores and isPraise flag
   */
  async isPraise(text: string, rating?: number): Promise<PraiseFilterResult> {
    // Low ratings (1-3) always have pain, even if text sounds positive
    if (rating !== undefined && rating <= 3) {
      return { isPraise: false, confidence: 0, praiseSim: 0, complaintSim: 0 }
    }

    // Initialize anchor embeddings if needed
    await this.init()

    // If embeddings failed to initialize, fallback to not filtering
    if (!this.praiseEmbedding || !this.complaintEmbedding) {
      console.warn('[PraiseFilter] Embeddings not available, skipping filter')
      return { isPraise: false, confidence: 0, praiseSim: 0, complaintSim: 0 }
    }

    // Generate embedding for the signal text
    const signalEmbedding = await generateEmbedding(text)

    if (!signalEmbedding) {
      return { isPraise: false, confidence: 0, praiseSim: 0, complaintSim: 0 }
    }

    // Calculate similarities to both anchors
    const praiseSim = cosineSimilarity(signalEmbedding, this.praiseEmbedding)
    const complaintSim = cosineSimilarity(signalEmbedding, this.complaintEmbedding)

    // Decision logic:
    // - Must be clearly more similar to praise than complaint (by PRAISE_MARGIN)
    // - Must have minimum similarity to praise anchor
    const isPraise =
      praiseSim > this.MINIMUM_PRAISE_SIMILARITY &&
      praiseSim > complaintSim + this.PRAISE_MARGIN

    const confidence = isPraise ? praiseSim - complaintSim : 0

    return { isPraise, confidence, praiseSim, complaintSim }
  }

  /**
   * Filter an array of pain signals, removing praise-only entries
   * Uses batch embedding for efficiency
   *
   * @param signals - Array of PainSignal objects to filter
   * @returns Filtered array with praise-only signals removed
   */
  async filterMany(signals: PainSignal[]): Promise<PainSignal[]> {
    if (signals.length === 0) return []

    // Initialize anchor embeddings if needed
    await this.init()

    if (!this.praiseEmbedding || !this.complaintEmbedding) {
      console.warn('[PraiseFilter] Embeddings not available, returning all signals')
      return signals
    }

    console.log(`[PraiseFilter] Filtering ${signals.length} signals...`)

    // Generate embeddings for all signal texts in batch
    const texts = signals.map((s) => s.text)
    const embeddings = await generateEmbeddings(texts)

    // If embedding generation failed entirely, return all signals (fail open)
    if (!embeddings || embeddings.length === 0) {
      console.warn('[PraiseFilter] Embedding generation failed, returning all signals')
      return signals
    }

    // Filter signals
    const filtered: PainSignal[] = []
    let praiseCount = 0

    for (let i = 0; i < signals.length; i++) {
      const signal = signals[i]
      const embedding = embeddings[i]?.embedding

      // If embedding failed, keep the signal (fail open)
      if (!embedding || embedding.length === 0) {
        filtered.push(signal)
        continue
      }

      // Low ratings are never praise
      const rating = signal.source.rating
      if (rating !== undefined && rating <= 3) {
        filtered.push(signal)
        continue
      }

      // Calculate similarities
      const praiseSim = cosineSimilarity(embedding, this.praiseEmbedding!)
      const complaintSim = cosineSimilarity(embedding, this.complaintEmbedding!)

      // Check if praise-only
      const isPraise =
        praiseSim > this.MINIMUM_PRAISE_SIMILARITY &&
        praiseSim > complaintSim + this.PRAISE_MARGIN

      if (isPraise) {
        praiseCount++
        console.log(
          `[PraiseFilter] Filtered: "${signal.text.substring(0, 60)}..." ` +
            `(praise: ${praiseSim.toFixed(3)}, complaint: ${complaintSim.toFixed(3)})`
        )
      } else {
        filtered.push(signal)
      }
    }

    console.log(
      `[PraiseFilter] Filtered ${praiseCount} praise-only signals, kept ${filtered.length}`
    )

    return filtered
  }
}

// Singleton instance for reuse
let praiseFilterInstance: PraiseFilter | null = null

/**
 * Get the singleton PraiseFilter instance
 */
export function getPraiseFilter(): PraiseFilter {
  if (!praiseFilterInstance) {
    praiseFilterInstance = new PraiseFilter()
  }
  return praiseFilterInstance
}

/**
 * Reset the PraiseFilter singleton (for testing only)
 * This clears cached embeddings so they'll be regenerated on next use.
 */
export function resetPraiseFilter(): void {
  praiseFilterInstance = null
}

/**
 * Filter a single text for praise (convenience function)
 * @deprecated Prefer using getPraiseFilter().isPraise() directly
 */
export async function isPraiseByEmbedding(
  text: string,
  rating?: number
): Promise<PraiseFilterResult> {
  return getPraiseFilter().isPraise(text, rating)
}

/**
 * Filter multiple pain signals, removing praise-only entries (convenience function)
 */
export async function filterPraiseSignals(signals: PainSignal[]): Promise<PainSignal[]> {
  return getPraiseFilter().filterMany(signals)
}

// =============================================================================
// EMOTION DETECTION KEYWORDS
// =============================================================================
// Keywords that indicate the primary emotion in a pain signal

const EMOTION_KEYWORDS: Record<EmotionType, string[]> = {
  frustration: [
    'frustrated', 'frustrating', 'frustration', 'annoying', 'annoyed',
    'hate', 'hated', 'hating', 'infuriating', 'maddening', 'aggravating',
    'fed up', 'sick of', 'tired of', 'done with', 'furious', 'angry',
    'pissed', 'irritated', 'irritating', "can't stand", 'ugh', 'argh'
  ],
  anxiety: [
    'worried', 'worrying', 'anxious', 'anxiety', 'stressed', 'stressing',
    'nervous', 'panicking', 'panic', 'scared', 'afraid', 'terrified',
    'overwhelming', 'overwhelmed', 'dread', 'dreading', 'fear', 'fearful',
    'uncertain', 'unsure', 'paranoid', 'freaking out'
  ],
  disappointment: [
    'disappointed', 'disappointing', 'disappointment', 'letdown', 'let down',
    'underwhelming', 'underwhelmed', 'expected more', 'not what i hoped',
    'sad', 'sadly', 'unfortunate', 'unfortunately', 'regret', 'regretted',
    'wish', 'wished', 'if only', 'should have been', 'could have been'
  ],
  confusion: [
    'confused', 'confusing', 'confusion', "don't understand", "can't figure",
    'lost', 'no idea', 'unclear', 'makes no sense', 'baffling', 'baffled',
    'puzzled', 'puzzling', 'perplexed', 'what am i doing wrong', 'help',
    'how do i', 'why does', 'why is', 'stuck', 'clueless'
  ],
  hope: [
    'hope', 'hoping', 'hopefully', 'looking for', 'searching for',
    'need a solution', 'any recommendations', 'any suggestions', 'advice',
    'wish there was', 'would love', 'would be great', 'dream', 'ideal',
    'perfect would be', 'if only there was', 'someone should make'
  ],
  neutral: [] // Default when no emotion keywords match
}

/**
 * Detect the primary emotion in a text based on keyword matching
 */
export function detectEmotion(text: string): EmotionType {
  const lowerText = text.toLowerCase()
  const emotionScores: Record<EmotionType, number> = {
    frustration: 0,
    anxiety: 0,
    disappointment: 0,
    confusion: 0,
    hope: 0,
    neutral: 0
  }

  // Score each emotion based on keyword matches
  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    if (emotion === 'neutral') continue
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        emotionScores[emotion as EmotionType]++
      }
    }
  }

  // Find the emotion with the highest score
  let maxEmotion: EmotionType = 'neutral'
  let maxScore = 0
  for (const [emotion, score] of Object.entries(emotionScores)) {
    if (score > maxScore) {
      maxScore = score
      maxEmotion = emotion as EmotionType
    }
  }

  return maxEmotion
}

// =============================================================================
// KEYWORD TIERS - Comprehensive pain signal detection
// =============================================================================

// Tier 3: High intensity (weight: 3 points) - Strong emotional pain signals
const HIGH_INTENSITY_KEYWORDS = [
  // Frustration cluster
  'nightmare', 'nightmarish', 'hate', 'hated', 'hating',
  'frustrated', 'frustrating', 'frustration',
  'desperate', 'desperately', 'furious', 'infuriating',
  'fed up', 'sick of', 'tired of', 'done with',
  "can't stand", 'cannot stand', 'at my wit\'s end',

  // Extreme negative
  'terrible', 'terribly', 'awful', 'awfully', 'horrible', 'horrendous',
  'worst', 'impossible', 'impossibly', 'unbearable',
  'broken', 'useless', 'worthless', 'pointless',

  // Exhaustion/burnout
  'exhausted', 'exhausting', 'overwhelmed', 'overwhelms',
  'burning out', 'burnt out', 'burned out',
  'killing me', 'driving me crazy', 'driving me insane',

  // Giving up signals
  'giving up', 'gave up', 'give up', 'about to quit',
  'ready to quit', 'breaking point', 'last straw',

  // Value negative
  'waste of time', 'waste of money', 'total waste',
  'complete disaster', 'absolute mess', 'utter failure',
]

// Tier 2: Medium intensity (weight: 2 points) - Clear problem signals
const MEDIUM_INTENSITY_KEYWORDS = [
  // Struggle cluster
  'struggle', 'struggling', 'struggled', 'struggles',
  'difficult', 'difficulty', 'difficulties',
  'hard', 'harder', 'hardest',
  'challenging', 'challenge', 'challenges',

  // Problem/issue cluster
  'problem', 'problems', 'problematic',
  'issue', 'issues', 'issues with',
  'concern', 'concerned', 'concerning', 'concerns',
  'worried', 'worry', 'worrying',

  // Confusion cluster
  'confusing', 'confused', 'confusion',
  'unclear', 'complicated', 'complex',
  'overwhelming', 'overwhelming amount',

  // Annoyance cluster
  'annoying', 'annoyed', 'annoyance', 'irritating', 'irritated',
  'disappointing', 'disappointed', 'disappointment',
  'lacking', 'missing', 'incomplete', 'inadequate',

  // Blocked/stuck
  'stuck', 'blocked', 'blocking', 'obstacle',
  'failing', 'failed', 'fail', 'failure',
  'not working', "doesn't work", "won't work", "isn't working",
  "can't figure out", 'cannot figure out',
  'no idea how', "don't know how", "don't understand",

  // Time/effort negative
  'takes too long', 'time consuming', 'tedious',
  'manual process', 'repetitive', 'cumbersome',
]

// Tier 1: Low intensity (weight: 1 point) - Mild interest/exploration signals
const LOW_INTENSITY_KEYWORDS = [
  'wondering', 'curious', 'curious about',
  'thinking about', 'considering', 'contemplating',
  'looking into', 'exploring', 'researching',
  'might', 'maybe', 'perhaps',
  'sometimes', 'occasionally', 'once in a while',
  'wish there was', 'wish I could', 'would be nice',
  'could be better', 'room for improvement',
]

// Solution-seeking (weight: 2 points) - Shows active demand
const SOLUTION_SEEKING_KEYWORDS = [
  // Direct asks
  'looking for', 'searching for', 'seeking',
  'in search of', 'trying to find', 'need to find',

  // Recommendation requests
  'anyone know', 'does anyone know', 'anybody know',
  'recommendations', 'recommend', 'recommended',
  'suggestions', 'suggest', 'suggested',
  'advice', 'advise', 'guidance',

  // Help requests
  'help with', 'need help', 'please help', 'can someone help',
  'how do i', 'how can i', 'how should i', 'how would i',
  'what do you use', 'what should i use', 'what would you recommend',
  'best way to', 'better way to', 'easier way to',

  // Alternatives
  'alternatives', 'alternative to', 'instead of',
  'similar to', 'like but',

  // Tips/ideas
  'tips', 'tip for', 'tricks', 'hacks',
  'any ideas', 'any thoughts', 'any suggestions',
  'would appreciate', 'greatly appreciate',
]

// Willingness to Pay signals (weight: 4 points) - STRONGEST signal
const WILLINGNESS_TO_PAY_KEYWORDS = {
  // Strong intent (high confidence)
  strongIntent: [
    'would pay', 'willing to pay', 'happy to pay',
    "i'd pay", 'i would pay', "i'll pay",
    'take my money', 'shut up and take',
    'worth paying', 'worth every penny',
    'money is no object', 'whatever it costs',
  ],
  // Enterprise intent (medium-high confidence) - B2B purchase signals
  // Enterprise users express WTP differently: "wish my company would upgrade"
  enterpriseIntent: [
    'wish my company', 'wish our company', 'wish my team',
    'wish we had this at work', 'need this at work',
    'recommend to my manager', 'recommend to management',
    'convince my boss', 'convince management', 'convince my manager',
    'propose to leadership', 'pitch to leadership',
    'our team needs', 'our company needs', 'our organization needs',
    'enterprise version', 'enterprise plan', 'business plan',
    'company should adopt', 'team should use', 'we should switch to',
    'would improve our workflow', 'would save our team',
    'getting my company to', 'getting my team to',
  ],
  // Financial discussion (medium confidence)
  financialDiscussion: [
    'budget', 'budgeting', 'budget for',
    'pricing', 'price point', 'price range',
    'how much does', 'how much would', 'cost of',
    'investment', 'invest in', 'roi',
    'subscription', 'subscribe', 'monthly fee',
    'premium', 'upgrade', 'pro version', 'paid version',
  ],
  // Purchase intent (medium confidence)
  purchaseIntent: [
    'where can i buy', 'where to buy', 'how to purchase',
    'looking to invest', 'ready to invest',
    'considering paying', 'thinking of paying',
  ],
  // Value signals (lower confidence but still relevant)
  valueSignals: [
    'worth the money', 'worth it', 'value for money',
    'save time', 'save money', 'save hours',
    'pay for convenience', 'pay for quality',
  ],
}

// =============================================================================
// INTERFACES
// =============================================================================

export type RelevanceTier = 'CORE' | 'RELATED' | 'N'
export type EmotionType = 'frustration' | 'anxiety' | 'disappointment' | 'confusion' | 'hope' | 'neutral'

export interface PainSignal {
  text: string
  title?: string
  score: number
  intensity: 'low' | 'medium' | 'high'
  signals: string[]
  solutionSeeking: boolean
  willingnessToPaySignal: boolean
  wtpConfidence: 'none' | 'low' | 'medium' | 'high'
  wtpSourceReliability?: 'high' | 'medium' | 'low'  // high=app reviews, medium=HN, low=Reddit
  tier?: RelevanceTier  // CORE = intersection match, RELATED = single-domain match
  emotion: EmotionType  // Primary emotion detected in the signal
  // Jan 2026: Semantic feedback category (Phase 3 - App Store-First Architecture)
  feedbackCategory?: 'pricing' | 'ads' | 'content' | 'performance' | 'features'
  feedbackCategoryConfidence?: number  // 0-1 similarity score
  source: {
    type: 'post' | 'comment'
    id: string
    subreddit: string
    author: string
    url: string
    createdUtc: number
    engagementScore: number
    rating?: number  // Star rating (1-5) for app store reviews
    // Raw engagement metrics for transparency
    upvotes?: number      // Reddit score / HN points / app review thumbsUp
    numComments?: number  // Comment count (Reddit/HN only)
  }
}

export interface ScoreResult {
  score: number
  signals: string[]
  highIntensityCount: number
  mediumIntensityCount: number
  lowIntensityCount: number
  solutionSeekingCount: number
  willingnessToPayCount: number
  wtpConfidence: 'none' | 'low' | 'medium' | 'high'
  strongestSignal: string | null
  // v2.0: Context flags for debugging
  hasNegativeContext: boolean
  hasWTPExclusion: boolean
}

export interface EmotionsBreakdown {
  frustration: number
  anxiety: number
  disappointment: number
  confusion: number
  hope: number
  neutral: number
}

export interface PainSummary {
  totalSignals: number
  averageScore: number
  highIntensityCount: number
  mediumIntensityCount: number
  lowIntensityCount: number
  solutionSeekingCount: number
  willingnessToPayCount: number
  topSubreddits: { name: string; count: number }[]
  // Transparency metrics
  dataConfidence: 'very_low' | 'low' | 'medium' | 'high'
  strongestSignals: string[]
  wtpQuotes: { text: string; subreddit: string; url?: string; createdUtc?: number; upvotes?: number; numComments?: number; rating?: number }[]
  // v3.0: Temporal distribution for recency awareness
  temporalDistribution: {
    last30Days: number
    last90Days: number
    last180Days: number
    older: number
  }
  // Date range of data analyzed
  dateRange?: {
    oldest: string // ISO date string
    newest: string // ISO date string
  }
  // Average recency score (0-1, higher = more recent)
  recencyScore: number
  // v4.0: Emotions breakdown (optional for backward compatibility)
  emotionsBreakdown?: EmotionsBreakdown
  // v5.0: Discussion velocity - CALCULATED from timestamps
  discussionVelocity?: {
    percentageChange: number | null  // e.g., +36 or -20, null if insufficient data
    trend: 'rising' | 'stable' | 'declining' | 'insufficient_data'
    recentCount: number       // Posts in last 90 days
    previousCount: number     // Posts in 91-180 days
    confidence: 'low' | 'medium' | 'high' | 'none'  // Based on sample size
    insufficientData?: boolean  // True if base period too small for meaningful comparison
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a keyword exists in text with word boundaries
 * Prevents false positives like "hard" matching "hardly"
 */
function matchKeyword(text: string, keyword: string): boolean {
  // For multi-word phrases, use simple includes
  if (keyword.includes(' ')) {
    return text.includes(keyword)
  }

  // For single words, use word boundary regex
  // Escape special regex characters in keyword
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`\\b${escaped}\\b`, 'i')
  return regex.test(text)
}

/**
 * Check if text matches any negative context pattern
 * These patterns indicate false positive scenarios
 */
function hasNegativeContext(text: string): boolean {
  const lowerText = text.toLowerCase()
  return NEGATIVE_CONTEXT_PATTERNS.some((pattern) => pattern.test(lowerText))
}

/**
 * Check if text matches any WTP exclusion pattern
 * These patterns indicate false positive WTP signals
 */
function hasWTPExclusion(text: string): boolean {
  const lowerText = text.toLowerCase()
  return WTP_EXCLUSION_PATTERNS.some((pattern) => pattern.test(lowerText))
}

/**
 * Calculate engagement multiplier based on upvotes
 * High engagement = more people relate to this pain
 * v2.0: Capped at 1.2x to prevent engagement from inflating scores too much
 */
function getEngagementMultiplier(upvotes: number): number {
  // Logarithmic scale - much more conservative than before
  // score of 100 = 1.1x, score of 1000 = 1.15x
  if (upvotes <= 1) return 1.0
  const multiplier = 1 + Math.log10(upvotes) * 0.05
  return Math.min(1.2, multiplier) // Cap at 1.2x (was 2.0x)
}

/**
 * Calculate recency multiplier based on post age
 * Recent posts are weighted higher because they indicate current pain
 * v3.0: Added recency weighting for temporal relevance
 */
export function getRecencyMultiplier(createdUtc: number): number {
  if (!createdUtc || createdUtc <= 0) return 1.0

  const nowSeconds = Date.now() / 1000
  const ageInDays = (nowSeconds - createdUtc) / (60 * 60 * 24)

  // Posts from last 30 days: 1.5x multiplier (recent = highly relevant)
  if (ageInDays <= 30) return 1.5

  // Posts from last 90 days: 1.25x (still very relevant)
  if (ageInDays <= 90) return 1.25

  // Posts from last 180 days: 1.0x (baseline)
  if (ageInDays <= 180) return 1.0

  // Posts from last year: 0.75x (slightly dated)
  if (ageInDays <= 365) return 0.75

  // Posts older than 1 year: 0.5x (potentially stale pain)
  return 0.5
}

/**
 * Get age bucket for temporal distribution tracking
 */
function getAgeBucket(createdUtc: number): 'last30Days' | 'last90Days' | 'last180Days' | 'older' {
  if (!createdUtc || createdUtc <= 0) return 'older'

  const nowSeconds = Date.now() / 1000
  const ageInDays = (nowSeconds - createdUtc) / (60 * 60 * 24)

  if (ageInDays <= 30) return 'last30Days'
  if (ageInDays <= 90) return 'last90Days'
  if (ageInDays <= 180) return 'last180Days'
  return 'older'
}

/**
 * Calculate discussion velocity from temporal distribution
 * Compares recent activity (0-90 days) vs previous period (91-180 days)
 * Returns percentage change and trend classification
 *
 * v5.1: Added minimum threshold check - if previousCount < 5, velocity is
 * statistically meaningless (e.g., +4100% from base of 1 is noise, not signal)
 */
const MIN_VELOCITY_BASE_THRESHOLD = 5 // Minimum signals in comparison period for meaningful velocity

function calculateDiscussionVelocity(temporalDistribution: {
  last30Days: number
  last90Days: number
  last180Days: number
  older: number
}): PainSummary['discussionVelocity'] {
  // Recent = last 90 days (includes last30Days + last90Days buckets)
  const recentCount = temporalDistribution.last30Days + temporalDistribution.last90Days
  // Previous = 91-180 days (just the last180Days bucket)
  const previousCount = temporalDistribution.last180Days

  // v5.1: Check for minimum threshold - velocity is meaningless with tiny base
  // A +4100% increase from 1 to 42 signals is statistically noise
  if (previousCount < MIN_VELOCITY_BASE_THRESHOLD) {
    return {
      percentageChange: null,
      trend: 'insufficient_data',
      recentCount,
      previousCount,
      confidence: 'none',
      insufficientData: true,
    }
  }

  // Determine confidence based on sample size
  const totalRecent = recentCount + previousCount
  let confidence: 'low' | 'medium' | 'high' = 'low'
  if (totalRecent >= 50) confidence = 'high'
  else if (totalRecent >= 20) confidence = 'medium'

  // Calculate percentage change
  let percentageChange = 0
  let trend: 'rising' | 'stable' | 'declining' = 'stable'

  percentageChange = Math.round(((recentCount - previousCount) / previousCount) * 100)

  // Classify trend (±15% is considered stable)
  if (percentageChange > 15) trend = 'rising'
  else if (percentageChange < -15) trend = 'declining'
  else trend = 'stable'

  return {
    percentageChange,
    trend,
    recentCount,
    previousCount,
    confidence,
    insufficientData: false,
  }
}

// =============================================================================
// MAIN SCORING FUNCTION
// =============================================================================

/**
 * Calculate pain score for a given text
 * Implements the PVRE Scoring Framework methodology
 * v2.0: Enhanced with negative context filtering and stricter scoring
 * v3.0: Added recency weighting for temporal relevance
 */
export function calculatePainScore(
  text: string,
  engagementScore: number = 0,
  createdUtc: number = 0
): ScoreResult {
  const lowerText = text.toLowerCase()
  const signals: string[] = []
  let highIntensityCount = 0
  let mediumIntensityCount = 0
  let lowIntensityCount = 0
  let solutionSeekingCount = 0
  let willingnessToPayCount = 0
  let wtpConfidence: 'none' | 'low' | 'medium' | 'high' = 'none'
  let strongestSignal: string | null = null

  // v2.0: Check for negative context patterns first
  const hasNegContext = hasNegativeContext(text)
  const hasWTPExcl = hasWTPExclusion(text)

  // Track which tier had the first match (for strongest signal)
  let firstHighMatch: string | null = null
  let firstMediumMatch: string | null = null

  // Check high intensity keywords (weight: 3 points each)
  for (const keyword of HIGH_INTENSITY_KEYWORDS) {
    if (matchKeyword(lowerText, keyword)) {
      signals.push(keyword)
      highIntensityCount++
      if (!firstHighMatch) firstHighMatch = keyword
    }
  }

  // Check medium intensity keywords (weight: 2 points each)
  for (const keyword of MEDIUM_INTENSITY_KEYWORDS) {
    if (matchKeyword(lowerText, keyword)) {
      signals.push(keyword)
      mediumIntensityCount++
      if (!firstMediumMatch) firstMediumMatch = keyword
    }
  }

  // Check low intensity keywords (weight: 1 point each)
  for (const keyword of LOW_INTENSITY_KEYWORDS) {
    if (matchKeyword(lowerText, keyword)) {
      signals.push(keyword)
      lowIntensityCount++
    }
  }

  // Check solution seeking keywords (weight: 2 points each)
  for (const keyword of SOLUTION_SEEKING_KEYWORDS) {
    if (matchKeyword(lowerText, keyword)) {
      signals.push(keyword)
      solutionSeekingCount++
    }
  }

  // Check willingness to pay signals with confidence levels
  // v2.0: Skip WTP detection if exclusion patterns match
  let wtpStrongCount = 0
  let wtpMediumCount = 0
  let wtpLowCount = 0

  if (!hasWTPExcl) {
    for (const keyword of WILLINGNESS_TO_PAY_KEYWORDS.strongIntent) {
      if (matchKeyword(lowerText, keyword)) {
        signals.push(keyword)
        willingnessToPayCount++
        wtpStrongCount++
      }
    }

    // Enterprise intent - B2B purchase signals (medium-high confidence)
    // Enterprise users express WTP differently: "wish my company would upgrade"
    for (const keyword of WILLINGNESS_TO_PAY_KEYWORDS.enterpriseIntent) {
      if (matchKeyword(lowerText, keyword)) {
        signals.push(keyword)
        willingnessToPayCount++
        wtpMediumCount++  // Treated as medium-high (between strong and regular medium)
      }
    }

    for (const keyword of WILLINGNESS_TO_PAY_KEYWORDS.financialDiscussion) {
      if (matchKeyword(lowerText, keyword)) {
        signals.push(keyword)
        willingnessToPayCount++
        wtpMediumCount++
      }
    }

    for (const keyword of WILLINGNESS_TO_PAY_KEYWORDS.purchaseIntent) {
      if (matchKeyword(lowerText, keyword)) {
        signals.push(keyword)
        willingnessToPayCount++
        wtpMediumCount++
      }
    }

    for (const keyword of WILLINGNESS_TO_PAY_KEYWORDS.valueSignals) {
      if (matchKeyword(lowerText, keyword)) {
        signals.push(keyword)
        willingnessToPayCount++
        wtpLowCount++
      }
    }
  }

  // Determine WTP confidence level
  if (wtpStrongCount > 0) {
    wtpConfidence = 'high'
  } else if (wtpMediumCount > 0) {
    wtpConfidence = 'medium'
  } else if (wtpLowCount > 0) {
    wtpConfidence = 'low'
  }

  // Determine strongest signal
  strongestSignal = firstHighMatch || firstMediumMatch || null

  // Calculate raw score with updated weights
  const rawScore =
    highIntensityCount * 3 +
    mediumIntensityCount * 2 +
    lowIntensityCount * 1 +
    solutionSeekingCount * 2 +
    willingnessToPayCount * 4 // WTP is the strongest signal

  // Apply engagement multiplier (now capped at 1.2x)
  const engagementMultiplier = getEngagementMultiplier(engagementScore)

  // v3.0: Apply recency multiplier
  const recencyMultiplier = getRecencyMultiplier(createdUtc)

  const adjustedScore = rawScore * engagementMultiplier * recencyMultiplier

  // Normalize to 0-10 scale
  // Target: a post with 2 high-intensity + 1 solution-seeking = ~8/10
  let normalizedScore = Math.min(10, adjustedScore)

  // v2.0: Apply score ceiling for low-quality signals
  // If ONLY low intensity keywords, cap score at 4.0 max
  if (highIntensityCount === 0 && mediumIntensityCount === 0 && lowIntensityCount > 0) {
    normalizedScore = Math.min(4.0, normalizedScore)
  }

  // If ONLY low + solution seeking (no pain), cap at 5.0
  if (highIntensityCount === 0 && mediumIntensityCount === 0 && solutionSeekingCount > 0) {
    normalizedScore = Math.min(5.0, normalizedScore)
  }

  // Apply bonuses for signal combinations
  let finalScore = normalizedScore

  // Bonus: High WTP confidence (only if not excluded)
  if (wtpConfidence === 'high' && !hasWTPExcl) {
    finalScore = Math.min(10, finalScore + 1)
  }

  // Bonus: High pain + solution seeking combo
  if (highIntensityCount > 0 && solutionSeekingCount > 0) {
    finalScore = Math.min(10, finalScore + 0.5)
  }

  // v2.0: Penalty for negative context patterns
  if (hasNegContext) {
    finalScore = Math.max(0, finalScore * 0.6) // 40% reduction
  }

  // v2.0: Stronger penalty for ONLY low intensity signals
  if (highIntensityCount === 0 && mediumIntensityCount === 0 && lowIntensityCount > 0) {
    finalScore = Math.max(0, finalScore - 1.0) // Stronger penalty (was -0.5)
  }

  return {
    score: Math.round(finalScore * 10) / 10,
    signals: [...new Set(signals)], // Remove duplicates
    highIntensityCount,
    mediumIntensityCount,
    lowIntensityCount,
    solutionSeekingCount,
    willingnessToPayCount,
    wtpConfidence,
    strongestSignal,
    hasNegativeContext: hasNegContext,
    hasWTPExclusion: hasWTPExcl,
  }
}

/**
 * Determine intensity level from score
 */
function getIntensity(score: number): 'low' | 'medium' | 'high' {
  if (score >= 7) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}

/**
 * Calculate engagement score (normalized combination of upvotes and comments)
 */
function calculateEngagementScore(score: number, numComments: number): number {
  // Logarithmic scale to prevent outliers from dominating
  const upvoteScore = Math.log10(Math.max(1, score + 1)) * 2
  const commentScore = Math.log10(Math.max(1, numComments + 1)) * 3
  return Math.round((upvoteScore + commentScore) * 10) / 10
}

/**
 * Determine WTP source reliability based on source type
 * App reviews > Hacker News > Reddit for purchase intent signals
 *
 * Rationale: People discussing payment intent in app reviews have actually used/considered
 * the product. Reddit discussions are often hypothetical or generic.
 */
function getWtpSourceReliability(subreddit: string): 'high' | 'medium' | 'low' {
  const lower = subreddit.toLowerCase()

  // High reliability: App store reviews (actual purchase context)
  if (lower === 'google_play' || lower === 'app_store' || lower === 'trustpilot') {
    return 'high'
  }

  // Medium reliability: Hacker News (tech-savvy, more specific discussions)
  if (lower === 'hackernews' || lower === 'hacker news' || lower === 'askhn' || lower === 'showhn') {
    return 'medium'
  }

  // Low reliability: Reddit (generic discussions, often hypothetical)
  return 'low'
}

/**
 * Determine data confidence based on post count
 * v2.0: This is the volume-based confidence (used for basic summary)
 */
function getDataConfidence(postCount: number): 'very_low' | 'low' | 'medium' | 'high' {
  if (postCount >= 200) return 'high'
  if (postCount >= 100) return 'medium'
  if (postCount >= 50) return 'low'
  return 'very_low'
}

/**
 * Calculate quality-weighted confidence
 * v2.0: Considers both volume AND signal quality
 * Higher-quality signals (high/medium intensity) contribute more to confidence
 */
function getQualityWeightedConfidence(summary: PainSummary): {
  confidence: 'very_low' | 'low' | 'medium' | 'high'
  qualityScore: number
  reasoning: string
} {
  // Calculate quality score: weighted sum of signal types
  // High intensity = 3 points, Medium = 2 points, Low = 0.5 points, WTP = 4 points
  const qualityScore =
    summary.highIntensityCount * 3 +
    summary.mediumIntensityCount * 2 +
    summary.lowIntensityCount * 0.5 +
    summary.willingnessToPayCount * 4

  // Normalize by total signals to get quality ratio
  const qualityRatio = summary.totalSignals > 0 ? qualityScore / summary.totalSignals : 0

  // Volume factor (diminishing returns after 100 signals)
  const volumeFactor = Math.min(1, Math.log10(Math.max(1, summary.totalSignals)) / 2)

  // Combined confidence score (0-10)
  const confidenceScore = qualityRatio * 3 * volumeFactor

  // Penalties
  const lowIntensityRatio = summary.lowIntensityCount / Math.max(1, summary.totalSignals)
  const highIntensityRatio = summary.highIntensityCount / Math.max(1, summary.totalSignals)

  let adjustedScore = confidenceScore

  // Penalty if mostly low-intensity signals
  if (lowIntensityRatio > 0.7 && summary.highIntensityCount < 5) {
    adjustedScore *= 0.6 // 40% reduction
  }

  // Bonus for strong high-intensity presence
  if (highIntensityRatio > 0.3 || summary.highIntensityCount > 20) {
    adjustedScore *= 1.2
  }

  // Map to confidence level
  let confidence: 'very_low' | 'low' | 'medium' | 'high'
  if (adjustedScore >= 6) {
    confidence = 'high'
  } else if (adjustedScore >= 3) {
    confidence = 'medium'
  } else if (adjustedScore >= 1) {
    confidence = 'low'
  } else {
    confidence = 'very_low'
  }

  // Generate reasoning
  const parts: string[] = []
  if (summary.highIntensityCount > 0) {
    parts.push(`${summary.highIntensityCount} high-intensity signals`)
  }
  if (summary.willingnessToPayCount > 0) {
    parts.push(`${summary.willingnessToPayCount} WTP signals`)
  }
  if (lowIntensityRatio > 0.7) {
    parts.push(`mostly low-intensity (${Math.round(lowIntensityRatio * 100)}%)`)
  }

  return {
    confidence,
    qualityScore: Math.round(adjustedScore * 10) / 10,
    reasoning: parts.join(', ') || 'Insufficient quality signals',
  }
}

// =============================================================================
// POST/COMMENT ANALYSIS
// =============================================================================

// Weight multiplier for title-only posts (recovered from [removed] posts)
// P0 FIX: Increased from 0.5 to 0.7 — titles are often the clearest pain expression
const TITLE_ONLY_WEIGHT = 0.7

/**
 * Check if a post is a title-only recovery (body was [removed])
 */
function isTitleOnlyPost(post: RedditPost): boolean {
  return (post.body || '').startsWith('[Title-only analysis]')
}

/**
 * Analyze an array of Reddit posts for pain signals
 */
export function analyzePosts(posts: RedditPost[]): PainSignal[] {
  const painSignals: PainSignal[] = []

  for (const post of posts) {
    // Check if this is a title-only recovered post
    const titleOnly = isTitleOnlyPost(post)

    // For title-only posts, analyze just the title
    const textToAnalyze = titleOnly ? post.title : `${post.title} ${post.body || ''}`
    const engagement = calculateEngagementScore(post.score, post.numComments)
    // v3.0: Pass createdUtc for recency weighting
    const scoreResult = calculatePainScore(textToAnalyze, post.score, post.createdUtc)

    // Apply title-only weight penalty if applicable
    const finalScore = titleOnly
      ? scoreResult.score * TITLE_ONLY_WEIGHT
      : scoreResult.score

    // Only include posts with some pain signals
    if (finalScore > 0 || scoreResult.signals.length > 0) {
      const textForAnalysis = titleOnly ? post.title : (post.body || post.title)

      // v8.0: Fast regex pre-filter for obvious praise (deprecated, kept for performance)
      // Note: Embedding-based filter (filterPraiseSignals) runs later in community-voice/route.ts
      const rating = (post as RedditPost & { rating?: number }).rating
      if (isPraiseOnly(textForAnalysis, rating)) {
        continue // Skip this review - it's pure praise with no pain
      }

      painSignals.push({
        text: textForAnalysis,
        title: post.title,
        score: finalScore,
        intensity: getIntensity(finalScore),
        signals: titleOnly
          ? [...scoreResult.signals, 'title-only']
          : scoreResult.signals,
        solutionSeeking: scoreResult.solutionSeekingCount > 0,
        willingnessToPaySignal: scoreResult.willingnessToPayCount > 0,
        wtpConfidence: scoreResult.wtpConfidence,
        wtpSourceReliability: scoreResult.willingnessToPayCount > 0
          ? getWtpSourceReliability(post.subreddit)
          : undefined,
        emotion: detectEmotion(textForAnalysis),
        source: {
          type: 'post',
          id: post.id,
          subreddit: post.subreddit,
          author: post.author,
          url: post.permalink?.startsWith('http')
            ? post.permalink  // Already a full URL (e.g., app store)
            : post.permalink
            ? `https://reddit.com${post.permalink}`
            : `https://reddit.com/r/${post.subreddit}/comments/${post.id}`,
          createdUtc: post.createdUtc,
          engagementScore: engagement,
          // Include star rating for app store reviews (1-5)
          rating: (post as RedditPost & { rating?: number }).rating,
          // Raw engagement metrics for user transparency
          upvotes: post.score,
          numComments: post.numComments,
        },
      })
    }
  }

  // Sort by pain score (descending)
  return painSignals.sort((a, b) => b.score - a.score)
}

/**
 * Analyze an array of Reddit comments for pain signals
 */
export function analyzeComments(comments: RedditComment[]): PainSignal[] {
  const painSignals: PainSignal[] = []

  for (const comment of comments) {
    // v3.0: Pass createdUtc for recency weighting
    const scoreResult = calculatePainScore(comment.body, comment.score, comment.createdUtc)

    // Only include comments with some pain signals
    if (scoreResult.score > 0 || scoreResult.signals.length > 0) {
      // v8.0: Fast regex pre-filter for obvious praise (deprecated, kept for performance)
      // Note: Embedding-based filter (filterPraiseSignals) runs later in community-voice/route.ts
      // Reddit comments don't have star ratings, so rating is undefined
      if (isPraiseOnly(comment.body)) {
        continue // Skip this comment - it's pure praise with no pain
      }

      const postId = comment.postId || ''

      painSignals.push({
        text: comment.body,
        score: scoreResult.score,
        intensity: getIntensity(scoreResult.score),
        signals: scoreResult.signals,
        solutionSeeking: scoreResult.solutionSeekingCount > 0,
        willingnessToPaySignal: scoreResult.willingnessToPayCount > 0,
        wtpConfidence: scoreResult.wtpConfidence,
        wtpSourceReliability: scoreResult.willingnessToPayCount > 0
          ? getWtpSourceReliability(comment.subreddit)
          : undefined,
        emotion: detectEmotion(comment.body),
        source: {
          type: 'comment',
          id: comment.id,
          subreddit: comment.subreddit,
          author: comment.author,
          url: comment.permalink?.startsWith('http')
            ? comment.permalink  // Already a full URL (e.g., app store)
            : comment.permalink
            ? `https://reddit.com${comment.permalink}`
            : `https://reddit.com/r/${comment.subreddit}/comments/${postId}/_/${comment.id}`,
          createdUtc: comment.createdUtc,
          engagementScore: Math.log10(Math.max(1, comment.score + 1)) * 2,
          // Raw engagement for comments (no numComments since it's a comment)
          upvotes: comment.score,
        },
      })
    }
  }

  // Sort by pain score (descending)
  return painSignals.sort((a, b) => b.score - a.score)
}

/**
 * Combine and deduplicate pain signals from posts and comments
 */
export function combinePainSignals(
  postSignals: PainSignal[],
  commentSignals: PainSignal[]
): PainSignal[] {
  // Combine both arrays
  const allSignals = [...postSignals, ...commentSignals]

  // Sort by score (descending), then by engagement score
  return allSignals.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }
    return b.source.engagementScore - a.source.engagementScore
  })
}

// =============================================================================
// SUMMARY STATISTICS (with Transparency Metrics)
// =============================================================================

/**
 * Get summary statistics for pain signals with transparency metrics
 * Provides the data needed for the PVRE transparency display
 */
export function getPainSummary(signals: PainSignal[]): PainSummary {
  const emptyEmotions: EmotionsBreakdown = {
    frustration: 0,
    anxiety: 0,
    disappointment: 0,
    confusion: 0,
    hope: 0,
    neutral: 0,
  }

  if (signals.length === 0) {
    return {
      totalSignals: 0,
      averageScore: 0,
      highIntensityCount: 0,
      mediumIntensityCount: 0,
      lowIntensityCount: 0,
      solutionSeekingCount: 0,
      willingnessToPayCount: 0,
      topSubreddits: [],
      dataConfidence: 'very_low',
      strongestSignals: [],
      wtpQuotes: [],
      temporalDistribution: {
        last30Days: 0,
        last90Days: 0,
        last180Days: 0,
        older: 0,
      },
      recencyScore: 0,
      emotionsBreakdown: emptyEmotions,
    }
  }

  const subredditCounts: Record<string, number> = {}
  const signalCounts: Record<string, number> = {}
  const wtpQuotes: { text: string; subreddit: string; url?: string; createdUtc?: number; upvotes?: number; numComments?: number; rating?: number }[] = []
  const emotionCounts: EmotionsBreakdown = { ...emptyEmotions }

  let totalScore = 0
  let highCount = 0
  let mediumCount = 0
  let lowCount = 0
  let solutionCount = 0
  let wtpCount = 0

  // v3.0: Track temporal distribution
  const temporalDistribution = {
    last30Days: 0,
    last90Days: 0,
    last180Days: 0,
    older: 0,
  }
  let oldestTimestamp = Infinity
  let newestTimestamp = 0
  let totalRecencyMultiplier = 0

  for (const signal of signals) {
    totalScore += signal.score
    if (signal.intensity === 'high') highCount++
    else if (signal.intensity === 'medium') mediumCount++
    else lowCount++

    if (signal.solutionSeeking) solutionCount++
    if (signal.willingnessToPaySignal) {
      wtpCount++
      // Collect WTP quotes for display - only include high/medium confidence
      // and require explicit payment language to avoid showing bug reports or praise
      if (wtpQuotes.length < 5 && (signal.wtpConfidence === 'high' || signal.wtpConfidence === 'medium')) {
        // v6.0: Validate quote contains actual payment-intent keywords, not just financial discussion
        const lowerText = signal.text.toLowerCase()
        const hasExplicitPaymentIntent =
          lowerText.includes('pay') ||
          lowerText.includes('buy') ||
          lowerText.includes('purchase') ||
          lowerText.includes('worth') ||
          lowerText.includes('money') ||
          lowerText.includes('invest') ||
          lowerText.includes('cost')

        if (hasExplicitPaymentIntent) {
          wtpQuotes.push({
            text: signal.text,
            subreddit: signal.source.subreddit,
            url: signal.source.url,
            createdUtc: signal.source.createdUtc,
            upvotes: signal.source.upvotes,
            numComments: signal.source.numComments,
            rating: signal.source.rating,
          })
        }
      }
    }

    // v4.0: Count emotions
    emotionCounts[signal.emotion]++

    subredditCounts[signal.source.subreddit] =
      (subredditCounts[signal.source.subreddit] || 0) + 1

    // Count individual signal keywords
    for (const keyword of signal.signals) {
      signalCounts[keyword] = (signalCounts[keyword] || 0) + 1
    }

    // v3.0: Track temporal distribution and date range
    const createdUtc = signal.source.createdUtc
    if (createdUtc && createdUtc > 0) {
      const bucket = getAgeBucket(createdUtc)
      temporalDistribution[bucket]++

      // Track date range
      if (createdUtc < oldestTimestamp) oldestTimestamp = createdUtc
      if (createdUtc > newestTimestamp) newestTimestamp = createdUtc

      // Accumulate recency multipliers for average
      totalRecencyMultiplier += getRecencyMultiplier(createdUtc)
    }
  }

  const topSubreddits = Object.entries(subredditCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Get strongest signals (most frequently appearing keywords)
  const strongestSignals = Object.entries(signalCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([keyword]) => keyword)

  // Calculate date range
  const dateRange =
    oldestTimestamp !== Infinity && newestTimestamp > 0
      ? {
          oldest: new Date(oldestTimestamp * 1000).toISOString().split('T')[0],
          newest: new Date(newestTimestamp * 1000).toISOString().split('T')[0],
        }
      : undefined

  // Calculate average recency score (normalized 0-1, where 1 = all posts from last 30 days)
  const avgRecencyMultiplier = totalRecencyMultiplier / signals.length
  const recencyScore = Math.round(((avgRecencyMultiplier - 0.5) / 1.0) * 100) / 100 // Normalize 0.5-1.5 to 0-1

  // Calculate discussion velocity from temporal data
  const discussionVelocity = calculateDiscussionVelocity(temporalDistribution)

  return {
    totalSignals: signals.length,
    averageScore: Math.round((totalScore / signals.length) * 10) / 10,
    highIntensityCount: highCount,
    mediumIntensityCount: mediumCount,
    lowIntensityCount: lowCount,
    solutionSeekingCount: solutionCount,
    willingnessToPayCount: wtpCount,
    topSubreddits,
    dataConfidence: getDataConfidence(signals.length),
    strongestSignals,
    wtpQuotes,
    temporalDistribution,
    dateRange,
    recencyScore: Math.max(0, Math.min(1, recencyScore)),
    emotionsBreakdown: emotionCounts,
    discussionVelocity,
  }
}

// =============================================================================
// OVERALL PAIN SCORE CALCULATION (for Viability Verdict)
// =============================================================================

/**
 * Calculate overall pain score (0-10) for the Viability Verdict
 * This is the weighted average considering all signals with bonuses/penalties
 * v2.0: Uses quality-weighted confidence instead of volume-only
 */
export function calculateOverallPainScore(summary: PainSummary): {
  score: number
  confidence: 'very_low' | 'low' | 'medium' | 'high'
  reasoning: string
} {
  if (summary.totalSignals === 0) {
    return {
      score: 0,
      confidence: 'very_low',
      reasoning: 'No pain signals found. Insufficient data to assess pain.',
    }
  }

  // Start with average score
  let score = summary.averageScore

  // Calculate ratios
  const wtpRatio = summary.willingnessToPayCount / summary.totalSignals
  const highRatio = summary.highIntensityCount / summary.totalSignals
  const lowRatio = summary.lowIntensityCount / summary.totalSignals
  const solutionRatio = summary.solutionSeekingCount / summary.totalSignals

  // v2.0: Apply score adjustments based on signal quality distribution

  // Bonus: High concentration of WTP signals (>5% of posts)
  if (wtpRatio > 0.05) {
    score = Math.min(10, score + 1)
  }

  // Bonus: High pain concentration (>30% high intensity)
  if (highRatio > 0.3) {
    score = Math.min(10, score + 0.5)
  }

  // Bonus: Strong solution-seeking (>20% actively looking)
  if (solutionRatio > 0.2) {
    score = Math.min(10, score + 0.5)
  }

  // v2.0: Stronger penalty for low-quality signal distribution
  // If mostly low-intensity (>60%) and few high-intensity (<10%), reduce score
  if (lowRatio > 0.6 && highRatio < 0.1) {
    score = Math.max(0, score - 1.5)
  }

  // v2.0: Penalty if no high OR medium intensity signals
  if (summary.highIntensityCount === 0 && summary.mediumIntensityCount === 0) {
    score = Math.max(0, score * 0.5) // 50% reduction
  }

  // v2.0: Use quality-weighted confidence
  const qualityConfidence = getQualityWeightedConfidence(summary)

  // Generate reasoning
  const reasoningParts: string[] = []

  if (highRatio > 0.3) {
    reasoningParts.push(`Strong pain signals (${Math.round(highRatio * 100)}% high intensity)`)
  } else if (highRatio > 0.1) {
    reasoningParts.push(`Moderate pain signals (${Math.round(highRatio * 100)}% high intensity)`)
  } else if (summary.highIntensityCount === 0) {
    reasoningParts.push('No high-intensity pain signals detected')
  }

  if (wtpRatio > 0.05) {
    reasoningParts.push(`WTP signals in ${Math.round(wtpRatio * 100)}% of posts`)
  }

  if (solutionRatio > 0.2) {
    reasoningParts.push(`High solution-seeking (${Math.round(solutionRatio * 100)}%)`)
  }

  if (lowRatio > 0.6) {
    reasoningParts.push(`Mostly exploratory signals (${Math.round(lowRatio * 100)}% low intensity)`)
  }

  if (summary.strongestSignals.length > 0) {
    reasoningParts.push(`Top signals: "${summary.strongestSignals.slice(0, 3).join('", "')}"`)
  }

  // Add quality confidence info
  if (qualityConfidence.reasoning) {
    reasoningParts.push(`Confidence: ${qualityConfidence.reasoning}`)
  }

  return {
    score: Math.round(score * 10) / 10,
    confidence: qualityConfidence.confidence,
    reasoning: reasoningParts.join('. ') || 'Moderate pain signals detected.',
  }
}
