"use client";

import { useState } from "react";
import { GraduationCap, MessageCircleQuestion, Shuffle, UserX, UsersRound } from "lucide-react";

import { StatTile } from "@/components/dashboard/stat-tile";
import { AdminChangeDecision, QueryList } from "@/components/shared/queries";
import { GroupTable } from "@/components/staff/group-table";
import { SupervisorHistory } from "@/components/staff/supervisor-change";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { DashboardHero } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import * as repo from "@/lib/data/repository";
import { useLoad } from "@/lib/use-load";

export default function AdminDashboardPage() {
  const { data, reload } = useLoad(async () => {
    const [overview, groups, ungrouped, queries, changes] = await Promise.all([
      repo.getOverview(),
      repo.listGroups(),
      repo.listUngroupedStudents(),
      repo.listTickets(),
      repo.listSupervisorChanges(),
    ]);
    // Change-of-supervisor requests both supervisors approved while the new one was full.
    const waiting = queries.filter((q) => q.category === "supervisor_change" && q.status === "forwarded");
    return { overview, groups, ungrouped, waiting, changes };
  }, "admin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function allocate() {
    setBusy(true);
    setMessage(null);
    try {
      const count = await repo.autoAllocateMentors();
      setMessage(
        count === 0
          ? "Nothing to allot - every group has a supervisor, or no supervisor on the portal has room."
          : `Allotted a supervisor to ${count} group${count > 1 ? "s" : ""}. Their students have been notified.`,
      );
      await reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Allocation failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <PageSkeleton />;
  const { overview, groups, ungrouped, waiting, changes } = data;

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow="Administrator"
        title="PBL at a"
        emphasis="glance."
        description="All groups and their supervisors. Groups that have not secured a mentor can be allotted one at random."
        image="photo"
        imageClassName="object-[center_6%]"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={GraduationCap} label="Students" value={overview.students} caption={`${ungrouped.length} not in a group`} doodle="books" />
        <StatTile icon={UsersRound} label="Groups" value={overview.groups} caption={`${overview.teachersOnPortal} supervisors on the portal`} tone="sage" doodle="globe" />
        <StatTile icon={UserX} label="Without supervisor" value={overview.unassignedGroups} caption="Waiting for a mentor" tone={overview.unassignedGroups > 0 ? "gold" : "sage"} doodle="bulb" />
        <StatTile icon={MessageCircleQuestion} label="Open queries" value={overview.openTickets} caption="Across all groups" tone={overview.openTickets > 0 ? "clay" : "neutral"} doodle="plane" />
      </div>

      <Card>
        <CardHeader
          title="Allot supervisors"
          description="Gives every group without a supervisor a random supervisor who is on the portal and has fewer than 7 groups. Pending requests for those groups are closed."
          action={
            <Button size="sm" loading={busy} disabled={overview.unassignedGroups === 0} onClick={() => void allocate()}>
              <Shuffle className="size-3.5" />
              Allot at random
            </Button>
          }
        />
        {message ? <p className="px-5 py-3 text-[13px] text-ink-800">{message}</p> : null}
      </Card>

      {waiting.length > 0 ? (
        <Card className="ring-2 ring-azure-100">
          <CardHeader
            title={`Supervisor change requests (${waiting.length})`}
            description="Both supervisors approved these moves, but the requested supervisor already has their full number of groups. Your call."
          />
          <QueryList queries={waiting} action={(q) => <AdminChangeDecision query={q} onChanged={() => void reload()} />} />
        </Card>
      ) : null}

      <GroupTable title="All groups" groups={groups} hrefBase="/admin/groups" showMentor />

      {changes.length > 0 ? (
        <Card>
          <CardHeader title="Recent supervisor changes" description="Open a group to change its supervisor." />
          <SupervisorHistory changes={changes.slice(0, 8)} showGroup />
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Students not in a group" description="They need to form or join a group before a supervisor can be allotted." />
        {ungrouped.length === 0 ? (
          <EmptyState title="Everyone is in a group" />
        ) : (
          <ul className="divide-y divide-sand-200/70">
            {ungrouped.map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-2 px-5 py-3 text-[13.5px]">
                <span className="font-medium text-ink-900">{s.fullName}</span>
                <span className="tnum text-stone-500">{s.registrationNumber} · {s.universityEmail}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
