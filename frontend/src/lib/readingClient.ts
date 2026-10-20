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

// Reading state lives on the server, keyed by profile (never in shared browser storage).
export type ReadingPrefs = { level?: string; size?: number };
export type ReadingState = { progress: Record<string, number>; prefs: ReadingPrefs };

export const readingUrl = (profileId: string, storyId?: string) =>
  `/reading?profileId=${encodeURIComponent(profileId)}${storyId ? `&story=${encodeURIComponent(storyId)}` : ""}`;

export async function loadReadingState(profileId: string): Promise<ReadingState> {
  const d = await getJson(`/api/reading/progress?profileId=${encodeURIComponent(profileId)}`);
  return { progress: d.progress ?? {}, prefs: d.prefs ?? {} };
}

function put(body: unknown, keepalive = false) {
  return fetch("/api/reading/progress", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive,
  }).catch(() => {});
}

export const saveProgress = (profileId: string, storyId: string, progress: number, keepalive = false) =>
  put({ profileId, storyId, progress: Math.min(1, Math.max(0, progress)) }, keepalive);

export const savePrefs = (profileId: string, prefs: ReadingPrefs) => put({ profileId, prefs });

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
