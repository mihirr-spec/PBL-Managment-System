import Link from "next/link";
import { ChevronRight, Crown } from "lucide-react";

import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import type { Group } from "@/lib/types";

/**
 * Front-level list of groups: number, leader, project and basics. Each row
 * opens the full team view at `${hrefBase}/<group id>`.
 */
export function GroupTable({
  title,
  description,
  groups,
  hrefBase,
  showMentor = false,
  pendingReports = {},
  openTickets = {},
}: {
  title: string;
  description?: string;
  groups: Array<Group & { mentorName?: string }>;
  hrefBase: string;
  showMentor?: boolean;
  /** group id → reports awaiting a grade */
  pendingReports?: Record<string, number>;
  /** group id → open queries */
  openTickets?: Record<string, number>;
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      {groups.length === 0 ? (
        <EmptyState title="No groups yet" description="Groups appear here once they are assigned." scene="team" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left">
            <thead>
              <tr className="border-b border-sand-200/60 bg-white/40 text-[10.5px] tracking-[0.12em] text-ink-400 uppercase">
                <th className="px-5 py-2.5 font-semibold">Group</th>
                <th className="px-5 py-2.5 font-semibold">Team leader</th>
                <th className="px-5 py-2.5 font-semibold">Project</th>
                <th className="px-5 py-2.5 font-semibold">{showMentor ? "Supervisor" : "Action needed"}</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200/70">
              {groups.map((g) => {
                const leader = g.members.find((m) => m.studentId === g.leaderStudentId);
                const reports = pendingReports[g.id] ?? 0;
                const tickets = openTickets[g.id] ?? 0;
                return (
                  <tr key={g.id} className="group relative transition-colors hover:bg-white/70">
                    <td className="px-5 py-3.5">
                      <Link href={`${hrefBase}/${g.id}`} className="after:absolute after:inset-0">
                        <span className="tnum font-display text-[17px] text-ink-900">Group {g.number}</span>
                      </Link>
                      <p className="text-[12px] text-stone-500">
                        {g.name} · {g.members.length} students
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink-900">
                        <Crown className="size-3.5 text-gold-500" aria-hidden />
                        {leader?.fullName ?? "-"}
                      </p>
                      <p className="tnum text-[12px] text-stone-500">{leader?.registrationNumber}</p>
                    </td>
                    <td className="max-w-[20rem] px-5 py-3.5">
                      <p className="truncate text-[13.5px] font-medium text-ink-900">{g.projectTitle}</p>
                      <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-stone-500" title={g.projectIdea || undefined}>
                        {g.projectIdea || "No description yet."}
                      </p>
                      <p className="mt-1 text-[11px] text-stone-400">
                        {g.domain || "No domain"} · {g.progress}% done
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-[12.5px]">
                      {showMentor ? (
                        g.mentorName ? (
                          <span className="text-ink-900">{g.mentorName}</span>
                        ) : (
                          <span className="rounded-full bg-gold-50 px-2 py-0.5 font-semibold text-gold-600">Unassigned</span>
                        )
                      ) : reports + tickets === 0 ? (
                        <span className="text-stone-400">Up to date</span>
                      ) : (
                        <span className="text-ink-900">
                          {reports > 0 ? `${reports} report${reports > 1 ? "s" : ""} to grade` : ""}
                          {reports > 0 && tickets > 0 ? " · " : ""}
                          {tickets > 0 ? `${tickets} open quer${tickets > 1 ? "ies" : "y"}` : ""}
                        </span>
                      )}
                    </td>
                    <td className="pr-4">
                      <ChevronRight className="size-4 text-sand-300 group-hover:text-stone-500" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
