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
        <Suspense fallback={<p className={styles.loading}>Preparing lesson…</p>}>
          <DashboardInner />
        </Suspense>
      </main>
    </div>
  );
}
