/**
 * Signal Clustering Module
 *
 * Groups signals by semantic similarity using cached embeddings.
 * NO NEW API CALLS - uses embeddings already cached from tiered filtering.
 *
 * ARCHITECTURE:
 * - Input: TieredScoredSignal[] (output from tiered filter)
 * - Process: Fetch cached embeddings → Build similarity matrix → Cluster
 * - Output: SignalCluster[] (grouped by semantic similarity)
 *
 * ALGORITHM: Simple agglomerative clustering
 * 1. Build pairwise similarity matrix using cosine similarity
 * 2. Iteratively merge most similar signals into clusters
 * 3. Stop when similarity drops below threshold
 *
 * COST: $0 - pure math on cached embeddings
 */

import { TieredScoredSignal, NormalizedPost, DataSource } from '@/lib/adapters/types'
import { generateEmbeddings, cosineSimilarity } from './embedding-service'

// =============================================================================
// TYPES
// =============================================================================

/**
 * A cluster of semantically similar signals
 */
export interface SignalCluster {
  /** Unique cluster identifier */
  id: string

  /** Signals in this cluster */
  signals: TieredScoredSignal[]

  /** Representative quotes (most central to cluster) */
  representativeQuotes: Array<{
    text: string
    source: DataSource
    subreddit?: string
    score: number
  }>

  /** Average internal similarity (cluster cohesion) */
  avgSimilarity: number

  /** Cluster size */
  size: number

  /** Source breakdown */
  sources: {
    appStore: number
    googlePlay: number
    reddit: number
    trustpilot: number
    other: number
  }

  /** Optional AI-generated label (set by labelClusters) */
  label?: string

  /** Centroid embedding (average of all signals) */
  centroid?: number[]
}

/**
 * Result from clustering operation
 */
export interface ClusteringResult {
  /** Formed clusters (sorted by size, descending) */
  clusters: SignalCluster[]

  /** Signals that didn't fit any cluster */
  unclustered: TieredScoredSignal[]

  /** Statistics */
  stats: ClusteringStats
}

/**
 * Clustering statistics
 */
export interface ClusteringStats {
  totalSignals: number
  clusteredSignals: number
  unclusteredSignals: number
  clusterCount: number
  avgClusterSize: number
  processingTimeMs: number
}

/**
 * Configuration for clustering
 */
export interface ClusteringConfig {
  /**
   * Minimum signals required to form a cluster.
   * Clusters smaller than this are dissolved.
   * Default: 3
   */
  minClusterSize?: number

  /**
   * Minimum cosine similarity to consider signals related.
   * Higher = tighter clusters, fewer signals per cluster.
   * Default: 0.70
   */
  similarityThreshold?: number

  /**
   * Maximum number of clusters to return.
   * Smallest clusters are merged into "unclustered" if exceeded.
   * Default: 10
   */
  maxClusters?: number

  /**
   * Number of representative quotes per cluster.
   * Default: 3
   */
  representativeQuoteCount?: number
}

// =============================================================================
// DEFAULTS
// =============================================================================

