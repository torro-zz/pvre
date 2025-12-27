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
      const { downloadExecutiveSummaryPDF } = await import('@/lib/pdf/report-generator')
      downloadExecutiveSummaryPDF(reportData)
    } catch (error) {
      console.error('Failed to generate summary PDF:', error)
    } finally {
      setIsGenerating(null)
    }
  }

  const handleInterviewGuide = async () => {
    setIsGenerating('interview')
    try {
      const { downloadInterviewGuidePDF } = await import('@/lib/pdf/report-generator')
      downloadInterviewGuidePDF(reportData)
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

