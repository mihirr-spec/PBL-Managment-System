import Image from "next/image";
import {
  ArrowRight,
  Award,
  Bell,
  Building2,
  CheckCircle2,
  FileSignature,
  FolderKanban,
  GraduationCap,
  LineChart,
  UsersRound,
} from "lucide-react";

import { Brand } from "@/components/layout/brand";
import { CampusAccent } from "@/components/layout/campus-accent";
import { Doodle, type DoodleKey } from "@/components/layout/doodle";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Numbered core features - rows alternate side, as in a printed spread. */
const FEATURES = [
  {
    number: "01",
    icon: LineChart,
    tint: "text-numeral-blue",
    title: "Track Your Progress",
    body: "Monitor project progress, milestones, deadlines and submissions from one place.",
  },
  {
    number: "02",
    icon: FolderKanban,
    tint: "text-numeral-peach",
    title: "Manage Your Project",
    body: "Keep project information, team members, documents and project links organized.",
  },
  {
    number: "03",
    icon: UsersRound,
    tint: "text-numeral-sage",
    title: "Collaborate",
    body: "Stay connected with coordinators, mentors and teammates throughout the project.",
  },
  {
    number: "04",
    icon: Award,
    tint: "text-numeral-lilac",
    title: "Evaluate & Improve",
    body: "Access feedback, evaluations, marks and project performance.",
  },
] as const;

const STEPS: ReadonlyArray<{ doodle: DoodleKey; title: string; body: string }> = [
  {
    doodle: "bulb",
    title: "Form your group",
    body: "The team lead creates the group and adds classmates by registration number.",
  },
  {
    doodle: "triangle",
    title: "Register your mentor",
    body: "Upload the PBL form your teacher signed. They approve it, or ask for corrections.",
  },
  {
    doodle: "globe",
    title: "Report every week",
    body: "Submit one weekly report for the group. Raise a query whenever you are stuck.",
  },
  {
    doodle: "book",
    title: "Get graded",
    body: "Your mentor grades each report and each student, with notes on what to improve.",
  },
];

const AUDIENCES = [
  {
    icon: GraduationCap,
    title: "Students",
    body: "Manage your projects, track progress, meet deadlines and collaborate with your team.",
  },
  {
    icon: UsersRound,
    title: "Faculty / Coordinators",
    body: "Guide students, monitor progress, provide feedback and manage evaluations.",
  },
  {
    icon: Building2,
    title: "Administrators",
    body: "Oversee PBL activities, manage timelines, announcements and system-wide operations.",
  },
] as const;

/** Two-tone uppercase label that opens each marketing section. */
function Eyebrow({ lead, emphasis }: { lead: string; emphasis: string }) {
  return (
    <p className="text-[11px] font-semibold tracking-[0.22em] text-ink-400 uppercase">
      {lead} <span className="text-ink-800">{emphasis}</span>
    </p>
  );
}

