import { NextResponse } from "next/server";
import {
  getRepliesForQueueItem,
  getAllRecentReplies,
} from "@/lib/email/reply-tracker";

// Force Next.js to skip the cache so you see new replies immediately
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const queueId = searchParams.get("queueId");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    // Validate limit to prevent database strain
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    if (queueId) {
      // 1. Fetch replies for a specific tracking ID
      const replies = await getRepliesForQueueItem(queueId);

      return NextResponse.json({
        success: true,
        data: replies,
        count: replies.length,
      });
    }

    // 2. Otherwise, fetch the global recent feed
    const replies = await getAllRecentReplies(safeLimit);

    return NextResponse.json({
      success: true,
      data: replies,
      count: replies.length,
    });
  } catch (error: any) {
    // Detailed logging for your server console
    console.error(" [API] Error fetching email replies:", error.message);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to retrieve replies. Check server logs.",
      },
      { status: 500 },
    );
  }
}