const DEFAULT_CONFIG: Required<ClusteringConfig> = {
  minClusterSize: 3,
  similarityThreshold: 0.70,
  maxClusters: 10,
  representativeQuoteCount: 3,
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Cluster signals by semantic similarity.
 *
 * Uses cached embeddings from the tiered filter step - no new API calls.
 * Signals must have already been processed by generateEmbeddings() during filtering.
 *
 * @param signals - TieredScoredSignal[] from tiered filter
 * @param config - Optional clustering configuration
 * @returns ClusteringResult with clusters and unclustered signals
 */
export async function clusterSignals(
  signals: TieredScoredSignal[],
  config?: ClusteringConfig
): Promise<ClusteringResult> {
  const startTime = Date.now()
  const opts = { ...DEFAULT_CONFIG, ...config }

  // Handle edge cases
  if (signals.length === 0) {
    return createEmptyResult(startTime)
  }

  if (signals.length < opts.minClusterSize) {
    return {
      clusters: [],
      unclustered: signals,
      stats: {
        totalSignals: signals.length,
        clusteredSignals: 0,
        unclusteredSignals: signals.length,
        clusterCount: 0,
        avgClusterSize: 0,
        processingTimeMs: Date.now() - startTime,
      },
    }
  }

  // Step 1: Get embeddings for all signals (from cache)
  const textsForEmbedding = signals.map(s => s.post.textForEmbedding)
  const embeddingResults = await generateEmbeddings(textsForEmbedding)

  // Map signal index to embedding
  const embeddings: Map<number, number[]> = new Map()
  for (let i = 0; i < embeddingResults.length; i++) {
    if (embeddingResults[i].embedding.length > 0) {
      embeddings.set(i, embeddingResults[i].embedding)
    }
  }

  // Step 2: Build similarity matrix (only for signals with valid embeddings)
  const validIndices = Array.from(embeddings.keys())
  const similarityMatrix = buildSimilarityMatrix(validIndices, embeddings)

  // Step 3: Cluster using agglomerative approach
  const clusterAssignments = agglomerativeClustering(
    validIndices,
    similarityMatrix,
    opts.similarityThreshold,
    opts.minClusterSize
  )

  // Step 4: Build cluster objects
  const clusterMap = new Map<number, TieredScoredSignal[]>()
  const unclustered: TieredScoredSignal[] = []

  for (let i = 0; i < signals.length; i++) {
    const clusterId = clusterAssignments.get(i)
    if (clusterId === undefined || clusterId === -1) {
      unclustered.push(signals[i])
    } else {
      const existing = clusterMap.get(clusterId) || []
      existing.push(signals[i])
      clusterMap.set(clusterId, existing)
    }
  }

  // Step 5: Convert to SignalCluster objects
  let clusters: SignalCluster[] = []
  let clusterIdCounter = 0

  for (const [, clusterSignals] of clusterMap) {
    if (clusterSignals.length >= opts.minClusterSize) {
      const cluster = buildCluster(
        `cluster_${clusterIdCounter++}`,
        clusterSignals,
        embeddings,
        signals,
        opts.representativeQuoteCount
      )
      clusters.push(cluster)
    } else {
      // Too small, add to unclustered
      unclustered.push(...clusterSignals)
    }
  }

  // Step 6: Sort by size and limit
  clusters.sort((a, b) => b.size - a.size)
  if (clusters.length > opts.maxClusters) {
    // Move excess clusters to unclustered
    const excess = clusters.slice(opts.maxClusters)
    for (const c of excess) {
      unclustered.push(...c.signals)
    }
    clusters = clusters.slice(0, opts.maxClusters)
  }

  // Calculate stats
  const clusteredCount = clusters.reduce((sum, c) => sum + c.size, 0)
  const processingTimeMs = Date.now() - startTime

  return {
    clusters,
    unclustered,
    stats: {
      totalSignals: signals.length,
      clusteredSignals: clusteredCount,
      unclusteredSignals: unclustered.length,
      clusterCount: clusters.length,
      avgClusterSize: clusters.length > 0 ? clusteredCount / clusters.length : 0,
      processingTimeMs,
    },
  }
}

// =============================================================================
// CLUSTERING ALGORITHM
// =============================================================================

/**
 * Build pairwise similarity matrix for given indices.
 */
function buildSimilarityMatrix(
  indices: number[],
  embeddings: Map<number, number[]>
): Map<string, number> {
  const matrix = new Map<string, number>()

  for (let i = 0; i < indices.length; i++) {
    for (let j = i + 1; j < indices.length; j++) {
      const idx1 = indices[i]
      const idx2 = indices[j]
      const emb1 = embeddings.get(idx1)
      const emb2 = embeddings.get(idx2)

      if (emb1 && emb2) {
        const similarity = cosineSimilarity(emb1, emb2)
        const key = `${idx1}-${idx2}`
        matrix.set(key, similarity)
      }
    }
  }

  return matrix
}

/**
 * Get similarity between two signal indices from pre-computed matrix.
 */
function getSimilarity(
  matrix: Map<string, number>,
  idx1: number,
  idx2: number
): number {
  if (idx1 === idx2) return 1.0
  const key = idx1 < idx2 ? `${idx1}-${idx2}` : `${idx2}-${idx1}`
  return matrix.get(key) ?? 0
}

/**
 * Simple agglomerative clustering.
 *
 * Algorithm:
 * 1. Start with each signal as its own cluster
 * 2. Find the two most similar clusters
 * 3. Merge if similarity >= threshold
 * 4. Repeat until no more merges possible
 *
 * Returns: Map<signalIndex, clusterId> (-1 = unclustered)
 */
function agglomerativeClustering(
  indices: number[],
  similarityMatrix: Map<string, number>,
  threshold: number,
  minSize: number
): Map<number, number> {
  // Initialize: each index is its own cluster
  const clusterOf = new Map<number, number>()
  const clusters = new Map<number, Set<number>>()

  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i]
    clusterOf.set(idx, idx) // Use index as initial cluster ID
    clusters.set(idx, new Set([idx]))
  }

  // Find pairs above threshold and sort by similarity (descending)
  const pairs: Array<{ idx1: number; idx2: number; sim: number }> = []
  for (let i = 0; i < indices.length; i++) {
    for (let j = i + 1; j < indices.length; j++) {
      const sim = getSimilarity(similarityMatrix, indices[i], indices[j])
      if (sim >= threshold) {
        pairs.push({ idx1: indices[i], idx2: indices[j], sim })
      }
    }
  }
  pairs.sort((a, b) => b.sim - a.sim)

  // Merge clusters greedily
  for (const { idx1, idx2 } of pairs) {
    const c1 = clusterOf.get(idx1)!
    const c2 = clusterOf.get(idx2)!

    if (c1 === c2) continue // Already in same cluster

    const cluster1 = clusters.get(c1)!
    const cluster2 = clusters.get(c2)!

    // Check if merge maintains cohesion (average similarity to merged cluster)
    const merged = new Set([...cluster1, ...cluster2])
    const avgSim = calculateClusterCohesion(merged, similarityMatrix)

    if (avgSim >= threshold * 0.9) {
      // Allow slight drop from threshold
      // Merge cluster2 into cluster1
      for (const idx of cluster2) {
        cluster1.add(idx)
        clusterOf.set(idx, c1)
      }
      clusters.delete(c2)
    }
  }

  // Assign final cluster IDs
  const finalClusters = new Map<number, number>()
  let nextId = 0
  const clusterIdMap = new Map<number, number>()

  for (const idx of indices) {
    const clusterId = clusterOf.get(idx)!
    const cluster = clusters.get(clusterId)

    if (cluster && cluster.size >= minSize) {
      if (!clusterIdMap.has(clusterId)) {
        clusterIdMap.set(clusterId, nextId++)
      }
      finalClusters.set(idx, clusterIdMap.get(clusterId)!)
    } else {
      finalClusters.set(idx, -1) // Unclustered
    }
  }

  return finalClusters
}

