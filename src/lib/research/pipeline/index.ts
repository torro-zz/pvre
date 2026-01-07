/**
 * Research Pipeline - Modular research execution
 *
 * This module provides:
 * - ResearchContext: Typed context for pipeline execution
 * - Mode helpers: isAppGapMode(), isHypothesisMode()
 * - Context creation: createContext()
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
