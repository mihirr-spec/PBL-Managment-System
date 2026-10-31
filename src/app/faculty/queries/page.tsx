"use client";

import { useState } from "react";
import { CheckCircle2, Inbox, ListChecks, Paperclip, Search, Clock } from "lucide-react";

import { ChangeDecision, ChangeProgress, statusOf } from "@/components/shared/queries";
import { FileChips } from "@/components/shared/file-link";
import { RichText } from "@/components/shared/rich-text";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { SearchBox, PillTabs, FilterMenu } from "@/components/ui/toolbar";
import { useSession } from "@/lib/auth/session";
import { listTickets, replyTicket } from "@/lib/data/repository";
import type { Ticket } from "@/lib/types";
import { useLoad } from "@/lib/use-load";
import { formatDateTime, timeAgo, cn } from "@/lib/utils";

const KINDS = [
  { value: "all", label: "All kinds" },
  { value: "general", label: "Questions" },
  { value: "supervisor_change", label: "Change of supervisor" },
] as const;

type Tab = "action" | "all" | "open" | "resolved";

/** Every typed word must appear in the subject, the message, the student or the group. */
function matches(q: Ticket, query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = [q.subject, q.body, q.studentName, q.groupNumber ? `group ${q.groupNumber}` : ""].join(" ").toLowerCase();
  return words.every((w) => haystack.includes(w));
}

/** Whether the viewer still has to act: an open question, or a change their side has not approved. */
function needsAction(q: Ticket, me?: string) {
  if (q.category !== "supervisor_change") return q.status === "open";
  if (q.status !== "open") return false;
  return q.targetFacultyId === me ? !q.targetApprovedAt : !q.currentApprovedAt;
}

/**
 * The supervisor's queries, two panes: a list to pick from on the left, the
 * chosen query with its reply box on the right.
 */
