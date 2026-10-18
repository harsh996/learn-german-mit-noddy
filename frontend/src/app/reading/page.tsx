"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { StoryLibrary } from "@/components/reading/StoryLibrary";
import { StoryReader } from "@/components/reading/StoryReader";
import styles from "@/components/reading/reader.module.css";

function ReadingInner() {
  const id = useSearchParams().get("story");
  return id ? <StoryReader id={id} /> : <StoryLibrary />;
}

export default function ReadingPage() {
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
        <Suspense fallback={null}>
          <ReadingInner />
        </Suspense>
      </main>
    </div>
  );
}
