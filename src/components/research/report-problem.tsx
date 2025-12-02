'use client'

import { useState } from 'react'
import { MessageSquare, X, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'

interface ReportProblemProps {
  jobId: string
  onSubmit?: () => void
}

const PROBLEM_TYPES = [
  { id: 'not_useful', label: "Results weren't useful for my research" },
  { id: 'wrong_data', label: 'Data seemed irrelevant to my hypothesis' },
  { id: 'missing_competitors', label: 'Major competitors were missing' },
  { id: 'score_wrong', label: "Viability score doesn't match my research" },
  { id: 'technical', label: "Something broke or didn't load" },
  { id: 'other', label: 'Other issue' },
]

export function ReportProblem({ jobId, onSubmit }: ReportProblemProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [problemType, setProblemType] = useState('')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!problemType) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/feedback/report-problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          problemType,
          details,
          requestRefund: true,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to submit report')
      }

      setSubmitted(true)
      onSubmit?.()
    } catch (err) {
      console.error('Failed to submit report:', err)
      setError(err instanceof Error ? err.message : 'Failed to submit report')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
          <div>
            <p className="font-medium text-green-600 dark:text-green-400">
              Thanks for the feedback
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              We've credited your account and will review your report to improve our service.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageSquare className="w-4 h-4" />
        Report a problem
      </button>
    )
  }

  return (
    <div className="p-4 bg-muted/30 border rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">Report a Problem</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(false)}
          className="h-8 w-8"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <Label className="text-sm text-muted-foreground mb-2 block">
            What went wrong?
          </Label>
          <RadioGroup value={problemType} onValueChange={setProblemType}>
            {PROBLEM_TYPES.map((type) => (
              <div key={type.id} className="flex items-center space-x-2">
                <RadioGroupItem value={type.id} id={type.id} />
                <Label htmlFor={type.id} className="text-sm font-normal cursor-pointer">
                  {type.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div>
          <Label className="text-sm text-muted-foreground mb-2 block">
            Tell us more <span className="text-red-500">*</span>
          </Label>
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Please describe the issue in detail. What were you hoping to learn? What was missing or incorrect? (minimum 20 characters)"
            className="resize-none"
            rows={3}
          />
          {details.length > 0 && details.length < 20 && (
            <p className="text-xs text-amber-600 mt-1">
              Please provide more detail ({20 - details.length} more characters needed)
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            We'll refund your credit automatically
          </p>
          <Button
            onClick={handleSubmit}
            disabled={!problemType || details.length < 20 || submitting}
            size="sm"
          >
            {submitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </div>

      </div>
    </div>
  )
}
