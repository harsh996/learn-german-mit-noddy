// Edge-safe (no Node imports): shared by middleware and route handlers.

const DEV_SECRET = "german-tutor-dev-secret-change-in-prod";

const KNOWN_WEAK = new Set([
  DEV_SECRET,
  "change-me-to-a-long-random-string",
  "changeme",
  "secret",
]);

export function getAuthSecretString(): string {
  const secret = process.env.AUTH_SECRET?.trim();

  if (process.env.NODE_ENV !== "production") {
    return secret || DEV_SECRET;
  }

  if (!secret || secret.length < 32 || KNOWN_WEAK.has(secret)) {
    // Refuse to sign/verify sessions with a guessable key: anyone could forge a login.
    throw new Error(
      "AUTH_SECRET must be set to a random string of at least 32 characters " +
        "(generate one with: openssl rand -base64 48)"
    );
  }
  return secret;
}

export function getAuthSecret() {
  return new TextEncoder().encode(getAuthSecretString());
}
