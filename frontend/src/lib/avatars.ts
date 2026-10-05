export type AvatarGender = "female" | "male";

/**
 * Free local TalkingHead GLBs (from met4citizen/TalkingHead, MIT).
 * Hosted under /public/avatars so we do not depend on Ready Player Me CDN
 * (models.readyplayer.me currently fails DNS in many networks).
 */
export const TUTOR_AVATARS = {
  female: {
    name: "Hannah",
    body: "F" as const,
    url: "/avatars/hannah.glb",
    avatarMood: "happy",
    baseline: undefined as Record<string, number> | undefined,
    retarget: undefined as Record<string, unknown> | undefined,
  },
  male: {
    name: "Lukas",
    body: "M" as const,
    url: "/avatars/lukas.glb",
    avatarMood: "neutral",
    baseline: {
      headRotateX: -0.04,
      eyeBlinkLeft: 0.05,
      eyeBlinkRight: 0.05,
    },
    retarget: {
      Neck: { z: -0.01, rx: -0.15 },
      Neck1: { z: -0.01, rx: -0.15 },
      Neck2: { z: -0.01, rx: -0.15 },
      LeftShoulder: { rz: -0.3 },
      RightShoulder: { rz: 0.3 },
      scaleToEyesLevel: 1.0,
      origin: { y: -0.1 },
    },
  },
} as const;

export function getAvatarConfig(gender: AvatarGender) {
  const meta = TUTOR_AVATARS[gender] ?? TUTOR_AVATARS.female;
  return {
    url: meta.url,
    body: meta.body,
    name: meta.name,
    avatarMood: meta.avatarMood,
    baseline: meta.baseline,
    retarget: meta.retarget,
    lipsyncLang: "de" as const,
  };
}
