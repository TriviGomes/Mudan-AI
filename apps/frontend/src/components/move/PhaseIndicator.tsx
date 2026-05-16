import { Check } from "lucide-react";

const PHASES = [
  { n: 1, label: "Casa" },
  { n: 2, label: "Cômodos" },
  { n: 3, label: "Decisões" },
  { n: 4, label: "Caixas" },
] as const;

export function PhaseIndicator({
  current,
  onGoTo,
}: {
  current: 1 | 2 | 3 | 4;
  onGoTo?: (phase: 1 | 2 | 3 | 4) => void;
}) {
  return (
    <nav className="flex items-center gap-0 mb-6">
      {PHASES.map(({ n, label }, idx) => {
        const done = n < current;
        const active = n === current;
        const clickable = done && onGoTo;
        return (
          <div key={n} className="flex items-center">
            <button
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "bg-foreground text-background"
                  : done
                    ? "text-foreground cursor-pointer hover:bg-muted"
                    : "text-muted-foreground cursor-default"
              }`}
              onClick={() => clickable && onGoTo(n as 1 | 2 | 3 | 4)}
              disabled={!clickable && !active}
            >
              <span
                className={`flex size-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  active
                    ? "bg-background text-foreground"
                    : done
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <Check className="size-3" /> : n}
              </span>
              {label}
            </button>
            {idx < PHASES.length - 1 && (
              <div
                className={`h-px w-6 mx-1 ${n < current ? "bg-emerald-400" : "bg-border"}`}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
