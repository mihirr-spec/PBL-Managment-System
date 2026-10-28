import type { ReactNode } from "react";

import { DoodleVignette, type SceneKey } from "@/components/layout/doodle-scene";
import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[20px] border border-white/90 bg-white/88 shadow-[0_1px_2px_rgba(61,78,92,0.05),0_20px_50px_-30px_rgba(61,78,92,0.45)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-sand-200/60 px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="font-display text-[17px] tracking-tight text-ink-900">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-[13px] text-stone-500">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

/** Shown in place of a list when there is nothing to display. */
export function EmptyState({
  icon,
  title,
  description,
  scene = "directory",
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Doodle vignette shown above the message. */
  scene?: SceneKey;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-10 text-center",
        className,
      )}
    >
      <DoodleVignette scene={scene} icon={icon} className="mb-3" />
      <p className="font-display text-[20px] text-ink-900">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-stone-500">{description}</p>
      ) : null}
    </div>
  );
}
