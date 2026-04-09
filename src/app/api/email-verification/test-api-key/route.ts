import { NextResponse } from 'next/server';
import { testApifyApiKey } from '@/lib/services/apify';

/**
 * POST /api/email-verification/test-api-key
 * Test Apify API key validity
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { api_key } = body;

    if (!api_key) {
      return NextResponse.json({
        success: false,
        error: 'api_key is required'
      }, { status: 400 });
    }

    const isValid = await testApifyApiKey(api_key);

    if (isValid) {
      return NextResponse.json({
        success: true,
        message: 'API key is valid'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid API key'
      }, { status: 401 });
    }
  } catch (error: any) {
    console.error('Error testing API key:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
