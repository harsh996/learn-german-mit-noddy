import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "sprachraum-frontend",
    provider: process.env.AI_PROVIDER || "gemini",
  });
}
