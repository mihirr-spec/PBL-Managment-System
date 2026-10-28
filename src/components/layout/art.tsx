import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Watercolour campus sketches from `public/art`, plus the full painting.
 *
 * The sketches are painted on white paper, so wherever they sit on a tinted
 * or frosted surface they are drawn with `mix-blend-multiply` - the paper
 * drops out and only the ink and wash remain, as if painted onto the page.
 */
export const ART = {
  capitol: { src: "/art/art-capitol.svg", width: 393, height: 280 },
  avenue: { src: "/art/art-bottom-right.svg", width: 262, height: 208 },
  boulevard: { src: "/art/art-right-bldg.svg", width: 188, height: 332 },
  // The source crop carries a scrap of UI text at its right edge, so it is
  // always anchored left and framed narrower than its full width.
  terrace: { src: "/art/art-bottom-left.svg", width: 300, height: 186, position: "object-left" },
  campus: { src: "/campus.webp", width: 812, height: 1024 },
  // Landscape painting used behind the sign-in screen; open paper on the left.
  painting: { src: "/art/login-bg.webp", width: 1536, height: 1024, position: "object-right" },
  // Photograph of the main building reflected in rain water.
  photo: { src: "/coverpage.webp", width: 615, height: 574, position: "object-[center_42%]" },
} as const satisfies Record<
  string,
  { src: string; width: number; height: number; position?: string }
>;

export type ArtKey = keyof typeof ART;

/** Edge treatments - which side of the sketch dissolves into the surface. */
const FADE = {
  none: "",
  left: "[mask-image:linear-gradient(to_left,black_45%,transparent_100%)]",
  right: "[mask-image:linear-gradient(to_right,black_45%,transparent_100%)]",
  top: "[mask-image:linear-gradient(to_bottom,transparent_0%,black_40%)]",
  soft: "[mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_75%)]",
} as const;

export function Art({
  name,
  fade = "none",
  blend = true,
  priority = false,
  sizes = "400px",
  className,
}: {
  name: ArtKey;
  fade?: keyof typeof FADE;
  /** Multiply the white paper away. Off for the full-colour painting on dark. */
  blend?: boolean;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  const art: { src: string; width: number; height: number; position?: string } =
    ART[name];
  return (
    <Image
      src={art.src}
      alt=""
      aria-hidden
      width={art.width}
      height={art.height}
      sizes={sizes}
      priority={priority}
      className={cn(
        "pointer-events-none select-none object-cover",
        art.position,
        // Muted so the warm paintings sit inside the bluish white theme.
        "[filter:saturate(0.6)_brightness(1.04)]",
        blend && "mix-blend-multiply",
        FADE[fade],
        className,
      )}
    />
  );
}
