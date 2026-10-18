import Image from "next/image";

import { cn, initials } from "@/lib/utils";

/** Shown for a student who has not uploaded a photo of their own. */
export const STUDENT_AVATAR = "/avatars/student.webp";

const SIZES = {
  sm: "size-8 text-[11px]",
  md: "size-10 text-xs",
  lg: "size-14 text-sm",
  xl: "size-20 text-lg",
  "2xl": "size-28 text-2xl",
} as const;

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const shell = cn(
    "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold select-none",
    SIZES[size],
    className,
  );

  if (src) {
    return (
      <span className={cn(shell, "ring-2 ring-white")}>
        <Image src={src} alt={name} fill sizes="112px" className="object-cover" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        shell,
        "bg-gradient-to-br from-sand-200 to-gold-200 text-stone-700 ring-2 ring-white",
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
