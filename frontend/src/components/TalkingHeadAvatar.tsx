"use client";

import { useEffect, useRef, useState } from "react";
import { LipSyncAvatar } from "./LipSyncAvatar";
import { getAvatarConfig, type AvatarGender } from "@/lib/avatars";
import styles from "./TalkingHeadAvatar.module.css";

type Props = {
  gender: AvatarGender;
  name: string;
  mediaStream: MediaStream | null;
  /** When true, resume Web Audio so delayed tutor playback + lip sync run */
  audioUnlocked?: boolean;
  mouthOpen?: number;
  speaking?: boolean;
};

type HeadInstance = {
  showAvatar: (avatar: Record<string, unknown>, onprogress?: unknown) => Promise<void>;
  lookAtCamera: (t?: number) => void;
  setView?: (view: string, opt?: Record<string, unknown>) => void;
  start: () => void;
  stop: () => void;
  streamStop?: () => void;
  speakWithHands?: () => void;
  audioCtx: AudioContext;
  mtAvatar: Record<string, { newvalue: number | null; needsUpdate: boolean }>;
  opt: { update?: ((dt: number) => void) | null };
  isSpeaking: boolean;
};

type HeadAudioInstance = AudioWorkletNode & {
  loadModel: (url: string, reset?: boolean) => Promise<void>;
  update: (dt: number) => void;
  start: () => void;
  stop: () => void;
  onvalue: ((key: string, value: number) => void) | null;
  onstarted: ((data: unknown) => void) | null;
  onended: ((data: unknown) => void) | null;
  parameters: AudioParamMap;
};

const WORKLET_URL = "/headaudio/headworklet.min.mjs";
const MODEL_URL = "/headaudio/model-en-mixed.bin";
/** Delay heard audio so MFCC visemes land on the syllables the user hears */
const PLAYBACK_DELAY_SEC = 0.09;

/**
 * Production avatar: TalkingHead 3D + HeadAudio MFCC lip-sync.
 * Looks at the camera; lips driven from live tutor audio (works for German speech).
 */
