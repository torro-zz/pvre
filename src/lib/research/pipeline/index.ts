/**
 * Research Pipeline - Modular research execution
 *
 * This module provides:
 * - ResearchContext: Typed context for pipeline execution
 * - Mode helpers: isAppGapMode(), isHypothesisMode()
 * - Context creation: createContext()
 * - PipelineStep: Interface for composable steps
 * - Orchestrator: runResearchPipeline() for executing the full pipeline
 *
 * See: docs/REFACTORING_PLAN.md
 */

export {
  // Types
  type ResearchMode,
  type ResearchConfig,
  type ResearchState,
  type ResearchContext,

  // Mode detection
  isAppGapMode,
  isHypothesisMode,
  getAppData,
  detectModeFromCoverageData,
  detectModeFromAppData,

  // Context creation
  DEFAULT_CONFIG,
  createInitialState,
  createContext,

  // Context mutations
  setCrossStoreAppData,
  setStage,
  setError,
  setSubreddits,
  setKeywords,
} from './context'

export {
  // Pipeline step types
  type PipelineStep,
  type StepResult,
  type KeywordExtractionInput,
  type KeywordExtractionOutput,
  type SubredditDiscoveryInput,
  type SubredditDiscoveryOutput,
  type DataFetchInput,
  type DataFetchOutput,

  // Step execution helper
  executeStep,
} from './types'

export {
  // Orchestrator
  runResearchPipeline,
  logStepTimings,
  type PipelineAccumulator,
} from './orchestrator'
