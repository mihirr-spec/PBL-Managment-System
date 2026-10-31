import type { ReactNode } from "react";

import { Art, type ArtKey } from "@/components/layout/art";
import { DoodleScene, type SceneKey } from "@/components/layout/doodle-scene";
import { cn } from "@/lib/utils";

function Heading({
  eyebrow,
  title,
  emphasis,
  description,
  large,
}: {
  eyebrow?: string;
  title: string;
  emphasis?: string;
  description?: string;
  large?: boolean;
}) {
  return (
    <div className="min-w-0 max-w-xl">
      {eyebrow ? (
        <p className="mb-2 text-[11px] font-semibold tracking-[0.22em] text-ink-400 uppercase">
          PACE · <span className="text-ink-800">{eyebrow}</span>
        </p>
      ) : null}
      <h1
        className={cn(
          "font-display leading-[1.1] tracking-tight text-ink-900",
          large ? "text-[2.1rem] sm:text-[2.6rem]" : "text-[1.9rem] sm:text-[2.3rem]",
        )}
      >
        {title}
        {emphasis ? (
          title.trim().endsWith(",") ? (
            // A greeting ("Welcome,") puts the name on its own line, kept whole.
            <span className="block whitespace-nowrap text-azure-600">{emphasis}</span>
          ) : (
            <span className="text-azure-600"> {emphasis}</span>
          )
        ) : null}
      </h1>
      {description ? (
        <p className="mt-2.5 max-w-lg text-[14px] leading-relaxed text-stone-600">{description}</p>
      ) : null}
    </div>
  );
}

/**
 * Page banner. Each page passes its own doodle scene so the portal never
 * repeats one picture from page to page.
 */
export function PageHeader({
  eyebrow,
  title,
  emphasis,
  description,
  action,
  scene = "group",
  className,
}: {
  eyebrow?: string;
  title: string;
  /** Trailing words set in the azure accent, as on the landing page. */
  emphasis?: string;
  description?: string;
  action?: ReactNode;
  scene?: SceneKey;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "animate-fade-rise relative isolate mb-6 overflow-hidden rounded-[26px] border border-white/80 bg-white/80 px-6 py-7 shadow-[0_24px_70px_-34px_rgba(61,78,92,0.5)] backdrop-blur-xl sm:px-8 sm:py-8",
        className,
      )}
    >
      <DoodleScene scene={scene} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading eyebrow={eyebrow} title={title} emphasis={emphasis} description={description} />
        {action ? <div className="relative shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}

/**
 * Dashboard banner: a full-colour picture fills the right side. Students,
 * teachers and the PBL office each get a different one.
 */
export function DashboardHero({
  eyebrow,
  title,
  emphasis,
  description,
  action,
  image,
  imageClassName,
}: {
  eyebrow: string;
  title: string;
  emphasis?: string;
  description?: string;
  action?: ReactNode;
  image: ArtKey;
  imageClassName?: string;
}) {
  return (
    <header className="animate-fade-rise relative isolate mb-6 overflow-hidden rounded-[28px] border border-white/80 bg-white/85 shadow-[0_30px_80px_-36px_rgba(61,78,92,0.55)] backdrop-blur-xl">
      <div className="absolute inset-y-0 right-0 -z-10 w-full sm:w-[50%]" aria-hidden>
        <Art
          name={image}
          blend={false}
          priority
          sizes="(max-width: 640px) 100vw, 640px"
          className={cn(
            "h-full w-full object-cover opacity-20 sm:opacity-100 sm:[mask-image:linear-gradient(to_right,transparent_0%,black_30%)]",
            imageClassName,
          )}
        />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4 px-6 py-8 sm:px-9 sm:py-10">
        <div className="sm:max-w-[52%]">
          <Heading eyebrow={eyebrow} title={title} emphasis={emphasis} description={description} large />
        </div>
        {action ? <div className="relative shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}

/** Key/value row used throughout detail panels. */
export function DetailRow({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-2 border-b border-sand-200/70 py-2.5 last:border-0",
        className,
      )}
    >
      <dt className="text-[13px] text-stone-500">{label}</dt>
      <dd className="text-[13px] font-medium text-stone-800">{children}</dd>
    </div>
  );
}