/**
 * Calculate average pairwise similarity within a cluster.
 */
function calculateClusterCohesion(
  members: Set<number>,
  similarityMatrix: Map<string, number>
): number {
  const memberArray = Array.from(members)
  if (memberArray.length < 2) return 1.0

  let totalSim = 0
  let count = 0

  for (let i = 0; i < memberArray.length; i++) {
    for (let j = i + 1; j < memberArray.length; j++) {
      totalSim += getSimilarity(similarityMatrix, memberArray[i], memberArray[j])
      count++
    }
  }

  return count > 0 ? totalSim / count : 0
}

// =============================================================================
// CLUSTER BUILDING
// =============================================================================

/**
 * Build a SignalCluster object from signals.
 */
function buildCluster(
  id: string,
  signals: TieredScoredSignal[],
  embeddings: Map<number, number[]>,
  allSignals: TieredScoredSignal[],
  quoteCount: number
): SignalCluster {
  // Count sources
  const sources = {
    appStore: 0,
    googlePlay: 0,
    reddit: 0,
    trustpilot: 0,
    other: 0,
  }

  for (const s of signals) {
    switch (s.post.source) {
      case 'appstore':
        sources.appStore++
        break
      case 'playstore':
        sources.googlePlay++
        break
      case 'reddit':
        sources.reddit++
        break
      case 'trustpilot':
        sources.trustpilot++
        break
      default:
        sources.other++
    }
  }

  // Calculate centroid (average embedding)
  const centroid = calculateCentroid(signals, embeddings, allSignals)

  // Calculate average internal similarity
  const avgSimilarity = calculateAverageSimilarity(signals, embeddings, allSignals)

  // Select representative quotes (highest score signals)
  const sortedByScore = [...signals].sort((a, b) => b.score - a.score)
  const representativeQuotes = sortedByScore.slice(0, quoteCount).map(s => ({
    text: truncateText(s.post.body || s.post.title, 200),
    source: s.post.source,
    subreddit: s.post.metadata?.subreddit,
    score: s.score,
  }))

  return {
    id,
    signals,
    representativeQuotes,
    avgSimilarity,
    size: signals.length,
    sources,
    centroid,
  }
}

