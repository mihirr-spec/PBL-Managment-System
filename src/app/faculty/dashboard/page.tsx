"use client";

import { FileText, MessageCircleQuestion, Trophy, UserPlus, UsersRound } from "lucide-react";

import { StatTile } from "@/components/dashboard/stat-tile";
import { GroupTable } from "@/components/staff/group-table";
import { SupervisorHistory } from "@/components/staff/supervisor-change";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DashboardHero } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth/session";
import * as repo from "@/lib/data/repository";
import { useLoad } from "@/lib/use-load";

const MAX_GROUPS = 7;

export default function FacultyDashboardPage() {
  const { user } = useSession();
  const { data } = useLoad(async () => {
    const [groups, requests, ungraded, tickets, changes, achievements] = await Promise.all([
      repo.listGroups(user!.profileId),
      repo.listRequestsForFaculty(user!.profileId),
      repo.countUngradedReports(),
      repo.listTickets(),
      // Only changes involving this teacher are visible to them.
      repo.listSupervisorChanges(),
      repo.listAchievements(),
    ]);
    const openTickets: Record<string, number> = {};
    for (const t of tickets) if (t.status === "open") openTickets[t.groupId] = (openTickets[t.groupId] ?? 0) + 1;
    return {
      groups,
      pendingRequests: requests.filter((r) => r.status === "pending").length,
      ungraded,
      openTickets,
      changes,
      achievementsToReview: achievements.filter((a) => a.status === "submitted").length,
    };
  }, user ? user.id : null);

  if (!user || !data) return <PageSkeleton />;

  const ungradedTotal = data.groups.reduce((n, g) => n + (data.ungraded[g.id] ?? 0), 0);
  const ticketTotal = data.groups.reduce((n, g) => n + (data.openTickets[g.id] ?? 0), 0);

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow="Supervisor"
        title="Welcome,"
        emphasis={`${user.displayName}.`}
        description="Your PBL groups this semester. Open a group to see the whole team, grade reports and students, and answer queries."
        image="campus"
        imageClassName="object-[center_40%]"
        action={
          data.pendingRequests > 0 || data.achievementsToReview > 0 ? (
            <div className="flex flex-wrap gap-2">
              {data.pendingRequests > 0 ? (
                <ButtonLink href="/faculty/requests" size="sm">
                  <UserPlus className="size-3.5" />
                  {data.pendingRequests} mentor request{data.pendingRequests > 1 ? "s" : ""}
                </ButtonLink>
              ) : null}
              {data.achievementsToReview > 0 ? (
                <ButtonLink href="/faculty/achievements" size="sm" variant="secondary">
                  <Trophy className="size-3.5" />
                  {data.achievementsToReview} achievement{data.achievementsToReview > 1 ? "s" : ""} to review
                </ButtonLink>
              ) : null}
            </div>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={UsersRound} label="Groups" value={`${data.groups.length}/${MAX_GROUPS}`} caption="Supervising" doodle="book" />
        <StatTile icon={UserPlus} label="Requests" value={data.pendingRequests} caption="Waiting for your decision" tone="sage" doodle="pencil" />
        <StatTile icon={FileText} label="Reports to grade" value={ungradedTotal} caption="Across your groups" tone="gold" doodle="books" />
        <StatTile icon={MessageCircleQuestion} label="Open queries" value={ticketTotal} caption="From your students" tone={ticketTotal > 0 ? "clay" : "neutral"} doodle="globe" />
      </div>

      <GroupTable
        title="My groups"
        description="Click a group to open the full team view."
        groups={data.groups}
        hrefBase="/faculty/groups"
        pendingReports={data.ungraded}
        openTickets={data.openTickets}
      />

      {data.changes.length > 0 ? (
        <Card>
          <CardHeader
            title="Supervisor changes"
            description="Groups the PBL office moved to you or away from you, with the reason."
          />
          <SupervisorHistory changes={data.changes.slice(0, 6)} showGroup viewerFacultyId={user.profileId} />
        </Card>
      ) : null}
    </div>
  );
}
