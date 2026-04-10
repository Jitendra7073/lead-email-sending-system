import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, createSession, setAuthCookie } from '@/lib/auth/simple-auth';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // Verify password
    if (!verifyPassword(password)) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Create session
    const token = await createSession();

    // Set cookie
    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      message: 'Authenticated successfully',
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
