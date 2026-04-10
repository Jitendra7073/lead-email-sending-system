import { NextResponse } from 'next/server';
import { validateGmailSettings, testGmailConnection } from '@/lib/email/settings-validator';

export async function GET() {
  const validation = await validateGmailSettings();
  const connectionTest = validation.isValid ? await testGmailConnection() : null;

  return NextResponse.json({
    success: validation.isValid,
    validation: {
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings,
      settings: validation.settings
    },
    connection: connectionTest
  });
}
