import fs from "fs";
import path from "path";

import type { Meaning, VocabEntry } from "./vocabTypes";

type RawEntry = Partial<VocabEntry> & { word?: string; meanings?: Meaning[] };

let cache: { entries: VocabEntry[]; mtime: number } | null = null;

function dir() {
  return path.join(process.cwd(), "data", "vocab");
}

function slug(s: string) {
  return s.toLowerCase().replace(/\s+/g, "-");
}

function load(): VocabEntry[] {
  const d = dir();
  if (!fs.existsSync(d)) return [];
  const files = fs.readdirSync(d).filter((f) => /^(a1|a2|b1)\.json$/i.test(f));
  const mtime = Math.max(0, ...files.map((f) => fs.statSync(path.join(d, f)).mtimeMs));
  if (cache && cache.mtime === mtime) return cache.entries;

  const entries: VocabEntry[] = [];
  const seen = new Map<string, number>();
  for (const f of files) {
    const fileLevel = f.slice(0, 2).toUpperCase();
    let raw: RawEntry[];
    try {
      raw = JSON.parse(fs.readFileSync(path.join(d, f), "utf8"));
    } catch (e) {
      console.error(`Invalid vocab file ${f}:`, e);
      continue;
    }
    raw.forEach((r, i) => {
      if (!r.word || !r.meanings?.length) return;
      const level = (r.level || fileLevel).toUpperCase();
      const pos = (r.pos || "").toLowerCase();
      // Key is stable across list edits; duplicates (same level/pos/word) get a numeric suffix.
      const base = `${level}:${pos}:${slug(r.word)}`;
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      entries.push({
        key: n ? `${base}#${n}` : base,
        word: r.word,
        pos,
        level,
        article: r.article || undefined,
        notes: r.notes || undefined,
        frequency: typeof r.frequency === "number" ? r.frequency : i + 1,
        meanings: r.meanings,
      });
    });
  }
  entries.sort((a, b) => a.frequency - b.frequency);
  cache = { entries, mtime };
  return entries;
}

export function getVocab() {
  return load();
}

/** Lowercase word -> first English meaning, for hover lookups of words outside a sentence's own glosses. */
export function buildLookup(entries: VocabEntry[]) {
  const map: Record<string, string> = {};
  for (const e of entries) {
    const k = e.word.toLowerCase();
    if (!(k in map)) map[k] = e.meanings[0].english;
  }
  return map;
}

let byWord: { entries: VocabEntry[]; map: Map<string, VocabEntry> } | null = null;

/** Lowercase headword -> best (most frequent) entry. Article-less, so "Haus" and "haus" both match. */
export function findVocabEntry(word: string): VocabEntry | undefined {
  const entries = load();
  if (!byWord || byWord.entries !== entries) {
    const map = new Map<string, VocabEntry>();
    for (const e of entries) {
      const k = e.word.toLowerCase();
      if (!map.has(k)) map.set(k, e);
    }
    byWord = { entries, map };
  }
  return byWord.map.get(word.toLowerCase());
}
