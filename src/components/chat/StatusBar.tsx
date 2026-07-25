import { PulseOrb, type PulseState } from "./PulseOrb";
import type { StatusResponse } from "@/types/chat";

interface StatusBarProps {
  status: StatusResponse | null;
  pulseState: PulseState;
  onNewConversation: () => void;
  canStartNewConversation: boolean;
}

export function StatusBar({
  status,
  pulseState,
  onNewConversation,
  canStartNewConversation,
}: StatusBarProps) {
  return (
    <header className="z-30 w-full shrink-0 border-b border-slate-200/80 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 border border-slate-200/80 shadow-xs">
            <PulseOrb state={pulseState} size={9} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-[15px] font-bold tracking-tight text-slate-900">
                engine<span className="text-blue-600">/</span>room
              </h1>
              <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-700/10">
                Vertex AI
              </span>
            </div>
            <p className="truncate font-mono text-[11px] text-slate-500">
              {status === null
                ? "Conectando con Google Cloud…"
                : status.ok
                  ? `${status.displayName} · reasoningEngines/${status.engineIdShort} · ${status.location}`
                  : "Sin configurar"}
            </p>
            {status?.ok && status.authLabel && (
              <p className="truncate font-mono text-[10px] text-slate-400">
                Autenticado con {status.authLabel}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onNewConversation}
          disabled={!canStartNewConversation}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 font-sans text-[12px] font-medium text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Nueva conversación
        </button>
      </div>
    </header>
  );
}
