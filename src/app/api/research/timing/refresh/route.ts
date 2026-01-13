import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeTiming } from "@/lib/analysis/timing-analyzer";

/**
 * POST /api/research/timing/refresh
 *
 * Refreshes Google Trends data for an existing job.
 * Useful when the original job was created while Google Trends API was unavailable.
 */
export async function POST(request: NextRequest) {
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
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId is required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Get job details including coverage_data for app info
    const { data: job, error: jobError } = await adminClient
      .from('research_jobs')
      .select('id, hypothesis, coverage_data, user_id')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Verify user owns this job
    if (job.user_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Extract app name for App Gap mode
    const coverageData = job.coverage_data as { mode?: string; appData?: { name?: string } } | null;
    let appName: string | undefined;

    if (coverageData?.mode === 'app-analysis' && coverageData?.appData?.name) {
      appName = coverageData.appData.name;
      console.log(`[Timing Refresh] App Gap mode - including app name: ${appName}`);
    }

    console.log(`[Timing Refresh] Refreshing timing for job: ${jobId}`);
    const startTime = Date.now();

    // Run timing analysis with appName for better Google Trends results
    // Skip AI Discussion Trends for App Gap mode (irrelevant for app review analysis)
    const isAppGapMode = coverageData?.mode === 'app-analysis';
    const result = await analyzeTiming({
      hypothesis: job.hypothesis,
      appName,
      isAppGapMode
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Timing Refresh] Completed in ${duration}s - Score: ${result.score}/10`);
    console.log(`[Timing Refresh] Google Trends available: ${result.trendData?.dataAvailable ?? false}`);

    // Get the existing community_voice result
    const { data: existingResult, error: resultError } = await adminClient
      .from('research_results')
      .select('id, data')
      .eq('job_id', jobId)
      .eq('module_name', 'community_voice')
      .single();

    if (resultError || !existingResult) {
      return NextResponse.json(
        { error: "Community voice result not found for this job" },
        { status: 404 }
      );
    }

    // Update the timing data in the existing result
    const existingData = existingResult.data as Record<string, unknown> || {};
    const updatedData = {
      ...existingData,
      timing: result
    };

    const { error: updateError } = await adminClient
      .from('research_results')
      .update({ data: JSON.parse(JSON.stringify(updatedData)) })
      .eq('id', existingResult.id);

    if (updateError) {
      console.error('[Timing Refresh] Failed to update result:', updateError);
      return NextResponse.json(
        { error: "Failed to update timing data" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        score: result.score,
        trend: result.trend,
        trendData: result.trendData,
        timingWindow: result.timingWindow
      },
      meta: {
        processingTime: `${duration}s`,
        googleTrendsAvailable: result.trendData?.dataAvailable ?? false,
        keywords: result.trendData?.keywords ?? []
      }
    });

  } catch (error) {
    console.error("[Timing Refresh] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error: "Timing refresh failed",
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
