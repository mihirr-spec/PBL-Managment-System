"use client";

import { useState } from "react";
import { Inbox, ListChecks } from "lucide-react";

import { QueryList } from "@/components/shared/queries";
import { Card, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { FilterMenu, PillTabs, SearchBox } from "@/components/ui/toolbar";
import { listTickets } from "@/lib/data/repository";
import type { Ticket } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

const KINDS = [
  { value: "all", label: "All kinds" },
  { value: "general", label: "Questions" },
  { value: "supervisor_change", label: "Change of supervisor" },
] as const;

/** Every typed word must appear in the subject, the message, the student or the group. */
function matches(q: Ticket, query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = [q.subject, q.body, q.studentName, q.groupNumber ? `group ${q.groupNumber}` : ""].join(" ").toLowerCase();
  return words.every((w) => haystack.includes(w));
}

export default function FacultyQueriesPage() {
  const { data, error, reload } = useLoad(() => listTickets(), "queries");
  const [tab, setTab] = useState<"open" | "all">("open");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("all");

  if (error) return <p role="alert" className="text-[13px] text-clay-500">{error}</p>;
  if (!data) return <PageSkeleton />;
  const shown = data.filter((q) => (kind === "all" || q.category === kind) && matches(q, query));
  const open = shown.filter((q) => q.status === "open");
  const visible = tab === "open" ? open : shown;
  const searching = query.trim() !== "" || kind !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Queries"
        title="Student"
        emphasis="queries."
        description="Questions raised by students in your groups, and requests to change supervisor. Replies notify the student; approved change requests go to the administrator."
        scene="queries"
      />
      <div className="flex flex-wrap items-center gap-3">
        <PillTabs
          label="Queries"
          value={tab}
          onChange={setTab}
          items={[
            { key: "open", label: "Action needed", count: open.length, icon: Inbox },
            { key: "all", label: "All queries", icon: ListChecks },
          ]}
        />
        <div className="ml-auto flex w-full gap-3 sm:w-auto">
          <SearchBox value={query} onChange={setQuery} placeholder="Search queries..." className="flex-1 sm:w-72" />
          <FilterMenu value={kind} onChange={setKind} options={KINDS} />
        </div>
      </div>
      <Card>
        {visible.length === 0 ? (
          searching ? (
            <EmptyState title="No matches" description="No query matches your search or filter." scene="queries" />
          ) : tab === "open" ? (
            <EmptyState
              title="You're all caught up"
              description="No student queries need your attention right now. New questions and supervisor-change requests will appear here."
              scene="queries"
            />
          ) : (
            <EmptyState title="No queries yet" description="Questions from students in your groups will appear here." scene="queries" />
          )
        ) : (
          <QueryList queries={visible} canReply onChanged={reload} />
        )}
      </Card>
    </div>
  );
}
