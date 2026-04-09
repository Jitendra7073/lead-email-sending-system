import { NextResponse } from "next/server";
import { executeQuery } from "@/lib/db/postgres";

export async function GET() {
  try {
    const settings = await executeQuery(`
      SELECT * FROM email_settings
      ORDER BY key
    `);

    // Convert to key-value object
    const settingsObj: Record<string, any> = {};
    settings.forEach((setting: any) => {
      settingsObj[setting.key] = {
        value: setting.value,
        label: setting.label,
        description: setting.description,
        updated_at: setting.updated_at
      };
    });

    return NextResponse.json({
      success: true,
      settings: settingsObj
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({
        success: false,
        error: "Key and value are required"
      }, { status: 400 });
    }

    // Check if setting exists
    const existing = await executeQuery(`
      SELECT * FROM email_settings WHERE key = $1
    `, [key]);

    if (existing.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Setting not found"
      }, { status: 404 });
    }

    // Update setting
    await executeQuery(`
      UPDATE email_settings
      SET value = $1, updated_at = NOW()
      WHERE key = $2
    `, [value, key]);

    return NextResponse.json({
      success: true,
      message: "Setting updated successfully"
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
