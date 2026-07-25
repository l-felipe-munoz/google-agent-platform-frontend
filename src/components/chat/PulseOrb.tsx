export type PulseState = "idle" | "thinking" | "error" | "offline";

const DOT_COLOR: Record<PulseState, string> = {
  idle: "bg-emerald-500",
  thinking: "bg-blue-600",
  error: "bg-rose-500",
  offline: "bg-slate-400",
};

const ANIMATION: Record<PulseState, string> = {
  idle: "animate-[pulse-breathe_2.6s_ease-in-out_infinite]",
  thinking: "animate-[pulse-think_0.9s_ease-in-out_infinite]",
  error: "animate-[pulse-error_1.2s_ease-in-out_infinite]",
  offline: "",
};

export function PulseOrb({ state, size = 8 }: { state: PulseState; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block rounded-full ${DOT_COLOR[state]} ${ANIMATION[state]}`}
      style={{ width: size, height: size }}
    />
  );
}
