/**
 * DigiExplodeAI — Firebase ID-Token Verification Middleware for Cloudflare Workers
 * Uses native Web Crypto API (crypto.subtle) for zero-overhead, Worker-native RS256 verification.
 */

import type { Env } from './types';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const DEFAULT_FIREBASE_PROJECT_ID = 'gen-lang-client-0746984388';

interface CachedJwks {
  keys: any[];
  expiresAt: number;
}

let inMemoryJwksCache: CachedJwks | null = null;

/**
 * Base64URL decoder compatible with Cloudflare Workers V8 runtime
 */
export function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decodes and parses a JWT without verification (used to extract header & payload)
 */
export function parseJwtParts(token: string): {
  header: any;
  payload: any;
  signedData: Uint8Array;
  signature: Uint8Array;
} | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const textDecoder = new TextDecoder();
    const headerJson = textDecoder.decode(base64UrlDecode(parts[0]));
    const payloadJson = textDecoder.decode(base64UrlDecode(parts[1]));
    const signature = base64UrlDecode(parts[2]);
    const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);

    return {
      header: JSON.parse(headerJson),
      payload: JSON.parse(payloadJson),
      signedData,
      signature,
    };
  } catch {
    return null;
  }
}

/**
 * Fetches Google public keys for Firebase Auth with Cache-Control aware caching
 */
async function getGoogleJwks(env?: Env, forceRefresh = false): Promise<any[]> {
  // If test keys injected via env, prioritize them
  if (env?.TEST_JWKS && env.TEST_JWKS.length > 0) {
    return env.TEST_JWKS;
  }

  const now = Date.now();
  if (!forceRefresh && inMemoryJwksCache && inMemoryJwksCache.expiresAt > now) {
    return inMemoryJwksCache.keys;
  }

  const response = await fetch(GOOGLE_JWKS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Google JWKS: ${response.status}`);
  }

  const data: any = await response.json();
  const keys = Array.isArray(data.keys) ? data.keys : [];

  // Determine TTL from Cache-Control max-age or default to 1 hour
  let ttlSeconds = 3600;
  const cc = response.headers.get('Cache-Control');
  if (cc) {
    const match = cc.match(/max-age=(\d+)/);
    if (match) {
      ttlSeconds = Math.max(60, parseInt(match[1], 10));
    }
  }

  inMemoryJwksCache = {
    keys,
    expiresAt: now + ttlSeconds * 1000,
  };

  return keys;
}

/**
 * Extracts Bearer token from the standard Authorization header
 */
export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!authHeader) {
    return null;
  }
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Verifies a Firebase ID token:
 * 1. Validates structure and algorithm (RS256)
 * 2. Matches kid to Google's published JWKS
 * 3. Verifies cryptographic signature using crypto.subtle
 * 4. Validates issuer, audience, subject, and expiration
 * 5. Rejects anonymous sessions
 */
export async function verifyFirebaseIdToken(
  token: string,
  env?: Env
): Promise<{
  success: true;
  uid: string;
  email: string;
  payload: Record<string, any>;
} | {
  success: false;
  status: 401;
  error: string;
}> {
  if (!token || typeof token !== 'string') {
    return { success: false, status: 401, error: 'Token must be a non-empty string' };
  }

  const parsed = parseJwtParts(token);
  if (!parsed) {
    return { success: false, status: 401, error: 'Malformed JWT structure' };
  }

  const { header, payload, signedData, signature } = parsed;

  // 1. Verify Header
  if (header.alg !== 'RS256') {
    return { success: false, status: 401, error: `Unsupported algorithm: expected RS256, got ${header.alg}` };
  }
  if (!header.kid || typeof header.kid !== 'string') {
    return { success: false, status: 401, error: 'JWT header missing key identifier (kid)' };
  }

  // 2. Locate Public Key (JWK)
  let keys = await getGoogleJwks(env, false);
  let matchingJwk = keys.find((k: any) => k.kid === header.kid);

  // If not found in cache, force fresh fetch in case of key rotation
  if (!matchingJwk) {
    keys = await getGoogleJwks(env, true);
    matchingJwk = keys.find((k: any) => k.kid === header.kid);
  }

  if (!matchingJwk) {
    return { success: false, status: 401, error: `Public key with kid '${header.kid}' not found` };
  }

  // 3. Cryptographic Signature Verification
  try {
    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      matchingJwk,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: { name: 'SHA-256' },
      },
      false,
      ['verify']
    );

    const isSigValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      signature,
      signedData
    );

    if (!isSigValid) {
      return { success: false, status: 401, error: 'Invalid JWT signature' };
    }
  } catch (err: any) {
    return { success: false, status: 401, error: `Signature verification error: ${err?.message || 'unknown'}` };
  }

  // 4. Claims Validation
  const projectId = env?.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID;
  const nowInSec = Math.floor(Date.now() / 1000);

  // Audience
  if (payload.aud !== projectId) {
    return { success: false, status: 401, error: `Invalid audience: token was issued for project '${payload.aud}', expected '${projectId}'` };
  }

  // Issuer
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  if (payload.iss !== expectedIssuer) {
    return { success: false, status: 401, error: `Invalid issuer: expected '${expectedIssuer}', got '${payload.iss}'` };
  }

  // Subject (UID)
  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.trim().length === 0) {
    return { success: false, status: 401, error: 'Invalid subject: UID must be a non-empty string' };
  }

  // Expiration
  if (typeof payload.exp !== 'number' || payload.exp <= nowInSec) {
    return { success: false, status: 401, error: 'Token has expired' };
  }

  // Issued at & Auth Time (allow 5-minute clock drift)
  if (typeof payload.iat === 'number' && payload.iat > nowInSec + 300) {
    return { success: false, status: 401, error: 'Token issued in the future' };
  }
  if (typeof payload.auth_time === 'number' && payload.auth_time > nowInSec + 300) {
    return { success: false, status: 401, error: 'Authentication time in the future' };
  }

  // 5. Reject Anonymous Sessions
  const isAnonymous =
    payload.firebase?.sign_in_provider === 'anonymous' ||
    payload.provider_id === 'anonymous';

  if (isAnonymous) {
    return { success: false, status: 401, error: 'Anonymous authentication is not permitted on this API' };
  }

  return {
    success: true,
    uid: payload.sub,
    email: payload.email || '',
    payload,
  };
}

/**
 * Resets the in-memory JWKS cache (useful for tests)
 */
export function clearJwksCache(): void {
  inMemoryJwksCache = null;
}
