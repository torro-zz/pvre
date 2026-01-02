export {
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
  classifySimilarity,
  classifySimilarityWithThreshold,
  compareSimilarities,
  filterBySimilarity,
  generateMultiFacetEmbeddings,
  maxSimilarityAcrossFacets,
  filterByMultiFacetSimilarity,
  isEmbeddingServiceAvailable,
  SIMILARITY_THRESHOLDS,
  // Coverage boost for thin-data hypotheses (Dec 2025)
  COVERAGE_BOOST_CONFIG,
  generateHypothesisKeywords,
  calculateKeywordBoost,
  calculateBoostedSimilarity,
  // Problem-focused embedding functions
  extractProblemFocus,
  passesKeywordGate,
  applyKeywordGate,
  generateProblemFocusedEmbeddings,
  type EmbeddingResult,
  type SimilarityResult,
  type SimilarityTier,
  type ProblemFocus,
} from './embedding-service'

// Signal clustering (Jan 2026)
export {
  clusterSignals,
  getClusterSummary,
  formatClustersForPrompt,
  consolidateClusters,
  type SignalCluster,
  type ClusteringResult,
  type ClusteringStats,
  type ClusteringConfig,
} from './clustering'
