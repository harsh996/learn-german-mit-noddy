// Fixed-window, in-memory limiter. Good enough for a single container; counters
// reset on restart and are not shared between instances.

type Bucket = { count: number; resetAt: number };

const globalForRl = globalThis as unknown as { __rateBuckets?: Map<string, Bucket> };
const buckets = (globalForRl.__rateBuckets ??= new Map<string, Bucket>());

const MAX_KEYS = 50_000;

function live(key: string): Bucket | undefined {
  const bucket = buckets.get(key);
  if (!bucket) return undefined;
  if (bucket.resetAt <= Date.now()) {
    buckets.delete(key);
    return undefined;
  }
  return bucket;
}

/** Seconds until the key may try again, or 0 if it is under `limit`. */
export function retryAfterSeconds(key: string, limit: number): number {
  const bucket = live(key);
  if (!bucket || bucket.count < limit) return 0;
  return Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000));
}

export function recordHit(key: string, windowMs: number) {
  const bucket = live(key);
  if (bucket) {
    bucket.count += 1;
    return;
  }
  if (buckets.size >= MAX_KEYS) {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    // Still full (attack): drop the oldest entries so memory stays bounded.
    while (buckets.size >= MAX_KEYS) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }
  }
  buckets.set(key, { count: 1, resetAt: Date.now() + windowMs });
}

export function clearKey(key: string) {
  buckets.delete(key);
}
