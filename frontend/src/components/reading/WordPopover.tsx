"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSavedWords } from "@/components/vocab/SavedWordsProvider";
import { lookupWord, type WordInfo } from "@/lib/readingClient";
import styles from "./reader.module.css";

export type Target = { word: string; sentence: string; rect: DOMRect };

type Props = {
  target: Target;
  /** Offset parent of the popover; coordinates are relative to it so it scrolls with the text. */
  container: HTMLElement;
  fallbackLevel: string;
  onClose: () => void;
  onSaved: (surface: string) => void;
};

const WIDTH = 280;

export function WordPopover({ target, container, fallbackLevel, onClose, onSaved }: Props) {
  const { isSaved, save, remove } = useSavedWords();
  const [info, setInfo] = useState<WordInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    setInfo(null);
    setFailed(false);
    lookupWord(target.word, target.sentence).then(
      (i) => live && setInfo(i),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [target]);

  // Position under the word; flip above if it would run off the viewport; clamp horizontally.
  useLayoutEffect(() => {
    const c = container.getBoundingClientRect();
    const h = ref.current?.offsetHeight ?? 120;
    const below = target.rect.bottom + 10 + h < window.innerHeight || target.rect.top < h + 20;
    const centre = target.rect.left + target.rect.width / 2 - c.left;
    const left = Math.min(Math.max(centre - WIDTH / 2, 8), c.width - WIDTH - 8);
    const top = (below ? target.rect.bottom + 8 : target.rect.top - h - 8) - c.top;
    setPos({ left: Math.max(left, 0), top, above: !below });
  }, [target, container, info, failed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!ref.current?.contains(t) && !t.closest("[data-w]")) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  function retry() {
    setFailed(false);
    lookupWord(target.word, target.sentence).then(setInfo, () => setFailed(true));
  }

  const saved = info ? isSaved(info.wordKey) : false;

  function toggle() {
    if (!info) return;
    if (saved) return void remove(info.wordKey);
    onSaved(target.word.toLowerCase());
    void save({
      wordKey: info.wordKey,
      word: info.word,
      article: info.article,
      pos: info.pos,
      level: info.level ?? fallbackLevel,
      translation: info.translation,
    });
  }

  return (
    <div
      ref={ref}
      className={`${styles.pop} ${pos?.above ? styles.popAbove : ""}`}
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, width: WIDTH, visibility: pos ? "visible" : "hidden" }}
      role="dialog"
      aria-label={`Translation of ${target.word}`}
    >
      <div className={styles.popHead}>
        <strong>
          {info?.article ? `${info.article} ` : ""}
          {info?.word ?? target.word}
        </strong>
        {info?.pos && <em>{info.pos}</em>}
        <button type="button" className={styles.popX} onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {info && info.word.toLowerCase() !== target.word.toLowerCase() && (
        <div className={styles.popForm}>from “{target.word}”</div>
      )}
      <div className={styles.popTr}>
        {info ? info.translation : failed ? "Translation unavailable right now." : <span className={styles.shimmer}>Looking up…</span>}
      </div>
      <div className={styles.popActions}>
        <button type="button" className={saved ? styles.saved : styles.save} disabled={!info} onClick={toggle}>
          {saved ? "✓ Saved" : "+ Save word"}
        </button>
        {saved && (
          <button type="button" className={styles.link} onClick={() => window.dispatchEvent(new Event("open-saved-words"))}>
            View saved
          </button>
        )}
        {failed && (
          <button type="button" className={styles.link} onClick={retry}>
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
