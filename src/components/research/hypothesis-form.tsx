'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Loader2, Search, Lightbulb } from 'lucide-react'

interface HypothesisFormProps {
  onSubmit: (hypothesis: string) => Promise<void>
  isLoading: boolean
}

const EXAMPLE_HYPOTHESES = [
  'Training community for London Hyrox athletes',
  'Meal planning app for busy parents with picky eaters',
  'Remote collaboration tools for distributed design teams',
  'Personal finance coaching for millennials with student debt',
]

export function HypothesisForm({ onSubmit, isLoading }: HypothesisFormProps) {
  const [hypothesis, setHypothesis] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hypothesis.trim() || isLoading) return
    await onSubmit(hypothesis.trim())
  }

  const handleExampleClick = (example: string) => {
    setHypothesis(example)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Community Voice Mining
        </CardTitle>
        <CardDescription>
          Enter your business hypothesis to discover pain points and customer needs
          from Reddit discussions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hypothesis">Business Hypothesis</Label>
            <Textarea
              id="hypothesis"
              placeholder="e.g., Training community for London Hyrox athletes"
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              disabled={isLoading}
              rows={3}
              className="resize-none"
            />
            <p className="text-sm text-muted-foreground">
              Describe your business idea, target audience, or problem you want to solve.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lightbulb className="h-4 w-4" />
              <span>Try an example:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_HYPOTHESES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => handleExampleClick(example)}
                  disabled={isLoading}
                  className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            disabled={!hypothesis.trim() || isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing Communities...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Run Research
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
