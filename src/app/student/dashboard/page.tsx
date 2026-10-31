"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowUpRight, Award, Bell, FileText, MessageCircleQuestion, UsersRound } from "lucide-react";

import { NotificationIcon } from "@/components/notifications/notification-icon";
import { MentorCard } from "@/components/profile/mentor-card";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { DashboardHero } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { PageSkeleton } from "@/components/ui/skeleton";
import * as repo from "@/lib/data/repository";
import { usePortal } from "@/lib/data/portal-store";
import { useLoad } from "@/lib/use-load";
import { timeAgo } from "@/lib/utils";

function greeting(fullName: string) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return { part, name: fullName.split(" ")[0] };
}

export default function DashboardPage() {
  const { loading, student, group, mentor, supervisorChange, notifications } = usePortal();
  const router = useRouter();

  // Until they are in a group, students start on the details → supervisor →
  // application → group flow.
  const needsGroup = !loading && student != null && group == null;
  useEffect(() => {
    if (needsGroup) router.replace("/student/group");
  }, [needsGroup, router]);

  const { data } = useLoad(
    async () => {
      const [reports, grades, tickets] = await Promise.all([
        group ? repo.listReports(group.id) : Promise.resolve([]),
        student ? repo.listGrades([student.id]) : Promise.resolve([]),
        group ? repo.listTickets(group.id) : Promise.resolve([]),
      ]);
      return { reports, grades, tickets };
    },
    student ? `${student.id}:${group?.id ?? "none"}` : null,
  );

  if (loading || !student || needsGroup) return <PageSkeleton />;

  const hello = greeting(student.fullName);
  const latestReport = data?.reports[0];
  const openTickets = data?.tickets.filter((t) => t.status === "open").length ?? 0;
  // Reports and queries need a group; until then those cards point to it.
  const groupHref = (href: string) => (group ? href : "/student/group");

  return (
    <div className="space-y-6">
      {/* ------------------------------ hero ------------------------------ */}
      <DashboardHero
        eyebrow="Dashboard"
        title={`${hello.part},`}
        emphasis={`${hello.name}.`}
        description={
          group
            ? `Group ${group.number} · ${group.projectTitle}`
            : "You are not in a group yet - form one and register your mentor to get started."
        }
        image="painting"
        imageClassName="object-[85%_70%]"
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ------------------------ 1. ongoing project ------------------------ */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Ongoing project"
            action={
              <ButtonLink href="/student/group" variant="ghost" size="sm">
                My group <ArrowUpRight className="size-3.5" />
              </ButtonLink>
            }
          />
          {group ? (
            <CardBody className="space-y-4">
              <div>
                <p className="text-[11.5px] text-stone-500">
                  Group {group.number} · {group.name} {group.domain ? `· ${group.domain}` : ""}
                </p>
                <p className="mt-1 font-display text-[1.35rem] leading-snug tracking-tight text-ink-900">
                  {group.projectTitle}
                </p>
                <p className="mt-1.5 line-clamp-2 text-[13.5px] text-stone-600">{group.projectIdea}</p>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-[12px] text-stone-500">
                  <span>Progress</span>
                  <span className="tnum font-medium text-ink-800">{group.progress}%</span>
                </div>
                <ProgressBar value={group.progress} label="Project progress" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex -space-x-2">
                  {group.members.map((m) => (
                    <Avatar key={m.studentId} name={m.fullName} src={m.avatarUrl} size="sm" />
                  ))}
                </div>
                <span className="text-[12.5px] text-stone-500">{group.members.length} members</span>
              </div>
            </CardBody>
          ) : (
            <EmptyState
              icon={<UsersRound className="size-5" />}
              title="No group yet"
              description="Form a group with your classmates, then request a supervisor."
              scene="group"
            />
          )}
        </Card>

        {/* ------------------------- 5. supervisor -------------------------- */}
        <MentorCard mentor={mentor} lastChange={supervisorChange} />

        {/* ------------------------- 2. weekly report ------------------------ */}
        <Card>
          <CardHeader title="Weekly report" />
          <CardBody className="space-y-3">
            {latestReport ? (
              <>
                <p className="text-[13px] text-stone-600">
                  Last submitted: <span className="font-semibold text-ink-900">Week {latestReport.week}</span>{" "}
                  · {timeAgo(latestReport.submittedAt)}
                </p>
                <p className="text-[13px] text-stone-600">
                  {latestReport.grade != null
                    ? `Graded ${latestReport.grade}/10`
                    : "Waiting for your supervisor to grade it."}
                </p>
              </>
            ) : (
              <p className="text-[13px] text-stone-600">No weekly report submitted yet.</p>
            )}
            <ButtonLink href={groupHref("/student/reports")} size="sm">
              <FileText className="size-3.5" />
              Submit week {latestReport ? latestReport.week + 1 : 1} report
            </ButtonLink>
          </CardBody>
        </Card>

        {/* -------------------- 3. grades & improvements -------------------- */}
        <Card>
          <CardHeader
            title="Grades & improvements"
            action={
              <ButtonLink href="/student/grades" variant="ghost" size="sm">
                All
              </ButtonLink>
            }
          />
          {data && data.grades.length > 0 ? (
            <ul className="divide-y divide-sand-200/70">
              {data.grades.slice(0, 2).map((g) => (
                <li key={g.id} className="px-5 py-3">
                  <p className="flex items-baseline justify-between gap-2 text-[13.5px] font-medium text-ink-900">
                    {g.title}
                    <span className="tnum shrink-0 font-display text-[16px]">
                      {g.score}/{g.maxScore}
                    </span>
                  </p>
                  {g.improvements ? (
                    <p className="mt-0.5 line-clamp-2 text-[12.5px] text-stone-500">{g.improvements}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Award className="size-5" />} title="No grades yet" scene="grades" />
          )}
        </Card>

        {/* ----------------------------- 4. queries ----------------------------- */}
        <Card>
          <CardHeader title="Queries" />
          <CardBody className="space-y-3">
            <p className="text-[13px] text-stone-600">
              {openTickets > 0
                ? `${openTickets} open ${openTickets === 1 ? "query" : "queries"} with your supervisor.`
                : "Need help or have a problem? Raise a query - your supervisor sees it straight away."}
            </p>
            <ButtonLink href={groupHref("/student/queries/new")} size="sm" variant="secondary">
              <MessageCircleQuestion className="size-3.5" />
              Raise a query
            </ButtonLink>
          </CardBody>
        </Card>
      </div>

      {/* --------------------------- 6. notifications --------------------------- */}
      <Card>
        <CardHeader
          title="Latest notifications"
          action={
            <ButtonLink href="/student/notifications" variant="ghost" size="sm">
              View all
            </ButtonLink>
          }
        />
        {notifications.length === 0 ? (
          <EmptyState icon={<Bell className="size-5" />} title="Nothing new" scene="notifications" />
        ) : (
          <ul className="divide-y divide-sand-200/70">
            {notifications.slice(0, 4).map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href ?? "/student/notifications"}
                  className="flex gap-3 px-5 py-3 transition-colors hover:bg-white/70"
                >
                  <NotificationIcon kind={n.kind} />
                  <div className="min-w-0">
                    <p className={n.read ? "text-[13.5px] text-ink-900" : "text-[13.5px] font-semibold text-ink-900"}>
                      {n.title}
                    </p>
                    <p className="truncate text-[12px] text-stone-500">
                      {n.body} · {timeAgo(n.createdAt)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
