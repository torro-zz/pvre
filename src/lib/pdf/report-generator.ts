/**
 * PDF Report Generator for PVRE Research Results
 * Generates comprehensive PDF reports from research data.
 */

import jsPDF from 'jspdf';
import type { CommunityVoiceResult } from '@/app/api/research/community-voice/route';
import type { CompetitorIntelligenceResult } from '@/app/api/research/competitor-intelligence/route';
import type { ViabilityVerdict } from '@/lib/analysis/viability-calculator';

export interface ReportData {
  hypothesis: string;
  createdAt: string;
  viability: ViabilityVerdict;
  communityVoice?: CommunityVoiceResult;
  competitors?: CompetitorIntelligenceResult;
}

export function generatePDFReport(data: ReportData): jsPDF {
  const doc = new jsPDF();
  let y = 20;
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;

  // Helper function for text wrapping
  const addWrappedText = (text: string, fontSize: number, maxWidth: number = contentWidth) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, margin, y);
    y += lines.length * (fontSize * 0.5) + 5;
  };

  // Helper for new page check
  const checkNewPage = (neededSpace: number = 40) => {
    if (y > doc.internal.pageSize.getHeight() - neededSpace) {
      doc.addPage();
      y = 20;
    }
  };

  // === PAGE 1: Executive Summary ===

  // Header
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('PVRE Research Report', margin, y);
  y += 15;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(128);
  doc.text(`Generated: ${data.createdAt}`, margin, y);
  y += 15;

  // Hypothesis
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Hypothesis', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  addWrappedText(data.hypothesis, 11);
  y += 10;

  // Viability Verdict Box
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, contentWidth, 50, 'F');

  y += 10;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Viability Verdict', margin + 5, y);
  y += 10;

  doc.setFontSize(28);
  const verdictColor = data.viability.verdict === 'strong' ? [34, 197, 94] :
                       data.viability.verdict === 'mixed' ? [234, 179, 8] :
                       data.viability.verdict === 'weak' ? [249, 115, 22] :
                       [239, 68, 68];
  doc.setTextColor(verdictColor[0], verdictColor[1], verdictColor[2]);
  doc.text(`${data.viability.overallScore.toFixed(1)}/10`, margin + 5, y);

  doc.setFontSize(14);
  doc.text(data.viability.verdictLabel, margin + 50, y);
  y += 15;

  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  addWrappedText(data.viability.verdictDescription, 10, contentWidth - 10);
  y += 20;

  // Dimension scores
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Dimension Breakdown', margin, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  data.viability.dimensions.forEach(dim => {
    doc.text(`${dim.name}: ${dim.score.toFixed(1)}/10 (${Math.round(dim.weight * 100)}% weight)`, margin, y);
    y += 7;
  });
  y += 10;

  // Dealbreakers
  if (data.viability.dealbreakers.length > 0) {
    checkNewPage();
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(239, 68, 68);
    doc.text('Dealbreakers', margin, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0);
    data.viability.dealbreakers.forEach(db => {
      addWrappedText(`- ${db}`, 10);
    });
    y += 5;
  }

  // Recommendations
  if (data.viability.recommendations.length > 0) {
    checkNewPage();
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Recommendations', margin, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    data.viability.recommendations.forEach((rec, i) => {
      checkNewPage();
      addWrappedText(`${i + 1}. ${rec}`, 10);
    });
  }

  // === PAGE 2: Community Voice (if available) ===
  if (data.communityVoice) {
    doc.addPage();
    y = 20;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Community Voice Analysis', margin, y);
    y += 15;

    // Pain Summary
    const painSummary = data.communityVoice.painSummary;
    doc.setFontSize(12);
    doc.text(`Total Signals: ${painSummary.totalSignals}`, margin, y);
    y += 7;
    doc.text(`High Intensity: ${painSummary.highIntensityCount} | Medium: ${painSummary.mediumIntensityCount} | Low: ${painSummary.lowIntensityCount}`, margin, y);
    y += 7;
    doc.text(`Willingness to Pay Signals: ${painSummary.willingnessToPayCount}`, margin, y);
    y += 15;

    // Top Subreddits
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Top Subreddits', margin, y);
    y += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    painSummary.topSubreddits.slice(0, 5).forEach(sub => {
      doc.text(`r/${sub.name}: ${sub.count} signals`, margin, y);
      y += 6;
    });
    y += 10;

    // Themes
    if (data.communityVoice.themeAnalysis?.themes) {
      checkNewPage(60);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Top Pain Themes', margin, y);
      y += 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      data.communityVoice.themeAnalysis.themes.slice(0, 5).forEach(theme => {
        checkNewPage();
        doc.setFont('helvetica', 'bold');
        doc.text(`${theme.name} (${theme.intensity})`, margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        addWrappedText(theme.description, 9);
        y += 3;
      });
    }

    // Market Sizing
    if (data.communityVoice.marketSizing) {
      checkNewPage(80);
      y += 10;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Market Sizing', margin, y);
      y += 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const ms = data.communityVoice.marketSizing;
      doc.text(`TAM: ${ms.tam.value.toLocaleString()} - ${ms.tam.description}`, margin, y);
      y += 6;
      doc.text(`SAM: ${ms.sam.value.toLocaleString()} - ${ms.sam.description}`, margin, y);
      y += 6;
      doc.text(`SOM: ${ms.som.value.toLocaleString()} - ${ms.som.description}`, margin, y);
      y += 10;
      doc.text(`Customers Needed: ${ms.mscAnalysis.customersNeeded.toLocaleString()}`, margin, y);
      y += 6;
      doc.text(`Penetration Required: ${ms.mscAnalysis.penetrationRequired.toFixed(1)}%`, margin, y);
      y += 6;
      doc.text(`Achievability: ${ms.mscAnalysis.achievability.replace('_', ' ')}`, margin, y);
    }

    // Timing
    if (data.communityVoice.timing) {
      checkNewPage(80);
      y += 15;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Timing Analysis', margin, y);
      y += 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const timing = data.communityVoice.timing;
      doc.text(`Score: ${timing.score.toFixed(1)}/10 | Trend: ${timing.trend} | Window: ${timing.timingWindow}`, margin, y);
      y += 8;
      addWrappedText(timing.verdict, 10);
      y += 5;

      if (timing.tailwinds.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('Tailwinds:', margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        timing.tailwinds.slice(0, 3).forEach(tw => {
          doc.text(`+ ${tw.signal}: ${tw.description.slice(0, 80)}...`, margin + 5, y);
          y += 6;
        });
      }

      if (timing.headwinds.length > 0) {
        y += 3;
        doc.setFont('helvetica', 'bold');
        doc.text('Headwinds:', margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        timing.headwinds.slice(0, 3).forEach(hw => {
          doc.text(`- ${hw.signal}: ${hw.description.slice(0, 80)}...`, margin + 5, y);
          y += 6;
        });
      }
    }

    // Interview Questions
    if (data.communityVoice.interviewQuestions) {
      doc.addPage();
      y = 20;
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Interview Questions', margin, y);
      y += 15;

      const sections = [
        { title: 'Context Questions', questions: data.communityVoice.interviewQuestions.contextQuestions },
        { title: 'Problem Exploration', questions: data.communityVoice.interviewQuestions.problemQuestions },
        { title: 'Solution Testing', questions: data.communityVoice.interviewQuestions.solutionQuestions }
      ];

      sections.forEach(section => {
        checkNewPage(40);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(section.title, margin, y);
        y += 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        section.questions.forEach((q, i) => {
          checkNewPage();
          addWrappedText(`${i + 1}. ${q}`, 10);
        });
        y += 5;
      });
    }
  }

  // === PAGE 3: Competitors (if available) ===
  if (data.competitors) {
    doc.addPage();
    y = 20;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Competitive Landscape', margin, y);
    y += 15;

    // Market Overview
    if (data.competitors.marketOverview) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Market Overview', margin, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      addWrappedText(data.competitors.marketOverview.summary, 10);
      y += 5;
      doc.text(`Market Maturity: ${data.competitors.marketOverview.maturityLevel}`, margin, y);
      y += 15;
    }

    // Competitors
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Key Competitors', margin, y);
    y += 10;

    data.competitors.competitors.slice(0, 5).forEach(comp => {
      checkNewPage(50);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${comp.name} (${comp.threatLevel} threat)`, margin, y);
      y += 7;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      addWrappedText(comp.description, 9);

      if (comp.strengths && comp.strengths.length > 0) {
        doc.text('Strengths: ' + comp.strengths.slice(0, 2).join(', '), margin + 5, y);
        y += 6;
      }
      if (comp.weaknesses && comp.weaknesses.length > 0) {
        doc.text('Weaknesses: ' + comp.weaknesses.slice(0, 2).join(', '), margin + 5, y);
        y += 6;
      }
      y += 5;
    });

    // Gap Analysis
    if (data.competitors.gaps && data.competitors.gaps.length > 0) {
      checkNewPage(60);
      y += 10;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Market Gaps', margin, y);
      y += 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      data.competitors.gaps.slice(0, 5).forEach(gap => {
        checkNewPage();
        doc.setFont('helvetica', 'bold');
        doc.text(`${gap.gap} (${gap.opportunity})`, margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        addWrappedText(gap.description, 9);
        y += 3;
      });
    }
  }

  // Footer on last page
  doc.setFontSize(8);
  doc.setTextColor(128);
  doc.text('Generated by PVRE - Pre-Validation Research Engine', margin, doc.internal.pageSize.getHeight() - 10);

  return doc;
}

// Helper to trigger download
export function downloadPDFReport(data: ReportData, filename?: string): void {
  const doc = generatePDFReport(data);
  const safeName = filename || `pvre-report-${data.hypothesis.slice(0, 30).replace(/[^a-z0-9]/gi, '-')}`;
  doc.save(`${safeName}.pdf`);
}
