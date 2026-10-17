import { Art, type ArtKey } from "@/components/layout/art";
import { cn } from "@/lib/utils";

/**
 * Decorative watercolour bled off a section edge.
 *
 * The marketing sections sit on ivory, so the art is feathered on the side
 * that faces the content and held at low opacity - it reads as the paper the
 * page is printed on rather than as a picture competing with the type. Each
 * section passes a different sketch so the page never repeats itself.
 */
export function CampusAccent({
  side,
  art = "capitol",
  className,
}: {
  side: "left" | "right";
  art?: ArtKey;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 -z-10 hidden w-[22rem] overflow-hidden lg:block xl:w-[26rem]",
        side === "left" ? "left-0" : "right-0",
        className,
      )}
    >
      <Art
        name={art}
        sizes="26rem"
        className={cn(
          "h-full w-full opacity-35",
          side === "left"
            ? "[mask-image:linear-gradient(to_left,transparent_0%,black_60%)]"
            : "[mask-image:linear-gradient(to_right,transparent_0%,black_60%)]",
        )}
      />
    </div>
  );
}
