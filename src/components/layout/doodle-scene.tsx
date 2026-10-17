import { Doodle, type DoodleKey } from "@/components/layout/doodle";
import { cn } from "@/lib/utils";

/**
 * A small arrangement of study doodles over a soft wash of colour.
 *
 * Every page banner and empty state gets its own scene so no two pages look
 * the same — reports get books and a pencil, grades a bulb and set square,
 * and so on. The first doodle is the large one; the others are accents.
 */
const SCENES = {
  group: { doodles: ["cluster", "bulb", "plane"], tone: "azure" },
  reports: { doodles: ["books", "pencil", "plane"], tone: "gold" },
  grades: { doodles: ["book", "bulb", "triangle"], tone: "sage" },
  queries: { doodles: ["globe", "plane", "pencil"], tone: "clay" },
  notifications: { doodles: ["globe", "plane", "bulb"], tone: "azure" },
  directory: { doodles: ["books", "globe", "pencil"], tone: "azure" },
  requests: { doodles: ["book", "pencil", "triangle"], tone: "gold" },
  announcements: { doodles: ["cluster", "plane", "bulb"], tone: "sage" },
  profile: { doodles: ["book", "bulb", "pencil"], tone: "azure" },
  settings: { doodles: ["triangle", "pencil", "bulb"], tone: "gold" },
  team: { doodles: ["cluster", "triangle", "plane"], tone: "sage" },
  achievements: { doodles: ["bulb", "books", "plane"], tone: "gold" },
} as const satisfies Record<string, { doodles: readonly DoodleKey[]; tone: string }>;

export type SceneKey = keyof typeof SCENES;

const WASH = {
  azure: "bg-[radial-gradient(circle_at_65%_45%,rgba(120,170,230,0.45),transparent_62%)]",
  gold: "bg-[radial-gradient(circle_at_65%_45%,rgba(236,190,90,0.42),transparent_62%)]",
  sage: "bg-[radial-gradient(circle_at_65%_45%,rgba(140,190,140,0.42),transparent_62%)]",
  clay: "bg-[radial-gradient(circle_at_65%_45%,rgba(226,140,120,0.38),transparent_62%)]",
} as const;

/** Large doodles are sized by their source resolution so none look blurred. */
const BIG: Record<DoodleKey, string> = {
  cluster: "h-40",
  books: "h-36",
  globe: "h-28",
  book: "h-24",
  pencil: "h-24",
  bulb: "h-20",
  triangle: "h-20",
  plane: "h-12",
};

/** Banner scene: fills the right side of a page header. */
export function DoodleScene({ scene, className }: { scene: SceneKey; className?: string }) {
  const { doodles, tone } = SCENES[scene];
  const [main, second, third] = doodles;
  return (
    <div className={cn("pointer-events-none absolute inset-y-0 right-0 -z-10 w-[55%] sm:w-[42%]", className)} aria-hidden>
      <div className={cn("absolute inset-0", WASH[tone])} />
      <div className={cn("absolute -right-6 -bottom-10 size-56 rounded-full blur-2xl", WASH[tone])} />
      <Doodle
        name={main}
        className={cn("animate-art-drift absolute top-1/2 right-[8%] w-auto -translate-y-1/2 opacity-90", BIG[main])}
      />
      {second ? <Doodle name={second} className="absolute top-5 right-[48%] hidden h-12 w-auto -rotate-6 opacity-75 sm:block" /> : null}
      {third ? <Doodle name={third} className="absolute right-[40%] bottom-4 hidden h-9 w-auto rotate-12 opacity-70 sm:block" /> : null}
    </div>
  );
}

/** Small vignette above an empty-state message. */
export function DoodleVignette({ scene, className }: { scene: SceneKey; className?: string }) {
  const { doodles, tone } = SCENES[scene];
  return (
    <div className={cn("relative flex h-28 w-40 items-center justify-center", className)} aria-hidden>
      <div className={cn("absolute inset-0 rounded-full", WASH[tone])} />
      <Doodle name={doodles[0]} className="relative h-24 w-auto opacity-85" />
    </div>
  );
}
