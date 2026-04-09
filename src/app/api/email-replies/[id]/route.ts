import { NextResponse } from "next/server";
import { executeQuery } from "@/lib/db/postgres";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Reply ID is required" },
        { status: 400 }
      );
    }

    const result = await executeQuery(
      "DELETE FROM email_replies WHERE id = $1 RETURNING id",
      [id]
    );

    if (!result || result.length === 0) {
      return NextResponse.json(
        { success: false, error: "Reply not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Reply deleted successfully"
    });
  } catch (error: any) {
    console.error("Error deleting reply:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
