import { NextRequest, NextResponse } from "next/server";
import { AgentEngineError, saveSessionToMemory, streamAgentQuery } from "@/lib/agentEngine";
import { EnvConfigError } from "@/lib/env";
import { GoogleAuthConfigError } from "@/lib/googleAuth";
import type { ChatRequestBody } from "@/types/chat";

export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 8000;

/** Lee un stream hasta el final sin hacer nada con su contenido. */
async function drain(stream: ReadableStream<Uint8Array>): Promise<void> {
  const reader = stream.getReader();
  for (;;) {
    const { done } = await reader.read();
    if (done) return;
  }
}

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
    const sessionId = body.sessionId ?? null;
    const upstream = await streamAgentQuery({ userId, sessionId, message });

    // Sin sessionId no hay nada que guardar en Memory Bank (no sabríamos qué
    // sesión pedirle al agente), así que devolvemos el stream tal cual.
    if (!sessionId) {
      return new Response(upstream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // Partimos el stream en dos: una copia va al navegador tal cual, la otra
    // solo la usamos para saber cuándo terminó la respuesta del agente.
    const [clientStream, mirrorStream] = upstream.tee();

    // Guardado en memoria "fire-and-forget": no bloqueamos la respuesta al
    // navegador por esto. Si falla, solo lo dejamos en el log del servidor;
    // el usuario ya tiene su respuesta y puede seguir chateando.
    drain(mirrorStream)
      .then(() => saveSessionToMemory(userId, sessionId))
      .catch((err) => {
        console.error("[memory] no se pudo guardar la sesión en Memory Bank:", err);
      });

    return new Response(clientStream, {
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
