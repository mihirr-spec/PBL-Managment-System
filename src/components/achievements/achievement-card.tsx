"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Award,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  CircleX,
  Code2,
  Copy,
  ExternalLink,
  FileText,
  Flag,
  Globe,
  Hash,
  IndianRupee,
  Lightbulb,
  Link2,
  MapPin,
  Maximize2,
  MessageSquare,
  PencilLine,
  Rocket,
  Send,
  Share2,
  Sparkles,
  Star,
  Target,
  Trophy,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { DocumentViewer } from "@/components/shared/document-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import type { PendingApproval } from "@/components/achievements/linkedin-preview";
import { PlainMedal, SecondMedal, ThirdMedal } from "@/components/achievements/medal-icons";
import { achievementResult, findTemplate, linkedInPost, MAX_BONUS_MARKS, placement } from "@/lib/achievements";
import * as repo from "@/lib/data/repository";
import type { Achievement, AchievementDocument, AchievementEvent, AchievementStatus, Student } from "@/lib/types";
import { cn, formatDate, formatDateTime, timeAgo } from "@/lib/utils";

const STATUS: Record<AchievementStatus, { label: string; tone: "sky" | "gold" | "sage" | "clay" }> = {
  submitted: { label: "Under review", tone: "sky" },
  needs_info: { label: "More details needed", tone: "gold" },
  approved: { label: "Approved", tone: "sage" },
  rejected: { label: "Not approved", tone: "clay" },
};

export function AchievementStatusBadge({ status }: { status: AchievementStatus }) {
  return (
    <Badge tone={STATUS[status].tone} dot>
      {STATUS[status].label}
    </Badge>
  );
}

const ACTION_LABEL: Record<AchievementEvent["action"], string> = {
  submitted: "submitted it",
  resubmitted: "updated and resubmitted it",
  comment: "commented",
  needs_info: "asked for more details",
  approved: "approved it",
  rejected: "did not approve it",
  posted: "posted it on LinkedIn",
  unposted: "took the LinkedIn post down",
};

/**
 * Waiting on the supervisor: filed and not yet reviewed, or approved but its
 * LinkedIn post was deleted, so it needs posting again.
 */
export const needsAction = (a: Achievement) =>
  a.status === "submitted" || (a.status === "approved" && !a.linkedIn && !!a.linkedInRemovedAt);

/** Who is looking: the student who filed it, their supervisor, or the administrator. */
export type AchievementViewer = "student" | "reviewer" | "admin";

/** Student details the LinkedIn post is written with. */
type PostStudent = Pick<Student, "fullName" | "programme" | "branch" | "semester">;

const CATEGORY_ICON: Record<string, LucideIcon> = {
  hackathons: Code2,
  research: BookOpen,
  patents: Lightbulb,
  sports: PlainMedal,
  awards: Award,
  clubs: UsersRound,
  competitions: Star,
};

/**
 * The achievement's emblem. The trophy is kept for first place; second and
 * third get a silver or bronze medal; anything else shows its category.
 */
function emblem(a: Achievement): { icon: LucideIcon; tint: string; ring: string } {
  const place = placement(a);
  if (place === 1) return { icon: Trophy, tint: "text-azure-600", ring: "from-azure-100 via-white to-blue-50" };
  if (place === 2) return { icon: SecondMedal, tint: "text-slate-500", ring: "from-slate-200 via-white to-slate-50" };
  if (place === 3) return { icon: ThirdMedal, tint: "text-amber-700", ring: "from-amber-100 via-white to-orange-50" };
  return { icon: CATEGORY_ICON[a.category] ?? Sparkles, tint: "text-azure-600", ring: "from-azure-100 via-white to-blue-50" };
}

/** Round emblem with soft rings, in two sizes. */
function Emblem({ achievement, size }: { achievement: Achievement; size: "lg" | "sm" }) {
  const { icon: Icon, tint, ring } = emblem(achievement);
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ring-1 ring-white",
        ring,
        size === "lg" ? "size-28 shadow-[0_18px_40px_-20px_rgba(21,80,200,0.55)] sm:size-32" : "size-11",
      )}
      aria-hidden
    >
      {size === "lg" ? <span className="absolute inset-3 rounded-full bg-white/70 ring-1 ring-azure-100" /> : null}
      <Icon className={cn("relative", tint, size === "lg" ? "size-12 sm:size-14" : "size-5")} strokeWidth={1.6} />
    </span>
  );
}

