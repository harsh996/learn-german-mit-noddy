"use client";

import { useSavedWords } from "./SavedWordsProvider";
import type { Example, VocabEntry } from "@/lib/vocabTypes";
import styles from "./vocab.module.css";

const TOKEN = /([\p{L}][\p{L}'’-]*)/u;

type Props = {
  example: Example;
  level: string;
  /** Lowercase word -> vocab entry, used to link hovered words to list entries. */
  index: Map<string, VocabEntry>;
  lookup: Record<string, string>;
};

export function SentenceText({ example, level, index, lookup }: Props) {
  const { isSaved, save, remove } = useSavedWords();
  const glosses = example.glosses ?? {};
  const glossLower = Object.fromEntries(Object.entries(glosses).map(([k, v]) => [k.toLowerCase(), v]));

  return (
    <p className={styles.sentence}>
      {example.de.split(TOKEN).map((part, i) => {
        if (i % 2 === 0) return part;
        const lower = part.toLowerCase();
        const translation = glosses[part] ?? glossLower[lower] ?? lookup[lower] ?? "";
        const entry = index.get(lower);
        const wordKey = entry?.key ?? `custom:${lower}`;
        const saved = isSaved(wordKey);
        return (
          <span key={i} className={styles.tok} tabIndex={0}>
            {part}
            <span className={styles.pop} role="tooltip">
              <span className={styles.popTr}>{translation || "No translation available"}</span>
              <button
                type="button"
                className={saved ? styles.popSaved : styles.popSave}
                onClick={() =>
                  saved
                    ? remove(wordKey)
                    : save({
                        wordKey,
                        word: entry?.word ?? part,
                        article: entry?.article ?? null,
                        pos: entry?.pos ?? null,
                        level: entry?.level ?? level,
                        translation: translation || entry?.meanings[0].english || "",
                      })
                }
              >
                {saved ? "✓ Saved" : "+ Save word"}
              </button>
            </span>
          </span>
        );
      })}
    </p>
  );
}
