import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth/simple-auth';

export async function POST() {
  try {
    await clearAuthCookie();

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}
