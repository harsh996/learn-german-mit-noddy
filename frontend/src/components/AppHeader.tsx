"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSavedWords } from "./vocab/SavedWordsProvider";
import styles from "./AppHeader.module.css";

export function AppHeader({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  const { words, refresh, remove } = useSavedWords();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Lets any page open the saved-words drawer (e.g. "View saved words" in the reader).
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("open-saved-words", onOpen);
    return () => window.removeEventListener("open-saved-words", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <>
      <header className="topbar">
        <button className={styles.brand} type="button" onClick={() => router.push("/profiles")}>
          Sprach<span>Raum</span>
        </button>
        <div className={styles.actions}>
          {children}
          <button
            className={styles.saved}
            type="button"
            aria-label={`Saved words (${words.length})`}
            title="Saved words"
            onClick={() => setOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
            </svg>
            {words.length > 0 && <span className={styles.badge}>{words.length}</span>}
          </button>
          <button className="btn btn-ghost" type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <aside
            className={styles.drawer}
            role="dialog"
            aria-label="Saved words"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.drawerHead}>
              <h2>Saved words · {words.length}</h2>
              <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            {words.length === 0 ? (
              <p className={styles.empty}>
                No saved words yet. Tap a word in a story or hover one in the vocab examples to save it.
              </p>
            ) : (
              <ul className={styles.list}>
                {words.map((w) => (
                  <li key={w.wordKey}>
                    <div>
                      <strong>
                        {w.article ? `${w.article} ` : ""}
                        {w.word}
                      </strong>
                      <span>{w.translation || "—"}</span>
                    </div>
                    {w.level && <em>{w.level}</em>}
                    <button type="button" onClick={() => remove(w.wordKey)} aria-label={`Remove ${w.word}`}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