export function TalkingHeadAvatar({
  gender,
  name,
  mediaStream,
  audioUnlocked = false,
  mouthOpen = 0,
  speaking = false,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HeadInstance | null>(null);
  const headAudioRef = useRef<HeadAudioInstance | null>(null);
  const streamNodesRef = useRef<{
    source: MediaStreamAudioSourceNode;
    delay: DelayNode;
    gain: GainNode;
  } | null>(null);
  const gazeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorHint, setErrorHint] = useState("");

  // Boot TalkingHead + HeadAudio
  useEffect(() => {
    let cancelled = false;
    let head: HeadInstance | null = null;
    let headAudio: HeadAudioInstance | null = null;

    async function boot() {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const node = mountRef.current;
      if (!node || cancelled) return;

      setLoading(true);
      setFailed(false);
      setReady(false);
      setErrorHint("");

      try {
        const [{ TalkingHead }, { HeadAudio }] = await Promise.all([
          import("@met4citizen/talkinghead"),
          import("@met4citizen/headaudio/dist/headaudio.min.mjs"),
        ]);
        if (cancelled || !mountRef.current) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        head = new (TalkingHead as any)(mountRef.current, {
          ttsEndpoint: "",
          lipsyncModules: [],
          lipsyncLang: "de",
          cameraView: "head",
          cameraDistance: -0.35,
          cameraY: 0.02,
          cameraX: 0,
          cameraRotateX: 0,
          cameraRotateY: 0,
          modelFPS: 30,
          modelMovementFactor: 0.25,
          modelPixelRatio: Math.min(
            typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
            1.75
          ),
          lightAmbientIntensity: 2.4,
          lightDirectIntensity: 20,
          lightSpotIntensity: 6,
          avatarMood: "neutral",
          avatarIgnoreCamera: false,
          avatarIdleEyeContact: 0.95,
          avatarSpeakingEyeContact: 1,
          avatarIdleHeadMove: 0.12,
          avatarSpeakingHeadMove: 0.18,
          cameraRotateEnable: false,
          cameraPanEnable: false,
          cameraZoomEnable: false,
        }) as HeadInstance;

        headRef.current = head;

        await head.audioCtx.audioWorklet.addModule(WORKLET_URL);
        if (cancelled) {
          head.stop();
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        headAudio = new (HeadAudio as any)(head.audioCtx, {
          parameterData: {
            vadGateActiveDb: -42,
            vadGateInactiveDb: -58,
            vadGateActiveMs: 12,
            vadGateInactiveMs: 80,
            speakerMeanHz: gender === "female" ? 210 : 120,
          },
        }) as HeadAudioInstance;

        await headAudio.loadModel(MODEL_URL);
        headAudioRef.current = headAudio;

        headAudio.onvalue = (key, value) => {
          const mt = head?.mtAvatar?.[key];
          if (!mt) return;
          Object.assign(mt, { newvalue: value, needsUpdate: true });
        };

        let lastEnded = 0;
        headAudio.onended = () => {
          lastEnded = Date.now();
          if (head) head.isSpeaking = false;
        };
        headAudio.onstarted = () => {
          if (!head) return;
          head.isSpeaking = true;
          if (Date.now() - lastEnded > 120) {
            head.lookAtCamera(400);
          }
        };

        head.opt.update = headAudio.update.bind(headAudio);

        const cfg = getAvatarConfig(gender);
        const avatarOpts: Record<string, unknown> = {
          url: cfg.url,
          body: cfg.body,
          avatarMood: "neutral",
          lipsyncLang: "de",
          avatarIgnoreCamera: false,
          avatarIdleEyeContact: 0.95,
          avatarSpeakingEyeContact: 1,
          avatarIdleHeadMove: 0.12,
          avatarSpeakingHeadMove: 0.18,
        };
        if (cfg.baseline) avatarOpts.baseline = cfg.baseline;
        if (cfg.retarget) avatarOpts.retarget = cfg.retarget;

        await head.showAvatar(avatarOpts);
        if (cancelled) {
          head.stop();
          return;
        }

        head.setView?.("head", {
          cameraDistance: -0.35,
          cameraY: 0.02,
          cameraX: 0,
        });
        head.lookAtCamera(0);
        head.start();
        headAudio.start();

        gazeTimerRef.current = setInterval(() => {
          headRef.current?.lookAtCamera(600);
        }, 3500);

        setReady(true);
        setLoading(false);
      } catch (err) {
        console.warn("TalkingHead/HeadAudio failed, using canvas fallback", err);
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
      if (gazeTimerRef.current) {
        clearInterval(gazeTimerRef.current);
        gazeTimerRef.current = null;
      }
      try {
        streamNodesRef.current?.source.disconnect();
        streamNodesRef.current?.delay.disconnect();
        streamNodesRef.current?.gain.disconnect();
      } catch {
        // ignore
      }
      streamNodesRef.current = null;
      try {
        headAudioRef.current?.stop();
        headAudioRef.current?.disconnect();
      } catch {
        // ignore
      }
      headAudioRef.current = null;
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

  // Wire LiveKit tutor MediaStream → HeadAudio + delayed playback
  useEffect(() => {
    const head = headRef.current;
    const headAudio = headAudioRef.current;
    if (!ready || !head || !headAudio || !mediaStream) return;
    if (!mediaStream.getAudioTracks()[0]) return;

    try {
      streamNodesRef.current?.source.disconnect();
      streamNodesRef.current?.delay.disconnect();
      streamNodesRef.current?.gain.disconnect();
    } catch {
      // ignore
    }

    const source = head.audioCtx.createMediaStreamSource(mediaStream);
    const delay = head.audioCtx.createDelay(0.25);
    delay.delayTime.value = PLAYBACK_DELAY_SEC;
    const gain = head.audioCtx.createGain();
    gain.gain.value = 1;

    // Undelayed → lip sync classifier (so mouth leads, then delayed audio catches up)
    source.connect(headAudio);
    // Delayed → speakers (aligns heard German syllables with visemes)
    source.connect(delay);
    delay.connect(gain);
    gain.connect(head.audioCtx.destination);

    streamNodesRef.current = { source, delay, gain };
    head.lookAtCamera(300);

    return () => {
      try {
        source.disconnect();
        delay.disconnect();
        gain.disconnect();
      } catch {
        // ignore
      }
      if (streamNodesRef.current?.source === source) {
        streamNodesRef.current = null;
      }
    };
  }, [ready, mediaStream]);

  // Resume AudioContext after user gesture / unlock
  useEffect(() => {
    const head = headRef.current;
    if (!ready || !head || !audioUnlocked) return;
    void head.audioCtx.resume().catch(() => undefined);
    headAudioRef.current?.start();
    head.lookAtCamera(400);
  }, [ready, audioUnlocked]);

  if (failed) {
    return (
      <div className={styles.fallback}>
        <LipSyncAvatar gender={gender} name={name} mouthOpen={mouthOpen} speaking={speaking} />
        {errorHint ? <p className={styles.errorHint}>{errorHint}</p> : null}
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div ref={mountRef} className={styles.viewport} aria-label={`${name} 3D avatar`} />
      {loading ? <div className={styles.overlay}>Loading {name}…</div> : null}
    </div>
  );
}
