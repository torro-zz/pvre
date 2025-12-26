'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Download,
  Loader2,
  FileText,
  MessageSquare,
  Link2,
  ChevronDown,
  Check,
} from 'lucide-react'
import type { ReportData } from '@/lib/pdf/report-generator'

interface ExportDropdownProps {
  reportData: ReportData
  jobId: string
  className?: string
}

export function ExportDropdown({ reportData, jobId, className }: ExportDropdownProps) {
  const [isGenerating, setIsGenerating] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleFullPDF = async () => {
    setIsGenerating('full')
    try {
      const { downloadPDFReport } = await import('@/lib/pdf/report-generator')
      downloadPDFReport(reportData)
    } catch (error) {
      console.error('Failed to generate PDF:', error)
    } finally {
      setIsGenerating(null)
    }
  }

  const handleSummaryPDF = async () => {
    setIsGenerating('summary')
    try {
      const { downloadPDFReport } = await import('@/lib/pdf/report-generator')
      // For now, use full report with summary filename - could be enhanced later
      downloadPDFReport(reportData, `pvre-summary-${Date.now()}.pdf`)
    } catch (error) {
      console.error('Failed to generate summary PDF:', error)
    } finally {
      setIsGenerating(null)
    }
  }

  const handleInterviewGuide = async () => {
    setIsGenerating('interview')
    try {
      // Generate interview questions based on research findings
      const questions = generateInterviewQuestions(reportData)
      downloadInterviewGuide(questions, reportData.hypothesis)
    } catch (error) {
      console.error('Failed to generate interview guide:', error)
    } finally {
      setIsGenerating(null)
    }
  }

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/research/${jobId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy link:', error)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Export
              <ChevronDown className="h-3 w-3 ml-1" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleFullPDF} disabled={isGenerating !== null}>
          <FileText className="h-4 w-4 mr-2" />
          <div className="flex-1">
            <div className="font-medium">Full Report (PDF)</div>
            <div className="text-xs text-muted-foreground">Complete research analysis</div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleSummaryPDF} disabled={isGenerating !== null}>
          <FileText className="h-4 w-4 mr-2" />
          <div className="flex-1">
            <div className="font-medium">Executive Summary</div>
            <div className="text-xs text-muted-foreground">1-page overview</div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleInterviewGuide} disabled={isGenerating !== null}>
          <MessageSquare className="h-4 w-4 mr-2" />
          <div className="flex-1">
            <div className="font-medium">Interview Guide</div>
            <div className="text-xs text-muted-foreground">Questions for customer discovery</div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleCopyLink}>
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2 text-emerald-500" />
              <span className="text-emerald-600">Link Copied!</span>
            </>
          ) : (
            <>
              <Link2 className="h-4 w-4 mr-2" />
              <span>Copy Share Link</span>
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Generate interview questions based on research findings
function generateInterviewQuestions(data: ReportData): string[] {
  const questions: string[] = []

  // Context questions
  questions.push("Tell me about your role and daily responsibilities.")
  questions.push("Walk me through a typical day/week in your work.")

  // Problem exploration (based on hypothesis)
  if (data.hypothesis) {
    questions.push(`When was the last time you experienced frustration with ${extractProblemArea(data.hypothesis)}?`)
    questions.push("What did you do about it?")
    questions.push("How much time/money did that cost you?")
  }

  // Pain validation
  if (data.communityVoice?.painSummary?.strongestSignals?.length) {
    questions.push("What's the most frustrating part of your current workflow?")
    questions.push("Have you tried any solutions to fix this?")
  }

  // WTP validation
  if (data.communityVoice?.painSummary?.willingnessToPayCount && data.communityVoice.painSummary.willingnessToPayCount > 0) {
    questions.push("How much would you pay to solve this problem completely?")
    questions.push("What would a solution need to have for you to switch from what you're using now?")
  }

  // Solution exploration
  questions.push("If you had a magic wand, what would the ideal solution look like?")
  questions.push("What have you tried in the past that didn't work?")

  return questions
}

// Extract problem area from hypothesis
function extractProblemArea(hypothesis: string): string {
  // Simple extraction - get the main topic
  const words = hypothesis.toLowerCase().split(' ')
  const stopWords = ['a', 'the', 'to', 'for', 'with', 'and', 'or', 'but', 'is', 'are', 'that', 'this']
  const meaningful = words.filter(w => !stopWords.includes(w) && w.length > 3)
  return meaningful.slice(0, 3).join(' ') || 'this area'
}

// Download interview guide as text file
function downloadInterviewGuide(questions: string[], hypothesis: string) {
  const content = `INTERVIEW GUIDE
================

Research Hypothesis: ${hypothesis}

INTERVIEW QUESTIONS
-------------------

${questions.map((q, i) => `${i + 1}. ${q}`).join('\n\n')}

TIPS FOR CONDUCTING INTERVIEWS
------------------------------

1. Don't pitch your solution - focus on understanding their problems
2. Ask "why" and "can you tell me more" to go deeper
3. Look for specific examples, not generalizations
4. Listen for emotional language indicating real pain
5. Note what they're currently doing (or not doing) about the problem

AFTER THE INTERVIEW
-------------------

- What surprised you?
- What validated your hypothesis?
- What challenged your assumptions?
- What follow-up questions emerged?

Generated by PVRE - Pre-Validation Research Engine
`

  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `interview-guide-${Date.now()}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
