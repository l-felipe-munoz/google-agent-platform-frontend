const SUGGESTIONS = [
  "¿Qué puedes hacer por mí?",
  "Explícame tu propósito en dos frases",
  "Dame un resumen de tus capacidades",
];

export function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 shadow-xs">
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
          />
        </svg>
      </div>

      <div className="space-y-2 max-w-md">
        <h2 className="font-display text-xl font-bold tracking-tight text-slate-900">
          Reasoning Engine preparado
        </h2>
        <p className="text-sm leading-relaxed text-slate-600">
          Haz una pregunta o consulta directamente a tu agente desplegado en Vertex AI. La respuesta se transmitirá en tiempo real.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2 max-w-lg">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-2xs transition-all hover:border-blue-300 hover:bg-blue-50/70 hover:text-blue-700 active:scale-98"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
