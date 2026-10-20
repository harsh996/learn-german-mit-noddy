import { z } from "zod";

// Pure functions only, so the same rules can run in the browser and on the server.

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX_BYTES = 72; // bcrypt ignores everything past 72 bytes
export const EMAIL_MAX = 254;

const USERNAME_RE = /^[a-z][a-z0-9_]{2,19}$/;

// Usernames that must not be claimable via sign-up (the seeded admin bypasses this).
const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "root", "support", "help", "system", "sprachraum",
  "moderator", "staff", "null", "undefined", "api", "login", "signup",
]);

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "passw0rd", "12345678",
  "123456789", "1234567890", "qwertyui", "qwerty123", "iloveyou", "11111111",
  "abc12345", "letmein1", "welcome1", "admin123", "password123!",
]);

const emailSchema = z.string().email();

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  if (!email) return "Email is required";
  if (email.length > EMAIL_MAX || !emailSchema.safeParse(email).success) {
    return "Enter a valid email address";
  }
  return null;
}

export function validateUsername(username: string): string | null {
  if (!username) return "Username is required";
  if (!USERNAME_RE.test(username)) {
    return "Username must be 3–20 characters: start with a letter, then letters, numbers or underscores";
  }
  if (RESERVED_USERNAMES.has(username)) return "That username is not available";
  return null;
}

export function validatePassword(
  password: string,
  context: { email?: string; username?: string } = {}
): string | null {
  if (password.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters`;
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return `Password is too long (max ${PASSWORD_MAX_BYTES} bytes)`;
  }
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return "That password is too common";
  if (context.email && lower === context.email) return "Password must not be your email";
  if (context.username && lower === context.username) return "Password must not be your username";
  return null;
}
