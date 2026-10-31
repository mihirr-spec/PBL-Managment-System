"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Crown } from "lucide-react";

import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { RichText, plainText } from "@/components/shared/rich-text";
import type { Group } from "@/lib/types";

/**
 * Front-level list of groups: number, leader, project and basics. Each row
 * opens the full team view at `${hrefBase}/<group id>`; "Read full
 * description" shows the team's project description, formatted, in place.
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
                const open = expanded.has(g.id);
                return (
                  <Fragment key={g.id}>
                  <tr className="group relative transition-colors hover:bg-white/70">
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
                      <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-stone-500">
                        {plainText(g.projectIdea) || "No description yet."}
                      </p>
                      {g.projectIdea ? (
                        <button
                          type="button"
                          onClick={() => toggle(g.id)}
                          aria-expanded={open}
                          className="relative z-10 mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-azure-600 hover:underline"
                        >
                          {open ? "Hide description" : "Read full description"}
                          <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
                        </button>
                      ) : null}
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
                  {open ? (
                    <tr className="bg-azure-50/30">
                      <td colSpan={5} className="px-5 pt-1 pb-4">
                        <div className="rounded-[14px] bg-white px-5 py-4 ring-1 ring-sand-200">
                          <p className="text-[11px] font-semibold tracking-[0.12em] text-ink-400 uppercase">
                            Project description · {g.projectTitle}
                          </p>
                          <RichText text={g.projectIdea} className="mt-2 text-[13.5px]" />
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
