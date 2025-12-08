'use client'

import { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Loader2, Search, Lightbulb, ChevronDown, ChevronUp, Ban, Sparkles, X, Check, HelpCircle } from 'lucide-react'
import { CoveragePreview, CoverageData } from './coverage-preview'
import { StructuredHypothesis, formatHypothesis } from '@/types/research'

interface ExclusionSuggestion {
  term: string
  reason: string
}

interface HypothesisFormProps {
  onSubmit: (hypothesis: string, coverageData?: CoverageData, structuredHypothesis?: StructuredHypothesis) => Promise<void>
  isLoading: boolean
  showCoveragePreview?: boolean
}

// Structured examples that model good problem articulation
const EXAMPLE_HYPOTHESES: StructuredHypothesis[] = [
  {
    audience: 'Solo athletes preparing for Hyrox races',
    problem: 'struggle to stay motivated training alone and can\'t push hard enough',
    problemLanguage: 'no one to train with, hate training alone, can\'t push myself',
    solution: 'Training partner matching app',
  },
  {
    audience: 'Busy parents with picky eaters',
    problem: 'waste hours figuring out what to cook because kids reject everything',
    problemLanguage: 'kids won\'t eat anything, dinner is a nightmare, picky eater driving me crazy',
    solution: 'Meal planning app',
  },
  {
    audience: 'Remote designers on distributed teams',
    problem: 'feel disconnected and miss spontaneous collaboration',
    problemLanguage: 'feel isolated, miss office whiteboard sessions, async kills creativity',
  },
  {
    audience: 'Millennials with student debt',
    problem: 'feel overwhelmed managing finances and don\'t know where to start',
    problemLanguage: 'drowning in debt, no idea how to budget, money stress keeps me up',
  },
]

