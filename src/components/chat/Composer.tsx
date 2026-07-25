"use client";

import { useEffect, useRef } from "react";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  isBusy: boolean;
}

export function Composer({ value, onChange, onSend, disabled, isBusy }: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSend();
    }
  }

  return (
    <div className="w-full max-w-3xl">
      <div className="flex items-end gap-2 rounded-[28px] border border-slate-200/80 bg-white px-3 py-2 shadow-[0_8px_30px_-4px_rgba(15,23,42,0.12)] transition-all focus-within:border-blue-400 focus-within:shadow-[0_8px_30px_-4px_rgba(37,99,235,0.22)] sm:px-4">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder="Escribe tu pregunta aquí…"
          className="max-h-40 flex-1 resize-none self-center border-0 bg-transparent px-2 py-2 text-[14.5px] leading-relaxed text-slate-900 placeholder:text-slate-400 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 disabled:opacity-50"
        />

        <button
          type="button"
          onClick={onSend}
          disabled={disabled || !value.trim()}
          aria-label={isBusy ? "Generando respuesta" : "Enviar mensaje"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-medium shadow-xs transition-all hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none"
        >
          {isBusy ? (
            <span className="h-2.5 w-2.5 animate-pulse rounded-sm bg-current" aria-hidden="true" />
          ) : (
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
              <path
                d="M3 10h13M10 3l7 7-7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>

      <p className="mt-2 text-center font-mono text-[10.5px] text-slate-400/90">
        Presiona Enter para enviar · Shift + Enter para salto de línea
      </p>
    </div>
  );
}
