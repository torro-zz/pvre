'use client'

import { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, ArrowRight, ArrowLeft, Check, Edit2, Users, AlertTriangle, Lightbulb, MessageSquare, X, Plus, Link2, ExternalLink, Smartphone, Apple, Globe, Twitter, Rocket, Newspaper, Briefcase, Linkedin } from 'lucide-react'
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

// Structured examples with audience and problem separated for visual teaching
const EXAMPLE_INPUTS = [
  { audience: "Gym-goers", problem: "who want to make friends but feel awkward approaching strangers" },
  { audience: "Parents", problem: "overwhelmed by nightly meal planning decisions" },
  { audience: "Remote workers", problem: "feeling isolated without office interactions" },
  { audience: "New freelancers", problem: "struggling to land their first paying clients" },
  { audience: "9-to-5 employees", problem: "stuck dreaming about starting a side business" },
]

// Audience indicator words
const AUDIENCE_WORDS = [
  'who', 'people', 'users', 'customers', 'founders', 'entrepreneurs', 'freelancers',
  'parents', 'students', 'developers', 'designers', 'managers', 'workers', 'employees',
  'professionals', 'beginners', 'experts', 'teams', 'companies', 'startups', 'businesses',
  'men', 'women', 'adults', 'seniors', 'millennials', 'gen z', 'remote', 'solo',
  // Expat/immigrant related
  'expat', 'expats', 'expatriate', 'expatriates', 'immigrant', 'immigrants',
  'foreigner', 'foreigners', 'abroad', 'overseas', 'nomad', 'nomads', 'traveler', 'travelers',
  'digital nomad', 'digital nomads', 'relocated', 'relocating', 'new country', 'living abroad'
]

