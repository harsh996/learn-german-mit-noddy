/** Client + server safety filters for abusive / illicit content. */

const BLOCKED_PATTERNS: RegExp[] = [
  /\b(kill\s+yourself|kys)\b/i,
  /\b(nazi|hitler|holocaust\s+denial)\b/i,
  /\b(child\s*porn|csam|pedo)\b/i,
  /\b(how\s+to\s+(make|build)\s+(a\s+)?(bomb|explosive|weapon))\b/i,
  /\b(buy\s+(cocaine|heroin|fentanyl|meth))\b/i,
  /\b(rape|molest)\b/i,
];

const BLOCKED_DE: RegExp[] = [
  /\b(scheiß|scheisse|hurensohn|fotze|wichser)\b/i,
  /\b(nazi|hitler)\b/i,
];

export function containsBlockedContent(text: string): boolean {
  const sample = (text || "").slice(0, 4000);
  return [...BLOCKED_PATTERNS, ...BLOCKED_DE].some((re) => re.test(sample));
}

export const SAFETY_REFUSAL_DE =
  "Ich kann nur bei Sprachübungen helfen. Bitte lass uns höflich auf Deutsch weiter sprechen.";

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const AVATARS = [
  { gender: "female" as const, name: "Hannah" },
  { gender: "male" as const, name: "Lukas" },
];
