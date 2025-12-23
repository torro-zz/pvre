'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  MessageSquare,
  Heart,
  Wrench,
  Copy,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface CustomerLanguageBankProps {
  /** Exact phrases customers use to describe their problems */
  problemPhrases: string[]
  /** Emotional language found in discussions */
  emotionalLanguage?: string[]
  /** Tools and alternatives mentioned */
  toolsMentioned?: string[]
  /** Optional className for styling */
  className?: string
}

// Helper to extract emotional language from pain signals
export function extractEmotionalLanguage(
  painSignals: Array<{
    text: string
    signals?: string[]
    emotion?: string
  }>
): string[] {
  const emotionalTerms = new Set<string>()
  const emotionalPatterns = [
    /\b(frustrat\w*|annoy\w*|hate|terrible|awful|horrible|nightmare|pain|suffer\w*|struggle\w*|difficult|hard|stress\w*|overwhelm\w*|confus\w*|lost|stuck|exhausted|tired of|fed up|can't stand|sick of|impossible|hopeless)\b/gi
  ]

  for (const signal of painSignals) {
    // Check main text
    for (const pattern of emotionalPatterns) {
      const matches = signal.text.match(pattern)
      if (matches) {
        matches.forEach(m => emotionalTerms.add(m.toLowerCase()))
      }
    }
    // Check signal descriptions
    if (signal.signals) {
      for (const signalText of signal.signals) {
        for (const pattern of emotionalPatterns) {
          const matches = signalText.match(pattern)
          if (matches) {
            matches.forEach(m => emotionalTerms.add(m.toLowerCase()))
          }
        }
      }
    }
  }

  return Array.from(emotionalTerms).slice(0, 10)
}

// Helper to extract tools mentioned from theme analysis
export function extractToolsMentioned(
  alternatives: string[],
  painSignals?: Array<{ text: string }>
): string[] {
  const tools = new Set(alternatives)

  if (painSignals) {
    for (const signal of painSignals) {
      // Look for mentions like "using X" or "tried X"
      const usingMatch = signal.text.match(/(?:using|tried|use|switched to|moving to)\s+(\w+)/gi)
      if (usingMatch) {
        usingMatch.forEach(m => {
          const tool = m.split(/\s+/).pop()
          if (tool && tool.length > 2 && tool[0] === tool[0].toUpperCase()) {
            tools.add(tool)
          }
        })
      }
    }
  }

  return Array.from(tools).slice(0, 15)
}

export function CustomerLanguageBank({
  problemPhrases,
  emotionalLanguage = [],
  toolsMentioned = [],
  className,
}: CustomerLanguageBankProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const copyToClipboard = async (text: string, section: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(section)
    setTimeout(() => setCopied(null), 2000)
  }

  const formatAllLanguage = () => {
    let text = '# Customer Language Bank\n\n'

    if (problemPhrases.length > 0) {
      text += '## How They Describe The Problem\n'
      text += problemPhrases.map(p => `• "${p}"`).join('\n')
      text += '\n\n'
    }

    if (emotionalLanguage.length > 0) {
      text += '## Emotional Language\n'
      text += emotionalLanguage.map(e => `• ${e}`).join('\n')
      text += '\n\n'
    }

    if (toolsMentioned.length > 0) {
      text += '## Tools They Mention\n'
      text += toolsMentioned.map(t => `• ${t}`).join('\n')
    }

    return text
  }

  // Don't render if no content
  if (problemPhrases.length === 0 && emotionalLanguage.length === 0 && toolsMentioned.length === 0) {
    return null
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Customer Language Bank
            </CardTitle>
            <CardDescription>
              Real phrases to use in marketing and interviews
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(formatAllLanguage(), 'all')}
          >
            {copied === 'all' ? (
              <>
                <Check className="mr-2 h-3 w-3" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-3 w-3" />
                Copy All
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Problem Phrases */}
        {problemPhrases.length > 0 && (
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
              How They Describe The Problem
            </h4>
            <div className="flex flex-wrap gap-2">
              {problemPhrases.map((phrase, i) => (
                <Badge key={i} variant="secondary" className="font-normal">
                  "{phrase}"
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Emotional Language */}
        {emotionalLanguage.length > 0 && (
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
              <Heart className="w-3.5 h-3.5 text-muted-foreground" />
              Emotional Language
            </h4>
            <div className="flex flex-wrap gap-2">
              {emotionalLanguage.map((term, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
                >
                  {term}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Tools Mentioned */}
        {toolsMentioned.length > 0 && (
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
              <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
              Tools They Mention
            </h4>
            <div className="flex flex-wrap gap-2">
              {toolsMentioned.map((tool, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400"
                >
                  {tool}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Usage tip */}
        <div className="pt-2 border-t text-xs text-muted-foreground">
          Use these exact phrases in your landing page copy, ads, and interview scripts to resonate with your target audience.
        </div>
      </CardContent>
    </Card>
  )
}