/**
 * Calculate centroid embedding for a cluster.
 */
function calculateCentroid(
  signals: TieredScoredSignal[],
  embeddings: Map<number, number[]>,
  allSignals: TieredScoredSignal[]
): number[] | undefined {
  const clusterEmbeddings: number[][] = []

  for (const signal of signals) {
    const idx = allSignals.indexOf(signal)
    const emb = embeddings.get(idx)
    if (emb) {
      clusterEmbeddings.push(emb)
    }
  }

  if (clusterEmbeddings.length === 0) return undefined
  if (clusterEmbeddings.length === 1) return clusterEmbeddings[0]

  // Average all embeddings
  const dim = clusterEmbeddings[0].length
  const centroid = new Array(dim).fill(0)

  for (const emb of clusterEmbeddings) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += emb[i]
    }
  }

  for (let i = 0; i < dim; i++) {
    centroid[i] /= clusterEmbeddings.length
  }

  return centroid
}

/**
 * Calculate average pairwise similarity within a cluster.
 */
function calculateAverageSimilarity(
  signals: TieredScoredSignal[],
  embeddings: Map<number, number[]>,
  allSignals: TieredScoredSignal[]
): number {
  if (signals.length < 2) return 1.0

  let totalSim = 0
  let count = 0

  for (let i = 0; i < signals.length; i++) {
    for (let j = i + 1; j < signals.length; j++) {
      const idx1 = allSignals.indexOf(signals[i])
      const idx2 = allSignals.indexOf(signals[j])
      const emb1 = embeddings.get(idx1)
      const emb2 = embeddings.get(idx2)

      if (emb1 && emb2) {
        totalSim += cosineSimilarity(emb1, emb2)
        count++
      }
    }
  }

  return count > 0 ? totalSim / count : 0
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Create empty result for edge cases.
 */
function createEmptyResult(startTime: number): ClusteringResult {
  return {
    clusters: [],
    unclustered: [],
    stats: {
      totalSignals: 0,
      clusteredSignals: 0,
      unclusteredSignals: 0,
      clusterCount: 0,
      avgClusterSize: 0,
      processingTimeMs: Date.now() - startTime,
    },
  }
}

/**
 * Truncate text to a maximum length.
 */
function truncateText(text: string, maxLength: number): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

// =============================================================================
// HELPER FUNCTIONS FOR CONSUMERS
// =============================================================================

/**
 * Get a summary string for a cluster (for debugging/logging).
 */
export function getClusterSummary(cluster: SignalCluster): string {
  // Defensive guards for potentially malformed clusters
  const sources = cluster.sources ?? {}
  const sourcesList = []
  if ((sources.appStore ?? 0) > 0) sourcesList.push(`${sources.appStore} App Store`)
  if ((sources.googlePlay ?? 0) > 0) sourcesList.push(`${sources.googlePlay} Google Play`)
  if ((sources.reddit ?? 0) > 0) sourcesList.push(`${sources.reddit} Reddit`)
  if ((sources.trustpilot ?? 0) > 0) sourcesList.push(`${sources.trustpilot} Trustpilot`)
  if ((sources.other ?? 0) > 0) sourcesList.push(`${sources.other} other`)

  const avgSimilarity = Number.isFinite(cluster.avgSimilarity) ? cluster.avgSimilarity : 0
  return `${cluster.label || cluster.id}: ${cluster.size ?? 0} signals (${sourcesList.join(', ') || 'unknown'}), cohesion: ${avgSimilarity.toFixed(2)}`
}

/**
 * Format clusters for Claude prompt.
 * Returns a structured text representation for AI synthesis.
 */
export function formatClustersForPrompt(clusters: SignalCluster[]): string {
  if (clusters.length === 0) {
    return 'No clusters formed - signals were too dissimilar to group.'
  }

  const lines: string[] = []

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i]
    // Defensive guards for potentially malformed clusters (App Gap mode)
    const sources = cluster.sources ?? {}
    const sourcesList = []
    if ((sources.appStore ?? 0) > 0) sourcesList.push(`${sources.appStore} App Store`)
    if ((sources.googlePlay ?? 0) > 0) sourcesList.push(`${sources.googlePlay} Google Play`)
    if ((sources.reddit ?? 0) > 0) sourcesList.push(`${sources.reddit} Reddit`)
    if ((sources.trustpilot ?? 0) > 0) sourcesList.push(`${sources.trustpilot} Trustpilot`)

    const avgSimilarity = Number.isFinite(cluster.avgSimilarity) ? cluster.avgSimilarity : 0
    const representativeQuotes = Array.isArray(cluster.representativeQuotes)
      ? cluster.representativeQuotes
      : []

    lines.push(`CLUSTER ${i + 1}${cluster.label ? `: "${cluster.label}"` : ''} (${cluster.size ?? 0} signals)`)
    lines.push(`├─ Sources: ${sourcesList.join(', ') || 'unknown'}`)
    lines.push(`├─ Cohesion: ${avgSimilarity.toFixed(2)} (${avgSimilarity >= 0.8 ? 'very tight' : avgSimilarity >= 0.7 ? 'tight' : 'moderate'})`)
    lines.push(`└─ Representative quotes:`)

    for (const quote of representativeQuotes) {
      const sourceLabel = quote.subreddit ? `r/${quote.subreddit}` : quote.source
      lines.push(`   • "${quote.text}" [${sourceLabel}]`)
    }

    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Merge small clusters into existing larger ones or unclustered.
 * Useful for post-processing when many small clusters form.
 */
export function consolidateClusters(
  result: ClusteringResult,
  minSize: number = 5
): ClusteringResult {
  const largeClusters: SignalCluster[] = []
  const smallClusterSignals: TieredScoredSignal[] = []

  for (const cluster of result.clusters) {
    if (cluster.size >= minSize) {
      largeClusters.push(cluster)
    } else {
      smallClusterSignals.push(...cluster.signals)
    }
  }

  return {
    clusters: largeClusters,
    unclustered: [...result.unclustered, ...smallClusterSignals],
    stats: {
      ...result.stats,
      clusterCount: largeClusters.length,
      clusteredSignals: largeClusters.reduce((sum, c) => sum + c.size, 0),
      unclusteredSignals: result.unclustered.length + smallClusterSignals.length,
    },
  }
}
