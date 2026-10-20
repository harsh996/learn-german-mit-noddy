"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { ProfilePicker } from "@/components/ProfilePicker";
import { StoryLibrary } from "@/components/reading/StoryLibrary";
import { StoryReader } from "@/components/reading/StoryReader";
import { useActiveProfile, useSavedWords } from "@/components/vocab/SavedWordsProvider";
import { readingUrl } from "@/lib/readingClient";
import styles from "@/components/reading/reader.module.css";

function ReadingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const profileId = params.get("profileId");
  const id = params.get("story");
  useActiveProfile(profileId);

  // Reading progress is kept per learner profile, so we need to know whose it is.
  if (!profileId)
    return (
      <ProfilePicker
        heading="Geschichten"
        prompt="Who is reading?"
        onPick={(p) => router.push(readingUrl(p))}
      />
    );
  return id ? <StoryReader id={id} profileId={profileId} /> : <StoryLibrary profileId={profileId} />;
}

export default function ReadingPage() {
  const router = useRouter();
  const { profileId } = useSavedWords();
  return (
    <div className="app-shell">
      <AppHeader>
        <button className="btn btn-ghost" type="button" onClick={() => router.push("/profiles")}>
          Profiles
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => router.push(profileId ? `/vocab?profileId=${encodeURIComponent(profileId)}` : "/vocab")}
        >
          Vocabulary
        </button>
      </AppHeader>
      <main className={styles.main}>
        <Suspense fallback={null}>
          <ReadingInner />
        </Suspense>
      </main>
    </div>
  );
}
