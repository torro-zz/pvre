'use client'

import { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, ArrowRight, ArrowLeft, Check, Edit2, Users, AlertTriangle, Lightbulb, MessageSquare, X, Plus } from 'lucide-react'
import { CoveragePreview, CoverageData } from './coverage-preview'
import { StructuredHypothesis, formatHypothesis } from '@/types/research'
import { HypothesisInterpretation, RefinementSuggestion, InterpretHypothesisResponse } from '@/app/api/research/interpret-hypothesis/route'

type Step = 'input' | 'confirm' | 'adjust'

interface ConversationalInputProps {
  onSubmit: (hypothesis: string, coverageData?: CoverageData, structuredHypothesis?: StructuredHypothesis) => Promise<void>
  isLoading: boolean
  showCoveragePreview?: boolean
}

const EXAMPLE_INPUTS = [
  "Gym-goers who want to make friends but feel awkward approaching strangers",
  "Parents overwhelmed by nightly meal planning decisions",
  "Remote workers feeling isolated without office interactions",
  "New freelancers struggling to land their first paying clients",
  "9-to-5 employees stuck dreaming about starting a side business",
]

export function ConversationalInput({ onSubmit, isLoading, showCoveragePreview = true }: ConversationalInputProps) {
  // Step state
  const [step, setStep] = useState<Step>('input')

  // Input state
  const [rawInput, setRawInput] = useState('')

  // Interpretation state
  const [interpretation, setInterpretation] = useState<HypothesisInterpretation | null>(null)
  const [refinements, setRefinements] = useState<RefinementSuggestion[]>([])
  const [formattedHypothesis, setFormattedHypothesis] = useState('')
  const [isInterpreting, setIsInterpreting] = useState(false)
  const [interpretError, setInterpretError] = useState<string | null>(null)

  // Adjusted fields state (for step 3)
  const [adjustedAudience, setAdjustedAudience] = useState('')
  const [adjustedProblem, setAdjustedProblem] = useState('')
  const [adjustedPhrases, setAdjustedPhrases] = useState<string[]>([])
  const [newPhrase, setNewPhrase] = useState('')

  // Confirm step phrase editing
  const [confirmNewPhrase, setConfirmNewPhrase] = useState('')
  const [showAddPhrase, setShowAddPhrase] = useState(false)
  const addPhraseInputRef = useRef<HTMLInputElement>(null)

  // Coverage preview state
  const [showPreview, setShowPreview] = useState(false)

  // Build structured hypothesis from current state
  const getStructuredHypothesis = useCallback((): StructuredHypothesis => {
    if (step === 'adjust') {
      return {
        audience: adjustedAudience.trim(),
        problem: adjustedProblem.trim(),
        problemLanguage: adjustedPhrases.join(', '),
      }
    }
    if (interpretation) {
      return {
        audience: interpretation.audience,
        problem: interpretation.problem,
        problemLanguage: interpretation.searchPhrases.join(', '),
      }
    }
    return { audience: '', problem: '' }
  }, [step, interpretation, adjustedAudience, adjustedProblem, adjustedPhrases])

  const getHypothesisString = useCallback((): string => {
    const structured = getStructuredHypothesis()
    return formatHypothesis(structured)
  }, [getStructuredHypothesis])

  // Step 1: Interpret the raw input
  const handleInterpret = async () => {
    if (!rawInput.trim() || rawInput.trim().length < 10) return

    setIsInterpreting(true)
    setInterpretError(null)

    try {
      const response = await fetch('/api/research/interpret-hypothesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput: rawInput.trim() }),
      })

      if (!response.ok) {
        let errorMessage = 'Failed to interpret'
        try {
          const err = await response.json()
          errorMessage = err.error || errorMessage
        } catch {
          // Response wasn't JSON (e.g., HTML error page)
          errorMessage = `Server error (${response.status}). Please try again.`
        }
        throw new Error(errorMessage)
      }

      const data: InterpretHypothesisResponse = await response.json()

      setInterpretation(data.interpretation)
      setRefinements(data.refinementSuggestions || [])
      setFormattedHypothesis(data.formattedHypothesis)

      // Pre-populate adjust fields
      setAdjustedAudience(data.interpretation.audience)
      setAdjustedProblem(data.interpretation.problem)
      setAdjustedPhrases([...data.interpretation.searchPhrases])

      setStep('confirm')
    } catch (err) {
      setInterpretError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsInterpreting(false)
    }
  }

  // Step 2: Confirm and proceed
  const handleConfirm = () => {
    if (showCoveragePreview) {
      setShowPreview(true)
    } else {
      handleFinalSubmit()
    }
  }

  // Step 2: Go to adjust mode
  const handleAdjust = () => {
    setStep('adjust')
    setShowPreview(false)
  }

  // Apply a refinement suggestion and proceed to search
  const applyRefinement = (suggestion: RefinementSuggestion) => {
    if (!interpretation) return

    let newAudience = interpretation.audience
    let newProblem = interpretation.problem

    if (suggestion.type === 'audience') {
      newAudience = suggestion.suggestion
    } else if (suggestion.type === 'problem') {
      newProblem = suggestion.suggestion
    } else if (suggestion.type === 'angle') {
      // For angle suggestions, use it as the new problem framing
      newProblem = suggestion.suggestion
    }

    // Update interpretation
    setInterpretation({
      ...interpretation,
      audience: newAudience,
      problem: newProblem,
    })

    // Update adjusted fields to stay in sync
    setAdjustedAudience(newAudience)
    setAdjustedProblem(newProblem)

    // Automatically proceed to coverage check
    if (showCoveragePreview) {
      setShowPreview(true)
    }
  }

  // Step 3: Add a search phrase
  const addPhrase = () => {
    if (newPhrase.trim() && !adjustedPhrases.includes(newPhrase.trim())) {
      setAdjustedPhrases([...adjustedPhrases, newPhrase.trim()])
      setNewPhrase('')
    }
  }

  // Step 3: Remove a search phrase
  const removePhrase = (phrase: string) => {
    setAdjustedPhrases(adjustedPhrases.filter(p => p !== phrase))
  }

  // Confirm step: Remove a phrase directly from interpretation
  const removePhraseFromInterpretation = (phrase: string) => {
    if (interpretation) {
      setInterpretation({
        ...interpretation,
        searchPhrases: interpretation.searchPhrases.filter(p => p !== phrase),
      })
      // Also update adjusted phrases to stay in sync
      setAdjustedPhrases(prev => prev.filter(p => p !== phrase))
    }
  }

  // Confirm step: Add a phrase directly to interpretation
  const addPhraseToInterpretation = () => {
    if (confirmNewPhrase.trim() && interpretation) {
      const newPhraseClean = confirmNewPhrase.trim()
      if (!interpretation.searchPhrases.includes(newPhraseClean)) {
        setInterpretation({
          ...interpretation,
          searchPhrases: [...interpretation.searchPhrases, newPhraseClean],
        })
        // Also update adjusted phrases to stay in sync
        setAdjustedPhrases(prev => [...prev, newPhraseClean])
      }
      setConfirmNewPhrase('')
      setShowAddPhrase(false)
    }
  }

  // Step 3: Confirm adjustments
  const handleConfirmAdjustments = () => {
    // Update interpretation with adjusted values
    if (interpretation) {
      setInterpretation({
        ...interpretation,
        audience: adjustedAudience,
        problem: adjustedProblem,
        searchPhrases: adjustedPhrases,
      })
    }
    setStep('confirm')
  }

  // Final submit
  const handleFinalSubmit = async (coverageData?: CoverageData) => {
    const structured = getStructuredHypothesis()
    const hypothesisStr = getHypothesisString()
    await onSubmit(hypothesisStr, coverageData, structured)
  }

  // Go back to input
  const handleBack = () => {
    setStep('input')
    setShowPreview(false)
  }

  // Use example
  const useExample = (example: string) => {
    setRawInput(example)
  }

  // Check if form is valid
  const isInputValid = rawInput.trim().length >= 10
  const isAdjustValid = adjustedAudience.trim() && adjustedProblem.trim()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-500" />
          Who&apos;s frustrated?
        </CardTitle>
        <CardDescription>
          Describe who&apos;s struggling and what&apos;s causing their pain. Focus on the problem, not your solution.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Step 1: Free-form Input */}
        {step === 'input' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Textarea
                placeholder="e.g., Gym-goers who want to make friends but feel awkward approaching strangers"
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                disabled={isInterpreting || isLoading}
                rows={3}
                className="resize-none text-base"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Describe who&apos;s struggling and what problem they face. The more specific, the better results.
              </p>
            </div>

            {/* Error message */}
            {interpretError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {interpretError}
              </div>
            )}

            {/* Examples */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lightbulb className="h-4 w-4" />
                <span>Try an example:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_INPUTS.slice(0, 4).map((example, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => useExample(example)}
                    disabled={isInterpreting || isLoading}
                    className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 text-left"
                  >
                    {example.split(' ').slice(0, 5).join(' ')}...
                  </button>
                ))}
              </div>
            </div>

            {/* Continue button */}
            <Button
              onClick={handleInterpret}
              disabled={!isInputValid || isInterpreting || isLoading}
              className="w-full"
            >
              {isInterpreting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing the problem...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}

        {/* Step 2: Confirmation */}
        {step === 'confirm' && interpretation && !showPreview && (
          <div className="space-y-4">
            {/* Interpretation display */}
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Check className="h-4 w-4 text-green-600" />
                Here&apos;s what I understood:
              </div>

              <div className="space-y-3">
                {/* Audience */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    Audience
                  </div>
                  <p className="text-sm font-medium">{interpretation.audience}</p>
                </div>

                {/* Problem */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3 w-3" />
                    Problem
                  </div>
                  <p className="text-sm font-medium">{interpretation.problem}</p>
                </div>

                {/* Search phrases - editable */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    They might say things like:
                    <span className="text-muted-foreground/60">(click to remove)</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {interpretation.searchPhrases.map((phrase, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="text-xs pr-1 cursor-pointer hover:bg-secondary/80 group"
                      >
                        &quot;{phrase}&quot;
                        <button
                          type="button"
                          onClick={() => removePhraseFromInterpretation(phrase)}
                          className="ml-1 opacity-50 group-hover:opacity-100 hover:text-destructive transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    {/* Add phrase button/input */}
                    {showAddPhrase ? (
                      <div className="flex items-center gap-1">
                        <Input
                          ref={addPhraseInputRef}
                          value={confirmNewPhrase}
                          onChange={(e) => setConfirmNewPhrase(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addPhraseToInterpretation()
                            } else if (e.key === 'Escape') {
                              setShowAddPhrase(false)
                              setConfirmNewPhrase('')
                            }
                          }}
                          onBlur={() => {
                            if (!confirmNewPhrase.trim()) {
                              setShowAddPhrase(false)
                            }
                          }}
                          placeholder="Add phrase..."
                          className="h-6 text-xs w-40"
                          autoFocus
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={addPhraseToInterpretation}
                          disabled={!confirmNewPhrase.trim()}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddPhrase(true)
                          setTimeout(() => addPhraseInputRef.current?.focus(), 0)
                        }}
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                        Add
                      </button>
                    )}
                  </div>
                </div>

                {/* Confidence indicator */}
                {interpretation.confidence !== 'high' && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-2 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      {interpretation.confidence === 'low'
                        ? 'This is quite broad - consider being more specific for better results'
                        : 'Moderate confidence - results should be relevant'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Refinement suggestions (if any) */}
            {refinements.length > 0 && interpretation.confidence !== 'high' && (
              <div className="space-y-2 p-3 bg-violet-50 border border-violet-200 rounded-lg">
                <div className="flex items-center gap-2 text-sm font-medium text-violet-700">
                  <Sparkles className="h-4 w-4" />
                  Suggestions for better results:
                </div>
                <div className="space-y-2">
                  {refinements.slice(0, 3).map((ref, idx) => (
                    <button
                      key={idx}
                      onClick={() => applyRefinement(ref)}
                      className="block w-full text-left p-2 bg-white rounded border border-violet-100 hover:border-violet-300 transition-colors"
                    >
                      <p className="text-sm font-medium text-violet-900">{ref.suggestion}</p>
                      <p className="text-xs text-violet-600">{ref.rationale}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBack} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button variant="outline" onClick={handleAdjust} className="flex-1">
                <Edit2 className="mr-2 h-4 w-4" />
                Adjust
              </Button>
              <Button onClick={handleConfirm} disabled={isLoading} className="flex-1">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Search This
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2b: Coverage Preview */}
        {step === 'confirm' && showPreview && (
          <div className="space-y-4">
            <CoveragePreview
              hypothesis={getHypothesisString()}
              structuredHypothesis={getStructuredHypothesis()}
              onProceed={handleFinalSubmit}
              onRefine={() => {
                setShowPreview(false)
                setStep('adjust')
              }}
              disabled={isLoading}
            />
            <Button variant="outline" onClick={() => setShowPreview(false)} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Confirmation
            </Button>
          </div>
        )}

        {/* Step 3: Adjust */}
        {step === 'adjust' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <Edit2 className="h-4 w-4" />
              Adjust your search:
            </div>

            {/* Audience field */}
            <div className="space-y-2">
              <Label htmlFor="adj-audience">Who&apos;s struggling?</Label>
              <Input
                id="adj-audience"
                value={adjustedAudience}
                onChange={(e) => setAdjustedAudience(e.target.value)}
                disabled={isLoading}
                placeholder="e.g., People who go to gyms regularly"
              />
            </div>

            {/* Problem field */}
            <div className="space-y-2">
              <Label htmlFor="adj-problem">What&apos;s their problem?</Label>
              <Textarea
                id="adj-problem"
                value={adjustedProblem}
                onChange={(e) => setAdjustedProblem(e.target.value)}
                disabled={isLoading}
                rows={2}
                placeholder="e.g., Want to socialize but feel awkward approaching strangers"
                className="resize-none"
              />
            </div>

            {/* Search phrases */}
            <div className="space-y-2">
              <Label>Search phrases (how they describe it on Reddit)</Label>
              <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                {adjustedPhrases.map((phrase, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs pr-1">
                    &quot;{phrase}&quot;
                    <button
                      type="button"
                      onClick={() => removePhrase(phrase)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newPhrase}
                  onChange={(e) => setNewPhrase(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPhrase())}
                  placeholder="Add a search phrase..."
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button type="button" variant="outline" size="sm" onClick={addPhrase} disabled={!newPhrase.trim()}>
                  Add
                </Button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep('confirm')} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleConfirmAdjustments} disabled={!isAdjustValid || isLoading} className="flex-1">
                <Check className="mr-2 h-4 w-4" />
                Continue with Changes
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
