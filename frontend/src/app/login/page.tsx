"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [signupOpen, setSignupOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/signup")
      .then((r) => r.json())
      .then((d) => setSignupOpen(Boolean(d.enabled)))
      .catch(() => setSignupOpen(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      router.push("/profiles");
      router.refresh();
    } catch {
      setError("Unable to reach the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.hero}>
      <div className={styles.atmosphere} aria-hidden />
      <section className={`${styles.panel} animate-rise`}>
        <p className={styles.eyebrow}>German AI Voice Tutor</p>
        <h1 className={styles.brand}>
          Sprach<span>Raum</span>
        </h1>
        <p className={styles.tagline}>
          Speak German with a patient avatar that remembers your mistakes — and helps you unlearn them.
        </p>

        <form className={styles.form} onSubmit={onSubmit}>
          {error ? <div className="error-banner">{error}</div> : null}
          <div className="field">
            <label htmlFor="identifier">Email or username</label>
            <input
              id="identifier"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Enter the room"}
          </button>
        </form>
        {signupOpen && (
          <p className={styles.switch}>
            New here? <Link href="/signup">Create an account</Link>
          </p>
        )}
      </section>
    </main>
  );
}
