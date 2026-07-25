"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, SessionResponse, StatusResponse } from "@/types/chat";
import { createSseSplitter, extractEventText } from "@/lib/sse";
import { StatusBar } from "./StatusBar";
import { MessageBubble } from "./MessageBubble";
import { EmptyState } from "./EmptyState";
import { Composer } from "./Composer";
import type { PulseState } from "./PulseOrb";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ChatConsole() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? "smooth" : "instant",
    });
  }, []);

  const openSession = useCallback(async () => {
    try {
      const res = await fetch("/api/session", { method: "POST" });
      const data: SessionResponse = await res.json();
      setSession(data);
    } catch {
      setSession({ userId: newId(), sessionId: null });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/status");
        const data: StatusResponse = await res.json();
        if (!cancelled) setStatus(data);
      } catch {
        if (!cancelled) setStatus({ ok: false, error: "No se pudo consultar /api/status." });
      }
    })();

    (async () => {
      try {
        const res = await fetch("/api/session", { method: "POST" });
        const data: SessionResponse = await res.json();
        if (!cancelled) setSession(data);
      } catch {
        if (!cancelled) setSession({ userId: newId(), sessionId: null });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-scroll suave cuando cambia el número de mensajes (nuevo mensaje enviado)
  useEffect(() => {
    scrollToBottom(true);
  }, [messages.length, scrollToBottom]);

  // Auto-scroll instantáneo mientras llega el streaming del agente para seguir el texto en vivo
  useEffect(() => {
    if (isBusy) {
      scrollToBottom(false);
    }
  }, [messages, isBusy, scrollToBottom]);

  const handleNewConversation = useCallback(() => {
    setMessages([]);
    setDraft("");
    openSession();
  }, [openSession]);

  const send = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || isBusy || !session) return;

      setDraft("");
      setIsBusy(true);

      const userMessage: ChatMessage = {
        id: newId(),
        role: "user",
        text,
        createdAt: Date.now(),
      };

      const agentMessageId = newId();
      const agentMessage: ChatMessage = {
        id: agentMessageId,
        role: "agent",
        text: "",
        streaming: true,
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage, agentMessage]);

      const patchAgentMessage = (patch: Partial<ChatMessage>) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === agentMessageId ? { ...m, ...patch } : m))
        );
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: session.userId,
            sessionId: session.sessionId,
            message: text,
          }),
        });

        if (!res.ok || !res.body) {
          const errBody = await res.json().catch(() => null);
          throw new Error(errBody?.error || `El servidor respondió ${res.status}.`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const sse = createSseSplitter();
        let accumulated = "";
        let detectedAuthor: string | undefined;
        let detectedModelVersion: string | undefined;
        const rawEventsSeen: string[] = [];

        const consume = (payloads: string[]) => {
          for (const payload of payloads) {
            rawEventsSeen.push(payload);
            const { text: delta, error, author, modelVersion } = extractEventText(payload);
            if (error) throw new Error(error);

            // Solo asociamos autor/modelo con eventos que realmente traen texto.
            // Eventos intermedios (ej. transfer_to_agent del orquestador, tool
            // calls) también incluyen "author" pero no aportan contenido, y
            // fijarnos en ellos hacía que siempre quedara pegado el primer
            // agente (el orquestador) en vez del agente que de verdad respondió.
            if (delta) {
              accumulated += delta;
              if (author) detectedAuthor = author;
              if (modelVersion) detectedModelVersion = modelVersion;
              patchAgentMessage({
                text: accumulated,
                author: detectedAuthor,
                modelVersion: detectedModelVersion,
              });
            }
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          consume(sse.push(decoder.decode(value, { stream: true })));
        }

        consume(sse.push(decoder.decode()));
        consume(sse.flush());

        if (!accumulated && rawEventsSeen.length > 0) {
          console.warn(
            "[engine/room] El agente respondió pero no se pudo extraer texto. Eventos crudos:",
            rawEventsSeen
          );
        }

        patchAgentMessage({
          streaming: false,
          text: accumulated || "(sin contenido)",
          author: detectedAuthor,
          modelVersion: detectedModelVersion,
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Error desconocido.";
        patchAgentMessage({ streaming: false, isError: true, text: detail });
      } finally {
        setIsBusy(false);
      }
    },
    [isBusy, session]
  );

  const pulseState: PulseState = !status
    ? "offline"
    : !status.ok
      ? "error"
      : isBusy
        ? "thinking"
        : "idle";

  const inputDisabled = isBusy || !session || status?.ok === false;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-50">
      <StatusBar
        status={status}
        pulseState={pulseState}
        onNewConversation={handleNewConversation}
        canStartNewConversation={!isBusy && messages.length > 0}
      />

      <div className="relative flex-1 overflow-hidden">
        <main ref={scrollContainerRef} className="absolute inset-0 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-5 pb-32 sm:px-6">
            {status && !status.ok && (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-900 shadow-xs">
                <p className="font-semibold flex items-center gap-2">
                  <svg className="h-4 w-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  No pudimos conectar con el Reasoning Engine
                </p>
                <p className="mt-1 text-rose-700 leading-relaxed text-xs">{status.error}</p>
              </div>
            )}

            {messages.length === 0 ? (
              <EmptyState onPick={(text) => send(text)} />
            ) : (
              <div className="flex flex-col gap-5 py-6">
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Degradado para que el texto se difumine detrás de la barra flotante */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent"
          aria-hidden="true"
        />

        <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-5 sm:px-6">
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={() => send(draft)}
            disabled={inputDisabled}
            isBusy={isBusy}
          />
        </div>
      </div>
    </div>
  );
}
