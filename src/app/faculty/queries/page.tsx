"use client";

import { useState } from "react";
import { MessageCircleQuestion } from "lucide-react";

import { QueryList } from "@/components/shared/queries";
import { Card, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { listTickets } from "@/lib/data/repository";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";

export default function FacultyQueriesPage() {
  const { data, reload } = useLoad(() => listTickets(), "queries");
  const [showAll, setShowAll] = useState(false);

  if (!data) return <PageSkeleton />;
  const open = data.filter((q) => q.status === "open");
  const visible = showAll ? data : open;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Queries"
        title="Student"
        emphasis="queries."
        description="Questions raised by students in your groups, and requests to change supervisor. Replies notify the student; approved change requests go to the administrator."
        scene="queries"
      />
      <div className="inline-flex gap-1 rounded-xl bg-white/60 p-1 ring-1 ring-white">
        {[false, true].map((all) => (
          <button
            key={String(all)}
            onClick={() => setShowAll(all)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-[13px] font-medium",
              showAll === all ? "bg-ink-800 text-white" : "text-stone-600 hover:text-ink-800",
            )}
          >
            {all ? "All queries" : `Needs you (${open.length})`}
          </button>
        ))}
      </div>
      <Card>
        {visible.length === 0 ? (
          <EmptyState icon={<MessageCircleQuestion className="size-5" />} title="Nothing to show" scene="queries" />
        ) : (
          <QueryList queries={visible} canReply onChanged={reload} />
        )}
      </Card>
    </div>
  );
}
