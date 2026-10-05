import { NextRequest } from "next/server";
import {
  AccessToken,
  AgentDispatchClient,
  RoomAgentDispatch,
  RoomConfiguration,
  RoomServiceClient,
} from "livekit-server-sdk";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { jsonError, jsonOk, unauthorized } from "@/lib/api";

const AGENT_NAME = "german-tutor";

function httpLivekitHost(wsUrl: string) {
  return wsUrl.replace(/^ws:/, "http:").replace(/^wss:/, "https:");
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const { profileId } = await req.json();
    if (!profileId) return jsonError("profileId is required");

    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId: session.userId },
    });
    if (!profile) return jsonError("Profile not found", 404);

    const apiKey = process.env.LIVEKIT_API_KEY || "devkey";
    const apiSecret =
      process.env.LIVEKIT_API_SECRET || "secretsecretsecretsecretsecret12";
    const publicUrl =
      process.env.NEXT_PUBLIC_LIVEKIT_URL || "ws://localhost:7880";
    const internalUrl = process.env.LIVEKIT_URL || publicUrl;
    const livekitHttp = httpLivekitHost(internalUrl);

    const roomName = `tutor-${profile.id.slice(0, 8)}-${Date.now()}`;
    const identity = `user-${session.userId.slice(0, 8)}`;

    const metadata = JSON.stringify({
      profileId: profile.id,
      level: profile.level,
      avatarGender: profile.avatarGender,
      avatarName: profile.avatarName,
      profileName: profile.name,
      userId: session.userId,
    });

    const roomService = new RoomServiceClient(livekitHttp, apiKey, apiSecret);
    await roomService.createRoom({
      name: roomName,
      metadata,
      emptyTimeout: 300,
      maxParticipants: 4,
    });

    // Explicitly request the named worker (survives race where worker registers late)
    try {
      const dispatch = new AgentDispatchClient(livekitHttp, apiKey, apiSecret);
      await dispatch.createDispatch(roomName, AGENT_NAME, { metadata });
    } catch (err) {
      console.warn("Agent dispatch warning:", err);
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: profile.name,
      metadata,
      ttl: "1h",
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    at.roomConfig = new RoomConfiguration({
      agents: [
        new RoomAgentDispatch({
          agentName: AGENT_NAME,
          metadata,
        }),
      ],
    });

    const token = await at.toJwt();

    return jsonOk({
      token,
      url: publicUrl,
      roomName,
      profile: {
        id: profile.id,
        name: profile.name,
        level: profile.level,
        avatarGender: profile.avatarGender,
        avatarName: profile.avatarName,
      },
    });
  } catch (err) {
    console.error("Token error:", err);
    return jsonError("Failed to create LiveKit token", 500);
  }
}
