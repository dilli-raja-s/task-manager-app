import { AppError } from '../errors.js';

const bannedPasswords = new Set([
  'password',
  'password123',
  'qwerty123',
  'letmein123',
  '123456789',
  'admin123',
  'welcome123',
  'iloveyou123',
]);

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export function validateRegistrationPayload(payload) {
  const normalizedEmail = normalizeEmail(payload.email);
  const password = String(payload.password ?? '');
  const issues = [];

  if (!emailPattern.test(normalizedEmail)) {
    issues.push('Email must be a valid address.');
  }

  if (password.length < 12 || password.length > 128) {
    issues.push('Password must be between 12 and 128 characters.');
  }

  if (!/[A-Z]/.test(password)) {
    issues.push('Password must contain at least one uppercase letter.');
  }

  if (!/[a-z]/.test(password)) {
    issues.push('Password must contain at least one lowercase letter.');
  }

  if (!/[0-9]/.test(password)) {
    issues.push('Password must contain at least one number.');
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    issues.push('Password must contain at least one special character.');
  }

  const localPart = normalizedEmail.split('@')[0] ?? '';
  if (localPart && password.toLowerCase().includes(localPart)) {
    issues.push('Password cannot contain the email local part.');
  }

  if (bannedPasswords.has(password.toLowerCase())) {
    issues.push('Password is too common. Choose a stronger password.');
  }

  if (issues.length > 0) {
    throw new AppError(400, 'AUTH_PASSWORD_POLICY_VIOLATION', 'Password policy requirements were not met.', {
      issues,
    });
  }

  return {
    email: normalizedEmail,
    password,
  };
}

export function validateLoginPayload(payload) {
  const email = normalizeEmail(payload.email);
  const password = String(payload.password ?? '');

  if (!email || !password) {
    throw new AppError(400, 'AUTH_INVALID_LOGIN_PAYLOAD', 'Email and password are required.');
  }

  return { email, password };
}
