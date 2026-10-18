// Contextual German -> English translation for the reader (Gemini or OpenAI, whichever is configured).

export type WordInfo = { lemma: string; translation: string; article: string | null; pos: string | null };

const WORD_PROMPT = (word: string, sentence: string) =>
  `You are a German-English dictionary for learners. In the sentence below, explain the word "${word}".
Return JSON only: {"lemma": base form (infinitive for verbs, nominative singular for nouns, capitalised as in German), "translation": short English meaning as used in this sentence (max 6 words), "article": "der"|"die"|"das" for nouns else null, "pos": one of noun, verb, adjective, adverb, preposition, conjunction, pronoun, number, interjection, other}.
Sentence: ${sentence}`;

const SENTENCE_PROMPT = (text: string) =>
  `Translate this German text into natural English. Return JSON only: {"translation": "..."}.\n\n${text}`;

/** fetch with a couple of short retries for transient overload (429/5xx). */
async function fetchRetry(url: string, init: RequestInit, tries = 3): Promise<Response> {
  let res = await fetch(url, init);
  for (let i = 1; i < tries && (res.status === 429 || res.status >= 500); i++) {
    await new Promise((r) => setTimeout(r, 400 * i));
    res = await fetch(url, init);
  }
  return res;
}

async function askJson(prompt: string): Promise<Record<string, unknown> | null> {
  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  const signal = AbortSignal.timeout(20000);
  try {
    if (provider === "openai" && process.env.OPENAI_API_KEY) {
      const res = await fetchRetry("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: process.env.OPENAI_TRANSLATE_MODEL || "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
          temperature: 0,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return JSON.parse(data.choices?.[0]?.message?.content ?? "null");
    }
    const key = process.env.GOOGLE_API_KEY;
    if (!key) return null;
    // "-latest" aliases survive model retirements; the lite model is a fallback when the first is overloaded.
    const models = [process.env.GEMINI_TRANSLATE_MODEL, "gemini-flash-latest", "gemini-3.5-flash-lite"].filter(Boolean);
    for (const model of models) {
      const res = await fetchRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0 },
          }),
        },
        2,
      );
      if (!res.ok) continue;
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.find((p: { text?: string; thought?: boolean }) => p.text && !p.thought)?.text;
      if (text) return JSON.parse(text);
    }
    return null;
  } catch {
    return null;
  }
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function translateWord(word: string, sentence: string): Promise<WordInfo | null> {
  const r = await askJson(WORD_PROMPT(word, sentence));
  const translation = str(r?.translation, 80);
  if (!r || !translation) return null;
  const article = str(r.article, 4).toLowerCase();
  return {
    lemma: str(r.lemma, 60) || word,
    translation,
    article: ["der", "die", "das"].includes(article) ? article : null,
    pos: str(r.pos, 20).toLowerCase() || null,
  };
}

export async function translateText(text: string): Promise<string | null> {
  const r = await askJson(SENTENCE_PROMPT(text));
  return str(r?.translation, 4000) || null;
}
