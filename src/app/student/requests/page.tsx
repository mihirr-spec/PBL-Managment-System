"use client";

import { useRouter } from "next/navigation";
import { Inbox } from "lucide-react";

import { InvitationCard } from "@/components/student/invitation-card";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { usePortal } from "@/lib/data/portal-store";

/** Invitations from classmates to join their team. */
export default function RequestsPage() {
  const { loading, group, invitations, refresh } = usePortal();
  const router = useRouter();

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Requests"
        title="Team"
        emphasis="invitations."
        description="When a classmate adds you to their group, the invitation waits here. You join only once you accept."
        scene="team"
      />
      {invitations.length > 0 ? (
        invitations.map((inv) => (
          <InvitationCard
            key={inv.id}
            invitation={inv}
            onAnswered={async (accepted) => {
              await refresh();
              if (accepted) router.push("/student/group");
            }}
          />
        ))
      ) : (
        <Card>
          <EmptyState
            icon={<Inbox className="size-5" />}
            title="No invitations"
            description={
              group
                ? `You are in Group ${group.number} - ${group.name}.`
                : "Nobody has invited you yet. You can also start your own group."
            }
            scene="team"
          />
          <div className="px-5 pb-5 text-center">
            <ButtonLink href="/student/group" size="sm" variant="secondary">
              {group ? "Go to my group" : "Start my own group"}
            </ButtonLink>
          </div>
        </Card>
      )}
    </div>
  );
}
