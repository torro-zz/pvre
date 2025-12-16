'use client'

import { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, ArrowRight, ArrowLeft, Check, Edit2, Users, AlertTriangle, Lightbulb, MessageSquare, X, Plus, Link2, ExternalLink } from 'lucide-react'
import { CoveragePreview, CoverageData } from './coverage-preview'
import { StructuredHypothesis, formatHypothesis } from '@/types/research'
import {
  HypothesisInterpretation,
  RefinementSuggestion,
  InterpretHypothesisResponse,
  InterpretResponse,
  AppAnalysisResponse,
  AppAnalysisInterpretation,
} from '@/app/api/research/interpret-hypothesis/route'
import type { AppDetails } from '@/lib/data-sources/types'

type Step = 'input' | 'confirm' | 'adjust' | 'app-confirm'
type InputMode = 'hypothesis' | 'app-analysis'

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

// Audience indicator words
const AUDIENCE_WORDS = [
  'who', 'people', 'users', 'customers', 'founders', 'entrepreneurs', 'freelancers',
  'parents', 'students', 'developers', 'designers', 'managers', 'workers', 'employees',
  'professionals', 'beginners', 'experts', 'teams', 'companies', 'startups', 'businesses',
  'men', 'women', 'adults', 'seniors', 'millennials', 'gen z', 'remote', 'solo'
]

// Problem indicator words
const PROBLEM_WORDS = [
  'struggle', 'struggling', 'frustrated', 'frustrating', 'hate', 'tired', 'overwhelmed',
  'confused', 'stuck', 'can\'t', 'cannot', 'difficult', 'hard', 'problem', 'issue',
  'challenge', 'pain', 'annoying', 'stress', 'stressful', 'worried', 'anxious',
  'fail', 'failing', 'waste', 'wasting', 'losing', 'missing', 'need', 'want'
]

function InputQualityIndicator({ input }: { input: string }) {
  const length = input.trim().length
  const lowerInput = input.toLowerCase()

  // Check for audience and problem indicators
  const hasAudience = AUDIENCE_WORDS.some(word => lowerInput.includes(word))
  const hasProblem = PROBLEM_WORDS.some(word => lowerInput.includes(word))

  // Determine quality level
  let message: string
  let colorClass: string
  let icon: React.ReactNode

  if (length === 0) {
    message = "Describe who's struggling and what problem they face"
    colorClass = "text-muted-foreground"
    icon = null
  } else if (length < 20) {
    message = "Try adding more detail"
    colorClass = "text-muted-foreground"
    icon = null
  } else if (length < 50) {
    if (!hasAudience) {
      message = "Good start — who specifically has this problem?"
      colorClass = "text-amber-600"
      icon = <AlertTriangle className="h-3 w-3" />
    } else if (!hasProblem) {
      message = "Good — what's their frustration or struggle?"
      colorClass = "text-amber-600"
      icon = <AlertTriangle className="h-3 w-3" />
    } else {
      message = "Looking good — add more context for best results"
      colorClass = "text-amber-600"
      icon = <AlertTriangle className="h-3 w-3" />
    }
  } else {
    // 50+ chars
    if (hasAudience && hasProblem) {
      message = "Great detail"
      colorClass = "text-green-600"
      icon = <Check className="h-3 w-3" />
    } else if (!hasAudience) {
      message = "Good detail — try specifying who has this problem"
      colorClass = "text-amber-600"
      icon = <AlertTriangle className="h-3 w-3" />
    } else if (!hasProblem) {
      message = "Good detail — what's their pain or frustration?"
      colorClass = "text-amber-600"
      icon = <AlertTriangle className="h-3 w-3" />
    } else {
      message = "Great detail"
      colorClass = "text-green-600"
      icon = <Check className="h-3 w-3" />
    }
  }

  return (
    <div className={`flex items-center gap-1.5 text-xs ${colorClass}`}>
      {icon}
      <span>{message}</span>
    </div>
  )
}

