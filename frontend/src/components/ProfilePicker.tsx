"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./reading/reader.module.css";

type ProfileLite = { id: string; name: string; level: string };

/** Asks which learner profile to continue as; reading progress and saved words are per profile. */
export function ProfilePicker({
  heading,
  prompt,
  onPick,
}: {
  heading: string;
  prompt: string;
  onPick: (profileId: string) => void;
}) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<ProfileLite[] | null>(null);

  useEffect(() => {
    fetch("/api/profiles").then(
      async (res) => {
        if (res.status === 401) return router.push("/login");
        const data = await res.json().catch(() => ({}));
        setProfiles(res.ok ? data.profiles : []);
      },
      () => setProfiles([]),
    );
  }, [router]);

  if (!profiles) return null;
  if (profiles.length === 0)
    return (
      <div className={styles.state}>
        <p>Create a learner profile first.</p>
        <button className="btn btn-primary" type="button" onClick={() => router.push("/profiles")}>
          Go to profiles
        </button>
      </div>
    );

  return (
    <div className={styles.enter}>
      <div className={styles.intro}>
        <h1 className={styles.script}>{heading}</h1>
        <p>{prompt}</p>
      </div>
      <div className={styles.cards}>
        {profiles.map((p) => (
          <button key={p.id} type="button" className={styles.card} onClick={() => onPick(p.id)}>
            <span className={styles.cardTitle}>{p.name}</span>
            <span className={styles.cardMeta}>Level {p.level}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
