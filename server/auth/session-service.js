import crypto from 'crypto';
import { authRepository } from './auth-repository.js';

const absoluteLifetimeMs = 8 * 60 * 60 * 1000;
const idleLifetimeMs = 30 * 60 * 1000;

function shouldUseSecureCookies() {
  if (process.env.FORCE_SECURE_COOKIES === 'true') {
    return true;
  }

  if (process.env.NODE_ENV === 'test') {
    return false;
  }

  if (process.env.ALLOW_INSECURE_COOKIES === 'true') {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('ALLOW_INSECURE_COOKIES is only supported in development.');
    }

    return false;
  }

  return true;
}

function now() {
  return new Date();
}

function toIsoString(date) {
  return date.toISOString();
}

function hashIpAddress(ipAddress) {
  return crypto.createHash('sha256').update(String(ipAddress ?? '')).digest('hex');
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookies(),
    path: '/',
    maxAge: absoluteLifetimeMs,
  };
}

export function createCsrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

export function getCsrfCookieOptions() {
  return {
    httpOnly: false,
    sameSite: 'lax',
    secure: shouldUseSecureCookies(),
    path: '/',
    maxAge: absoluteLifetimeMs,
  };
}

export async function createSessionForUser(userId, metadata = {}) {
  const currentTime = now();
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(currentTime.getTime() + absoluteLifetimeMs);
  const idleExpiresAt = new Date(currentTime.getTime() + idleLifetimeMs);

  await authRepository.createSession({
    id: sessionId,
    userId,
    expiresAt: toIsoString(expiresAt),
    idleExpiresAt: toIsoString(idleExpiresAt),
    userAgent: String(metadata.userAgent ?? ''),
    ipHash: hashIpAddress(metadata.ipAddress),
  });

  return {
    id: sessionId,
    expiresAt: toIsoString(expiresAt),
    idleExpiresAt: toIsoString(idleExpiresAt),
  };
}

export async function validateSession(sessionId) {
  if (!sessionId) {
    return null;
  }

  const session = await authRepository.getSessionById(sessionId);

  if (!session || session.revokedAt) {
    return null;
  }

  const currentTime = now();
  const absoluteExpiry = new Date(session.expiresAt);
  const idleExpiry = new Date(session.idleExpiresAt);

  if (Number.isNaN(absoluteExpiry.getTime()) || Number.isNaN(idleExpiry.getTime())) {
    await authRepository.revokeSession(sessionId);
    return null;
  }

  if (absoluteExpiry <= currentTime || idleExpiry <= currentTime) {
    await authRepository.revokeSession(sessionId);
    return null;
  }

  const nextIdleExpiry = new Date(currentTime.getTime() + idleLifetimeMs);
  await authRepository.touchSession(sessionId, toIsoString(nextIdleExpiry));

  return {
    sessionId: session.id,
    user: {
      id: session.userId,
      email: session.email,
      createdAt: session.userCreatedAt,
    },
  };
}

export async function revokeSessionById(sessionId) {
  if (!sessionId) {
    return;
  }
  await authRepository.revokeSession(sessionId);
}

export async function revokeSessionsByUserId(userId) {
  await authRepository.revokeUserSessions(userId);
}

export async function cleanupExpiredSessions() {
  const currentTime = toIsoString(now());
  await authRepository.deleteExpiredSessions(currentTime);
}
