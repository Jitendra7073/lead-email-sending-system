import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const APP_PASSWORD = process.env.APP_PASSWORD || '';
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'change-this-secret'
);
const SESSION_DURATION = parseInt(
  process.env.SESSION_DURATION || '86400'
); // 24 hours default

export interface SessionPayload {
  authenticated: boolean;
  timestamp: number;
  [key: string]: unknown; // Index signature for JWTPayload compatibility
}

/**
 * Verify password matches
 */
export function verifyPassword(password: string): boolean {
  return password === APP_PASSWORD;
}

/**
 * Create session token
 */
export async function createSession(): Promise<string> {
  const payload: SessionPayload = {
    authenticated: true,
    timestamp: Date.now(),
  };

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION} seconds from now`)
    .sign(JWT_SECRET);
}

/**
 * Verify session token
 */
export async function verifySession(
  token: string
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const sessionPayload = payload as unknown as SessionPayload;
    return sessionPayload.authenticated === true;
  } catch {
    return false;
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) return false;

  return verifySession(token);
}

/**
 * Set auth cookie
 */
export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_DURATION,
    path: '/',
  });
}

/**
 * Clear auth cookie
 */
export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('auth-token');
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<void> {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    throw new Error('UNAUTHORIZED');
  }
}
