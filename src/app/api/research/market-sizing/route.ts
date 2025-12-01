import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateMarketSize } from "@/lib/analysis/market-sizing";

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
    const { hypothesis, geography, targetPrice, mscTarget } = body;

    if (!hypothesis || typeof hypothesis !== "string") {
      return NextResponse.json(
        { error: "Hypothesis is required" },
        { status: 400 }
      );
    }

    console.log(`[Market Sizing] Starting analysis for: "${hypothesis.slice(0, 50)}..."`);
    const startTime = Date.now();

    // Run market sizing analysis
    const result = await calculateMarketSize({
      hypothesis,
      geography,
      targetPrice,
      mscTarget
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Market Sizing] Completed in ${duration}s - Score: ${result.score}/10`);

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        processingTime: `${duration}s`,
        hypothesis: hypothesis.slice(0, 100)
      }
    });

  } catch (error) {
    console.error("[Market Sizing] Error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error: "Market sizing analysis failed",
        details: errorMessage,
        suggestion: "Please try again or simplify your hypothesis"
      },
      { status: 500 }
    );
  }
}
