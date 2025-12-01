import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeTiming } from "@/lib/analysis/timing-analyzer";

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
    const { hypothesis, industry } = body;

    if (!hypothesis || typeof hypothesis !== "string") {
      return NextResponse.json(
        { error: "Hypothesis is required" },
        { status: 400 }
      );
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
