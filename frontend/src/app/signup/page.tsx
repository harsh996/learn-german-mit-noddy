"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  normalizeEmail,
  normalizeUsername,
  validateEmail,
  validatePassword,
  validateUsername,
} from "@/lib/auth-validation";
import styles from "../login/login.module.css";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    fetch("/api/auth/signup")
      .then((r) => r.json())
      .then((d) => setEnabled(Boolean(d.enabled)))
      .catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    // Mirrors the server rules for quick feedback; the server is the real check.
    const e1 = normalizeEmail(email);
    const u1 = normalizeUsername(username);
    const problem =
      validateEmail(e1) ||
      validateUsername(u1) ||
      validatePassword(password, { email: e1, username: u1 }) ||
      (password !== confirm ? "Passwords do not match" : null);
    if (problem) {
      setError(problem);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e1, username: u1, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign-up failed");
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
        <p className={styles.tagline}>Create your account to start practising.</p>

        {!enabled ? (
          <div className="error-banner">Sign-up is currently closed.</div>
        ) : (
          <form className={styles.form} onSubmit={onSubmit}>
            {error ? <div className="error-banner">{error}</div> : null}
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={20}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="confirm">Confirm password</label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                maxLength={72}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        )}
        <p className={styles.switch}>
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </section>
    </main>
  );
}
