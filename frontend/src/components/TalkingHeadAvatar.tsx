"use client";

import { useEffect, useRef, useState } from "react";
import { LipSyncAvatar } from "./LipSyncAvatar";
import { getAvatarConfig, type AvatarGender } from "@/lib/avatars";
import styles from "./TalkingHeadAvatar.module.css";

type Props = {
  gender: AvatarGender;
  name: string;
  mediaStream: MediaStream | null;
  mouthOpen?: number;
  speaking?: boolean;
};

type HeadInstance = {
  showAvatar: (avatar: Record<string, unknown>, onprogress?: unknown) => Promise<void>;
  setValue: (mt: string, val: number, ms?: number | null) => void;
  lookAtCamera: (t?: number) => void;
  start: () => void;
  stop: () => void;
  streamStop?: () => void;
};

const VISEME_KEYS = [
  "viseme_sil",
  "viseme_PP",
  "viseme_FF",
  "viseme_TH",
  "viseme_DD",
  "viseme_kk",
  "viseme_CH",
  "viseme_SS",
  "viseme_nn",
  "viseme_RR",
  "viseme_aa",
  "viseme_E",
  "viseme_I",
  "viseme_O",
  "viseme_U",
] as const;

/**
 * Free client-side 3D avatar (TalkingHead + local GLB).
 * Lip sync driven from the LiveKit tutor MediaStream.
 */
export function TalkingHeadAvatar({
  gender,
  name,
  mediaStream,
  mouthOpen = 0,
  speaking = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HeadInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorHint, setErrorHint] = useState("");

  useEffect(() => {
    let cancelled = false;
    let head: HeadInstance | null = null;

    async function boot() {
      // Wait one frame so the mount node has layout size
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const node = mountRef.current;
      if (!node || cancelled) return;

      setLoading(true);
      setFailed(false);
      setReady(false);
      setErrorHint("");

      try {
        const { TalkingHead } = await import("@met4citizen/talkinghead");
        if (cancelled || !mountRef.current) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        head = new (TalkingHead as any)(mountRef.current, {
          ttsEndpoint: "",
          lipsyncModules: [],
          lipsyncLang: "de",
          cameraView: "upper",
          cameraDistance: -0.05,
          cameraY: 0.02,
          modelFPS: 30,
          modelPixelRatio: Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 1.75),
          lightAmbientIntensity: 2.2,
          lightDirectIntensity: 22,
          lightSpotIntensity: 4,
          avatarMood: "happy",
          avatarIdleHeadMove: 0.5,
          avatarSpeakingHeadMove: 0.7,
          cameraRotateEnable: false,
          cameraPanEnable: false,
          cameraZoomEnable: false,
        }) as HeadInstance;

        headRef.current = head;

        const cfg = getAvatarConfig(gender);
        const avatarOpts: Record<string, unknown> = {
          url: cfg.url,
          body: cfg.body,
          avatarMood: cfg.avatarMood,
          lipsyncLang: "de",
        };
        if (cfg.baseline) avatarOpts.baseline = cfg.baseline;
        if (cfg.retarget) avatarOpts.retarget = cfg.retarget;

        await head.showAvatar(avatarOpts);
        if (cancelled) {
          head.stop();
          return;
        }

        head.lookAtCamera(600);
        head.start();
        setReady(true);
        setLoading(false);
      } catch (err) {
        console.warn("TalkingHead failed, using canvas fallback", err);
        if (!cancelled) {
          setErrorHint(err instanceof Error ? err.message : "3D avatar failed to load");
          setFailed(true);
          setLoading(false);
          setReady(false);
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
      try {
        headRef.current?.streamStop?.();
        headRef.current?.stop();
      } catch {
        // ignore
      }
      headRef.current = null;
      if (mountRef.current) mountRef.current.innerHTML = "";
    };
  }, [gender]);

  useEffect(() => {
    const head = headRef.current;
    if (!ready || !head || !mediaStream) return;
    if (!mediaStream.getAudioTracks()[0]) return;

    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const source = ctx.createMediaStreamSource(mediaStream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.55;
    source.connect(analyser);

    const freq = new Uint8Array(analyser.frequencyBinCount);
    const time = new Uint8Array(analyser.fftSize);
    let raf = 0;
    let lastViseme = "viseme_sil";

    const clearVisemes = (except?: string) => {
      for (const key of VISEME_KEYS) {
        if (key === except) continue;
        head.setValue(key, 0, 60);
      }
      head.setValue("mouthOpen", 0, 60);
      head.setValue("jawOpen", 0, 60);
    };

    const tick = () => {
      analyser.getByteFrequencyData(freq);
      analyser.getByteTimeDomainData(time);

      let ampSum = 0;
      for (let i = 0; i < time.length; i++) {
        const v = (time[i] - 128) / 128;
        ampSum += v * v;
      }
      const rms = Math.sqrt(ampSum / time.length);

      const n = freq.length;
      const band = (from: number, to: number) => {
        let s = 0;
        const a = Math.floor(from * n);
        const b = Math.min(n, Math.ceil(to * n));
        for (let i = a; i < b; i++) s += freq[i];
        return s / Math.max(1, b - a) / 255;
      };

      const low = band(0.02, 0.12);
      const mid = band(0.12, 0.35);
      const high = band(0.35, 0.7);
      const level = Math.min(1, Math.pow(rms * 4.2, 1.05));

      if (level < 0.045) {
        if (lastViseme !== "viseme_sil") {
          clearVisemes("viseme_sil");
          head.setValue("viseme_sil", 1, 80);
          lastViseme = "viseme_sil";
        }
        raf = requestAnimationFrame(tick);
        return;
      }

      let viseme: (typeof VISEME_KEYS)[number] = "viseme_aa";
      if (high > mid && high > low && high > 0.22) {
        viseme = high > 0.4 ? "viseme_SS" : "viseme_FF";
      } else if (low > mid * 1.15) {
        viseme = low > 0.45 ? "viseme_O" : "viseme_aa";
      } else if (mid > low && mid > high) {
        viseme = mid > 0.4 ? "viseme_E" : "viseme_I";
      } else if (high > 0.18 && mid > 0.2) {
        viseme = "viseme_CH";
      } else {
        viseme = "viseme_U";
      }

      const strength = Math.min(0.95, 0.35 + level * 0.7);
      if (viseme !== lastViseme) {
        clearVisemes(viseme);
        lastViseme = viseme;
      }
      head.setValue(viseme, strength, 45);
      head.setValue("mouthOpen", Math.min(1, level * 1.15), 45);
      head.setValue("jawOpen", Math.min(0.85, level * 0.9), 45);

      raf = requestAnimationFrame(tick);
    };

    void ctx.resume().catch(() => undefined);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      clearVisemes();
      void ctx.close().catch(() => undefined);
    };
  }, [ready, mediaStream]);

  if (failed) {
    return (
      <div className={styles.fallback} ref={rootRef}>
        <LipSyncAvatar gender={gender} name={name} mouthOpen={mouthOpen} speaking={speaking} />
        {errorHint ? <p className={styles.errorHint}>{errorHint}</p> : null}
      </div>
    );
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <div ref={mountRef} className={styles.viewport} aria-label={`${name} 3D avatar`} />
      {loading ? <div className={styles.overlay}>Loading {name}…</div> : null}
    </div>
  );
}