/** Floating card on the hero picture: one real moment from the portal. */
function HeroChip({
  icon,
  tone,
  title,
  note,
  className,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  note: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-fade-rise absolute flex items-center gap-3 rounded-2xl border border-white/90 bg-white/90 py-2.5 pr-4 pl-2.5 shadow-[0_18px_40px_-22px_rgba(13,31,63,0.55)] backdrop-blur-md",
        className,
      )}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tone)} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold whitespace-nowrap text-ink-900">{title}</span>
        <span className="block text-[11.5px] whitespace-nowrap text-stone-500">{note}</span>
      </span>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-ivory-100">
      {/* ------------------------------ hero ----------------------------- */}
      <section className="relative isolate flex flex-col overflow-x-clip">
        {/* Sky wash, the same one the portal pages sit on */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,var(--color-wash-sky)_0%,var(--color-wash-mid)_40%,var(--color-wash-low)_75%,var(--color-ivory-100)_100%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-70 [background-image:radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.95),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.6),transparent_35%)]"
        />

        <header className="mx-auto flex h-24 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
          <Brand href="/" height={80} priority />
          <ButtonLink
            href="/login"
            size="sm"
            variant="secondary"
            className="border-white/60 bg-white/60 backdrop-blur-md hover:bg-white/80"
          >
            Sign in
            <ArrowRight className="size-3.5" />
          </ButtonLink>
        </header>

        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pt-2 pb-16 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-12">
          {/* --- words --- */}
          <div className="animate-fade-rise max-w-xl">
            <h1 className="font-display text-[2.5rem] leading-[1.04] tracking-tight text-ink-900 sm:text-[3.4rem] xl:text-[3.9rem]">
              Every PBL project,
              <span className="block text-azure-600">from first idea to final grade.</span>
            </h1>

            <p className="mt-5 max-w-lg text-[15.5px] leading-relaxed text-stone-600">
              Form your team, register your mentor with the signed PBL form,
              submit weekly reports and see your grades - with your mentor and
              the PBL office on the same page.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink
                href="/login"
                size="lg"
                className="bg-ink-800 px-7 text-white shadow-[0_14px_30px_-16px_rgba(13,31,63,0.95)] hover:bg-ink-700 active:bg-ink-900"
              >
                Sign in
                <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink
                href="#how-it-works"
                variant="secondary"
                size="lg"
                className="border-white/70 bg-white/60 px-7 backdrop-blur hover:bg-white/85"
              >
                See how it works
              </ButtonLink>
            </div>

            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-stone-600">
              {[
                { icon: GraduationCap, label: "Students" },
                { icon: UsersRound, label: "Teachers" },
                { icon: Building2, label: "PBL office" },
              ].map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-white/80 text-azure-600 ring-1 ring-white">
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* --- picture, with a few real moments from the portal --- */}
          <div className="relative mx-auto w-full max-w-[26rem] lg:mr-4 lg:ml-auto">
            <Doodle
              name="cluster"
              className="absolute -top-10 -right-12 -z-10 hidden w-44 opacity-70 sm:block"
            />
            <Doodle
              name="plane"
              className="absolute top-1/3 -left-16 hidden w-10 -rotate-12 opacity-70 lg:block"
            />

            <div className="animate-fade-rise overflow-hidden rounded-[30px] border-[6px] border-white/90 bg-white shadow-[0_40px_90px_-40px_rgba(13,31,63,0.6)]">
              <Image
                src="/campus.webp"
                alt="Watercolour of the university's main building"
                width={812}
                height={1024}
                priority
                sizes="(max-width: 1024px) 90vw, 420px"
                className="aspect-[4/4.6] w-full object-cover object-[center_35%]"
              />
            </div>

            <HeroChip
              className="left-3 top-10 sm:-left-14"
              icon={<FileSignature className="size-4" />}
              tone="bg-azure-50 text-azure-600"
              title="Mentor approved"
              note="Signed PBL form accepted"
            />
            <HeroChip
              className="right-3 top-[46%] sm:-right-10"
              icon={<CheckCircle2 className="size-4" />}
              tone="bg-sage-100 text-sage-500"
              title="Week 5 report graded"
              note="9 / 10 · Great field test"
            />
            <HeroChip
              className="left-3 bottom-8 sm:-left-10"
              icon={<Bell className="size-4" />}
              tone="bg-gold-50 text-gold-600"
              title="New from the PBL office"
              note="Final report template"
            />
          </div>
        </div>
      </section>

      {/* ---------------------- core features (01–04) -------------------- */}
      <section
        id="features"
        className="relative isolate overflow-hidden px-5 pt-20 pb-16 sm:px-8 sm:pt-24"
      >
        <CampusAccent side="right" art="capitol" />
        <Doodle
          name="cluster"
          className="absolute top-6 right-4 -z-10 hidden w-56 opacity-80 lg:block xl:w-64"
        />

        <div className="mx-auto max-w-5xl">
          <Eyebrow lead="Core" emphasis="Features" />
          <h2 className="mt-4 max-w-xl font-display text-[2.4rem] leading-[1.08] tracking-tight text-ink-900 sm:text-[3.1rem]">
            Built for a Better PBL{" "}
            <span className="text-azure-600">Experience.</span>
          </h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-stone-600">
            Everything you need to plan, collaborate, track and complete your
            project - without the chaos.
          </p>

          <ol className="mt-14">
            {FEATURES.map(({ number, icon: Icon, tint, title, body }, index) => (
              <li
                key={number}
                className="border-t border-sand-200 py-8 first:border-t-0 first:pt-0 sm:py-10"
              >
                <div
                  className={cn(
                    "flex items-center gap-6 sm:gap-10",
                    // Even rows lead with the numeral, odd rows close with it.
                    index % 2 === 1 && "sm:flex-row-reverse",
                  )}
                >
                  <span
                    className={cn(
                      "tnum font-display text-[4rem] leading-none font-semibold sm:text-[6rem]",
                      tint,
                    )}
                    aria-hidden
                  >
                    {number}
                  </span>

                  <div className="flex max-w-md flex-1 items-start gap-5">
                    <Icon
                      className="mt-1 size-7 shrink-0 text-azure-600"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                    <div>
                      <h3 className="font-display text-[1.45rem] tracking-tight text-ink-900">
                        {title}
                      </h3>
                      <p className="mt-2 text-[14.5px] leading-relaxed text-stone-600">
                        {body}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------- how it works ----------------------- */}
      <section
        id="how-it-works"
        className="relative isolate scroll-mt-4 overflow-hidden px-5 py-20 text-center sm:px-8"
      >
        <CampusAccent side="left" art="boulevard" />

        <div className="mx-auto max-w-5xl">
          <Eyebrow lead="How it" emphasis="Works" />
          <h2 className="mt-4 font-display text-[2.2rem] leading-[1.1] tracking-tight text-ink-900 sm:text-[2.9rem]">
            Four steps, one{" "}
            <span className="text-azure-600">semester.</span>
          </h2>
          <p className="mt-4 text-[15px] text-stone-600">
            The whole PBL journey, exactly as it runs in the portal.
          </p>

          <ol className="mt-14 grid gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {STEPS.map(({ doodle, title, body }, index) => (
              <li key={title} className="flex flex-col items-center">
                <span className="tnum text-[13px] font-semibold tracking-[0.1em] text-ink-800">
                  {String(index + 1).padStart(2, "0")}
                </span>

                {/* Rail - one dot per step, joined except at the two ends */}
                <div className="relative mt-3 flex h-3 w-full items-center justify-center">
                  <span
                    className={cn(
                      "absolute top-1/2 hidden h-px bg-ink-700/30 lg:block",
                      index === 0
                        ? "right-0 left-1/2"
                        : index === STEPS.length - 1
                          ? "right-1/2 left-0"
                          : "inset-x-0",
                    )}
                    aria-hidden
                  />
                  <span
                    className="relative size-2.5 rounded-full bg-azure-600"
                    aria-hidden
                  />
                </div>

                <Doodle name={doodle} className="mt-5 h-16 w-auto" />
                <h3 className="mt-3 text-[14.5px] font-semibold tracking-tight text-ink-900">
                  {title}
                </h3>
                <p className="mt-2 max-w-[15rem] text-[13.5px] leading-relaxed text-stone-600">
                  {body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------ who it is built for -------------------- */}
      <section className="relative isolate overflow-hidden px-5 py-20 text-center sm:px-8">
        <CampusAccent side="right" art="avenue" />
        <Doodle
          name="pencil"
          className="absolute top-14 left-[8%] -z-10 hidden w-10 -rotate-12 opacity-70 lg:block"
        />

        <div className="mx-auto max-w-5xl">
          <Eyebrow lead="Built for" emphasis="The PBL Ecosystem" />
          <h2 className="mt-4 font-display text-[2.2rem] leading-[1.1] tracking-tight text-ink-900 sm:text-[2.9rem]">
            Designed for Everyone Involved.
          </h2>
          <p className="mt-4 text-[15px] text-stone-600">
            A unified platform for students, faculty and administrators.
          </p>

          <div className="mt-14 grid gap-10 text-left sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-sand-200">
            {AUDIENCES.map(({ icon: Icon, title, body }) => (
              <article key={title} className="sm:px-7 sm:first:pl-0 sm:last:pr-0">
                <Icon className="size-8 text-ink-800" strokeWidth={1.5} aria-hidden />
                <h3 className="mt-5 flex items-center justify-between gap-3 font-display text-[1.3rem] tracking-tight text-ink-900">
                  {title}
                  <ArrowRight className="size-4 text-ink-700" aria-hidden />
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-stone-600">
                  {body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------- cta ----------------------------- */}
      <section className="px-5 pt-6 pb-20 sm:px-8">
        <div className="relative isolate mx-auto grid max-w-6xl overflow-hidden rounded-[32px] border border-white bg-white/80 shadow-[0_40px_90px_-50px_rgba(13,31,63,0.55)] md:grid-cols-[1.1fr_1fr]">
          <div className="px-7 py-12 sm:px-12 sm:py-14">
            <Eyebrow lead="Ready" emphasis="When Your Team Is" />
            <h2 className="mt-4 font-display text-[2rem] leading-[1.1] tracking-tight text-ink-900 sm:text-[2.5rem]">
              Your group, your mentor,
              <span className="block text-azure-600">your progress.</span>
            </h2>
            <p className="mt-4 max-w-md text-[14.5px] leading-relaxed text-stone-600">
              Sign in with your university email to form your group, register
              your mentor and submit this week&rsquo;s report.
            </p>
            <ButtonLink
              href="/login"
              size="lg"
              className="mt-8 bg-ink-800 px-8 text-white shadow-[0_14px_30px_-16px_rgba(13,31,63,0.95)] hover:bg-ink-700 active:bg-ink-900"
            >
              Sign in
              <ArrowRight className="size-4" />
            </ButtonLink>
          </div>

          {/* The campus painting fills the card's right half */}
          <div className="relative min-h-56 md:min-h-0" aria-hidden>
            <Image
              src="/art/login-bg.webp"
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 560px"
              className="object-cover object-[78%_70%] md:[mask-image:linear-gradient(to_right,transparent_0%,black_28%)]"
            />
          </div>
        </div>
      </section>

      {/* ----------------------------- footer ---------------------------- */}
      <footer className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 border-t border-sand-200 px-5 py-10 sm:px-8">
        <Brand href="/" height={56} />
        <p className="text-[12.5px] text-stone-400">
          A university Project-Based Learning initiative · Semester 5
        </p>
      </footer>
    </div>
  );
}
