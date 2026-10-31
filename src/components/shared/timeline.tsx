import { FileText } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TimelineState = "evaluated" | "submitted" | "pending";

/**
 * One stop on the weekly-report timeline: a dot on a vertical line, with the
 * row beside it. The line below a stop turns blue once that stop is done, so
 * the blue run shows how far the team has got. `milestone` stops (midterm,
 * endterm) get a document marker instead of a dot.
 */
export function TimelineItem({
  state,
  milestone = false,
  last = false,
  children,
}: {
  state: TimelineState;
  milestone?: boolean;
  last?: boolean;
  children: ReactNode;
}) {
  const done = state !== "pending";
  return (
    <div className="relative pl-11">
      {last ? null : (
        <span
          aria-hidden
          className={cn("absolute top-7 -bottom-10 left-[15px] w-0.5 rounded-full", done ? "bg-azure-500" : "bg-sand-200")}
        />
      )}
      {milestone ? (
        <span
          aria-hidden
          className={cn(
            "absolute top-3.5 left-0.5 flex size-7 items-center justify-center rounded-lg ring-4 ring-[#f3f7fc]",
            done ? "bg-violet-100 text-violet-600" : "bg-white text-stone-400 ring-1 ring-sand-200",
          )}
        >
          <FileText className="size-4" />
        </span>
      ) : (
        <span
          aria-hidden
          className={cn(
            "absolute top-5 left-2 flex size-4 items-center justify-center rounded-full ring-4 ring-[#f3f7fc]",
            state === "evaluated"
              ? "bg-azure-600"
              : state === "submitted"
                ? "border-2 border-azure-600 bg-white"
                : "border-2 border-sand-300 bg-white",
          )}
        >
          {state === "evaluated" ? <span className="size-1.5 rounded-full bg-white" /> : null}
        </span>
      )}
      {children}
    </div>
  );
}

/** Progress through the weekly reports and the two evaluation uploads, as a labelled bar. */
export function ReportProgress({
  done,
  total,
  className,
}: {
  done: number;
  total: number;
  className?: string;
}) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className={cn("rounded-2xl bg-white/70 px-5 py-3.5 ring-1 ring-sand-200/70", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-semibold text-ink-900">Progress</p>
        <p className="text-[12.5px] text-stone-500">
          <span className="tnum font-display text-[1.3rem] text-azure-600">{percent}%</span> · {done} of {total} submissions
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand-200/70" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-azure-600 transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1.5 text-[11.5px] text-stone-500">Seven weekly reports plus the midterm and endterm uploads.</p>
    </div>
  );
}
