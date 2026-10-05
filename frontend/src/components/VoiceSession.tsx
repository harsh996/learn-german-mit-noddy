"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteAudioTrack,
  createLocalAudioTrack,
} from "livekit-client";
import { containsBlockedContent, SAFETY_REFUSAL_DE } from "@/lib/safety";
import styles from "./VoiceSession.module.css";

const TalkingHeadAvatar = dynamic(
  () => import("./TalkingHeadAvatar").then((m) => m.TalkingHeadAvatar),
  { ssr: false }
);

type ProfileInfo = {
  id: string;
  name: string;
  level: string;
  avatarGender: "female" | "male";
  avatarName: string;
};

type ChatLine = {
  role: "tutor" | "learner" | "system";
  text: string;
};

type Props = {
  profileId: string;
  onEnded?: () => void;
};

export function VoiceSession({ profileId, onEnded }: Props) {
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "ending" | "error">("idle");
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [tutorJoined, setTutorJoined] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [needsAudioGesture, setNeedsAudioGesture] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [tutorStream, setTutorStream] = useState<MediaStream | null>(null);

  const roomRef = useRef<Room | null>(null);
  const audioElsRef = useRef<HTMLAudioElement[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const localTrackRef = useRef<Awaited<ReturnType<typeof createLocalAudioTrack>> | null>(null);
  const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const transcriptLines = useMemo(
    () => chat.map((c) => `${c.role}: ${c.text}`),
    [chat]
  );

  const stopAnalyser = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    analyserRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    setMouthOpen(0);
    setSpeaking(false);
  }, []);

  const attachAnalyser = useCallback(
    (mediaStream: MediaStream) => {
      stopAnalyser();
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const source = ctx.createMediaStreamSource(mediaStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.65;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        const n = Math.min(40, data.length);
        for (let i = 2; i < n; i++) sum += data[i];
        const avg = sum / (n - 2) / 255;
        const open = Math.min(1, Math.pow(avg * 2.2, 1.1));
        setMouthOpen(open);
        setSpeaking(open > 0.08);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      if (ctx.state === "suspended") {
        void ctx.resume().catch(() => undefined);
      }
    },
    [stopAnalyser]
  );

  const unlockAudio = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.startAudio();
      if (audioCtxRef.current?.state === "suspended") {
        await audioCtxRef.current.resume();
      }
      for (const el of audioElsRef.current) {
        el.muted = false;
        el.volume = 1;
        await el.play().catch(() => undefined);
      }
      setAudioUnlocked(true);
      setNeedsAudioGesture(false);
      setHint("");
    } catch (err) {
      console.warn("Audio unlock failed", err);
      setNeedsAudioGesture(true);
      setHint("Browser blocked sound. Click “Enable tutor sound”, then speak.");
    }
  }, []);

  const cleanupRoom = useCallback(async () => {
    if (waitTimerRef.current) {
      clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    }
    stopAnalyser();
    setTutorStream(null);
    if (localTrackRef.current) {
      localTrackRef.current.stop();
      localTrackRef.current = null;
    }
    for (const el of audioElsRef.current) {
      el.pause();
      el.remove();
    }
    audioElsRef.current = [];
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    setTutorJoined(false);
    setAudioUnlocked(false);
    setNeedsAudioGesture(false);
  }, [stopAnalyser]);

  const summarizeSession = useCallback(
    async (lines: string[]) => {
      const text = lines.join("\n").slice(0, 20000);
      if (!text.trim()) return;

      const mistakes: Array<{ category: string; errorPattern: string; correctionNote: string }> = [];
      const lower = text.toLowerCase();
      if (/\bmit (der|die|das)\b/.test(lower) || /\bmit den\b/.test(lower)) {
        mistakes.push({
          category: "Grammar",
          errorPattern: "Incorrect case after preposition 'mit'",
          correctionNote: "Always use Dativ after 'mit' → mit dem / mit der / mit den",
        });
      }
      if (/\bich habe gegangen\b/.test(lower)) {
        mistakes.push({
          category: "Grammar",
          errorPattern: "Uses haben instead of sein with gehen",
          correctionNote: "Motion verbs use sein → ich bin gegangen",
        });
      }

      await fetch("/api/session/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          summary: `Voice lesson practiced. Turns logged: ${lines.length}.`,
          mistakes,
          transcript: text,
        }),
      }).catch(() => undefined);
    },
    [profileId]
  );

  const endSession = useCallback(async () => {
    setStatus("ending");
    const lines = transcriptLines;
    await cleanupRoom();
    await summarizeSession(lines);
    setStatus("idle");
    onEnded?.();
  }, [cleanupRoom, onEnded, summarizeSession, transcriptLines]);

  const startSession = useCallback(async () => {
    setError("");
    setHint("");
    setTutorJoined(false);
    setNeedsAudioGesture(false);
    setAudioUnlocked(false);
    setTutorStream(null);
    setStatus("connecting");
    setChat([]);

    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start session");
        setStatus("error");
        return;
      }

      setProfile(data.profile);

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      const markTutorPresent = () => {
        setTutorJoined(true);
        if (waitTimerRef.current) {
          clearTimeout(waitTimerRef.current);
          waitTimerRef.current = null;
        }
      };

      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        const ok = room.canPlaybackAudio;
        setAudioUnlocked(ok);
        setNeedsAudioGesture(!ok);
        if (!ok) {
          setHint("Tutor audio is blocked by the browser. Click “Enable tutor sound”.");
        }
      });

      room.on(RoomEvent.ParticipantConnected, () => {
        markTutorPresent();
      });

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        markTutorPresent();
        if (track.kind !== Track.Kind.Audio) return;

        const audioTrack = track as RemoteAudioTrack;
        const el = audioTrack.attach() as HTMLAudioElement;
        el.autoplay = true;
        el.setAttribute("playsinline", "true");
        el.muted = false;
        el.volume = 1;
        el.style.display = "none";
        document.body.appendChild(el);
        audioElsRef.current.push(el);

        void el.play().catch(() => {
          setNeedsAudioGesture(true);
          setHint("Tutor audio is blocked by the browser. Click “Enable tutor sound”.");
        });
        void room
          .startAudio()
          .then(() => {
            setAudioUnlocked(true);
            setNeedsAudioGesture(false);
          })
          .catch(() => {
            setNeedsAudioGesture(true);
          });

        const mediaStream = new MediaStream([audioTrack.mediaStreamTrack]);
        setTutorStream(mediaStream);
        attachAnalyser(mediaStream);
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) {
          track.detach().forEach((el) => {
            el.remove();
            audioElsRef.current = audioElsRef.current.filter((x) => x !== el);
          });
          setTutorStream(null);
        }
        stopAnalyser();
      });

      room.on(RoomEvent.Disconnected, () => {
        stopAnalyser();
        setTutorStream(null);
        setStatus("idle");
        setTutorJoined(false);
      });

      room.on(RoomEvent.DataReceived, (payload) => {
        try {
          const msg = new TextDecoder().decode(payload);
          const parsed = JSON.parse(msg);
          if (parsed?.type === "transcript" && typeof parsed.text === "string") {
            if (containsBlockedContent(parsed.text)) {
              setChat((t) => [...t, { role: "system", text: SAFETY_REFUSAL_DE }]);
              return;
            }
            const roleRaw = String(parsed.role || "tutor").toLowerCase();
            const role: ChatLine["role"] =
              roleRaw === "user" || roleRaw === "learner" || roleRaw === "student"
                ? "learner"
                : roleRaw === "system"
                  ? "system"
                  : "tutor";
            setChat((t) => [...t.slice(-40), { role, text: parsed.text }]);
          }
        } catch {
          // ignore non-json data
        }
      });

      await room.connect(data.url, data.token);

      void room
        .startAudio()
        .then(() => setAudioUnlocked(true))
        .catch(() => {
          setNeedsAudioGesture(true);
          setHint("Click “Enable tutor sound” so you can hear Lukas/Hannah.");
        });

      if (room.remoteParticipants.size > 0) {
        markTutorPresent();
      }

      const mic = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      localTrackRef.current = mic;
      await room.localParticipant.publishTrack(mic);

      setStatus("live");
      waitTimerRef.current = setTimeout(() => {
        if (room.remoteParticipants.size === 0) {
          setHint(
            "Room is connected, but the AI tutor worker has not joined yet. Wait a few seconds, then click Retry."
          );
        }
      }, 8000);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Connection failed");
      setStatus("error");
      await cleanupRoom();
    }
  }, [attachAnalyser, cleanupRoom, profileId, stopAnalyser]);

  useEffect(() => {
    void startSession();
    return () => {
      void cleanupRoom();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  async function toggleMute() {
    const track = localTrackRef.current;
    if (!track) return;
    if (muted) {
      await track.unmute();
      setMuted(false);
    } else {
      await track.mute();
      setMuted(true);
    }
  }

  const gender = profile?.avatarGender || "female";
  const avatarName = profile?.avatarName || "Hannah";

  const statusLabel = (() => {
    if (status === "connecting") return "Connecting…";
    if (status === "ending") return "Saving session…";
    if (status === "error") return "Connection error";
    if (status === "idle") return "Session ended";
    if (!tutorJoined) return "Waiting for tutor…";
    if (speaking) return "Tutor speaking";
    if (needsAudioGesture) return "Sound blocked";
    return "Listening";
  })();

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.tutorMeta}>
          <div className={styles.tutorName}>{avatarName}</div>
          <div className={styles.statusRow}>
            <span className={styles.dot} data-live={status === "live" && tutorJoined} />
            {profile ? `${profile.name} · ${profile.level} · ${statusLabel}` : statusLabel}
          </div>
        </div>
        <button
          className={styles.closeBtn}
          type="button"
          aria-label="End lesson"
          onClick={() => void endSession()}
          disabled={status !== "live" && status !== "connecting"}
        >
          ×
        </button>
      </header>

      <div className={styles.stage}>
        <div className={styles.avatarFrame}>
          <TalkingHeadAvatar
            gender={gender}
            name={avatarName}
            mediaStream={tutorStream}
            mouthOpen={mouthOpen}
            speaking={speaking || status === "connecting"}
          />
        </div>
      </div>

      {needsAudioGesture || (tutorJoined && !audioUnlocked) ? (
        <div className={styles.soundGate}>
          <p>The tutor is connected, but your browser is blocking sound until you allow it.</p>
          <button className="btn btn-primary" type="button" onClick={() => void unlockAudio()}>
            Enable tutor sound
          </button>
        </div>
      ) : null}

      {error ? <div className={styles.errorBanner}>{error}</div> : null}
      {hint && !needsAudioGesture ? (
        <div className={styles.hint}>
          {hint}
          <div className={styles.hintActions}>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                void (async () => {
                  await cleanupRoom();
                  await startSession();
                })();
              }}
            >
              Retry joining tutor
            </button>
          </div>
        </div>
      ) : null}

      <div className={styles.chat} aria-live="polite">
        {chat.length === 0 ? (
          <p className={styles.chatEmpty}>Chat appears here as you practice.</p>
        ) : (
          chat.slice(-16).map((line, i) => (
            <div
              key={`${i}-${line.text.slice(0, 24)}`}
              className={`${styles.bubble} ${
                line.role === "learner" ? styles.bubbleLearner : styles.bubbleTutor
              }`}
            >
              {line.text}
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      <div className={styles.dock}>
        <button
          className={styles.secondaryBtn}
          type="button"
          onClick={() => void unlockAudio()}
          disabled={status !== "live"}
        >
          {audioUnlocked ? "Sound on" : "Sound"}
        </button>
        <button
          className={styles.micBtn}
          type="button"
          data-muted={muted}
          aria-label={muted ? "Unmute microphone" : "Mute microphone"}
          onClick={() => void toggleMute()}
          disabled={status !== "live"}
        >
          <MicIcon muted={muted} />
        </button>
        <button
          className={styles.secondaryBtn}
          type="button"
          onClick={() => void endSession()}
          disabled={status !== "live" && status !== "connecting"}
        >
          End
        </button>
      </div>
    </div>
  );
}

function MicIcon({ muted }: { muted: boolean }) {
  if (muted) {
    return (
      <svg className={styles.micIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M5 11a7 7 0 0 0 10.5 6M19 11a6.9 6.9 0 0 1-1.2 3.9M12 18v3M4 4l16 16"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg className={styles.micIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
