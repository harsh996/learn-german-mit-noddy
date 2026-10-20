"""
LiveKit voice agent — multi-provider (Gemini / OpenAI) German tutor.
Compatible with livekit-agents 1.x (AgentSession + RealtimeModel).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

import httpx
from dotenv import load_dotenv

from livekit.agents import (
    Agent,
    AgentSession,
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
)
from livekit.plugins import google, openai

from memory import extract_heuristic_mistakes, fetch_profile_memories
from prompts import build_system_prompt

load_dotenv()

logger = logging.getLogger("german-tutor-agent")
logging.basicConfig(level=logging.INFO)


def _parse_metadata(ctx: JobContext) -> dict[str, Any]:
    meta: dict[str, Any] = {}
    raw_room = ctx.room.metadata or ""
    if raw_room:
        try:
            meta.update(json.loads(raw_room))
        except json.JSONDecodeError:
            logger.warning("Invalid room metadata JSON")

    if not meta.get("profileId"):
        for participant in ctx.room.remote_participants.values():
            if participant.metadata:
                try:
                    meta.update(json.loads(participant.metadata))
                    break
                except json.JSONDecodeError:
                    continue
    return meta


def _build_realtime_model(system_prompt: str, gender: str):
    provider = os.getenv("AI_PROVIDER", "gemini").lower()

    if provider == "openai":
        voice_name = "alloy" if gender == "female" else "echo"
        model_name = os.getenv("OPENAI_MODEL", "gpt-4o-realtime-preview")
        api_key = os.getenv("OPENAI_API_KEY")
        logger.info("Using OpenAI Realtime model=%s voice=%s", model_name, voice_name)
        kwargs: dict[str, Any] = {
            "model": model_name,
            "voice": voice_name,
            "instructions": system_prompt,
        }
        if api_key:
            kwargs["api_key"] = api_key
        # Short silence window so replies start promptly after the learner stops.
        try:
            from openai.types.beta.realtime.session import TurnDetection

            kwargs["turn_detection"] = TurnDetection(
                type="server_vad",
                threshold=0.5,
                prefix_padding_ms=300,
                silence_duration_ms=int(os.getenv("OPENAI_SILENCE_MS", "500")),
            )
        except Exception:  # noqa: BLE001
            logger.warning("OpenAI turn_detection config unavailable; using defaults")
        return openai.realtime.RealtimeModel(**kwargs)

    voice_name = "Aoede" if gender == "female" else "Puck"
    model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-native-audio-preview-12-2025")
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    logger.info("Using Gemini Realtime model=%s voice=%s", model_name, voice_name)

    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY is missing — cannot start Gemini realtime session")

    # ~0.5s silence ends the turn so replies feel conversational; raise GEMINI_SILENCE_MS
    # if short pauses mid-sentence get cut off.
    # END_SENSITIVITY_LOW + long silence previously caused multi-minute hangs with mic noise.
    silence_ms = int(os.getenv("GEMINI_SILENCE_MS", "500"))
    prefix_ms = int(os.getenv("GEMINI_PREFIX_PADDING_MS", "200"))
    realtime_input_config = None
    try:
        from google.genai import types

        realtime_input_config = types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                disabled=False,
                start_of_speech_sensitivity=types.StartSensitivity.START_SENSITIVITY_HIGH,
                end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_HIGH,
                prefix_padding_ms=prefix_ms,
                silence_duration_ms=silence_ms,
            ),
            activity_handling=types.ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
            turn_coverage=types.TurnCoverage.TURN_INCLUDES_ALL_INPUT,
        )
        logger.info(
            "Gemini VAD: silence=%sms prefix=%sms end_sensitivity=HIGH",
            silence_ms,
            prefix_ms,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not configure Gemini activity detection: %s", exc)

    return google.realtime.RealtimeModel(
        model=model_name,
        voice=voice_name,
        instructions=system_prompt,
        api_key=api_key,
        realtime_input_config=realtime_input_config,
    )


async def _post_session_summary(
    profile_id: str,
    summary: str,
    mistakes: list[dict[str, str]],
    transcript: str,
) -> None:
    frontend = os.getenv("FRONTEND_URL", "http://frontend:3000").rstrip("/")
    secret = os.getenv("AUTH_SECRET", "")
    if not secret:
        logger.error("AUTH_SECRET is not set; cannot post session summary")
        return
    url = f"{frontend}/api/session/summarize"

    payload = {
        "profileId": profile_id,
        "summary": summary,
        "mistakes": mistakes,
        "transcript": transcript[:20000],
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                url,
                json=payload,
                headers={"x-agent-key": secret, "Content-Type": "application/json"},
            )
            logger.info("Session summarize status=%s body=%s", resp.status_code, resp.text[:200])
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to post session summary: %s", exc)


async def entrypoint(ctx: JobContext):
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    logger.info("Connected to room %s", ctx.room.name)

    try:
        await ctx.wait_for_participant()
    except Exception:  # noqa: BLE001
        logger.warning("No participant yet; continuing with room metadata only")

    meta = _parse_metadata(ctx)
    profile_id = meta.get("profileId")
    level = meta.get("level", "A1")
    gender = meta.get("avatarGender", "female")
    profile_name = meta.get("profileName")

    memories = await asyncio.to_thread(fetch_profile_memories, profile_id) if profile_id else []
    system_prompt = build_system_prompt(
        level=level,
        memory_items=memories,
        avatar_gender=gender,
        profile_name=profile_name,
    )

    model = _build_realtime_model(system_prompt, gender)
    transcript_chunks: list[str] = []

    session = AgentSession(llm=model)
    agent = Agent(instructions=system_prompt)

    @session.on("user_input_transcribed")
    def _on_user_transcript(ev):  # type: ignore[no-untyped-def]
        text = getattr(ev, "transcript", None) or getattr(ev, "text", "") or ""
        if text:
            transcript_chunks.append(f"user: {text}")

    @session.on("conversation_item_added")
    def _on_item(ev):  # type: ignore[no-untyped-def]
        item = getattr(ev, "item", None)
        role = getattr(item, "role", None)
        content = getattr(item, "text_content", None) or getattr(item, "content", "")
        if role and content:
            transcript_chunks.append(f"{role}: {content}")

    await session.start(agent=agent, room=ctx.room)

    greeting_instruction = (
        "Greet the learner warmly in German at their CEFR level (1 short sentence). "
        "Immediately offer 2 topic choices (e.g. weekend, food, hobbies) and ask them "
        "to say a few sentences. Keep it brief and start the dialogue right away."
    )

    # Realtime models produce the spoken greeting themselves.
    await session.generate_reply(instructions=greeting_instruction)

    async def _on_shutdown(*_args):  # type: ignore[no-untyped-def]
        if not profile_id:
            return
        joined = "\n".join(transcript_chunks)
        mistakes = extract_heuristic_mistakes(joined)
        summary = (
            f"Voice session for {profile_name or 'learner'} at level {level}. "
            f"Memories loaded: {len(memories)}. Turns: {len(transcript_chunks)}."
        )
        await _post_session_summary(profile_id, summary, mistakes, joined)

    ctx.add_shutdown_callback(_on_shutdown)


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name="german-tutor",
        )
    )
