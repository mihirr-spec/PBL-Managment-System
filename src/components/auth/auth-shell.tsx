import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { GraduationCap } from "lucide-react";

/**
 * Sign-in and sign-up screens: the campus watercolour sits on the right at full height and
 * the form sits in a frosted dialog over the open paper on the left. The page
 * is exactly one screen tall - nothing to scroll on a laptop.
 */
export function AuthShell({
  title,
  emphasis,
  subtitle,
  children,
}: {
  title: string;
  emphasis: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[#fbfcfd] wide:h-dvh">
      {/* Soft sky wash on the open paper side */}
      <div
        aria-hidden
        className="absolute inset-0 -z-20 [background-image:radial-gradient(ellipse_at_10%_15%,rgba(150,190,235,0.35),transparent_45%),radial-gradient(ellipse_at_20%_95%,rgba(150,190,235,0.25),transparent_40%)]"
      />
      {/* The painting is sized by the screen's height so the whole scene shows,
          and its left edge dissolves into the paper. */}
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 -z-10 w-full wide:w-[max(78vw,150dvh)] wide:[mask-image:linear-gradient(to_right,transparent_0%,black_22%)]"
      >
        <Image
          src="/art/login-bg.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[72%_bottom]"
        />
      </div>
      {/* Light veil so the dialog reads cleanly on smaller screens */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-white/15 wide:hidden" />

      <header className="px-6 pt-5 sm:px-10 wide:absolute wide:inset-x-0 wide:top-0">
        <Link href="/" className="inline-flex items-center gap-3 text-ink-800">
          <GraduationCap className="size-8" strokeWidth={1.5} aria-hidden />
          <span className="text-[20px] font-semibold tracking-[0.04em]">PBL</span>
        </Link>
      </header>

      {/* On wide screens the dialog sits in the open paper left of the
          painting (centred on ~24vw); narrower screens centre it. */}
      <main className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6 wide:justify-start wide:pt-16 wide:pb-4 wide:pl-[max(4rem,calc(24vw-15.5rem))]">
        <div
          role="dialog"
          aria-labelledby="auth-title"
          className="animate-fade-rise scroll-soft w-full max-w-[31rem] rounded-[26px] wide:max-h-[calc(100dvh-5.5rem)] wide:overflow-y-auto border border-white/80 bg-white/85 px-6 py-7 shadow-[0_30px_90px_-30px_rgba(13,31,63,0.45)] backdrop-blur-xl sm:px-10"
        >
          <div className="text-center">
            <h1
              id="auth-title"
              className="font-display text-[2.1rem] leading-[1.05] font-semibold tracking-[-0.02em] text-ink-900 sm:text-[2.35rem]"
            >
              {title} <span className="text-azure-600">{emphasis}</span>
            </h1>
            <p className="mt-1.5 text-[14px] text-stone-600">
              {subtitle}
            </p>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