export function ConversationalInput({ onSubmit, isLoading, showCoveragePreview = true }: ConversationalInputProps) {
  // Step state
  const [step, setStep] = useState<Step>('input')

  // Input mode: 'text' or 'url'
  const [inputMode, setInputMode] = useState<'text' | 'url'>('text')

  // Input state
  const [rawInput, setRawInput] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)

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

  // App analysis mode state
  const [researchMode, setResearchMode] = useState<InputMode>('hypothesis')
  const [appData, setAppData] = useState<AppDetails | null>(null)
  const [appInterpretation, setAppInterpretation] = useState<AppAnalysisInterpretation | null>(null)
  const [appSearchPhrases, setAppSearchPhrases] = useState<string[]>([])
  const [appNewPhrase, setAppNewPhrase] = useState('')
  const [showAppAddPhrase, setShowAppAddPhrase] = useState(false)
  const appAddPhraseInputRef = useRef<HTMLInputElement>(null)

  // Build structured hypothesis from current state
  const getStructuredHypothesis = useCallback((): StructuredHypothesis => {
    // App analysis mode
    if (researchMode === 'app-analysis' && appData && appInterpretation) {
      return {
        audience: appInterpretation.targetAudience,
        problem: appInterpretation.primaryDomain,
        problemLanguage: appSearchPhrases.join(', '),
      }
    }
    // Hypothesis mode - adjust step
    if (step === 'adjust') {
      return {
        audience: adjustedAudience.trim(),
        problem: adjustedProblem.trim(),
        problemLanguage: adjustedPhrases.join(', '),
      }
    }
    // Hypothesis mode - confirm step
    if (interpretation) {
      return {
        audience: interpretation.audience,
        problem: interpretation.problem,
        problemLanguage: interpretation.searchPhrases.join(', '),
      }
    }
    return { audience: '', problem: '' }
  }, [step, interpretation, adjustedAudience, adjustedProblem, adjustedPhrases, researchMode, appData, appInterpretation, appSearchPhrases])

  const getHypothesisString = useCallback((): string => {
    const structured = getStructuredHypothesis()
    return formatHypothesis(structured)
  }, [getStructuredHypothesis])

  // Supported URL types with their display info
  type UrlType = 'reddit' | 'twitter' | 'producthunt' | 'hackernews' | 'indiehackers' | 'linkedin' | 'website' | 'googleplay' | 'appstore'

  const URL_TYPE_INFO: Record<UrlType, { label: string; icon: string; description: string }> = {
    googleplay: { label: 'Google Play', icon: '🤖', description: 'App analysis mode' },
    appstore: { label: 'App Store', icon: '🍎', description: 'App analysis mode' },
    reddit: { label: 'Reddit', icon: '🔴', description: 'Thread or search results' },
    twitter: { label: 'Twitter/X', icon: '𝕏', description: 'Tweet or thread' },
    producthunt: { label: 'Product Hunt', icon: '🚀', description: 'Product page or launch' },
    hackernews: { label: 'Hacker News', icon: '🟠', description: 'Post or comments' },
    indiehackers: { label: 'Indie Hackers', icon: '💼', description: 'Post or discussion' },
    linkedin: { label: 'LinkedIn', icon: '🔵', description: 'Post or article' },
    website: { label: 'Website', icon: '🌐', description: 'Competitor or review site' },
  }

  // URL validation and type detection
  const validateUrl = useCallback((url: string): { valid: boolean; type: UrlType | null; error: string | null } => {
    if (!url.trim()) {
      return { valid: false, type: null, error: null }
    }
    try {
      const parsed = new URL(url.trim())
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, type: null, error: 'Please enter a valid URL starting with http:// or https://' }
      }
      const hostname = parsed.hostname.toLowerCase()

      // Detect app stores FIRST (highest priority)
      if (hostname.includes('play.google.com')) {
        return { valid: true, type: 'googleplay', error: null }
      }
      if (hostname.includes('apps.apple.com') || hostname.includes('itunes.apple.com')) {
        return { valid: true, type: 'appstore', error: null }
      }

      // Detect other platforms
      if (hostname.includes('reddit.com') || hostname.includes('redd.it')) {
        return { valid: true, type: 'reddit', error: null }
      }
      if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
        return { valid: true, type: 'twitter', error: null }
      }
      if (hostname.includes('producthunt.com')) {
        return { valid: true, type: 'producthunt', error: null }
      }
      if (hostname.includes('news.ycombinator.com') || hostname.includes('hackernews')) {
        return { valid: true, type: 'hackernews', error: null }
      }
      if (hostname.includes('indiehackers.com')) {
        return { valid: true, type: 'indiehackers', error: null }
      }
      if (hostname.includes('linkedin.com')) {
        return { valid: true, type: 'linkedin', error: null }
      }
      // Accept any other valid URL as a website
      return { valid: true, type: 'website', error: null }
    } catch {
      return { valid: false, type: null, error: 'Please enter a valid URL' }
    }
  }, [])

  const urlValidation = validateUrl(urlInput)
  const isUrlValid = urlValidation.valid

  // Step 1: Interpret the raw input (handles both hypothesis and app URL)
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

      const data: InterpretResponse = await response.json()

      // Check if this is app-analysis mode
      if (data.mode === 'app-analysis') {
        setResearchMode('app-analysis')
        setAppData(data.appData)
        setAppInterpretation(data.interpretation)
        setAppSearchPhrases([...data.interpretation.searchPhrases])
        setStep('app-confirm')
        return
      }

      // Hypothesis mode (default)
      setResearchMode('hypothesis')
      const hypothesisData = data as InterpretHypothesisResponse & { mode: 'hypothesis' }

      setInterpretation(hypothesisData.interpretation)
      setRefinements(hypothesisData.refinementSuggestions || [])
      setFormattedHypothesis(hypothesisData.formattedHypothesis)

      // Pre-populate adjust fields
      setAdjustedAudience(hypothesisData.interpretation.audience)
      setAdjustedProblem(hypothesisData.interpretation.problem)
      setAdjustedPhrases([...hypothesisData.interpretation.searchPhrases])

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
            {/* Mode toggle */}
            <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
              <button
                type="button"
                onClick={() => setInputMode('text')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  inputMode === 'text'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <MessageSquare className="h-4 w-4" />
                Describe
              </button>
              <button
                type="button"
                onClick={() => setInputMode('url')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  inputMode === 'url'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Link2 className="h-4 w-4" />
                Paste URL
              </button>
            </div>

            {/* Text input mode */}
            {inputMode === 'text' && (
              <>
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
                  {/* Input quality indicator */}
                  <InputQualityIndicator input={rawInput} />
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
              </>
            )}

            {/* URL input mode */}
            {inputMode === 'url' && (
              <>
                <div className="space-y-2">
                  <Input
                    type="url"
                    placeholder="Paste a URL from Reddit, Twitter, Product Hunt, or any website..."
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value)
                      setUrlError(null)
                    }}
                    disabled={isInterpreting || isLoading}
                    className="text-base"
                    autoFocus
                  />
                  {urlValidation.error && urlInput.trim() && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {urlValidation.error}
                    </p>
                  )}
                  {!urlInput.trim() && (
                    <p className="text-xs text-muted-foreground">
                      Paste a URL to analyze pain signals from discussions or reviews
                    </p>
                  )}
                  {isUrlValid && urlValidation.type && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      <span>{URL_TYPE_INFO[urlValidation.type].icon}</span>
                      <span>{URL_TYPE_INFO[urlValidation.type].label} detected</span>
                      <span className="text-muted-foreground">— {URL_TYPE_INFO[urlValidation.type].description}</span>
                    </p>
                  )}
                </div>

                {/* Error message */}
                {interpretError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                    {interpretError}
                  </div>
                )}

                {/* Supported platforms */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ExternalLink className="h-4 w-4" />
                    <span>Supported sources:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(URL_TYPE_INFO).map(([key, { label, icon }]) => (
                      <span key={key} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                        <span>{icon}</span>
                        <span>{label}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Analyze URL button */}
                <Button
                  onClick={async () => {
                    if (!isUrlValid || !urlValidation.type) return

                    setIsInterpreting(true)
                    setInterpretError(null)

                    try {
                      // Route app store URLs to app-centric analysis
                      if (urlValidation.type === 'googleplay' || urlValidation.type === 'appstore') {
                        const response = await fetch('/api/research/interpret-hypothesis', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ rawInput: urlInput.trim() }),
                        })

                        if (!response.ok) {
                          let errorMessage = 'Failed to analyze app'
                          try {
                            const err = await response.json()
                            errorMessage = err.error || errorMessage
                          } catch {
                            errorMessage = `Server error (${response.status}). Please try again.`
                          }
                          throw new Error(errorMessage)
                        }

                        const data: InterpretResponse = await response.json()

                        if (data.mode === 'app-analysis') {
                          setResearchMode('app-analysis')
                          setAppData(data.appData)
                          setAppInterpretation(data.interpretation)
                          setAppSearchPhrases([...data.interpretation.searchPhrases])
                          setStep('app-confirm')
                          return
                        }
                        // Fallback if somehow it's not app-analysis
                        throw new Error('Failed to analyze app - unexpected response')
                      }

                      // For all other URLs, use the analyze-url endpoint
                      const response = await fetch('/api/research/analyze-url', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          url: urlInput.trim(),
                          urlType: urlValidation.type,
                        }),
                      })

                      if (!response.ok) {
                        let errorMessage = 'Failed to analyze URL'
                        try {
                          const err = await response.json()
                          errorMessage = err.error || errorMessage
                        } catch {
                          errorMessage = `Server error (${response.status}). Please try again.`
                        }
                        throw new Error(errorMessage)
                      }

                      const data = await response.json()

                      setInterpretation(data.interpretation)
                      setRefinements(data.refinementSuggestions || [])
                      setFormattedHypothesis(data.formattedHypothesis)

                      // Pre-populate adjust fields
                      setAdjustedAudience(data.interpretation.audience)
                      setAdjustedProblem(data.interpretation.problem)
                      setAdjustedPhrases([...data.interpretation.searchPhrases])

                      // Store the original URL for reference
                      setRawInput(`Analyzing: ${urlInput}`)

                      setStep('confirm')
                    } catch (err) {
                      setInterpretError(err instanceof Error ? err.message : 'Something went wrong')
                    } finally {
                      setIsInterpreting(false)
                    }
                  }}
                  disabled={!isUrlValid || isInterpreting || isLoading}
                  className="w-full"
                >
                  {isInterpreting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing URL...
                    </>
                  ) : (
                    <>
                      Analyze URL
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  We&apos;ll extract pain signals, complaints, and feedback from the page
                </p>
              </>
            )}
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

                {/* Confidence indicator - brief note, details in refinement section below */}
                {interpretation.confidence !== 'high' && refinements.length > 0 && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-2 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      {interpretation.confidence === 'low'
                        ? 'See suggestions below for better results ↓'
                        : 'Good, but see suggestions below for even better results'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Refinement suggestions - prominent for low confidence, helpful for medium */}
            {refinements.length > 0 && interpretation.confidence !== 'high' && (
              <div className={`space-y-2 p-3 rounded-lg border ${
                interpretation.confidence === 'low'
                  ? 'bg-amber-50 border-amber-300'
                  : 'bg-violet-50 border-violet-200'
              }`}>
                <div className={`flex items-center gap-2 text-sm font-medium ${
                  interpretation.confidence === 'low' ? 'text-amber-800' : 'text-violet-700'
                }`}>
                  {interpretation.confidence === 'low' ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {interpretation.confidence === 'low'
                    ? 'Your input is quite broad. Try one of these more specific angles:'
                    : 'For better results, consider:'}
                </div>
                <div className="space-y-2">
                  {refinements.slice(0, 3).map((ref, idx) => (
                    <button
                      key={idx}
                      onClick={() => applyRefinement(ref)}
                      className={`block w-full text-left p-2 bg-white rounded border transition-colors ${
                        interpretation.confidence === 'low'
                          ? 'border-amber-200 hover:border-amber-400 hover:bg-amber-50'
                          : 'border-violet-100 hover:border-violet-300'
                      }`}
                    >
                      <p className={`text-sm font-medium ${
                        interpretation.confidence === 'low' ? 'text-amber-900' : 'text-violet-900'
                      }`}>{ref.suggestion}</p>
                      <p className={`text-xs ${
                        interpretation.confidence === 'low' ? 'text-amber-700' : 'text-violet-600'
                      }`}>{ref.rationale}</p>
                    </button>
                  ))}
                </div>
                {interpretation.confidence === 'low' && (
                  <p className="text-xs text-amber-600 pt-1">
                    Broad searches often return irrelevant results. Clicking a suggestion above helps us find more targeted signals.
                  </p>
                )}
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

        {/* Step: App Confirmation (App-Centric Mode) */}
        {step === 'app-confirm' && appData && appInterpretation && !showPreview && (
          <div className="space-y-4">
            {/* App Card */}
            <div className="p-4 bg-gradient-to-r from-violet-500/10 to-blue-500/10 rounded-lg border border-violet-500/20">
              <div className="flex gap-4">
                {/* App Icon */}
                {appData.iconUrl && (
                  <img
                    src={appData.iconUrl}
                    alt={appData.name}
                    className="w-16 h-16 rounded-xl shadow-sm flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg truncate">{appData.name}</h3>
                    {/* Store indicator */}
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                      appData.store === 'google_play'
                        ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                        : 'bg-gray-500/20 text-gray-600 dark:text-gray-400'
                    }`}>
                      {appData.store === 'google_play' ? '🤖 Google Play' : '🍎 App Store'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{appData.developer}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-sm">
                    <span className="flex items-center gap-1">
                      <span className="text-yellow-500">★</span>
                      {appData.rating.toFixed(1)}
                    </span>
                    <span className="text-muted-foreground">
                      {appData.reviewCount.toLocaleString()} reviews
                    </span>
                    {appData.installs && (
                      <span className="text-muted-foreground">
                        {appData.installs} installs
                      </span>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {appData.category}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Problem Domain Interpretation */}
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-violet-500" />
                Here&apos;s what this app solves:
              </div>

              <div className="space-y-3">
                {/* Primary Domain */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3 w-3" />
                    Primary Problem
                  </div>
                  <p className="text-sm font-medium">{appInterpretation.primaryDomain}</p>
                </div>

                {/* Secondary Domains */}
                {appInterpretation.secondaryDomains.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Also addresses:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {appInterpretation.secondaryDomains.map((domain, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {domain}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Target Audience */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    Target Users
                  </div>
                  <p className="text-sm">{appInterpretation.targetAudience}</p>
                </div>

                {/* Search Phrases - editable */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    Search phrases for Reddit/HN:
                    <span className="text-muted-foreground/60">(click to remove)</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {appSearchPhrases.map((phrase, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="text-xs pr-1 cursor-pointer hover:bg-secondary/80 group"
                      >
                        &quot;{phrase}&quot;
                        <button
                          type="button"
                          onClick={() => setAppSearchPhrases(prev => prev.filter(p => p !== phrase))}
                          className="ml-1 opacity-50 group-hover:opacity-100 hover:text-destructive transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    {/* Add phrase button/input */}
                    {showAppAddPhrase ? (
                      <div className="flex items-center gap-1">
                        <Input
                          ref={appAddPhraseInputRef}
                          value={appNewPhrase}
                          onChange={(e) => setAppNewPhrase(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              if (appNewPhrase.trim() && !appSearchPhrases.includes(appNewPhrase.trim())) {
                                setAppSearchPhrases(prev => [...prev, appNewPhrase.trim()])
                              }
                              setAppNewPhrase('')
                              setShowAppAddPhrase(false)
                            } else if (e.key === 'Escape') {
                              setShowAppAddPhrase(false)
                              setAppNewPhrase('')
                            }
                          }}
                          onBlur={() => {
                            if (!appNewPhrase.trim()) {
                              setShowAppAddPhrase(false)
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
                          onClick={() => {
                            if (appNewPhrase.trim() && !appSearchPhrases.includes(appNewPhrase.trim())) {
                              setAppSearchPhrases(prev => [...prev, appNewPhrase.trim()])
                            }
                            setAppNewPhrase('')
                            setShowAppAddPhrase(false)
                          }}
                          disabled={!appNewPhrase.trim()}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setShowAppAddPhrase(true)
                          setTimeout(() => appAddPhraseInputRef.current?.focus(), 0)
                        }}
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                        Add
                      </button>
                    )}
                  </div>
                </div>

                {/* Competitor Terms */}
                {appInterpretation.competitorTerms.length > 0 && (
                  <div className="space-y-1 pt-2 border-t">
                    <div className="text-xs text-muted-foreground">Competitors to compare:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {appInterpretation.competitorTerms.slice(0, 5).map((comp, idx) => (
                        <span key={idx} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {comp}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBack} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={() => setShowPreview(true)}
                disabled={isLoading || appSearchPhrases.length === 0}
                className="flex-1"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Search These Phrases
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* App Confirmation: Coverage Preview */}
        {step === 'app-confirm' && showPreview && (
          <div className="space-y-4">
            <CoveragePreview
              hypothesis={getHypothesisString()}
              structuredHypothesis={getStructuredHypothesis()}
              onProceed={handleFinalSubmit}
              onRefine={() => {
                setShowPreview(false)
              }}
              disabled={isLoading}
            />
            <Button variant="outline" onClick={() => setShowPreview(false)} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to App Details
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
