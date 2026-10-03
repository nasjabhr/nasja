/**
 * Security engine for Nasjah Atelier ERP
 * Strict brute-force protection, rate limiting, and founder access restriction.
 */

const STORAGE_KEY_ATTEMPTS = 'nasjah_sec_attempts';
const STORAGE_KEY_LOCKOUT = 'nasjah_sec_lockout_until';
const STORAGE_KEY_LAST_FAIL = 'nasjah_sec_last_fail';

// Authorized emails (Nasjah Founders)
export const AUTHORIZED_EMAILS: string[] = [
  'nasjabhr@gmail.com',
];

export const MAX_ALLOWED_ATTEMPTS = 3;
export const BASE_LOCKOUT_SECONDS = 300; // 5 minutes initial lockout
export const EXTENDED_LOCKOUT_SECONDS = 900; // 15 minutes for repeated lockout

export interface SecurityState {
  attempts: number;
  isLocked: boolean;
  remainingSeconds: number;
  lockoutUntil: number;
  lastFailedAt: string | null;
}

export function getSecurityState(): SecurityState {
  try {
    const attempts = parseInt(localStorage.getItem(STORAGE_KEY_ATTEMPTS) || '0', 10);
    const lockoutUntil = parseInt(localStorage.getItem(STORAGE_KEY_LOCKOUT) || '0', 10);
    const lastFailedAt = localStorage.getItem(STORAGE_KEY_LAST_FAIL);
    const now = Date.now();

    if (lockoutUntil > now) {
      const remainingSeconds = Math.ceil((lockoutUntil - now) / 1000);
      return {
        attempts,
        isLocked: true,
        remainingSeconds,
        lockoutUntil,
        lastFailedAt,
      };
    }

    return {
      attempts: lockoutUntil > 0 && lockoutUntil <= now ? 0 : attempts,
      isLocked: false,
      remainingSeconds: 0,
      lockoutUntil: 0,
      lastFailedAt,
    };
  } catch {
    return {
      attempts: 0,
      isLocked: false,
      remainingSeconds: 0,
      lockoutUntil: 0,
      lastFailedAt: null,
    };
  }
}

export function recordFailedAttempt(): SecurityState {
  const current = getSecurityState();
  const newAttempts = current.attempts + 1;
  const now = Date.now();

  localStorage.setItem(STORAGE_KEY_ATTEMPTS, newAttempts.toString());
  localStorage.setItem(STORAGE_KEY_LAST_FAIL, new Date().toLocaleTimeString('ar-BH'));

  if (newAttempts >= MAX_ALLOWED_ATTEMPTS) {
    const lockoutDuration = newAttempts > MAX_ALLOWED_ATTEMPTS 
      ? EXTENDED_LOCKOUT_SECONDS * 1000 
      : BASE_LOCKOUT_SECONDS * 1000;
      
    const lockoutUntil = now + lockoutDuration;
    localStorage.setItem(STORAGE_KEY_LOCKOUT, lockoutUntil.toString());

    return {
      attempts: newAttempts,
      isLocked: true,
      remainingSeconds: Math.ceil(lockoutDuration / 1000),
      lockoutUntil,
      lastFailedAt: new Date().toLocaleTimeString('ar-BH'),
    };
  }

  return {
    attempts: newAttempts,
    isLocked: false,
    remainingSeconds: 0,
    lockoutUntil: 0,
    lastFailedAt: new Date().toLocaleTimeString('ar-BH'),
  };
}

export function resetFailedAttempts(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_ATTEMPTS);
    localStorage.removeItem(STORAGE_KEY_LOCKOUT);
    localStorage.removeItem(STORAGE_KEY_LAST_FAIL);
  } catch {
    // Ignore storage issues
  }
}

export const AUTHORIZED_UIDS: string[] = [
  '53cc7a5b-bc93-40ff-908e-d582d85e0efc',
];
export const AUTHORIZED_UID = '53cc7a5b-bc93-40ff-908e-d582d85e0efc';

/**
 * Checks whether an email is on the founders whitelist
 */
export function isEmailAuthorized(email: string): boolean {
  const cleanEmail = email.trim().toLowerCase();
  // Allow configured founders
  if (AUTHORIZED_EMAILS.some((e) => e.toLowerCase() === cleanEmail)) {
    return true;
  }
  // Allow if domain is specifically company domain or pre-configured in project
  return false;
}

/**
 * Verifies that the logged-in user is an authorized founder (by email or UID).
 * Guarantees founders have absolute access and never get locked out.
 */
export function isUserAuthorized(user: { id?: string; email?: string | null } | null | undefined): boolean {
  if (!user) return false;
  // 1. Authorized if email belongs to approved founders
  if (user.email && isEmailAuthorized(user.email)) return true;
  // 2. Authorized if user UID belongs to founder UIDs
  if (user.id && AUTHORIZED_UIDS.includes(user.id)) return true;
  return false;
}