export function HypothesisForm({ onSubmit, isLoading, showCoveragePreview = true }: HypothesisFormProps) {
  // Structured input fields
  const [audience, setAudience] = useState('')
  const [problem, setProblem] = useState('')
  const [problemLanguage, setProblemLanguage] = useState('')
  const [solution, setSolution] = useState('')
  const [excludeTopics, setExcludeTopics] = useState('')
  const [showSolution, setShowSolution] = useState(false)
  const [showExclude, setShowExclude] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // AI exclusion suggestions
  const [exclusionSuggestions, setExclusionSuggestions] = useState<ExclusionSuggestion[]>([])
  const [selectedExclusions, setSelectedExclusions] = useState<Set<string>>(new Set())
  const [isSuggestingExclusions, setIsSuggestingExclusions] = useState(false)
  const [suggestionError, setSuggestionError] = useState<string | null>(null)
  const lastSuggestionInput = useRef<string>('')

  // Build the structured hypothesis
  const structuredHypothesis: StructuredHypothesis = {
    audience: audience.trim(),
    problem: problem.trim(),
    problemLanguage: problemLanguage.trim() || undefined,
    solution: solution.trim() || undefined,
    excludeTopics: excludeTopics.trim() || undefined,
  }

  // Generate display string for backwards compatibility
  const hypothesisString = formatHypothesis(structuredHypothesis)

  // Check if form is valid (required fields filled)
  const isValid = audience.trim() && problem.trim()

  // Check if we can suggest exclusions (audience ≥3 chars, problem ≥10 chars)
  const canSuggestExclusions = audience.trim().length >= 3 && problem.trim().length >= 10

  // Fetch AI exclusion suggestions
  const fetchExclusionSuggestions = useCallback(async () => {
    // Skip if user already typed exclusions
    if (excludeTopics.trim()) return

    // Skip if we already fetched for this exact input
    const inputHash = `${audience.trim()}|${problem.trim()}|${problemLanguage.trim()}`
    if (inputHash === lastSuggestionInput.current) return

    if (!canSuggestExclusions) return

    setIsSuggestingExclusions(true)
    setSuggestionError(null)

    try {
      const response = await fetch('/api/research/suggest-exclusions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audience: audience.trim(),
          problem: problem.trim(),
          problemLanguage: problemLanguage.trim() || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get suggestions')
      }

      const data = await response.json()
      lastSuggestionInput.current = inputHash
      setExclusionSuggestions(data.suggestions || [])
      setSelectedExclusions(new Set()) // Reset selections for new suggestions
    } catch (error) {
      console.error('Exclusion suggestion error:', error)
      setSuggestionError('Could not load suggestions')
    } finally {
      setIsSuggestingExclusions(false)
    }
  }, [audience, problem, problemLanguage, excludeTopics, canSuggestExclusions])

  // Toggle a suggestion on/off
  const toggleExclusion = (term: string) => {
    setSelectedExclusions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(term)) {
        newSet.delete(term)
      } else {
        newSet.add(term)
      }
      return newSet
    })
  }

  // Apply selected exclusions to the input field
  const applySelectedExclusions = () => {
    if (selectedExclusions.size === 0) return

    const existing = excludeTopics.trim()
    const existingTerms = existing ? existing.split(',').map(t => t.trim().toLowerCase()) : []
    const newTerms = Array.from(selectedExclusions).filter(
      term => !existingTerms.includes(term.toLowerCase())
    )

    if (newTerms.length === 0) return

    const combined = existing
      ? `${existing}, ${newTerms.join(', ')}`
      : newTerms.join(', ')

    setExcludeTopics(combined)
    setSelectedExclusions(new Set())
    handleFieldChange()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || isLoading) return

    // If coverage preview is enabled and not yet shown, show it first
    if (showCoveragePreview && !showPreview) {
      setShowPreview(true)
      return
    }

    // If coverage preview is shown, don't submit from the form - let handleProceed handle it
    if (showCoveragePreview && showPreview) {
      return
    }

    await onSubmit(hypothesisString, undefined, structuredHypothesis)
  }

  const handleExampleClick = (example: StructuredHypothesis) => {
    setAudience(example.audience)
    setProblem(example.problem)
    setProblemLanguage(example.problemLanguage || '')
    setSolution(example.solution || '')
    setShowSolution(!!example.solution)
    setShowPreview(false) // Reset preview when example changes
  }

  const handleFieldChange = () => {
    // Reset preview if any field changes
    if (showPreview) {
      setShowPreview(false)
    }
  }

  const handleProceed = async (coverageData: CoverageData) => {
    await onSubmit(hypothesisString, coverageData, structuredHypothesis)
  }

  const handleRefine = () => {
    setShowPreview(false)
    // Focus on the first field
    const input = document.getElementById('audience')
    input?.focus()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Community Voice Mining
        </CardTitle>
        <CardDescription>
          Tell us about the problem you want to validate. We&apos;ll search Reddit
          for people expressing this pain.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1: Audience */}
          <div className="space-y-2">
            <Label htmlFor="audience" className="flex items-center gap-1">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-medium">1</span>
              Who&apos;s struggling?
            </Label>
            <Input
              id="audience"
              placeholder="e.g., Solo athletes preparing for Hyrox races"
              value={audience}
              onChange={(e) => {
                setAudience(e.target.value)
                handleFieldChange()
              }}
              disabled={isLoading}
              className="w-full"
            />
          </div>

          {/* Step 2: Problem */}
          <div className="space-y-2">
            <Label htmlFor="problem" className="flex items-center gap-1">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-medium">2</span>
              What&apos;s their problem?
            </Label>
            <Textarea
              id="problem"
              placeholder="e.g., Training alone kills motivation, can't push hard enough, poor race performance"
              value={problem}
              onChange={(e) => {
                setProblem(e.target.value)
                handleFieldChange()
              }}
              disabled={isLoading}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Step 3: Problem Language (optional but important) */}
          <div className="space-y-2">
            <Label htmlFor="problemLanguage" className="flex items-center gap-1">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground text-xs font-medium">3</span>
              How do THEY describe it?
              <span className="text-xs text-muted-foreground ml-1">(optional)</span>
            </Label>
            <Textarea
              id="problemLanguage"
              placeholder="e.g., no one to train with, hate training alone, can't push myself"
              value={problemLanguage}
              onChange={(e) => {
                setProblemLanguage(e.target.value)
                handleFieldChange()
              }}
              disabled={isLoading}
              rows={2}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Think: what would they type into Reddit? This dramatically improves search quality.
            </p>
          </div>

          {/* Optional Sections (collapsible) */}
          <div className="space-y-3 pt-2 border-t">
            {/* Solution (collapsible) */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowSolution(!showSolution)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showSolution ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Your solution idea
                <span className="text-xs ml-1">(optional)</span>
              </button>
              {showSolution && (
                <Input
                  id="solution"
                  placeholder="e.g., Training partner matching app"
                  value={solution}
                  onChange={(e) => {
                    setSolution(e.target.value)
                    handleFieldChange()
                  }}
                  disabled={isLoading}
                  className="w-full"
                />
              )}
            </div>

            {/* Exclude Topics (collapsible) */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowExclude(!showExclude)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showExclude ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <Ban className="h-3.5 w-3.5" />
                Exclude irrelevant topics
                <span className="text-xs ml-1">(optional)</span>
              </button>
              {showExclude && (
                <div className="space-y-3">
                  {/* AI Suggestion Button */}
                  {canSuggestExclusions && !excludeTopics.trim() && exclusionSuggestions.length === 0 && (
                    <button
                      type="button"
                      onClick={fetchExclusionSuggestions}
                      disabled={isSuggestingExclusions || isLoading}
                      className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 transition-all disabled:opacity-50 animate-pulse-subtle"
                    >
                      {isSuggestingExclusions ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Analyzing for ambiguous terms...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Suggest exclusions based on your hypothesis
                        </>
                      )}
                    </button>
                  )}

                  {/* Suggestion Error */}
                  {suggestionError && (
                    <p className="text-xs text-destructive">{suggestionError}</p>
                  )}

                  {/* AI Suggestions Display */}
                  {exclusionSuggestions.length > 0 && (
                    <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          AI detected ambiguous terms. Click to exclude:
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setExclusionSuggestions([])
                            setSelectedExclusions(new Set())
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {exclusionSuggestions.map((suggestion, idx) => {
                          const isSelected = selectedExclusions.has(suggestion.term)
                          return (
                            <div key={idx} className="relative group inline-flex">
                              <button
                                type="button"
                                onClick={() => toggleExclusion(suggestion.term)}
                                className={`text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1 ${
                                  isSelected
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background hover:bg-muted border-border'
                                }`}
                              >
                                {isSelected && <Check className="h-3 w-3" />}
                                {suggestion.term}
                                <HelpCircle className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                              </button>
                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-normal z-50 max-w-[200px] text-center">
                                {suggestion.reason}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-900" />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {selectedExclusions.size > 0 && (
                        <button
                          type="button"
                          onClick={applySelectedExclusions}
                          className="text-xs text-primary hover:text-primary/80 font-medium"
                        >
                          Add {selectedExclusions.size} exclusion{selectedExclusions.size > 1 ? 's' : ''} to filter
                        </button>
                      )}
                    </div>
                  )}

                  <Input
                    id="excludeTopics"
                    placeholder="e.g., corporate training, dog training, machine learning"
                    value={excludeTopics}
                    onChange={(e) => {
                      setExcludeTopics(e.target.value)
                      handleFieldChange()
                    }}
                    disabled={isLoading}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated topics to filter out. Useful for ambiguous terms like &quot;training&quot;.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Examples */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lightbulb className="h-4 w-4" />
              <span>Try an example:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_HYPOTHESES.map((example, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleExampleClick(example)}
                  disabled={isLoading}
                  className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
                >
                  {example.audience.split(' ').slice(0, 3).join(' ')}...
                </button>
              ))}
            </div>
          </div>

          {/* Coverage Preview */}
          {showCoveragePreview && showPreview && (
            <CoveragePreview
              hypothesis={hypothesisString}
              structuredHypothesis={structuredHypothesis}
              onProceed={handleProceed}
              onRefine={handleRefine}
              disabled={isLoading}
            />
          )}

          {/* Submit Button - shows "Check Coverage" first, then hidden when preview is shown */}
          {(!showCoveragePreview || !showPreview) && (
            <Button
              type="submit"
              disabled={!isValid || isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing Communities...
                </>
              ) : showCoveragePreview ? (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Check Data Availability (Free)
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Run Research
                </>
              )}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