// Problem indicator words
const PROBLEM_WORDS = [
  'struggle', 'struggling', 'frustrated', 'frustrating', 'hate', 'tired', 'overwhelmed',
  'confused', 'stuck', 'can\'t', 'cannot', 'difficult', 'hard', 'problem', 'issue',
  'challenge', 'pain', 'annoying', 'stress', 'stressful', 'worried', 'anxious',
  'fail', 'failing', 'waste', 'wasting', 'losing', 'missing', 'need', 'want',
  'lonely', 'loneliness', 'isolated', 'isolation', 'alone', 'disconnected', 'depressed',
  'unhappy', 'miserable', 'helpless', 'hopeless', 'scared', 'afraid', 'nervous'
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

  // Inline editing state for audience/problem on confirm screen
  const [editingAudience, setEditingAudience] = useState(false)
  const [editingProblem, setEditingProblem] = useState(false)
  const [tempAudience, setTempAudience] = useState('')
  const [tempProblem, setTempProblem] = useState('')

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

  const URL_TYPE_INFO: Record<UrlType, { label: string; icon: React.ComponentType<{ className?: string }>; description: string }> = {
    googleplay: { label: 'Google Play', icon: Smartphone, description: 'App analysis mode' },
    appstore: { label: 'App Store', icon: Apple, description: 'App analysis mode' },
    reddit: { label: 'Reddit', icon: MessageSquare, description: 'Thread or search results' },
    twitter: { label: 'Twitter/X', icon: Twitter, description: 'Tweet or thread' },
    producthunt: { label: 'Product Hunt', icon: Rocket, description: 'Product page or launch' },
    hackernews: { label: 'Hacker News', icon: Newspaper, description: 'Post or comments' },
    indiehackers: { label: 'Indie Hackers', icon: Briefcase, description: 'Post or discussion' },
    linkedin: { label: 'LinkedIn', icon: Linkedin, description: 'Post or article' },
    website: { label: 'Website', icon: Globe, description: 'Competitor or review site' },
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
    setUserEditedPhrases(false) // Reset - user hasn't edited phrases yet in this session
    setUserAddedPhrases([]) // Clear user-added tracking for fresh session
  }

  // Apply a refinement suggestion and regenerate search phrases
  const applyRefinement = async (suggestion: RefinementSuggestion) => {
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

    // Regenerate search phrases for the new hypothesis
    setIsRegenerating(true)
    try {
      const response = await fetch('/api/research/interpret-hypothesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawInput: `${newAudience} who ${newProblem}`
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.mode === 'hypothesis' && data.interpretation?.searchPhrases) {
          // Update with fresh phrases
          setInterpretation({
            ...interpretation,
            audience: newAudience,
            problem: newProblem,
            searchPhrases: data.interpretation.searchPhrases,
          })
          setAdjustedAudience(newAudience)
          setAdjustedProblem(newProblem)
          setAdjustedPhrases([...data.interpretation.searchPhrases])

          // Proceed to coverage check
          if (showCoveragePreview) {
            setShowPreview(true)
          }
          return
        }
      }
    } catch (err) {
      console.error('Failed to regenerate phrases for refinement:', err)
    } finally {
      setIsRegenerating(false)
    }

    // Fallback: update without regenerating phrases
    setInterpretation({
      ...interpretation,
      audience: newAudience,
      problem: newProblem,
    })
    setAdjustedAudience(newAudience)
    setAdjustedProblem(newProblem)

    if (showCoveragePreview) {
      setShowPreview(true)
    }
  }

  // Step 3: Add a search phrase
  const addPhrase = () => {
    const trimmed = newPhrase.trim()
    if (trimmed && !adjustedPhrases.includes(trimmed)) {
      setAdjustedPhrases([...adjustedPhrases, trimmed])
      setUserAddedPhrases([...userAddedPhrases, trimmed]) // Track user additions
      setNewPhrase('')
      setUserEditedPhrases(true)
    }
  }

  // Step 3: Remove a search phrase
  const removePhrase = (phrase: string) => {
    setAdjustedPhrases(adjustedPhrases.filter(p => p !== phrase))
    setUserEditedPhrases(true) // User manually edited phrases
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

  // Start inline editing for audience
  const startEditingAudience = () => {
    if (interpretation) {
      setTempAudience(interpretation.audience)
      setEditingAudience(true)
    }
  }

  // Start inline editing for problem
  const startEditingProblem = () => {
    if (interpretation) {
      setTempProblem(interpretation.problem)
      setEditingProblem(true)
    }
  }

  // Save inline audience edit and regenerate phrases
  const saveAudienceEdit = async () => {
    if (!interpretation || !tempAudience.trim()) return

    const changed = tempAudience.trim() !== interpretation.audience.trim()
    setEditingAudience(false)

    if (changed) {
      setIsRegenerating(true)
      try {
        const response = await fetch('/api/research/interpret-hypothesis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawInput: `${tempAudience.trim()} who ${interpretation.problem.trim()}`
          }),
        })

        if (response.ok) {
          const data = await response.json()
          if (data.mode === 'hypothesis' && data.interpretation?.searchPhrases) {
            setInterpretation({
              ...interpretation,
              audience: tempAudience.trim(),
              searchPhrases: data.interpretation.searchPhrases,
            })
            setAdjustedAudience(tempAudience.trim())
            setAdjustedPhrases(data.interpretation.searchPhrases)
          }
        }
      } finally {
        setIsRegenerating(false)
      }
    }
  }

  // Save inline problem edit and regenerate phrases
  const saveProblemEdit = async () => {
    if (!interpretation || !tempProblem.trim()) return

    const changed = tempProblem.trim() !== interpretation.problem.trim()
    setEditingProblem(false)

    if (changed) {
      setIsRegenerating(true)
      try {
        const response = await fetch('/api/research/interpret-hypothesis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawInput: `${interpretation.audience.trim()} who ${tempProblem.trim()}`
          }),
        })

        if (response.ok) {
          const data = await response.json()
          if (data.mode === 'hypothesis' && data.interpretation?.searchPhrases) {
            setInterpretation({
              ...interpretation,
              problem: tempProblem.trim(),
              searchPhrases: data.interpretation.searchPhrases,
            })
            setAdjustedProblem(tempProblem.trim())
            setAdjustedPhrases(data.interpretation.searchPhrases)
          }
        }
      } finally {
        setIsRegenerating(false)
      }
    }
  }

  // Track user-added custom phrases (to preserve when regenerating)
  const [userAddedPhrases, setUserAddedPhrases] = useState<string[]>([])
  const [userEditedPhrases, setUserEditedPhrases] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)

  // Step 3: Confirm adjustments - ALWAYS regenerate phrases if audience/problem changed
  const handleConfirmAdjustments = async () => {
    if (!interpretation) return

    // Check if audience or problem changed from original interpretation
    const audienceChanged = adjustedAudience.trim() !== interpretation.audience.trim()
    const problemChanged = adjustedProblem.trim() !== interpretation.problem.trim()

    // ALWAYS regenerate when audience/problem changes - old phrases become stale
    if (audienceChanged || problemChanged) {
      setIsRegenerating(true)
      try {
        const response = await fetch('/api/research/interpret-hypothesis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawInput: `${adjustedAudience.trim()} who ${adjustedProblem.trim()}`
          }),
        })

        if (response.ok) {
          const data = await response.json()
          if (data.mode === 'hypothesis' && data.interpretation?.searchPhrases) {
            // Merge regenerated phrases with user-added custom phrases
            const newPhrases = [...data.interpretation.searchPhrases]
            // Add back any user-added phrases that aren't already in the new list
            for (const userPhrase of userAddedPhrases) {
              if (!newPhrases.some(p => p.toLowerCase() === userPhrase.toLowerCase())) {
                newPhrases.push(userPhrase)
              }
            }

            setAdjustedPhrases(newPhrases)
            setInterpretation({
              ...interpretation,
              audience: adjustedAudience,
              problem: adjustedProblem,
              searchPhrases: newPhrases,
            })
            setStep('confirm')
            return
          }
        }
      } catch (err) {
        console.error('Failed to regenerate phrases:', err)
        // Fall through to use existing phrases
      } finally {
        setIsRegenerating(false)
      }
    }

    // No hypothesis changes - use existing phrases as-is
    setInterpretation({
      ...interpretation,
      audience: adjustedAudience,
      problem: adjustedProblem,
      searchPhrases: adjustedPhrases,
    })
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
    <div className="space-y-6">
      {/* Step 1: Free-form Input */}
      {step === 'input' && (
        <div className="space-y-6">
          {/* Modern Mode Toggle */}
          <div className="flex justify-center">
            <div className="inline-flex p-1 bg-muted/80 rounded-xl border shadow-sm">
              <button
                type="button"
                onClick={() => setInputMode('text')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  inputMode === 'text'
                    ? 'bg-background shadow-md text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <MessageSquare className="h-4 w-4" />
                Describe a Problem
              </button>
              <button
                type="button"
                onClick={() => setInputMode('url')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  inputMode === 'url'
                    ? 'bg-background shadow-md text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Link2 className="h-4 w-4" />
                Analyze a URL
              </button>
            </div>
          </div>

          {/* Text input mode */}
          {inputMode === 'text' && (
            <div className="space-y-8">
              {/* Hero Input Area with Animated Glow */}
              <div className="input-glow relative">
                {/* Input container */}
                <div className="relative bg-background rounded-2xl border border-border/60 shadow-xl overflow-hidden">
                  <Textarea
                    placeholder="Describe who's struggling and what problem they face..."
                    value={rawInput}
                    onChange={(e) => setRawInput(e.target.value)}
                    disabled={isInterpreting || isLoading}
                    rows={4}
                    className="resize-none text-lg leading-relaxed bg-transparent border-0 px-6 py-6 focus:ring-0 focus-visible:ring-0 placeholder:text-muted-foreground/50"
                    autoFocus
                  />
                  {/* Bottom bar with quality indicator */}
                  <div className="flex items-center justify-between px-6 py-4 border-t border-border/40 bg-muted/30">
                    <InputQualityIndicator input={rawInput} />
                    <span className="text-xs text-muted-foreground/60 tabular-nums">
                      {rawInput.length} characters
                    </span>
                  </div>
                </div>
              </div>

              {/* Error message */}
              {interpretError && (
                <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/50 rounded-xl text-sm text-red-700 dark:text-red-300">
                  {interpretError}
                </div>
              )}

              {/* Examples Section - Floating Suggestions */}
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60">
                  <Lightbulb className="h-3.5 w-3.5" />
                  <span>Try an example</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                  {EXAMPLE_INPUTS.slice(0, 4).map((example, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => useExample(`${example.audience} ${example.problem}`)}
                      disabled={isInterpreting || isLoading}
                      className="group text-left p-4 rounded-xl border border-border/30 bg-muted/20 hover:bg-muted/40 hover:border-border/60 transition-all disabled:opacity-50"
                    >
                      <span className="text-sm font-medium text-foreground/90 group-hover:text-foreground">{example.audience}</span>
                      <span className="text-sm text-muted-foreground/70 group-hover:text-muted-foreground"> {example.problem}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Continue button */}
              <Button
                onClick={handleInterpret}
                disabled={!isInputValid || isInterpreting || isLoading}
                size="lg"
                className="w-full rounded-xl h-12 text-base mt-2"
              >
                {isInterpreting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </div>
          )}

          {/* URL input mode */}
          {inputMode === 'url' && (
            <div className="space-y-8">
              {/* Hero URL Input */}
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-primary/20 to-violet-500/20 rounded-2xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <Input
                    type="url"
                    placeholder="Paste a URL to analyze..."
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value)
                      setUrlError(null)
                    }}
                    disabled={isInterpreting || isLoading}
                    className="text-lg h-14 bg-background border-2 border-muted hover:border-muted-foreground/20 focus:border-primary/50 rounded-xl px-5 transition-colors placeholder:text-muted-foreground/50"
                    autoFocus
                  />
                </div>
              </div>

              {/* URL validation feedback */}
              <div className="min-h-[20px]">
                {urlValidation.error && urlInput.trim() && (
                  <p className="text-sm text-amber-600 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {urlValidation.error}
                  </p>
                )}
                {!urlInput.trim() && (
                  <p className="text-sm text-muted-foreground">
                    Paste a URL from Reddit, app stores, or any discussion forum
                  </p>
                )}
                {isUrlValid && urlValidation.type && (
                  <p className="text-sm text-muted-foreground">
                    {URL_TYPE_INFO[urlValidation.type].description}
                  </p>
                )}
              </div>

              {/* Error message */}
              {interpretError && (
                <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
                  {interpretError}
                </div>
              )}

              {/* Supported platforms - Modern Grid */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ExternalLink className="h-4 w-4" />
                  <span>Supported sources</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(URL_TYPE_INFO).map(([key, { label, icon: Icon }]) => {
                    const isMatched = isUrlValid && urlValidation.type === key
                    return (
                      <span
                        key={key}
                        className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                          isMatched
                            ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-600 dark:text-emerald-400'
                            : 'bg-muted/50 text-muted-foreground'
                        }`}
                      >
                        {isMatched && <Check className="h-3.5 w-3.5" />}
                        <Icon className="h-3.5 w-3.5" />
                        <span>{label}</span>
                      </span>
                    )
                  })}
                </div>
              </div>

              {/* Analyze URL button */}
              <Button
                size="lg"
                className="w-full rounded-xl h-12 text-base"
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
                >
                  {isInterpreting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing URL...
                    </>
                  ) : (
                  <>
                    Analyze URL
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>

              <p className="text-sm text-center text-muted-foreground">
                We&apos;ll extract pain signals, complaints, and feedback from the page
              </p>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Confirmation */}
      {step === 'confirm' && interpretation && !showPreview && (
        <div className="space-y-8">
          {/* Header - Clean and Minimal */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Check className="h-5 w-5 text-emerald-600" />
            </div>
            <h2 className="text-xl font-semibold">Ready to search</h2>
          </div>

          {/* Main Content Card - Spacious and Premium */}
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-6 sm:p-8 space-y-6">
            {/* Audience Section - Inline Editable */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <Users className="h-3.5 w-3.5" />
                  Audience
                </div>
                {!editingAudience && (
                  <button
                    type="button"
                    onClick={startEditingAudience}
                    disabled={isRegenerating}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </button>
                )}
              </div>
              {editingAudience ? (
                <div className="space-y-2">
                  <Input
                    value={tempAudience}
                    onChange={(e) => setTempAudience(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        saveAudienceEdit()
                      } else if (e.key === 'Escape') {
                        setEditingAudience(false)
                      }
                    }}
                    className="text-lg"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingAudience(false)}>
                      Cancel
                    </Button>
                    <Button type="button" size="sm" onClick={saveAudienceEdit} disabled={!tempAudience.trim()}>
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-lg font-medium leading-relaxed text-foreground">
                  {interpretation.audience}
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-border/40" />

            {/* Problem Section - Inline Editable */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Problem
                </div>
                {!editingProblem && (
                  <button
                    type="button"
                    onClick={startEditingProblem}
                    disabled={isRegenerating}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit
                  </button>
                )}
              </div>
              {editingProblem ? (
                <div className="space-y-2">
                  <Textarea
                    value={tempProblem}
                    onChange={(e) => setTempProblem(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        saveProblemEdit()
                      } else if (e.key === 'Escape') {
                        setEditingProblem(false)
                      }
                    }}
                    rows={2}
                    className="text-lg resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingProblem(false)}>
                      Cancel
                    </Button>
                    <Button type="button" size="sm" onClick={saveProblemEdit} disabled={!tempProblem.trim()}>
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-lg font-medium leading-relaxed text-foreground">
                  {interpretation.problem}
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-border/40" />

            {/* Search Phrases Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Search Phrases
                </div>
                <span className="text-xs text-muted-foreground/60">
                  Click to remove
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {interpretation.searchPhrases.map((phrase, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => removePhraseFromInterpretation(phrase)}
                    className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-background border border-border/60 hover:border-destructive/50 hover:bg-destructive/5 transition-all text-sm"
                  >
                    <span className="text-foreground/90 group-hover:text-foreground">
                      &quot;{phrase}&quot;
                    </span>
                    <X className="h-3.5 w-3.5 text-muted-foreground group-hover:text-destructive transition-colors" />
                  </button>
                ))}

                {/* Add phrase button/input */}
                {showAddPhrase ? (
                  <div className="flex items-center gap-2">
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
                      className="h-10 text-sm w-44 rounded-xl"
                      autoFocus
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-10 px-3 rounded-xl"
                      onClick={addPhraseToInterpretation}
                      disabled={!confirmNewPhrase.trim()}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddPhrase(true)
                      setTimeout(() => addPhraseInputRef.current?.focus(), 0)
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-dashed border-border/60 hover:border-primary/50 hover:bg-muted/50 transition-all text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add phrase
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Confidence Warning - Only show if not high confidence */}
          {interpretation.confidence !== 'high' && refinements.length > 0 && (
            <div className={`rounded-2xl border p-5 sm:p-6 space-y-4 ${
              interpretation.confidence === 'low'
                ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40'
                : 'bg-violet-50/50 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-800/40'
            }`}>
              <div className={`flex items-center gap-3 ${
                interpretation.confidence === 'low' ? 'text-amber-900 dark:text-amber-100' : 'text-violet-900 dark:text-violet-100'
              }`}>
                {interpretation.confidence === 'low' ? (
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20">
                    <Sparkles className="h-4 w-4" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-sm">
                    {interpretation.confidence === 'low'
                      ? 'Your input is quite broad'
                      : 'Suggestions for better results'}
                  </h3>
                  <p className={`text-xs ${
                    interpretation.confidence === 'low' ? 'text-amber-700 dark:text-amber-300' : 'text-violet-700 dark:text-violet-300'
                  }`}>
                    {interpretation.confidence === 'low'
                      ? 'Try one of these more specific angles:'
                      : 'Consider these refinements:'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {refinements.slice(0, 3).map((ref, idx) => (
                  <button
                    key={idx}
                    onClick={() => applyRefinement(ref)}
                    className={`block w-full text-left p-3.5 rounded-xl border transition-all ${
                      interpretation.confidence === 'low'
                        ? 'bg-white dark:bg-background border-amber-200/60 dark:border-amber-800/40 hover:border-amber-400 hover:shadow-sm'
                        : 'bg-white dark:bg-background border-violet-200/60 dark:border-violet-800/40 hover:border-violet-400 hover:shadow-sm'
                    }`}
                  >
                    <p className={`text-sm font-medium mb-0.5 ${
                      interpretation.confidence === 'low' ? 'text-amber-900 dark:text-amber-100' : 'text-violet-900 dark:text-violet-100'
                    }`}>
                      {ref.suggestion}
                    </p>
                    <p className={`text-xs ${
                      interpretation.confidence === 'low' ? 'text-amber-700 dark:text-amber-300' : 'text-violet-700 dark:text-violet-300'
                    }`}>
                      {ref.rationale}
                    </p>
                  </button>
                ))}
              </div>

              {interpretation.confidence === 'low' && (
                <p className="text-xs text-amber-600 dark:text-amber-400 pt-1">
                  Broad searches often return irrelevant results. Clicking a suggestion above helps us find more targeted signals.
                </p>
              )}
            </div>
          )}

          {/* Action Buttons - Modern and Prominent */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={handleBack}
              size="lg"
              className="h-12 rounded-xl"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isLoading || isRegenerating}
              size="lg"
              className="h-12 rounded-xl"
            >
              {isLoading || isRegenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Search This
                  <ArrowRight className="ml-2 h-4 w-4" />
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
              mode="hypothesis"
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
              <Button variant="outline" onClick={() => setStep('confirm')} disabled={isRegenerating} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleConfirmAdjustments} disabled={!isAdjustValid || isLoading || isRegenerating} className="flex-1">
                {isRegenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating phrases...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Continue with Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step: App Confirmation (App-Centric Mode) */}
        {step === 'app-confirm' && appData && appInterpretation && !showPreview && (
          <div className="space-y-5">
            {/* Compact App Header */}
            <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
              {appData.iconUrl && (
                <img
                  src={appData.iconUrl}
                  alt={appData.name}
                  className="w-12 h-12 rounded-lg shadow-sm flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium truncate">{appData.name}</h3>
                  <span className="text-xs text-muted-foreground">
                    {appData.store === 'google_play' ? 'Google Play' : 'App Store'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <span className="text-yellow-500">★</span>
                    {appData.rating.toFixed(1)}
                  </span>
                  <span>•</span>
                  <span>{appData.reviewCount.toLocaleString()} reviews</span>
                  <span>•</span>
                  <span>{appData.category}</span>
                </div>
              </div>
            </div>

            {/* Problem Focus - Clean Card */}
            <div className="p-4 rounded-xl border bg-card">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Problem Domain
              </div>
              <p className="text-base font-medium leading-relaxed">
                {appInterpretation.primaryDomain}
              </p>
              {appInterpretation.secondaryDomains.length > 0 && (
                <p className="text-sm text-muted-foreground mt-1.5">
                  Also: {appInterpretation.secondaryDomains.slice(0, 2).join(', ')}
                  {appInterpretation.secondaryDomains.length > 2 && ` +${appInterpretation.secondaryDomains.length - 2} more`}
                </p>
              )}
            </div>

            {/* Search Phrases - Main Focus */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Search Phrases
                </div>
                <span className="text-xs text-muted-foreground">
                  {appSearchPhrases.length} phrases
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {appSearchPhrases.map((phrase, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20 text-foreground group"
                  >
                    {phrase}
                    <button
                      type="button"
                      onClick={() => setAppSearchPhrases(prev => prev.filter(p => p !== phrase))}
                      className="opacity-40 group-hover:opacity-100 hover:text-destructive transition-opacity ml-0.5"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
                {/* Add phrase */}
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
                      className="h-8 text-sm w-44"
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAppAddPhrase(true)
                      setTimeout(() => appAddPhraseInputRef.current?.focus(), 0)
                    }}
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                We&apos;ll search Reddit and Hacker News for these phrases to find pain signals
              </p>
            </div>

            {/* Competitors - Subtle inline */}
            {appInterpretation.competitorTerms.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                <span>Comparing with:</span>
                <span className="text-foreground">
                  {appInterpretation.competitorTerms.slice(0, 4).join(', ')}
                  {appInterpretation.competitorTerms.length > 4 && ` +${appInterpretation.competitorTerms.length - 4}`}
                </span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleBack} size="lg" className="flex-1 h-11">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={() => setShowPreview(true)}
                disabled={isLoading || appSearchPhrases.length === 0}
                size="lg"
                className="flex-1 h-11"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
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
              mode="app-analysis"
              appData={appData}
            />
            <Button variant="outline" onClick={() => setShowPreview(false)} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to App Details
            </Button>
          </div>
        )}
    </div>
  )
}
