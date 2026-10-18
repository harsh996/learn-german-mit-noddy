"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import styles from "./profiles.module.css";

type Memory = {
  id: string;
  category: string;
  errorPattern: string;
  occurrenceCount: number;
};

type Profile = {
  id: string;
  name: string;
  level: string;
  avatarGender: string;
  avatarName: string;
  memories: Memory[];
  _count: { sessions: number; memories: number };
};

const LEVELS = ["A1", "A2", "B1", "B2", "C1"];

export default function ProfilesPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [maxProfiles, setMaxProfiles] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [level, setLevel] = useState("A1");
  const [avatarGender, setAvatarGender] = useState<"female" | "male">("female");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/profiles");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load profiles");
        return;
      }
      setProfiles(data.profiles);
      setMaxProfiles(data.maxProfiles);
    } catch {
      setError("Unable to load profiles");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function createProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, level, avatarGender }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create profile");
        return;
      }
      setShowCreate(false);
      setName("");
      setLevel("A1");
      setAvatarGender("female");
      await load();
    } catch {
      setError("Could not create profile");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProfile(id: string) {
    if (!confirm("Delete this profile and its memory?")) return;
    const res = await fetch(`/api/profiles/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  function startSession(id: string) {
    router.push(`/dashboard?profileId=${id}`);
  }

  return (
    <div className="app-shell">
      <AppHeader>
        <button className="btn btn-ghost" onClick={() => router.push("/reading")} type="button">
          Reading
        </button>
        <button className="btn btn-ghost" onClick={() => router.push("/vocab")} type="button">
          Vocabulary
        </button>
      </AppHeader>

      <main className={styles.main}>
        <div className={`${styles.header} animate-rise`}>
          <h1>Choose a learner profile</h1>
          <p>Up to {maxProfiles} profiles — each keeps its own CEFR level, avatar, and mistake memory.</p>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        {loading ? (
          <p className={styles.muted}>Loading profiles…</p>
        ) : (
          <div className={styles.grid}>
            {profiles.map((p, i) => (
              <article
                key={p.id}
                className={`${styles.card} animate-rise`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className={styles.avatarBadge} data-gender={p.avatarGender}>
                  {p.avatarName[0]}
                </div>
                <div className={styles.meta}>
                  <h2>{p.name}</h2>
                  <p>
                    {p.avatarName} · Level {p.level}
                  </p>
                  <p className={styles.stats}>
                    {p._count.sessions} sessions · {p._count.memories} memories
                  </p>
                  {p.memories[0] ? (
                    <p className={styles.memoryHint}>
                      Focus: {p.memories[0].category} — {p.memories[0].errorPattern}
                    </p>
                  ) : null}
                </div>
                <div className={styles.actions}>
                  <button className="btn btn-primary" type="button" onClick={() => startSession(p.id)}>
                    Start lesson
                  </button>
                  <button className="btn btn-ghost" type="button" onClick={() => deleteProfile(p.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}

            {profiles.length < maxProfiles ? (
              <button
                type="button"
                className={`${styles.createCard} animate-rise`}
                onClick={() => setShowCreate(true)}
              >
                <span>+</span>
                Create new profile
              </button>
            ) : null}
          </div>
        )}
      </main>

      {showCreate ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <form className={styles.modal} onSubmit={createProfile}>
            <h2>New profile</h2>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="level">Target German level</label>
              <select id="level" value={level} onChange={(e) => setLevel(e.target.value)}>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Avatar</label>
              <div className={styles.avatarPick}>
                <label className={avatarGender === "female" ? styles.picked : undefined}>
                  <input
                    type="radio"
                    name="avatar"
                    checked={avatarGender === "female"}
                    onChange={() => setAvatarGender("female")}
                  />
                  Hannah (Female)
                </label>
                <label className={avatarGender === "male" ? styles.picked : undefined}>
                  <input
                    type="radio"
                    name="avatar"
                    checked={avatarGender === "male"}
                    onChange={() => setAvatarGender("male")}
                  />
                  Lukas (Male)
                </label>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className="btn btn-ghost" type="button" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Create"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
