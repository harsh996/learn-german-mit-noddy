import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { jsonError, jsonOk, unauthorized } from "@/lib/api";
import { findVocabEntry } from "@/lib/vocab";
import { translateText, translateWord, type WordInfo } from "@/lib/translate";

const schema = z.union([
  z.object({ word: z.string().trim().min(1).max(60), sentence: z.string().trim().max(600).default("") }),
  z.object({ text: z.string().trim().min(1).max(2500) }),
]);

// Small in-process cache so repeated taps (and other users) don't re-hit the model.
const CACHE_MAX = 5000;
const cache = new Map<string, unknown>();
function remember<T>(key: string, value: T) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, value);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request");

  if ("text" in parsed.data) {
    const { text } = parsed.data;
    const k = `t:${text}`;
    let translation = cache.get(k) as string | undefined;
    if (!translation) {
      translation = (await translateText(text)) ?? undefined;
      if (!translation) return jsonError("Translation unavailable", 503);
      remember(k, translation);
    }
    return jsonOk({ translation });
  }

  const { word, sentence } = parsed.data;
  const lower = word.toLowerCase();

  // 1. Curated vocabulary list (exact headword match) — instant and consistent with the vocab section.
  const direct = findVocabEntry(lower);
  if (direct) {
    return jsonOk({
      wordKey: direct.key,
      word: direct.word,
      article: direct.article ?? null,
      pos: direct.pos || null,
      level: direct.level,
      translation: direct.meanings[0].english,
    });
  }

  // 2. Contextual lookup for inflected / unlisted words, then re-link to the vocab list via the lemma.
  const k = `w:${lower}|${sentence}`;
  let info = cache.get(k) as WordInfo | undefined;
  if (!info) {
    info = (await translateWord(word, sentence)) ?? undefined;
    if (!info) return jsonError("Translation unavailable", 503);
    remember(k, info);
  }
  const entry = findVocabEntry(info.lemma);
  return jsonOk({
    wordKey: entry?.key ?? `custom:${info.lemma.toLowerCase()}`,
    word: entry?.word ?? info.lemma,
    article: entry?.article ?? info.article,
    pos: entry?.pos || info.pos,
    level: entry?.level ?? null,
    translation: entry ? entry.meanings[0].english : info.translation,
  });
}
