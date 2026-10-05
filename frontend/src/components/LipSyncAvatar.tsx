"use client";

import { useEffect, useRef } from "react";

type Props = {
  gender: "female" | "male";
  name: string;
  mouthOpen: number; // 0..1
  speaking: boolean;
};

/**
 * Audio-reactive 2D canvas avatar. Mouth height tracks Web Audio analyser amplitude.
 */
export function LipSyncAvatar({ gender, name, mouthOpen, speaking }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouthRef = useRef(mouthOpen);
  mouthRef.current = mouthOpen;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let idle = 0;

    const draw = () => {
      idle += 0.03;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // soft halo
      const halo = ctx.createRadialGradient(w / 2, h * 0.42, 20, w / 2, h * 0.42, w * 0.45);
      halo.addColorStop(0, gender === "female" ? "rgba(201,162,39,0.22)" : "rgba(90,140,160,0.22)");
      halo.addColorStop(1, "transparent");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h * 0.42;
      const headR = Math.min(w, h) * 0.28;
      const bounce = speaking ? Math.sin(idle * 2) * 2 : Math.sin(idle) * 1.2;

      // neck
      ctx.fillStyle = gender === "female" ? "#e8c4a8" : "#d4b090";
      ctx.fillRect(cx - 18, cy + headR * 0.7, 36, 55);

      // shoulders
      ctx.beginPath();
      ctx.ellipse(cx, cy + headR + 58, headR * 1.35, 38, 0, 0, Math.PI * 2);
      ctx.fillStyle = gender === "female" ? "#1a5c52" : "#2c3e50";
      ctx.fill();

      // head
      ctx.beginPath();
      ctx.arc(cx, cy + bounce, headR, 0, Math.PI * 2);
      ctx.fillStyle = gender === "female" ? "#f0d0b4" : "#dfbf98";
      ctx.fill();

      // hair
      ctx.beginPath();
      if (gender === "female") {
        ctx.ellipse(cx, cy - headR * 0.15 + bounce, headR * 1.05, headR * 0.95, 0, Math.PI, Math.PI * 2);
        ctx.fillStyle = "#3d2415";
        ctx.fill();
        // side hair
        ctx.beginPath();
        ctx.ellipse(cx - headR * 0.85, cy + headR * 0.2 + bounce, 22, 55, 0.2, 0, Math.PI * 2);
        ctx.ellipse(cx + headR * 0.85, cy + headR * 0.2 + bounce, 22, 55, -0.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.ellipse(cx, cy - headR * 0.35 + bounce, headR * 0.95, headR * 0.55, 0, Math.PI, Math.PI * 2);
        ctx.fillStyle = "#2a2118";
        ctx.fill();
      }

      // eyes
      const eyeY = cy - 8 + bounce;
      const blink = Math.sin(idle * 0.4) > 0.98 ? 0.15 : 1;
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.ellipse(cx - 28, eyeY, 7, 8 * blink, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 28, eyeY, 7, 8 * blink, 0, 0, Math.PI * 2);
      ctx.fill();

      // brows
      ctx.strokeStyle = gender === "female" ? "#3d2415" : "#2a2118";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 40, eyeY - 18);
      ctx.quadraticCurveTo(cx - 28, eyeY - 24, cx - 16, eyeY - 16);
      ctx.moveTo(cx + 16, eyeY - 16);
      ctx.quadraticCurveTo(cx + 28, eyeY - 24, cx + 40, eyeY - 18);
      ctx.stroke();

      // nose
      ctx.strokeStyle = "rgba(80,50,30,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, eyeY + 8);
      ctx.lineTo(cx - 4, eyeY + 28);
      ctx.stroke();

      // mouth — reactive viseme from analyser
      const open = Math.max(0.05, Math.min(1, mouthRef.current));
      const mouthW = 28 + open * 8;
      const mouthH = 4 + open * 28;
      const mouthY = cy + 38 + bounce;

      ctx.beginPath();
      ctx.ellipse(cx, mouthY, mouthW, mouthH, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#8b3a3a";
      ctx.fill();

      if (open > 0.25) {
        ctx.beginPath();
        ctx.ellipse(cx, mouthY + mouthH * 0.15, mouthW * 0.65, mouthH * 0.55, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#3a1515";
        ctx.fill();
      }

      // name plate
      ctx.fillStyle = "rgba(15,61,54,0.85)";
      const label = name;
      ctx.font = "600 16px Manrope, sans-serif";
      const tw = ctx.measureText(label).width;
      const lx = cx - tw / 2 - 12;
      const ly = h - 42;
      roundRect(ctx, lx, ly, tw + 24, 28, 14);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(label, cx - tw / 2, ly + 19);

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [gender, name, speaking]);

  return (
    <canvas
      ref={canvasRef}
      width={420}
      height={520}
      style={{ width: "100%", maxWidth: 420, height: "auto", display: "block" }}
      aria-label={`${name} avatar`}
    />
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
