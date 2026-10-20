"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type SavedWord = {
  wordKey: string;
  word: string;
  article?: string | null;
  pos?: string | null;
  level?: string | null;
  translation: string;
};

type Ctx = {
  /** The learner profile whose saved words are shown; null when no profile is selected. */
  profileId: string | null;
  setProfileId: (id: string | null) => void;
  words: SavedWord[];
  isSaved: (key: string) => boolean;
  save: (w: SavedWord) => Promise<void>;
  remove: (key: string) => Promise<void>;
  refresh: () => Promise<void>;
  /** Drop everything held in memory (used on logout so nothing carries to the next account). */
  reset: () => void;
};

const SavedWordsContext = createContext<Ctx | null>(null);

export function SavedWordsProvider({ children }: { children: React.ReactNode }) {
  const [profileId, setProfileIdState] = useState<string | null>(null);
  const [words, setWords] = useState<SavedWord[]>([]);
  // Guards against a slow response for a previous profile overwriting the current one.
  const active = useRef<string | null>(null);

  const setProfileId = useCallback((id: string | null) => {
    if (active.current === id) return;
    active.current = id;
    setWords([]);
    setProfileIdState(id);
  }, []);

  const refresh = useCallback(async () => {
    const pid = active.current;
    if (!pid) return;
    try {
      const res = await fetch(`/api/vocab/saved?profileId=${encodeURIComponent(pid)}`);
      if (!res.ok || active.current !== pid) return;
      const data = await res.json();
      if (active.current === pid) setWords(data.words);
    } catch {}
  }, []);

  useEffect(() => {
    void refresh();
  }, [profileId, refresh]);

  const reset = useCallback(() => setProfileId(null), [setProfileId]);

  const save = useCallback(async (w: SavedWord) => {
    const pid = active.current;
    if (!pid) return;
    // Optimistic; roll back if the server rejects.
    setWords((prev) => (prev.some((p) => p.wordKey === w.wordKey) ? prev : [w, ...prev]));
    const res = await fetch("/api/vocab/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...w, profileId: pid }),
    }).catch(() => null);
    if (!res?.ok && active.current === pid) setWords((prev) => prev.filter((p) => p.wordKey !== w.wordKey));
  }, []);

  const remove = useCallback(async (key: string) => {
    const pid = active.current;
    if (!pid) return;
    let removed: SavedWord | undefined;
    setWords((prev) => {
      removed = prev.find((p) => p.wordKey === key);
      return prev.filter((p) => p.wordKey !== key);
    });
    const res = await fetch(
      `/api/vocab/saved?profileId=${encodeURIComponent(pid)}&wordKey=${encodeURIComponent(key)}`,
      { method: "DELETE" },
    ).catch(() => null);
    if (!res?.ok && removed && active.current === pid) setWords((prev) => [removed!, ...prev]);
  }, []);

  const value = useMemo<Ctx>(() => {
    const keys = new Set(words.map((w) => w.wordKey));
    return { profileId, setProfileId, words, isSaved: (k) => keys.has(k), save, remove, refresh, reset };
  }, [profileId, setProfileId, words, save, remove, refresh, reset]);

  return <SavedWordsContext.Provider value={value}>{children}</SavedWordsContext.Provider>;
}

export function useSavedWords() {
  const ctx = useContext(SavedWordsContext);
  if (!ctx) throw new Error("useSavedWords must be used within SavedWordsProvider");
  return ctx;
}

/** Pages call this with the profile id from their URL (or null) to scope saved words to it. */
export function useActiveProfile(profileId: string | null) {
  const { setProfileId } = useSavedWords();
  useEffect(() => {
    setProfileId(profileId);
  }, [profileId, setProfileId]);
}
