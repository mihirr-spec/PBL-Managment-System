import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

/** Logo is 1200 × 570; the emblem (dome and ribbon) is square. */
const LOGO_RATIO = 1200 / 570;

/**
 * The PACE logo (Project Allocation, Coordination & Evaluation), used in the
 * sidebar, the auth screens and the landing page. `compact` shows only the
 * emblem; `height` sets the logo's height in pixels.
 */
export function Brand({
  href = "/",
  compact = false,
  height = 48,
  priority = false,
  className,
}: {
  href?: string;
  compact?: boolean;
  height?: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} aria-label="PACE home" className={cn("inline-flex shrink-0 items-center", className)}>
      {compact ? (
        <Image src="/brand/pace-emblem.webp" alt="PACE" width={height} height={height} priority={priority} />
      ) : (
        <Image
          src="/brand/pace-logo.webp"
          alt="PACE - Project Allocation, Coordination & Evaluation"
          width={Math.round(height * LOGO_RATIO)}
          height={height}
          priority={priority}
        />
      )}
    </Link>
  );
}
