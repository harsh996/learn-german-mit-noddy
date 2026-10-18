"use client";

import { memo, useState } from "react";
import { translateParagraph } from "@/lib/readingClient";
import styles from "./reader.module.css";

const TOKEN = /([\p{L}][\p{L}'’-]*)/u;

type Props = {
  text: string;
  first: boolean;
  /** Lowercase words the user has saved; they are underlined in the text. */
  saved: ReadonlySet<string>;
};

function ParagraphImpl({ text, first, saved }: Props) {
  const [tr, setTr] = useState<{ state: "idle" | "loading" | "ready" | "error"; text?: string }>({ state: "idle" });
  const [open, setOpen] = useState(false);

  async function toggle() {
    if (open) return setOpen(false);
    setOpen(true);
    if (tr.state === "ready" || tr.state === "loading") return;
    setTr({ state: "loading" });
    try {
      setTr({ state: "ready", text: await translateParagraph(text) });
    } catch {
      setTr({ state: "error" });
    }
  }

  if (text === "* * *") return <div className={styles.orn} aria-hidden="true">❦</div>;

  return (
    <div className={styles.para}>
      <p className={first ? styles.first : undefined}>
        {text.split(TOKEN).map((part, i) =>
          i % 2 === 0 ? (
            part
          ) : (
            <span key={i} className={saved.has(part.toLowerCase()) ? `${styles.w} ${styles.wSaved}` : styles.w} data-w={part}>
              {part}
            </span>
          ),
        )}
      </p>
      <button
        type="button"
        className={`${styles.trBtn} ${open ? styles.trBtnOn : ""}`}
        onClick={toggle}
        aria-expanded={open}
        aria-label="Show English translation of this paragraph"
        title="Translate paragraph"
      >
        EN
      </button>
      {open && (
        <div className={styles.trBox} role="note">
          {tr.state === "loading" && <span className={styles.shimmer}>Translating…</span>}
          {tr.state === "ready" && tr.text}
          {tr.state === "error" && (
            <>
              Translation unavailable. <button type="button" onClick={() => { setTr({ state: "idle" }); void toggle(); }}>Retry</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export const Paragraph = memo(ParagraphImpl);
