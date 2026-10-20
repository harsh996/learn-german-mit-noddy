"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { READING_LEVELS, type StorySummary } from "@/lib/readingTypes";
import {
  AuthError,
  loadReadingState,
  loadStories,
  prefetchStory,
  readingUrl,
  savePrefs,
} from "@/lib/readingClient";
import styles from "./reader.module.css";

export function StoryLibrary({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [stories, setStories] = useState<StorySummary[] | null>(null);
  const [error, setError] = useState("");
  const [level, setLevel] = useState<string>("A1");
  const [progress, setProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    let live = true;
    setStories(null);
    setProgress({});
    Promise.all([loadStories(), loadReadingState(profileId)]).then(
      ([s, state]) => {
        if (!live) return;
        const saved = state.prefs.level;
        if (saved && (READING_LEVELS as readonly string[]).includes(saved)) setLevel(saved);
        setProgress(state.progress);
        setStories(s);
      },
      (e) => {
        if (!live) return;
        if (e instanceof AuthError) router.push("/login");
        else setError("We couldn't load the stories.");
      },
    );
    return () => {
      live = false;
    };
  }, [router, profileId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    stories?.forEach((s) => (c[s.level] = (c[s.level] ?? 0) + 1));
    return c;
  }, [stories]);

  const shown = stories?.filter((s) => s.level === level) ?? [];
  const resume = stories
    ?.filter((s) => (progress[s.id] ?? 0) > 0.02 && (progress[s.id] ?? 0) < 0.97)
    .sort((a, b) => progress[b.id] - progress[a.id])[0];

  function pick(l: string) {
    setLevel(l);
    void savePrefs(profileId, { level: l });
  }

  return (
    <div className={styles.enter}>
      <div className={styles.intro}>
        <h1 className={styles.script}>Geschichten</h1>
        <p>Short German stories by level. Tap any word to translate and save it.</p>
      </div>

      {resume && (
        <button type="button" className={styles.resume} onClick={() => router.push(readingUrl(profileId, resume.id))}>
          <span>Continue reading</span>
          <strong>{resume.title}</strong>
          <span>{Math.round(progress[resume.id] * 100)}% · {resume.level}</span>
        </button>
      )}

      <div className={styles.tabs} role="tablist" aria-label="Level">
        {READING_LEVELS.map((l) => (
          <button key={l} type="button" role="tab" aria-selected={l === level} className={l === level ? styles.tabOn : undefined} onClick={() => pick(l)}>
            {l}
            {stories && <small>{counts[l] ?? 0}</small>}
          </button>
        ))}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {!stories && !error ? (
        <div className={styles.cards}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={`${styles.card} ${styles.skelCard}`} aria-hidden="true" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className={styles.state}>No stories at this level yet.</p>
      ) : (
        <div className={styles.cards} key={level}>
          {shown.map((s, i) => {
            const p = progress[s.id] ?? 0;
            return (
              <button
                key={s.id}
                type="button"
                className={styles.card}
                style={{ animationDelay: `${i * 45}ms` }}
                onClick={() => router.push(readingUrl(profileId, s.id))}
                onPointerEnter={() => prefetchStory(s.id)}
                onFocus={() => prefetchStory(s.id)}
              >
                <span className={styles.cardTitle}>{s.title}</span>
                <span className={styles.en}>{s.titleEn}</span>
                <span className={styles.cardMeta}>
                  {s.words} words · ~{Math.max(1, Math.round(s.words / 120))} min
                  {p >= 0.97 ? " · ✓ read" : ""}
                </span>
                {p > 0.02 && (
                  <span className={styles.cardProg} aria-hidden="true">
                    <i style={{ width: `${Math.round(Math.min(p, 1) * 100)}%` }} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