/** One line in a list of achievements; opens the full view. */
export function AchievementRow({
  achievement: a,
  viewer,
  onOpen,
}: {
  achievement: Achievement;
  viewer: AchievementViewer;
  onOpen: () => void;
}) {
  const { category } = findTemplate(a.category, a.template);
  const result = achievementResult(a);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-azure-50/60"
    >
      <Emblem achievement={a} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold tracking-wide text-azure-600 uppercase">
          {category?.label ?? a.category}
        </span>
        <span className="mt-0.5 block truncate font-display text-[16px] text-ink-900">{a.title}</span>
        <span className="mt-0.5 block truncate text-[12.5px] text-slate-500">
          {a.status === "approved" && !a.linkedIn && a.linkedInRemovedAt ? (
            <span className="font-medium text-[#0a66c2]">LinkedIn post removed - post again · </span>
          ) : null}
          {viewer !== "student" && a.student ? `${a.student.fullName} · ` : ""}
          {result ? `${result} · ` : ""}
          {a.participants.length > 0 ? `with ${a.participants.length} other${a.participants.length === 1 ? "" : "s"} · ` : ""}
          Filed {timeAgo(a.createdAt)}
        </span>
      </span>
      <span className="hidden sm:block">
        <AchievementStatusBadge status={a.status} />
      </span>
      <ChevronRight className="size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

/**
 * Everything about one achievement: the headline, the details the student
 * gave, the certificate (with a full-size view), who achieved it, the
 * conversation, and the reviewer's decision. Approved achievements show their
 * LinkedIn post: staff open the preview (`onPreview`), students get a draft.
 */
export function AchievementDetail({
  achievement: a,
  viewer,
  student,
  onBack,
  onChanged,
  onEdit,
  onPreview,
  onApproveWithPreview,
}: {
  achievement: Achievement;
  viewer: AchievementViewer;
  /** For the LinkedIn post - the student's own record, or the embedded one. */
  student?: PostStudent;
  onBack: () => void;
  onChanged: () => void;
  onEdit?: () => void;
  onPreview?: () => void;
  onApproveWithPreview?: (approval: PendingApproval) => void;
}) {
  const { category, template } = findTemplate(a.category, a.template);
  const open = a.status === "submitted" || a.status === "needs_info";
  const who = student ?? a.student;
  const result = achievementResult(a);
  const place = placement(a);
  const ResultIcon = place === 1 ? Trophy : place === 2 ? SecondMedal : place === 3 ? ThirdMedal : PlainMedal;

  return (
    <div className="animate-fade-rise overflow-hidden rounded-[26px] bg-white/85 shadow-[0_30px_80px_-50px_rgba(13,31,63,0.55)] ring-1 ring-white">
      {/* ------------------------------------------------------------ hero */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-azure-50 via-white to-blue-50/60 px-5 pt-5 pb-7 sm:px-8">
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 -z-10 hidden w-[42%] bg-[url(/art/art-capitol.svg)] bg-contain bg-right-bottom bg-no-repeat opacity-35 [mask-image:linear-gradient(to_right,transparent,black_45%)] md:block"
        />
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-[13.5px] font-medium text-azure-600 hover:underline"
          >
            <ArrowLeft className="size-4" />
            Back to achievements
          </button>
          <AchievementStatusBadge status={a.status} />
        </div>

        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
          <Emblem achievement={a} size="lg" />
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-azure-50 px-3 py-1 text-[11px] font-semibold tracking-wide text-azure-600 uppercase ring-1 ring-azure-100">
              <Building2 className="size-3.5" />
              {category?.label ?? a.category}
            </span>
            <h2 className="mt-3 font-display text-[1.65rem] leading-tight text-ink-900 sm:text-[2rem]">{a.title}</h2>
            {a.description ? (
              <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed whitespace-pre-line text-slate-600">{a.description}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-slate-600">
              {result ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-azure-50 px-3 py-1.5 font-semibold text-azure-600 ring-1 ring-azure-100">
                  <ResultIcon className="size-4" />
                  {result}
                </span>
              ) : null}
              {a.achievedOn ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4 text-slate-400" />
                  {formatDate(a.achievedOn)}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5" title={formatDateTime(a.createdAt)}>
                <FileText className="size-4 text-slate-400" />
                Filed {timeAgo(a.createdAt)}
              </span>
              {a.status === "approved" && a.bonusMarks != null ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                  <Sparkles className="size-4" />+{a.bonusMarks} / {MAX_BONUS_MARKS} bonus marks
                </span>
              ) : null}
            </div>
            {viewer !== "student" && a.student ? (
              <p className="mt-3 text-[12.5px] text-slate-500">
                Filed by <span className="font-medium text-ink-800">{a.student.fullName}</span> · {a.student.registrationNumber}
                {a.groupNumber ? ` · Group ${a.groupNumber}` : ""}
                {viewer === "admin" && a.reviewerName ? ` · Supervisor: ${a.reviewerName}` : ""}
              </p>
            ) : null}
            {viewer === "student" && open && onEdit ? (
              <Button size="sm" variant={a.status === "needs_info" ? "primary" : "secondary"} className="mt-4" onClick={onEdit}>
                <PencilLine className="size-3.5" />
                {a.status === "needs_info" ? "Add the details and resubmit" : "Edit submission"}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {/* --------------------------------------------- details and evidence */}
      <section className="grid gap-6 border-t border-azure-100/70 px-5 py-6 sm:px-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Details achievement={a} templateFields={template?.fields} />
          <People achievement={a} filedBy={who?.fullName ?? "Student"} />
        </div>
        <Evidence documents={a.documents} />
      </section>

      {/* ------------------------------------------------ decision and talk */}
      {viewer !== "student" && open ? (
        <section className="border-t border-azure-100/70 px-5 py-6 sm:px-8">
          <ReviewPanel achievement={a} onChanged={onChanged} onApproveWithPreview={onApproveWithPreview} />
        </section>
      ) : null}

      <section className="border-t border-azure-100/70 px-5 py-6 sm:px-8">
        <SectionTitle icon={MessageSquare} title="Activity" />
        <Trail events={a.events} />
        <CommentBox achievementId={a.id} onChanged={onChanged} />

        {a.linkedIn ? (
          <PostedOnLinkedIn achievement={a} onPreview={onPreview} canRemove={viewer !== "student"} onChanged={onChanged} />
        ) : null}
        {a.status === "approved" && !a.linkedIn && a.linkedInRemovedAt ? (
          <p className="mt-4 rounded-2xl bg-blue-50/70 px-4 py-3 text-[13px] text-slate-600 ring-1 ring-azure-100">
            <span className="font-semibold text-[#0a66c2]">The LinkedIn post was removed</span> on {formatDate(a.linkedInRemovedAt)}.
            {viewer !== "student" ? " It's still approved - preview the post to put it up again." : " It's still approved."}
          </p>
        ) : null}
        {a.status === "approved" && !a.linkedIn ? (
          onPreview ? (
            <Button size="sm" className="mt-4 bg-[#0a66c2] text-white hover:bg-[#004182]" onClick={onPreview}>
              <Share2 className="size-3.5" />
              Preview LinkedIn post
            </Button>
          ) : who ? (
            <LinkedInDraft achievement={a} student={who} />
          ) : null
        ) : null}
      </section>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">
        <Icon className="size-[18px] text-azure-600" strokeWidth={1.8} />
        {title}
      </h3>
      {hint ? <p className="mt-0.5 text-[12.5px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

/** An icon for each kind of question, so the details table scans quickly. */
const FIELD_ICON: Record<string, LucideIcon> = {
  event: Trophy,
  contest: Code2,
  competition: Star,
  position: Award,
  rank: Hash,
  medal: PlainMedal,
  award: Award,
  organiser: Building2,
  by: Building2,
  host: Building2,
  office: Building2,
  venue: MapPin,
  team: UsersRound,
  role: UserRound,
  problem: FileText,
  entry: FileText,
  summary: FileText,
  what: FileText,
  for: Target,
  prize: IndianRupee,
  value: IndianRupee,
  paper: BookOpen,
  conference: Globe,
  journal: BookOpen,
  publisher: BookOpen,
  link: Link2,
  invention: Lightbulb,
  startup: Rocket,
  milestone: Flag,
  sport: PlainMedal,
  level: Flag,
};

function Details({
  achievement: a,
  templateFields,
}: {
  achievement: Achievement;
  templateFields?: Array<{ key: string; label: string }>;
}) {
  const rows = (templateFields ?? Object.keys(a.answers).map((key) => ({ key, label: key })))
    .map((f) => ({ key: f.key, label: f.label, value: (a.answers[f.key] ?? "").trim() }))
    .filter((r) => r.value);
  if (rows.length === 0) return null;
  return (
    <div>
      <SectionTitle icon={FileText} title="Details" />
      <dl className="divide-y divide-azure-100/70 rounded-2xl bg-azure-50/40 ring-1 ring-azure-100/70">
        {rows.map((r) => {
          const Icon = FIELD_ICON[r.key] ?? FileText;
          return (
            <div key={r.key} className="grid grid-cols-[2rem_1fr] items-start gap-x-3 px-4 py-3 sm:grid-cols-[2rem_11rem_1fr]">
              <Icon className="mt-0.5 size-[18px] text-azure-600" strokeWidth={1.7} aria-hidden />
              <dt className="text-[12.5px] text-slate-500">{r.label}</dt>
              <dd className="col-start-2 text-[14px] break-words text-ink-900 sm:col-start-3">
                {r.key === "link" && /^https?:\/\//.test(r.value) ? (
                  <a href={r.value} target="_blank" rel="noreferrer" className="text-azure-600 hover:underline">
                    {r.value}
                  </a>
                ) : (
                  r.value
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

/** LinkedIn's "in" mark. */
function LinkedInMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="5" fill="#0a66c2" />
      <path
        fill="#fff"
        d="M7.1 9.6h2.6V18H7.1zM8.4 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3M11.3 9.6h2.5v1.2c.4-.7 1.3-1.4 2.6-1.4 2.7 0 3.2 1.8 3.2 4.1V18H17v-4c0-1 0-2.2-1.3-2.2s-1.6 1-1.6 2.1V18h-2.6z"
      />
    </svg>
  );
}

/** The student who filed it and everyone they added, with LinkedIn profiles. */
function People({ achievement: a, filedBy }: { achievement: Achievement; filedBy: string }) {
  const people = [
    { key: "filer", name: filedBy, note: "Filed this achievement", linkedin: a.linkedin },
    ...a.participants.map((p, i) => ({
      key: `p${i}`,
      name: p.name,
      note: [p.registrationNumber, p.inTeam ? "Teammate" : "Outside the team"].filter(Boolean).join(" · "),
      linkedin: p.linkedin,
    })),
  ];
  return (
    <div>
      <SectionTitle
        icon={UsersRound}
        title={people.length > 1 ? "Who achieved it" : "Achieved by"}
        hint={people.length > 1 ? "Everyone here is told about the decision and the LinkedIn post." : "Only this student is told about it."}
      />
      <ul className="divide-y divide-azure-100/70 rounded-2xl bg-azure-50/40 ring-1 ring-azure-100/70">
        {people.map((p) => (
          <li key={p.key} className="flex items-center gap-3 px-4 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-[12px] font-semibold text-azure-600 ring-1 ring-azure-100">
              {p.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-ink-900">{p.name}</span>
              <span className="block truncate text-[12px] text-slate-500">{p.note}</span>
            </span>
            {p.linkedin ? (
              <a
                href={p.linkedin}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12.5px] font-medium text-[#0a66c2] hover:bg-white"
              >
                <LinkedInMark className="size-4" />
                Profile
              </a>
            ) : (
              <span className="text-[12px] text-slate-400">No LinkedIn</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const IMAGE = /\.(png|jpe?g|gif|webp)$/i;

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** The certificate or proof: a preview of the chosen file, its size, and a full-size view. */
function Evidence({ documents }: { documents: AchievementDocument[] }) {
  const [index, setIndex] = useState(0);
  const [preview, setPreview] = useState<{ path: string; url: string | null } | null>(null);
  const [size, setSize] = useState<{ path: string; bytes: number | null } | null>(null);
  const [full, setFull] = useState(false);
  const doc = documents[Math.min(index, documents.length - 1)];
  const isImage = !!doc && IMAGE.test(doc.name);

  useEffect(() => {
    if (!doc) return;
    let live = true;
    if (isImage) {
      repo.getFileUrl("achievements", doc.path).then(
        (url) => live && setPreview({ path: doc.path, url }),
        () => live && setPreview({ path: doc.path, url: null }),
      );
    }
    repo.getFileSize("achievements", doc.path).then(
      (bytes) => live && setSize({ path: doc.path, bytes }),
      () => live && setSize({ path: doc.path, bytes: null }),
    );
    return () => {
      live = false;
    };
  }, [doc, isImage]);

  if (!doc) {
    return (
      <div>
        <SectionTitle icon={Link2} title="Certificate / Evidence" />
        <p className="rounded-2xl bg-azure-50/40 px-4 py-6 text-center text-[13px] text-slate-500 ring-1 ring-azure-100/70">
          No documents attached.
        </p>
      </div>
    );
  }

  const url = preview?.path === doc.path ? preview.url : undefined;
  const bytes = size?.path === doc.path ? size.bytes : null;
  const type = doc.name.split(".").pop()?.toUpperCase() ?? "FILE";

  return (
    <div>
      <SectionTitle icon={Link2} title="Certificate / Evidence" />
      <button
        type="button"
        onClick={() => setFull(true)}
        className="group relative block aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white ring-1 ring-azure-100 transition-shadow hover:shadow-[0_20px_40px_-24px_rgba(21,80,200,0.6)]"
        aria-label={`View ${doc.name} full size`}
      >
        {isImage && url ? (
          // eslint-disable-next-line @next/next/no-img-element -- private file from a short-lived signed link
          <img src={url} alt={doc.name} className="size-full object-contain p-2" />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-2 text-slate-500">
            <FileText className="size-10 text-azure-600" strokeWidth={1.4} />
            <span className="text-[13px]">{isImage ? "Loading preview…" : `${type} document - click to open`}</span>
          </span>
        )}
        <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1 text-[12px] font-medium text-azure-600 opacity-0 shadow-sm ring-1 ring-azure-100 transition-opacity group-hover:opacity-100">
          <Maximize2 className="size-3.5" />
          Enlarge
        </span>
      </button>

      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-azure-50/40 px-4 py-3 ring-1 ring-azure-100/70">
        <FileText className="size-5 shrink-0 text-azure-600" strokeWidth={1.7} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium text-ink-900">{doc.name}</span>
          <span className="block text-[12px] text-slate-500">
            {type}
            {bytes != null ? ` · ${formatSize(bytes)}` : ""}
          </span>
        </span>
        <Button size="sm" variant="secondary" onClick={() => setFull(true)}>
          <ExternalLink className="size-3.5" />
          View full size
        </Button>
      </div>

      {documents.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {documents.map((d, i) => (
            <button
              key={d.path}
              type="button"
              onClick={() => setIndex(i)}
              className={cn(
                "max-w-[12rem] truncate rounded-lg px-3 py-1.5 text-[12.5px] ring-1 transition-colors",
                i === index ? "bg-azure-50 font-medium text-azure-600 ring-azure-100" : "bg-white/70 text-slate-600 ring-white hover:text-ink-800",
              )}
            >
              {d.name}
            </button>
          ))}
        </div>
      ) : null}

      {full ? <DocumentViewer bucket="achievements" path={doc.path} name={doc.name} onClose={() => setFull(false)} /> : null}
    </div>
  );
}

function Trail({ events }: { events: AchievementEvent[] }) {
  const shown = events.filter((e) => e.action !== "submitted" || e.note);
  if (shown.length === 0) return <p className="text-[13px] text-slate-500">No comments or decisions yet.</p>;
  return (
    <ol className="space-y-3 border-l-2 border-azure-100 pl-4">
      {shown.map((e) => (
        <li key={e.id} className="text-[13.5px]">
          <p className="text-[12.5px] text-slate-500">
            <span className="font-medium text-ink-800">{e.actorName}</span> {ACTION_LABEL[e.action]} ·{" "}
            <span title={formatDateTime(e.createdAt)}>{timeAgo(e.createdAt)}</span>
          </p>
          {e.note ? (
            <p
              className={cn(
                "mt-1 rounded-xl px-3 py-2 whitespace-pre-line text-ink-800",
                e.action === "needs_info" && "bg-blue-50",
                e.action === "rejected" && "bg-red-50",
                e.action === "approved" && "bg-emerald-50",
                !["needs_info", "rejected", "approved"].includes(e.action) && "bg-azure-50/50",
              )}
            >
              {e.note}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

type Mode = "approve" | "needs_info" | "reject";

const NOTE_LIMIT = 500;

const CHOICES = [
  {
    key: "approve",
    label: "Approve",
    hint: "Mark this achievement as verified",
    icon: CircleCheck,
    dot: "bg-emerald-500",
    selected: "ring-emerald-400 bg-emerald-50/60",
  },
  {
    key: "needs_info",
    label: "Ask for more details",
    hint: "Request more information from the student",
    icon: CircleHelp,
    dot: "bg-azure-500",
    selected: "ring-azure-500 bg-azure-50",
  },
  {
    key: "reject",
    label: "Reject",
    hint: "Mark this submission as invalid",
    icon: CircleX,
    dot: "bg-red-500",
    selected: "ring-red-400 bg-red-50/60",
  },
] as const;

/** Review & decision: three choices, a note, bonus marks when approving. */
function ReviewPanel({
  achievement,
  onChanged,
  onApproveWithPreview,
}: {
  achievement: Achievement;
  onChanged: () => void;
  onApproveWithPreview?: (approval: PendingApproval) => void;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [note, setNote] = useState("");
  const [marks, setMarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide() {
    if (!mode) return;
    const m = marks.trim() === "" ? 0 : Number(marks);
    if (mode === "approve" && (Number.isNaN(m) || m < 0 || m > MAX_BONUS_MARKS)) {
      setError(`Bonus marks must be between 0 and ${MAX_BONUS_MARKS}.`);
      return;
    }
    if (mode !== "approve" && !note.trim()) {
      setError(mode === "reject" ? "Tell the student why it was rejected." : "Tell the student what more you need.");
      return;
    }
    // The preview records the approval itself, once the post has been seen.
    if (mode === "approve" && onApproveWithPreview) {
      setError(null);
      onApproveWithPreview({ note: note.trim(), marks: m });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await repo.reviewAchievement(achievement.id, mode, note.trim(), mode === "approve" ? m : undefined);
      setMode(null);
      setNote("");
      setMarks("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the decision.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <SectionTitle icon={CircleCheck} title="Review & decision" hint="Review the submission and take an action." />
      <div className="grid gap-3 md:grid-cols-3">
        {CHOICES.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={mode === c.key}
            onClick={() => {
              setMode(mode === c.key ? null : c.key);
              setError(null);
            }}
            className={cn(
              "flex items-center gap-3.5 rounded-2xl bg-white px-4 py-3.5 text-left ring-1 transition-all",
              mode === c.key ? cn("ring-2", c.selected) : "ring-azure-100 hover:ring-azure-500/40",
            )}
          >
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-white", c.dot)}>
              <c.icon className="size-5" strokeWidth={2} />
            </span>
            <span>
              <span className="block text-[14.5px] font-semibold text-ink-900">{c.label}</span>
              <span className="block text-[12.5px] text-slate-500">{c.hint}</span>
            </span>
          </button>
        ))}
      </div>

      {mode ? (
        <div className="mt-4 grid gap-3">
          {mode === "approve" ? (
            <label className="grid gap-1.5 text-[13px] text-ink-800">
              Bonus marks (0-{MAX_BONUS_MARKS})
              <Input
                type="number"
                min={0}
                max={MAX_BONUS_MARKS}
                step={0.5}
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                placeholder="0"
                className="max-w-[8rem]"
              />
              <span className="text-[12px] text-slate-500">Added to the student&apos;s grades. Leave at 0 to approve without marks.</span>
            </label>
          ) : null}
          <label className="grid gap-1.5 text-[13px] text-ink-800">
            {mode === "approve" ? "Feedback (optional)" : mode === "reject" ? "Reason" : "Additional details / comments"}
            <Textarea
              rows={3}
              maxLength={NOTE_LIMIT}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                mode === "needs_info"
                  ? "e.g. Please attach the official results page and the certificate."
                  : mode === "reject"
                    ? "e.g. Participation certificates don't count as an achievement."
                    : "e.g. Excellent work - nominated for the Student Excellence Award."
              }
            />
            <span className="text-right text-[12px] text-slate-400">
              {note.length}/{NOTE_LIMIT}
            </span>
          </label>
          {error ? <p role="alert" className="text-[13px] text-red-600">{error}</p> : null}
          <div>
            <Button
              loading={busy}
              variant={mode === "reject" ? "danger" : "primary"}
              className={mode === "approve" ? "bg-emerald-600 text-white hover:bg-emerald-700" : undefined}
              onClick={() => void decide()}
            >
              {mode === "approve" ? <Check className="size-4" /> : mode === "reject" ? <CircleX className="size-4" /> : <Send className="size-4" />}
              {mode === "approve"
                ? onApproveWithPreview
                  ? "Preview LinkedIn post and approve"
                  : "Confirm approval"
                : mode === "reject"
                  ? "Reject submission"
                  : "Send request"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CommentBox({ achievementId, onChanged }: { achievementId: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await repo.commentAchievement(achievementId, note.trim());
      setNote("");
      setOpen(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post the comment.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-azure-600 hover:underline"
      >
        <MessageSquare className="size-3.5" />
        Add a comment
      </button>
    );
  }
  return (
    <div className="mt-4 grid gap-2">
      <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Write a comment or feedback" aria-label="Comment" />
      {error ? <p role="alert" className="text-[13px] text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button size="sm" loading={busy} disabled={!note.trim()} onClick={() => void send()}>
          <Send className="size-3.5" />
          Post comment
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/**
 * "On LinkedIn" with a link to the live post. Staff can take the post down,
 * which puts the achievement back in the supervisor's "Action needed" list.
 */
function PostedOnLinkedIn({
  achievement: a,
  onPreview,
  canRemove,
  onChanged,
}: {
  achievement: Achievement;
  onPreview?: () => void;
  canRemove: boolean;
  onChanged: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!a.linkedIn) return null;

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await repo.removeAchievementFromLinkedIn(a.id);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove the post.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl bg-blue-50/70 px-4 py-3 text-[13px] text-slate-600 ring-1 ring-azure-100">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 font-semibold text-[#0a66c2]">
          <LinkedInMark className="size-4" />
          On LinkedIn
        </span>
        <span>
          Posted by {a.linkedIn.postedBy || "staff"} · {formatDate(a.linkedIn.postedAt)}
        </span>
        <a
          href={`https://www.linkedin.com/feed/update/${a.linkedIn.urn}/`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-azure-600 hover:underline"
        >
          <ExternalLink className="size-3.5" />
          View post
        </a>
        {onPreview ? (
          <button onClick={onPreview} className="text-slate-500 hover:text-ink-800 hover:underline">
            Preview
          </button>
        ) : null}
        {canRemove && !confirming ? (
          <button onClick={() => setConfirming(true)} className="text-red-600 hover:underline">
            Remove from LinkedIn
          </button>
        ) : null}
      </p>
      {confirming ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-azure-100 pt-3">
          <span className="text-ink-800">Delete this post from LinkedIn? The achievement stays approved and goes back to Action needed.</span>
          <Button size="sm" variant="danger" loading={busy} onClick={() => void remove()}>
            <CircleX className="size-3.5" />
            Delete the post
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
            Keep it
          </Button>
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-red-600">{error}</p> : null}
    </div>
  );
}

/** The post written from the template; editable, then copied or opened in LinkedIn. */
export function LinkedInDraft({ achievement, student }: { achievement: Achievement; student: PostStudent }) {
  const [text, setText] = useState(() => linkedInPost(achievement, student));
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="secondary" className="mt-4" onClick={() => setOpen(true)}>
        <Share2 className="size-3.5" />
        LinkedIn post
      </Button>
    );
  }

  return (
    <div className="mt-4 rounded-2xl bg-blue-50/70 p-4 ring-1 ring-azure-100">
      <p className="text-[12px] font-medium tracking-wide text-azure-600 uppercase">LinkedIn post · written from the template</p>
      <Textarea
        rows={10}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="LinkedIn post"
        className="mt-2 font-[inherit] text-[13px] leading-relaxed"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void copy()}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy text"}
        </Button>
        <a
          href={`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/80 px-3 text-[13px] font-medium text-slate-700 ring-1 ring-white ring-inset hover:bg-white hover:text-ink-800"
        >
          <ExternalLink className="size-3.5" />
          Open in LinkedIn
        </a>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
    </div>
  );
}
