import { NextRequest, NextResponse } from "next/server";
import { AgentEngineError, streamAgentQuery } from "@/lib/agentEngine";
import { EnvConfigError } from "@/lib/env";
import { GoogleAuthConfigError } from "@/lib/googleAuth";
import type { ChatRequestBody } from "@/types/chat";

export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 8000;

export async function POST(req: NextRequest) {
  let body: Partial<ChatRequestBody>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo de la petición no es JSON válido." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const userId = typeof body.userId === "string" ? body.userId : "";

  if (!userId) {
    return NextResponse.json({ error: "Falta userId. Recarga la página para abrir una sesión." }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "El mensaje no puede estar vacío." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `El mensaje es demasiado largo (máximo ${MAX_MESSAGE_LENGTH} caracteres).` },
      { status: 400 }
    );
  }

  try {
    const upstream = await streamAgentQuery({
      userId,
      sessionId: body.sessionId ?? null,
      message,
    });

    return new Response(upstream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof AgentEngineError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof EnvConfigError || error instanceof GoogleAuthConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `No se pudo contactar al Reasoning Engine. Detalle: ${detail}` },
      { status: 502 }
    );
  }
}
