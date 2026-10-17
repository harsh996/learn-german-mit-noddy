"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { VoiceSession } from "@/components/VoiceSession";
import styles from "./dashboard.module.css";

function DashboardInner() {
  const router = useRouter();
  const params = useSearchParams();
  const profileId = params.get("profileId");
  const mode = params.get("mode");

  if (!profileId) {
    return (
      <div className={styles.empty}>
        <p>No profile selected.</p>
        <button className="btn btn-primary" type="button" onClick={() => router.push("/profiles")}>
          Back to profiles
        </button>
      </div>
    );
  }

  if (mode !== "live") {
    const choose = (m: string) => router.push(`/dashboard?profileId=${profileId}&mode=${m}`);
    return (
      <div className={styles.picker}>
        <h1>What would you like to practise?</h1>
        <div className={styles.options}>
          <button type="button" className={styles.option} onClick={() => router.push("/vocab")}>
            <strong>Vocabulary</strong>
            <span>Browse and save words</span>
          </button>
          <button type="button" className={styles.option} onClick={() => choose("live")}>
            <strong>Live Conversation</strong>
            <span>Video chat with your AI tutor</span>
          </button>
          <button type="button" className={styles.option} disabled>
            <strong>Reading</strong>
            <span>Coming soon</span>
          </button>
        </div>
        <button className="btn btn-ghost" type="button" onClick={() => router.push("/profiles")}>
          Back to profiles
        </button>
      </div>
    );
  }

  return (
    <VoiceSession
      profileId={profileId}
      onEnded={() => router.push("/profiles")}
    />
  );
}

export default function DashboardPage() {
  const router = useRouter();

  return (
    <div className="app-shell">
      <AppHeader>
        <button className="btn btn-ghost" type="button" onClick={() => router.push("/profiles")}>
          Profiles
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => router.push("/vocab")}>
          Vocabulary
        </button>
      </AppHeader>
      <main className={styles.main}>
        <Suspense fallback={<p className={styles.loading}>Loading…</p>}>
          <DashboardInner />
        </Suspense>
      </main>
    </div>
  );
}
