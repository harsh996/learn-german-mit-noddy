export const VOCAB_LEVELS = ["A1", "A2", "B1", "B2", "OTHERS"] as const;

/** Display name for a level code ("OTHERS" -> "Others"). */
export function levelLabel(level: string) {
  return level === "OTHERS" ? "Others" : level;
}
export const VOCAB_POS = [
  "adjective",
  "adverb",
  "conjunction",
  "interjection",
  "noun",
  "number",
  "preposition",
  "pronoun",
  "verb",
] as const;

export type Example = { de: string; en: string; glosses?: Record<string, string> };
export type Meaning = { english: string; examples: Example[] };
export type VocabEntry = {
  key: string;
  word: string;
  pos: string;
  level: string;
  article?: string;
  /** Plural form / verb principal parts / other usage notes. */
  notes?: string;
  frequency: number;
  meanings: Meaning[];
};
