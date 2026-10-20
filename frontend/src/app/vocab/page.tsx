"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ProfilePicker } from "@/components/ProfilePicker";
import { SentenceText } from "@/components/vocab/SentenceText";
import { useActiveProfile, useSavedWords } from "@/components/vocab/SavedWordsProvider";
import { VOCAB_LEVELS, VOCAB_POS, levelLabel, type VocabEntry } from "@/lib/vocabTypes";
import styles from "@/components/vocab/vocab.module.css";

type Prefs = { sort: "frequency" | "alpha"; status: "all" | "saved" | "unsaved"; pos: string; level: string };
const DEFAULT_PREFS: Prefs = { sort: "frequency", status: "all", pos: "all", level: "all" };

function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className={styles.seg}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={o.value === value ? styles.segOn : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function VocabPage() {
  return (
    <Suspense fallback={null}>
      <VocabRoute />
    </Suspense>
  );
}

// Saved words are kept per learner profile, so the page needs to know which one.
function VocabRoute() {
  const router = useRouter();
  const profileId = useSearchParams().get("profileId");
  useActiveProfile(profileId);

  if (profileId) return <VocabContent profileId={profileId} />;
  return (
    <div className="app-shell">
      <AppHeader>
        <button className="btn btn-ghost" type="button" onClick={() => router.push("/profiles")}>
          Profiles
        </button>
      </AppHeader>
      <main>
        <ProfilePicker
          heading="Vocabulary"
          prompt="Whose word list?"
          onPick={(p) => router.push(`/vocab?profileId=${encodeURIComponent(p)}`)}
        />
      </main>
    </div>
  );
}

function VocabContent({ profileId }: { profileId: string }) {
  const router = useRouter();
  const { isSaved, save, remove } = useSavedWords();
  const [entries, setEntries] = useState<VocabEntry[]>([]);
  const [lookup, setLookup] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [prefsReady, setPrefsReady] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const [v, p] = await Promise.all([fetch("/api/vocab"), fetch("/api/vocab/preferences")]);
        if (v.status === 401) return router.push("/login");
        const vd = await v.json();
        setEntries(vd.entries);
        setLookup(vd.lookup);
        if (p.ok) setPrefs({ ...DEFAULT_PREFS, ...(await p.json()).prefs });
      } finally {
        setLoading(false);
        setPrefsReady(true);
      }
    })();
  }, [router]);

  function updatePrefs(patch: Partial<Prefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/vocab/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => {});
    }, 400);
  }

  const index = useMemo(() => {
    const m = new Map<string, VocabEntry>();
    for (const e of entries) if (!m.has(e.word.toLowerCase())) m.set(e.word.toLowerCase(), e);
    return m;
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = entries.filter((e) => {
      if (prefs.pos !== "all" && e.pos !== prefs.pos) return false;
      if (prefs.level !== "all" && e.level !== prefs.level) return false;
      if (prefs.status === "saved" && !isSaved(e.key)) return false;
      if (prefs.status === "unsaved" && isSaved(e.key)) return false;
      if (q && !e.word.toLowerCase().includes(q) && !e.meanings.some((m) => m.english.toLowerCase().includes(q)))
        return false;
      return true;
    });
    if (prefs.sort === "alpha") out.sort((a, b) => a.word.localeCompare(b.word, "de"));
    return out;
  }, [entries, prefs, search, isSaved]);

  const selected = filtered.find((e) => e.key === selectedKey) ?? filtered[0];

  function toggle(e: VocabEntry) {
    if (isSaved(e.key)) return remove(e.key);
    return save({
      wordKey: e.key,
      word: e.word,
      article: e.article ?? null,
      pos: e.pos,
      level: e.level,
      translation: e.meanings.map((m) => m.english).join("; "),
    });
  }

  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

  return (
    <div className="app-shell">
      <AppHeader>
        <button className="btn btn-ghost" type="button" onClick={() => router.push("/profiles")}>
          Profiles
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => router.push(`/reading?profileId=${encodeURIComponent(profileId)}`)}
        >
          Reading
        </button>
      </AppHeader>

      <main className={styles.layout}>
        <aside className={styles.filters}>
          <div className={styles.count}>
            <strong>{filtered.length.toLocaleString()}</strong> words
          </div>
          <label className={styles.label}>Search</label>
          <input
            className={styles.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="German or English…"
          />
          <label className={styles.label}>Sort by</label>
          <Seg
            value={prefs.sort}
            onChange={(sort) => updatePrefs({ sort })}
            options={[
              { value: "frequency", label: "Level" },
              { value: "alpha", label: "A–Z" },
            ]}
          />
          <label className={styles.label}>Word status</label>
          <Seg
            value={prefs.status}
            onChange={(status) => updatePrefs({ status })}
            options={[
              { value: "all", label: "All" },
              { value: "saved", label: "Saved" },
              { value: "unsaved", label: "Not saved" },
            ]}
          />
          <label className={styles.label}>Part of speech</label>
          <div className={styles.chips}>
            {["all", ...VOCAB_POS].map((p) => (
              <button
                key={p}
                type="button"
                className={p === prefs.pos ? styles.segOn : undefined}
                onClick={() => updatePrefs({ pos: p })}
              >
                {p === "all" ? "All" : cap(p)}
              </button>
            ))}
          </div>
          <label className={styles.label}>Level</label>
          <Seg
            value={prefs.level}
            onChange={(level) => updatePrefs({ level })}
            options={[{ value: "all", label: "All" }, ...VOCAB_LEVELS.map((l) => ({ value: l as string, label: levelLabel(l) }))]}
          />
          <button
            type="button"
            className={styles.reset}
            onClick={() => {
              setSearch("");
              updatePrefs(DEFAULT_PREFS);
            }}
          >
            Reset filters
          </button>
        </aside>

        <section className={styles.listCol} aria-label="Word list">
          {loading || !prefsReady ? (
            <p className={styles.note}>Loading words…</p>
          ) : entries.length === 0 ? (
            <p className={styles.note}>
              No word lists found. Add a1.json … c1.json to <code>frontend/data/vocab</code>.
            </p>
          ) : filtered.length === 0 ? (
            <p className={styles.note}>No words match these filters.</p>
          ) : (
            <ul className={styles.list}>
              {filtered.map((e) => (
                <li
                  key={e.key}
                  className={e.key === selected?.key ? styles.rowOn : undefined}
                  onClick={() => setSelectedKey(e.key)}
                >
                  <span className={styles.rowWord}>
                    {e.article ? <small>{e.article} </small> : null}
                    {e.word}
                  </span>
                  <span className={styles.rowMeaning}>{e.meanings.map((m) => m.english).join(" · ")}</span>
                  <span className={styles.rowLevel}>{levelLabel(e.level)}</span>
                  <button
                    type="button"
                    className={isSaved(e.key) ? styles.bmOn : styles.bm}
                    aria-label={isSaved(e.key) ? `Unsave ${e.word}` : `Save ${e.word}`}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      toggle(e);
                    }}
                  >
                    {isSaved(e.key) ? "★" : "☆"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.detail} aria-label="Word details">
          {selected && (
            <>
              <div className={styles.detailHead}>
                <h1>
                  {selected.article && <small>{selected.article} </small>}
                  {selected.word}
                </h1>
                <div className={styles.meta}>
                  <span>{cap(selected.pos || "word")}</span>
                  <span>Level {levelLabel(selected.level)}</span>
                </div>
                {selected.notes && <p className={styles.notes}>{selected.notes}</p>}
                <button
                  type="button"
                  className={isSaved(selected.key) ? "btn btn-primary" : "btn btn-ghost"}
                  onClick={() => toggle(selected)}
                >
                  {isSaved(selected.key) ? "★ Saved" : "☆ Save word"}
                </button>
              </div>
              {selected.meanings.map((m, i) => (
                <div key={i} className={styles.meaning}>
                  <h2>
                    {selected.meanings.length > 1 && <span>{i + 1}.</span>} {m.english}
                  </h2>
                  {m.examples.map((ex, j) => (
                    <div key={j} className={styles.example}>
                      <SentenceText example={ex} level={selected.level} index={index} lookup={lookup} />
                      <p className={styles.sentenceEn}>{ex.en}</p>
                    </div>
                  ))}
                </div>
              ))}
              <p className={styles.hint}>Hover (or tap) a word in a German sentence to translate and save it.</p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
