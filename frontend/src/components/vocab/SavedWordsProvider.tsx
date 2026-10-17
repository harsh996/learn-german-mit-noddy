"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type SavedWord = {
  wordKey: string;
  word: string;
  article?: string | null;
  pos?: string | null;
  level?: string | null;
  translation: string;
};

type Ctx = {
  words: SavedWord[];
  isSaved: (key: string) => boolean;
  save: (w: SavedWord) => Promise<void>;
  remove: (key: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const SavedWordsContext = createContext<Ctx | null>(null);

export function SavedWordsProvider({ children }: { children: React.ReactNode }) {
  const [words, setWords] = useState<SavedWord[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/vocab/saved");
      if (!res.ok) return;
      const data = await res.json();
      setWords(data.words);
    } catch {}
  }, []);

  const save = useCallback(async (w: SavedWord) => {
    // Optimistic; roll back if the server rejects.
    setWords((prev) => (prev.some((p) => p.wordKey === w.wordKey) ? prev : [w, ...prev]));
    const res = await fetch("/api/vocab/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(w),
    }).catch(() => null);
    if (!res?.ok) setWords((prev) => prev.filter((p) => p.wordKey !== w.wordKey));
  }, []);

  const remove = useCallback(async (key: string) => {
    let removed: SavedWord | undefined;
    setWords((prev) => {
      removed = prev.find((p) => p.wordKey === key);
      return prev.filter((p) => p.wordKey !== key);
    });
    const res = await fetch(`/api/vocab/saved?wordKey=${encodeURIComponent(key)}`, {
      method: "DELETE",
    }).catch(() => null);
    if (!res?.ok && removed) setWords((prev) => [removed!, ...prev]);
  }, []);

  const value = useMemo<Ctx>(() => {
    const keys = new Set(words.map((w) => w.wordKey));
    return { words, isSaved: (k) => keys.has(k), save, remove, refresh };
  }, [words, save, remove, refresh]);

  return <SavedWordsContext.Provider value={value}>{children}</SavedWordsContext.Provider>;
}

export function useSavedWords() {
  const ctx = useContext(SavedWordsContext);
  if (!ctx) throw new Error("useSavedWords must be used within SavedWordsProvider");
  return ctx;
}
