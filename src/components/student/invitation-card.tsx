"use client";

import { useState } from "react";
import { Check, Crown, GraduationCap, Hourglass, X } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import * as repo from "@/lib/data/repository";
import type { GroupInvitation } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

/**
 * "Mihir has invited you to join his team" - the group, who is in it, and
 * where its supervisor request stands, with accept and decline.
 */
export function InvitationCard({
  invitation: inv,
  onAnswered,
}: {
  invitation: GroupInvitation;
  onAnswered: (accepted: boolean) => void;
}) {
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function answer(accept: boolean) {
    setBusy(accept ? "accept" : "decline");
    setError(null);
    try {
      await repo.respondToInvitation(inv.id, accept);
      onAnswered(accept);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not answer the invitation.");
      setBusy(null);
    }
  }

  return (
    <Card className="ring-2 ring-azure-100">
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={inv.leader.fullName} size="md" />
            <div>
              <p className="text-[15px] text-ink-900">
                <span className="font-semibold">{inv.leader.fullName}</span> has invited you to join their team
              </p>
              <p className="text-[12px] text-stone-500">
                {inv.leader.registrationNumber} · {timeAgo(inv.createdAt)}
              </p>
            </div>
          </div>
          <Badge tone="gold" dot>Waiting for you</Badge>
        </div>

        <div className="rounded-[14px] border border-sand-200/70 bg-white/60 px-4 py-3">
          <p className="text-[11.5px] text-stone-500">
            Group {inv.group.number} · {inv.group.name}
            {inv.group.domain ? ` · ${inv.group.domain}` : ""}
          </p>
          <p className="mt-0.5 font-display text-[1.15rem] tracking-tight text-ink-900">{inv.group.projectTitle}</p>
          {inv.group.projectIdea ? (
            <p className="mt-1 text-[13px] leading-relaxed text-stone-600">{inv.group.projectIdea}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-ink-400 uppercase">In the group</p>
            <ul className="space-y-1">
              {inv.members.map((m) => (
                <li key={m.registrationNumber} className="flex items-center gap-1.5 text-[13px] text-ink-800">
                  {m.fullName}
                  {m.registrationNumber === inv.leader.registrationNumber ? (
                    <Crown className="size-3.5 text-gold-500" aria-label="Team leader" />
                  ) : null}
                  <span className="tnum text-[11.5px] text-stone-400">{m.registrationNumber}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-ink-400 uppercase">Supervisor</p>
            {inv.mentor ? (
              <div className="flex items-start gap-2 text-[13px]">
                <GraduationCap className="mt-0.5 size-4 shrink-0 text-azure-600" />
                <div>
                  <p className="font-medium text-ink-900">{inv.mentor.fullName}</p>
                  <p className="text-[12px] text-stone-500">{inv.mentor.designation} · {inv.mentor.department}</p>
                  {inv.mentor.email ? <p className="text-[12px] text-stone-500">{inv.mentor.email}</p> : null}
                </div>
              </div>
            ) : (
              <p className="flex items-start gap-2 text-[13px] text-stone-600">
                <Hourglass className="mt-0.5 size-4 shrink-0 text-gold-500" />
                {inv.requestedTeachers.length > 0
                  ? `Waiting for ${inv.requestedTeachers.join(", ")} to accept. Their details appear here once they do.`
                  : "No supervisor yet - the team lead has not sent a request."}
              </p>
            )}
          </div>
        </div>

        {error ? <p role="alert" className="text-[13px] text-clay-500">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => answer(true)} loading={busy === "accept"} disabled={busy !== null}>
            <Check className="size-3.5" />
            Accept and join
          </Button>
          <Button variant="secondary" onClick={() => answer(false)} loading={busy === "decline"} disabled={busy !== null}>
            <X className="size-3.5" />
            Decline
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
