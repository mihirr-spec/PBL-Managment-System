import Image from "next/image";
import {
  Bell,
  BookUser,
  FileText,
  GraduationCap,
  Megaphone,
  MessageCircleQuestion,
  Settings,
  Sparkle,
  Trophy,
  UserPlus,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Page banner backdrops and empty-state pictures, in the bluish white theme.
 *
 * Each page names a scene. Its banner shows a soft painted view on the right
 * (the campus painting, the dome, or open sky with birds) fading into the
 * white card, and its empty state shows the scene's icon in a pale blue
 * bubble.
 */
const SCENES = {
  group: { backdrop: "campus", icon: UsersRound },
  reports: { backdrop: "dome", icon: FileText },
  grades: { backdrop: "sky", icon: GraduationCap },
  queries: { backdrop: "sky", icon: MessageCircleQuestion },
  notifications: { backdrop: "sky", icon: Bell },
  directory: { backdrop: "campus", icon: BookUser },
  requests: { backdrop: "dome", icon: UserPlus },
  announcements: { backdrop: "sky", icon: Megaphone },
  profile: { backdrop: "campus", icon: UserRound },
  settings: { backdrop: "sky", icon: Settings },
  team: { backdrop: "campus", icon: UsersRound },
  achievements: { backdrop: "campus", icon: Trophy },
} as const satisfies Record<string, { backdrop: "campus" | "dome" | "sky"; icon: LucideIcon }>;

export type SceneKey = keyof typeof SCENES;

/** Fades the picture into the card on its left edge. */
const FADE = "[mask-image:linear-gradient(to_right,transparent_0%,black_38%)]";

/** Three gulls, drawn as single strokes. */
function Birds({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 50" className={className} fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden>
      <path d="M8 22c6-7 11-7 14 0 3-7 8-7 14 0" strokeWidth="2.2" />
      <path d="M52 34c4-5 8-5 10 0 2-5 6-5 10 0" strokeWidth="1.8" />
      <path d="M84 12c5-6 9-6 12 0 3-6 7-6 12 0" strokeWidth="2" />
    </svg>
  );
}

/** Open blue sky with soft clouds and a few birds. */
function Sky() {
  return (
    <div className={cn("absolute inset-0 overflow-hidden bg-gradient-to-b from-[#7fb8ea] via-[#a9d0f3] to-[#d6e9f9]", FADE)}>
      <div className="absolute -right-10 -bottom-16 h-44 w-80 rounded-full bg-white/95 blur-2xl" />
      <div className="absolute right-[18%] -bottom-10 h-36 w-56 rounded-full bg-white/90 blur-xl" />
      <div className="absolute right-[2%] bottom-6 h-24 w-40 rounded-full bg-white/80 blur-lg" />
      <div className="absolute top-6 right-[30%] h-16 w-44 rounded-full bg-white/70 blur-xl" />
      <div className="absolute top-[38%] -right-6 h-20 w-36 rounded-full bg-white/75 blur-xl" />
      <Birds className="absolute top-[20%] right-[22%] w-32 text-slate-600/80" />
    </div>
  );
}

/** Banner backdrop: fills the right side of a page header. */
export function DoodleScene({ scene, className }: { scene: SceneKey; className?: string }) {
  const { backdrop } = SCENES[scene];
  return (
    <div
      className={cn("pointer-events-none absolute inset-y-0 right-0 -z-10 w-full opacity-30 sm:w-[55%] sm:opacity-100", className)}
      aria-hidden
    >
      {backdrop === "sky" ? (
        <Sky />
      ) : (
        <Image
          src={backdrop === "campus" ? "/art/login-bg.webp" : "/campus.webp"}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 720px"
          className={cn(
            "object-cover [filter:saturate(0.6)_brightness(1.06)]",
            backdrop === "campus" ? "object-[85%_62%]" : "object-[center_22%]",
            FADE,
          )}
        />
      )}
      {/* A pale blue veil keeps the paintings in the same cool key. */}
      {backdrop === "sky" ? null : <div className="absolute inset-0 bg-gradient-to-r from-white via-white/10 to-[#dcebf9]/30" />}
    </div>
  );
}

/** Empty-state picture: the scene's icon in a pale blue bubble with sparkles. */
export function DoodleVignette({
  scene,
  icon,
  className,
}: {
  scene: SceneKey;
  /** Replaces the scene's own icon. */
  icon?: React.ReactNode;
  className?: string;
}) {
  const { icon: Icon } = SCENES[scene];
  return (
    <div className={cn("relative flex h-36 w-52 items-center justify-center", className)} aria-hidden>
      <div className="absolute inset-x-6 inset-y-2 rounded-full bg-[radial-gradient(circle,#dbeafb_0%,#eaf3fd_55%,transparent_72%)]" />
      <div className="absolute top-7 left-3 h-16 w-24 -rotate-6 rounded-xl bg-white/80 shadow-[0_10px_30px_-18px_rgba(21,80,200,0.5)] ring-1 ring-azure-100" />
      <div className="absolute top-4 right-4 h-14 w-20 rotate-6 rounded-xl bg-white/70 ring-1 ring-azure-100" />
      <span className="relative flex size-20 items-center justify-center rounded-full bg-white shadow-[0_16px_36px_-18px_rgba(21,80,200,0.6)] ring-1 ring-azure-100 [&_svg]:size-10 [&_svg]:text-azure-600">
        {icon ?? <Icon strokeWidth={1.6} />}
      </span>
      <Sparkle className="absolute top-5 left-[22%] size-4 fill-azure-100 text-azure-500/60" />
      <Sparkle className="absolute right-[16%] bottom-6 size-5 fill-azure-100 text-azure-500/60" />
      <Sparkle className="absolute top-2 right-[30%] size-3 fill-azure-100 text-azure-500/50" />
    </div>
  );
}
