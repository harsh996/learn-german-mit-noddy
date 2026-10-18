// Client-side helpers for the reader: cached fetches and safe localStorage access.
import type { Story, StorySummary } from "./readingTypes";

let listCache: Promise<StorySummary[]> | null = null;
const storyCache = new Map<string, Promise<Story>>();

export class AuthError extends Error {}

async function getJson(url: string) {
  const res = await fetch(url);
  if (res.status === 401) throw new AuthError();
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export function loadStories(): Promise<StorySummary[]> {
  if (!listCache) {
    listCache = getJson("/api/reading").then((d) => d.stories as StorySummary[]);
    listCache.catch(() => (listCache = null));
  }
  return listCache;
}

export function loadStory(id: string): Promise<Story> {
  let p = storyCache.get(id);
  if (!p) {
    p = getJson(`/api/reading?id=${encodeURIComponent(id)}`).then((d) => d.story as Story);
    p.catch(() => storyCache.delete(id));
    storyCache.set(id, p);
  }
  return p;
}

export const prefetchStory = (id: string) => void loadStory(id).catch(() => {});

export function store(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setStore(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export const progressKey = (id: string) => `reading-progress:${id}`;
export const readProgress = (id: string) => Math.min(1, Math.max(0, Number(store(progressKey(id))) || 0));

export type WordInfo = {
  wordKey: string;
  word: string;
  article: string | null;
  pos: string | null;
  level: string | null;
  translation: string;
};

const wordCache = new Map<string, Promise<WordInfo>>();
const textCache = new Map<string, Promise<string>>();

async function post(body: unknown) {
  const res = await fetch("/api/reading/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new AuthError();
  if (!res.ok) throw new Error("unavailable");
  return res.json();
}

export function lookupWord(word: string, sentence: string): Promise<WordInfo> {
  const k = `${word.toLowerCase()}|${sentence}`;
  let p = wordCache.get(k);
  if (!p) {
    p = post({ word, sentence });
    p.catch(() => wordCache.delete(k));
    wordCache.set(k, p);
  }
  return p;
}

export function translateParagraph(text: string): Promise<string> {
  let p = textCache.get(text);
  if (!p) {
    p = post({ text }).then((d) => d.translation as string);
    p.catch(() => textCache.delete(text));
    textCache.set(text, p);
  }
  return p;
}
