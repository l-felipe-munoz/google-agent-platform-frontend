import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createAgentSession } from "@/lib/agentEngine";
import type { SessionResponse } from "@/types/chat";

export const runtime = "nodejs";

export async function POST() {
  const userId = `user_${randomUUID()}`;

  let sessionId: string | null = null;
  try {
    sessionId = await createAgentSession(userId);
  } catch {
    // El agente puede no soportar sesiones (no todos los frameworks las requieren).
    // No es un error fatal: seguimos sin sessionId.
    sessionId = null;
  }

  const body: SessionResponse = { userId, sessionId };
  return NextResponse.json(body);
}
