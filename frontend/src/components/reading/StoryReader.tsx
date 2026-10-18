"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSavedWords } from "@/components/vocab/SavedWordsProvider";
import type { Story, StorySummary } from "@/lib/readingTypes";
import {
  AuthError,
  loadStories,
  loadStory,
  prefetchStory,
  progressKey,
  readProgress,
  setStore,
  store,
} from "@/lib/readingClient";
import { Paragraph } from "./Paragraph";
import { WordPopover, type Target } from "./WordPopover";
import styles from "./reader.module.css";

const SIZES = [1.1, 1.25, 1.45, 1.7];

/** The sentence around the clicked word, for contextual translation. */
function sentenceAround(el: HTMLElement): string {
  const p = el.closest("p");
  if (!p) return el.textContent ?? "";
  const full = p.textContent ?? "";
  let offset = 0;
  for (const n of Array.from(p.childNodes)) {
    if (n === el || n.contains(el)) break;
    offset += n.textContent?.length ?? 0;
  }
  const re = /[^.!?…]*[.!?…]+["„“”»«’]*\s*|[^.!?…]+$/g;
  for (const m of full.matchAll(re)) {
    const start = m.index ?? 0;
    if (offset >= start && offset < start + m[0].length) return m[0].trim().slice(0, 500);
  }
  return full.slice(0, 500);
}

export function StoryReader({ id }: { id: string }) {
  const router = useRouter();
  const { words } = useSavedWords();
  const [story, setStory] = useState<Story | null>(null);
  const [error, setError] = useState("");
  const [next, setNext] = useState<StorySummary | null>(null);
  const [size, setSize] = useState(1);
  const [target, setTarget] = useState<Target | null>(null);
  const [session, setSession] = useState<string[]>([]);
  const pageRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = Number(store("reading-size"));
    if (Number.isInteger(saved) && saved >= 0 && saved < SIZES.length) setSize(saved);
  }, []);

  useEffect(() => {
    let live = true;
    setStory(null);
    setError("");
    setTarget(null);
    setSession([]);
    Promise.all([loadStory(id), loadStories()]).then(
      ([s, all]) => {
        if (!live) return;
        setStory(s);
        const same = all.filter((x) => x.level === s.level);
        const i = same.findIndex((x) => x.id === s.id);
        const n = same[i + 1] ?? null;
        setNext(n);
        if (n) prefetchStory(n.id);
      },
      (e) => {
        if (!live) return;
        if (e instanceof AuthError) router.push("/login");
        else setError("We couldn't load this story.");
      },
    );
    return () => {
      live = false;
    };
  }, [id, router]);

  // Restore the previous scroll position once the text is on screen.
  useEffect(() => {
    if (!story) return;
    const p = readProgress(story.id);
    if (p > 0.02 && p < 0.97) {
      requestAnimationFrame(() => {
        const el = pageRef.current;
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: top + p * el.offsetHeight - window.innerHeight * 0.3 });
      });
    } else window.scrollTo({ top: 0 });
  }, [story]);

  // Reading progress bar + persisted progress (throttled by rAF / idle save).
  useEffect(() => {
    if (!story) return;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = 0;
    const update = () => {
      raf = 0;
      const el = pageRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight * 0.4;
      last = Math.min(1, Math.max(0, (window.innerHeight * 0.3 - r.top) / Math.max(total, 1)));
      if (barRef.current) barRef.current.style.transform = `scaleX(${last})`;
      clearTimeout(timer);
      timer = setTimeout(() => setStore(progressKey(story.id), last.toFixed(3)), 400);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      if (last) setStore(progressKey(story.id), last.toFixed(3));
    };
  }, [story]);

  const close = useCallback(() => setTarget(null), []);

  // The tapped word is marked with data-active-token (styled in CSS, survives re-renders).
  useEffect(() => {
    if (!target) pageRef.current?.querySelectorAll("[data-active-token]").forEach((n) => n.removeAttribute("data-active-token"));
  }, [target]);

  const onBodyClick = useCallback((e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-w]");
    if (!el) return;
    pageRef.current?.querySelectorAll("[data-active-token]").forEach((n) => n.removeAttribute("data-active-token"));
    el.setAttribute("data-active-token", "");
    setTarget({ word: el.dataset.w!, sentence: sentenceAround(el), rect: el.getBoundingClientRect() });
  }, []);

  function changeSize(delta: number) {
    const n = Math.min(SIZES.length - 1, Math.max(0, size + delta));
    setSize(n);
    setStore("reading-size", String(n));
    setTarget(null);
  }

  const savedSet = useMemo(() => {
    const set = new Set<string>(session);
    for (const w of words) {
      set.add(w.word.toLowerCase());
    }
    return set;
  }, [words, session]);

  if (error)
    return (
      <div className={styles.state}>
        <p>{error}</p>
        <button className="btn btn-primary" type="button" onClick={() => router.push("/reading")}>
          Back to stories
        </button>
      </div>
    );
  if (!story)
    return (
      <div className={styles.page} aria-busy="true">
        <div className={`${styles.skel} ${styles.skelTitle}`} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={styles.skel} style={{ width: `${92 - (i % 3) * 9}%` }} />
        ))}
      </div>
    );

  return (
    <>
      <div className={styles.progress} aria-hidden="true">
        <div ref={barRef} className={styles.progressBar} />
      </div>
      <article
        ref={pageRef}
        className={`${styles.page} ${styles.enter}`}
        style={{ ["--read-size" as string]: `${SIZES[size]}rem` }}
      >
        <div className={styles.toolbar}>
          <button className="btn btn-ghost" type="button" onClick={() => router.push("/reading")}>
            ← All stories
          </button>
          <div className={styles.sizer} role="group" aria-label="Text size">
            <button type="button" aria-label="Smaller text" onClick={() => changeSize(-1)} disabled={size === 0}>
              A−
            </button>
            <button type="button" aria-label="Larger text" onClick={() => changeSize(1)} disabled={size === SIZES.length - 1}>
              A+
            </button>
          </div>
        </div>
        <header className={styles.storyHead}>
          <span className={styles.badge}>{story.level}</span>
          <h1 className={styles.script}>{story.title}</h1>
          <p className={styles.en}>{story.titleEn}</p>
          <p className={styles.hint}>Tap any word for its meaning · EN translates a paragraph</p>
          <div className={styles.orn} aria-hidden="true">❦</div>
        </header>

        <div lang="de" className={styles.body} onClick={onBodyClick}>
          {story.paragraphs.map((p, i) => (
            <Paragraph key={i} text={p} first={i === 0} saved={savedSet} />
          ))}
        </div>

        <div className={styles.orn} aria-hidden="true">❦ ❦ ❦</div>
        <p className={styles.source}>{story.source}</p>
        <div className={styles.end}>
          {next ? (
            <button className="btn btn-primary" type="button" onClick={() => router.push(`/reading?story=${next.id}`)} onPointerEnter={() => prefetchStory(next.id)}>
              Next: {next.title} →
            </button>
          ) : (
            <button className="btn btn-primary" type="button" onClick={() => router.push("/reading")}>
              Back to all stories
            </button>
          )}
        </div>

        {target && pageRef.current && (
          <WordPopover
            target={target}
            container={pageRef.current}
            fallbackLevel={story.level}
            onClose={close}
            onSaved={(s) => setSession((prev) => (prev.includes(s) ? prev : [...prev, s]))}
          />
        )}
      </article>
    </>
  );
}
