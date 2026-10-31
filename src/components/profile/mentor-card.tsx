import Link from "next/link";
import { ArrowRightLeft, BookOpen, Building2, Mail } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import type { Faculty, SupervisorChange } from "@/lib/types";
import { formatDateTime, timeAgo } from "@/lib/utils";

/** The group's supervisor - or a prompt to request one. */
export function MentorCard({
  mentor,
  lastChange = null,
}: {
  mentor: Faculty | null;
  /** Shown as a notice when the group has moved to this supervisor. */
  lastChange?: SupervisorChange | null;
}) {
  if (!mentor) {
    return (
      <Card>
        <CardHeader title="Supervisor" />
        <EmptyState
          title="No supervisor yet"
          description="Request a supervisor from your group page. Groups without one are allotted a supervisor by the administrator."
          scene="requests"
        />
        <div className="px-5 pb-5 text-center">
          <ButtonLink href="/student/group" size="sm" variant="secondary">
            Go to my group
          </ButtonLink>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Supervisor" description="Your group's mentor for this semester." />
      <CardBody className="space-y-4">
        {lastChange && lastChange.toFacultyId === mentor.id ? (
          <div className="rounded-[12px] border border-azure-100 bg-azure-50/70 px-3 py-2.5 text-[12.5px] text-ink-800">
            <p className="flex items-center gap-1.5 font-semibold">
              <ArrowRightLeft className="size-3.5 text-azure-600" />
              Supervisor changed {lastChange.fromName ? `from ${lastChange.fromName}` : ""}
            </p>
            <p className="mt-0.5 text-stone-500" title={formatDateTime(lastChange.createdAt)}>
              By the administrator · {timeAgo(lastChange.createdAt)}
            </p>
            <p className="mt-1.5 whitespace-pre-line text-stone-600">
              <span className="font-semibold text-ink-800">Reason: </span>
              {lastChange.reason}
            </p>
          </div>
        ) : null}
        <div className="flex items-center gap-3.5">
          <Avatar name={mentor.fullName} size="lg" />
          <div className="min-w-0">
            <p className="font-display text-[17px] tracking-tight text-ink-900">{mentor.fullName}</p>
            <p className="text-[12.5px] text-stone-500">{mentor.designation}</p>
          </div>
        </div>

        <ul className="space-y-2.5 border-t border-sand-200/70 pt-4 text-[13px] text-stone-600">
          <li className="flex items-start gap-2.5">
            <Building2 className="mt-0.5 size-4 shrink-0 text-stone-400" />
            {mentor.department}
          </li>
          {mentor.email ? (
            <li className="flex items-center gap-2.5">
              <Mail className="size-4 shrink-0 text-stone-400" />
              <span className="truncate select-all">{mentor.email}</span>
            </li>
          ) : null}
          {mentor.expertise ? (
            <li className="flex items-start gap-2.5">
              <BookOpen className="mt-0.5 size-4 shrink-0 text-stone-400" />
              <span>{mentor.expertise}</span>
            </li>
          ) : null}
        </ul>

        <Link href="/student/queries/new" className="inline-block text-[13px] font-medium text-azure-600 hover:underline">
          Raise a query with your supervisor →
        </Link>
      </CardBody>
    </Card>
  );
}
