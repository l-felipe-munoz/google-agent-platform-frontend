import type { ChatMessage } from "@/types/chat";
import { Markdown } from "./Markdown";
import { PulseOrb } from "./PulseOrb";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="animate-rise-in flex justify-end">
        <div className="max-w-[82%] rounded-2xl rounded-tr-xs bg-blue-600 px-4.5 py-3 text-[14.5px] leading-relaxed text-white shadow-xs sm:max-w-[75%]">
          <p className="whitespace-pre-wrap font-sans">{message.text}</p>
          <p className="mt-1.5 text-right font-mono text-[10px] text-blue-100/80">
            {formatTime(message.createdAt)}
          </p>
        </div>
      </div>
    );
  }

  const authorName = message.author || "Reasoning Engine";
  const modelName = message.modelVersion;

  return (
    <div className="animate-rise-in flex gap-3">
      <div className="mt-1 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-slate-200/80 shadow-2xs">
          <PulseOrb
            state={message.streaming ? "thinking" : message.isError ? "error" : "idle"}
            size={7}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 min-w-0 max-w-[85%] sm:max-w-[80%]">
        {/* Encabezado con el Autor y la Versión del Modelo */}
        <div className="flex flex-wrap items-center gap-2 px-1 text-[11px]">
          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
            <svg
              className="h-3.5 w-3.5 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.75 17L9 20l-1 1h6l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            {authorName}
          </span>

          {modelName && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-600 border border-slate-200/60">
              <svg
                className="h-2.5 w-2.5 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              {modelName}
            </span>
          )}

          <span className="font-mono text-[10px] text-slate-400 ml-auto">
            {formatTime(message.createdAt)}
          </span>
        </div>

        {/* Cuerpo del Mensaje */}
        <div
          className={`rounded-2xl rounded-tl-xs border px-4.5 py-3.5 text-[14.5px] leading-relaxed shadow-2xs ${
            message.isError
              ? "border-rose-200 bg-rose-50/80 text-rose-950"
              : "border-slate-200/90 bg-white text-slate-800"
          }`}
        >
          {message.text ? (
            message.isError ? (
              <p
                className={`whitespace-pre-wrap font-sans ${
                  message.streaming ? "streaming-caret" : ""
                }`}
              >
                {message.text}
              </p>
            ) : (
              <Markdown
                text={message.text}
                className={message.streaming ? "streaming-caret" : ""}
              />
            )
          ) : message.streaming ? (
            <p className="font-sans text-slate-500">Procesando respuesta…</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