export default function FacultyQueriesPage() {
  const { user } = useSession();
  const me = user?.profileId;
  const { data, error, reload } = useLoad(() => listTickets(), "queries");
  const [tab, setTab] = useState<Tab>("action");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("all");
  const [newest, setNewest] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  if (error) return <p role="alert" className="text-[13px] text-clay-500">{error}</p>;
  if (!data) return <PageSkeleton />;

  const filtered = data.filter((q) => (kind === "all" || q.category === kind) && matches(q, query));
  const open = filtered.filter((q) => q.status === "open" || q.status === "forwarded");
  const resolved = filtered.filter((q) => q.status === "resolved" || q.status === "declined");
  const action = open.filter((q) => needsAction(q, me));
  const shown = (tab === "open" ? open : tab === "resolved" ? resolved : tab === "action" ? action : filtered).sort(
    (a, b) => (newest ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)),
  );
  const current = shown.find((q) => q.id === selected) ?? shown[0] ?? null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Queries"
        title="Student"
        emphasis="queries."
        description="Questions raised by students in your groups, and requests to move a group to or from you. A move happens once both supervisors approve."
        scene="queries"
      />

      <div className="flex flex-wrap items-center gap-3">
        <PillTabs
          label="Queries"
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          items={[
            { key: "action", label: "Action needed", count: action.length, icon: Inbox },
            { key: "all", label: "All queries", count: filtered.length, icon: ListChecks },
            { key: "open", label: "Open", count: open.length },
            { key: "resolved", label: "Resolved", count: resolved.length },
          ]}
        />
        <div className="ml-auto flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <SearchBox value={query} onChange={setQuery} placeholder="Search queries..." className="flex-1 sm:w-64" />
          <FilterMenu value={kind} onChange={setKind} options={KINDS} />
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(20rem,2fr)_minmax(0,3fr)]">
        {/* -------------------------------- list pane -------------------------------- */}
        <Card>
          <div className="flex items-center justify-between gap-2 border-b border-sand-200/70 px-4 py-3">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">
              {shown.length} {shown.length === 1 ? "query" : "queries"}
            </p>
            <label className="flex items-center gap-1.5 text-[12px] text-stone-500">
              <Clock className="size-3.5" />
              <select
                value={newest ? "newest" : "oldest"}
                onChange={(e) => setNewest(e.target.value === "newest")}
                className="cursor-pointer appearance-none rounded-lg border border-sand-200 bg-white/75 px-2 py-1 text-[12.5px] text-ink-900"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
          </div>
          {shown.length === 0 ? (
            <EmptyState
              icon={<Inbox className="size-5" />}
              title="Nothing here"
              description="No queries match this view. New ones will appear as students raise them."
              scene="queries"
            />
          ) : (
            <ul className="divide-y divide-sand-200/70">
              {shown.map((q) => (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(q.id)}
                    className={cn(
                      "relative flex w-full gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/70",
                      current?.id === q.id ? "bg-azure-50/50" : "",
                    )}
                  >
                    {current?.id === q.id ? <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-azure-600" /> : null}
                    <Avatar name={q.studentName ?? "Student"} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-ink-900">{q.subject}</p>
                      <p className="mt-0.5 truncate text-[12px] text-stone-500">
                        {q.studentName ?? "Student"}
                        {q.groupNumber != null ? ` - Group ${q.groupNumber}` : ""} · {timeAgo(q.createdAt)}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Badge tone={statusOf(q).tone} dot>{statusOf(q).label}</Badge>
                        {q.category === "supervisor_change" && q.targetFacultyId === me ? (
                          <span className="text-[11px] font-semibold text-azure-600">Wants to join you</span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* -------------------------------- detail pane ------------------------------- */}
        {current ? <DetailPane key={current.id} query={current} me={me} onChanged={reload} /> : (
          <Card>
            <EmptyState title="Pick a query" description="Select one on the left to read it and reply." scene="queries" />
          </Card>
        )}
      </div>
    </div>
  );
}

/** The chosen query: the student's message, then the reply box. */
function DetailPane({ query: q, me, onChanged }: { query: Ticket; me?: string; onChanged: () => void }) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOpen = q.status === "open" || q.status === "forwarded";
  const isChange = q.category === "supervisor_change";
  const status = statusOf(q);

  async function send(resolve: boolean) {
    if (!reply.trim() && !resolve) return;
    setBusy(true);
    setError(null);
    try {
      await replyTicket(q.id, reply.trim() || q.reply || "Resolved.", resolve);
      setReply("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the reply.");
    } finally {
      setBusy(false);
    }
  }

  // The first line is the student's greeting; the rest gets its dates bolded.
  const lines = q.body.split("\n");
  const first = lines[0] ?? "";

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <Badge tone={status.tone} dot>{status.label}</Badge>
        {isOpen && !isChange ? (
          <Button size="sm" variant="secondary" loading={busy} onClick={() => void send(true)}>
            <CheckCircle2 className="size-3.5" />
            Mark as resolved
          </Button>
        ) : null}
      </div>

      <div className="px-5 py-4">
        <h2 className="font-display text-[1.35rem] tracking-tight text-ink-900">{q.subject}</h2>

        <div className="mt-3 flex items-center gap-3 rounded-[12px] bg-white/70 p-3 ring-1 ring-sand-200/70">
          <Avatar name={q.studentName ?? "Student"} size="md" />
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-ink-900">{q.studentName ?? "Student"}</p>
            <p className="text-[12px] text-stone-500" title={formatDateTime(q.createdAt)}>
              {q.groupNumber != null ? `Group ${q.groupNumber}` : "Group"} · Student · {formatDateTime(q.createdAt)}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">Student&apos;s message</p>
          <div className="mt-2 space-y-2.5 rounded-[14px] bg-ivory-200/50 p-4 text-[14px] leading-[1.7] text-ink-800">
            {first ? <p className="font-semibold">{first}</p> : null}
            {lines.length > 1 ? <RichText text={lines.slice(1).join("\n")} className="text-[14px]" /> : null}
          </div>
        </div>

        {q.attachments.length > 0 ? (
          <div className="mt-4">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">Attachments</p>
            <FileChips
              bucket="submissions"
              files={q.attachments.map((a) => ({ path: a.filePath, name: a.fileName }))}
              className="mt-2"
            />
          </div>
        ) : null}

        {isChange ? <ChangeProgress query={q} /> : null}

        {q.reply ? (
          <div className="mt-4">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">Your response</p>
            <div className="mt-2 rounded-[14px] bg-azure-50/70 p-4 text-[13.5px] leading-relaxed whitespace-pre-line text-ink-800 ring-1 ring-azure-100">
              {q.reply}
              {q.repliedAt ? <p className="mt-1.5 text-[11.5px] text-stone-500">Replied {timeAgo(q.repliedAt)}</p> : null}
            </div>
          </div>
        ) : null}

        {q.adminReply ? (
          <div className="mt-4">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-ink-400 uppercase">{isChange ? "Outcome" : "Administrator"}</p>
            <div className="mt-2 rounded-[14px] bg-sage-100/70 p-4 text-[13.5px] leading-relaxed whitespace-pre-line text-ink-800 ring-1 ring-sage-500/15">
              {q.adminReply}
              {q.adminRepliedAt ? <p className="mt-1.5 text-[11.5px] text-stone-500">Answered {timeAgo(q.adminRepliedAt)}</p> : null}
            </div>
          </div>
        ) : null}

        {isChange && q.status === "open" ? (
          <ChangeDecision query={q} side={q.targetFacultyId === me ? "target" : "current"} onChanged={onChanged} />
        ) : null}

        {isOpen && !isChange ? (
          <div className="mt-5">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-900">
              <Search className="hidden" />
              Your response
            </p>
            <Textarea
              rows={3}
              className="mt-2"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Type your reply here..."
              aria-label="Your response"
            />
            {error ? <p role="alert" className="mt-1.5 text-[12.5px] text-clay-500">{error}</p> : null}
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11.5px] text-stone-400">
                <Paperclip className="size-3.5" />
                Replies notify the student on their portal.
              </span>
              <Button size="sm" loading={busy} disabled={!reply.trim()} onClick={() => void send(false)}>
                Send reply
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
