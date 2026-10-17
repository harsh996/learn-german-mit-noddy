export const VOCAB_LEVELS = ["A1", "A2", "B1"] as const;
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
