import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeTiming } from "@/lib/analysis/timing-analyzer";
import { StepStatusMap } from "@/types/database";
import { saveResearchResult } from "@/lib/research/save-result";

// Helper to update step status
async function updateStepStatus(
  jobId: string,
  stepName: keyof StepStatusMap,
  status: StepStatusMap[keyof StepStatusMap],
  unlockNext?: keyof StepStatusMap
) {
  const adminClient = createAdminClient();

  // Get current step status
  const { data: job } = await adminClient
    .from('research_jobs')
    .select('step_status')
    .eq('id', jobId)
    .single();

  const currentStatus = (job?.step_status as unknown as StepStatusMap) || {
    pain_analysis: 'pending',
    market_sizing: 'locked',
    timing_analysis: 'locked',
    competitor_analysis: 'locked',
  };

  // Update the step status
  const newStatus: StepStatusMap = {
    ...currentStatus,
    [stepName]: status,
  };

  // Unlock next step if specified
  if (unlockNext && status === 'completed') {
    newStatus[unlockNext] = 'pending';
  }

  await adminClient
    .from('research_jobs')
    .update({ step_status: JSON.parse(JSON.stringify(newStatus)) })
    .eq('id', jobId);
}

export async function POST(request: NextRequest) {
  let jobId: string | null = null;

  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { hypothesis, industry, jobId: requestJobId } = body;
    jobId = requestJobId;

    if (!hypothesis || typeof hypothesis !== "string") {
      return NextResponse.json(
        { error: "Hypothesis is required" },
        { status: 400 }
      );
    }

    // If jobId provided, check step guard and update status
    if (jobId) {
      const adminClient = createAdminClient();
      const { data: job } = await adminClient
        .from('research_jobs')
        .select('step_status')
        .eq('id', jobId)
        .single();

      const stepStatus = job?.step_status as unknown as StepStatusMap | null;

      // Check if market_sizing is completed (required before timing_analysis)
      if (stepStatus && stepStatus.market_sizing !== 'completed') {
        return NextResponse.json(
          { error: "Market sizing must be completed before timing analysis" },
          { status: 400 }
        );
      }

      // Check if timing_analysis is locked
      if (stepStatus && stepStatus.timing_analysis === 'locked') {
        return NextResponse.json(
          { error: "Timing analysis is locked. Complete previous steps first." },
          { status: 400 }
        );
      }

      // Update step status to in_progress
      await updateStepStatus(jobId, 'timing_analysis', 'in_progress');
    }

    console.log(`[Timing Analysis] Starting for: "${hypothesis.slice(0, 50)}..."`);
    const startTime = Date.now();

    // Run timing analysis
    const result = await analyzeTiming({
      hypothesis,
      industry
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Timing Analysis] Completed in ${duration}s - Score: ${result.score}/10`);

    // If jobId provided, save results and update step status
    if (jobId) {
      // Save results using shared utility
      await saveResearchResult(jobId, 'timing_analysis', result);

      // Update step status to completed and unlock competitor_analysis
      await updateStepStatus(jobId, 'timing_analysis', 'completed', 'competitor_analysis');
    }

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        processingTime: `${duration}s`,
        hypothesis: hypothesis.slice(0, 100)
      }
    });

  } catch (error) {
    console.error("[Timing Analysis] Error:", error);

    // Update step status to failed if jobId provided
    if (jobId) {
      await updateStepStatus(jobId, 'timing_analysis', 'failed');
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error: "Timing analysis failed",
        details: errorMessage,
        suggestion: "Please try again or simplify your hypothesis"
      },
      { status: 500 }
    );
  }
}
