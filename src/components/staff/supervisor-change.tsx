"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, ArrowRightLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import * as repo from "@/lib/data/repository";
import type { SupervisorChange } from "@/lib/types";
import { useLoad } from "@/lib/use-load";
import { formatDateTime, timeAgo } from "@/lib/utils";

/** The PBL office moves a group to another teacher directly, from the group's page. */
export function ChangeSupervisorForm({
  groupId,
  currentMentorId,
  onDone,
}: {
  groupId: string;
  currentMentorId: string | null;
  onDone: () => void;
}) {
  const teachers = useLoad(() => repo.listPortalTeachers(), "portal-teachers");
  const [facultyId, setFacultyId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldId = `new-supervisor-${groupId}`;

  async function change(event: FormEvent) {
    event.preventDefault();
    if (!facultyId) {
      setError("Choose the new supervisor.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await repo.changeSupervisor({ groupId, facultyId, reason: reason.trim() });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change the supervisor.");
      setBusy(false);
    }
  }

  const options = (teachers.data ?? []).filter((t) => t.id !== currentMentorId);

  return (
    <form onSubmit={change} className="mt-3 space-y-3 rounded-[14px] border border-azure-100 bg-white/75 p-3.5">
      <Field label="New supervisor" htmlFor={fieldId} help="Supervisors with a portal account. Each can supervise up to 7 groups.">
        <select
          id={fieldId}
          value={facultyId}
          onChange={(e) => setFacultyId(e.target.value)}
          className="h-10 w-full rounded-lg border border-sand-200 bg-white px-3 text-[13.5px] text-ink-900 focus:border-azure-500 focus:ring-3 focus:ring-azure-100 focus:outline-none"
        >
          <option value="">{teachers.data ? "Choose a supervisor…" : "Loading supervisors…"}</option>
          {options.map((t) => (
            <option key={t.id} value={t.id} disabled={t.groupCount >= t.maxGroups}>
              {t.fullName} - {t.groupCount}/{t.maxGroups} groups{t.groupCount >= t.maxGroups ? " (full)" : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Reason"
        htmlFor={`${fieldId}-reason`}
        help="Shown to the students, the old supervisor and the new one."
      >
        <Textarea id={`${fieldId}-reason`} rows={3} required value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {error ? <p role="alert" className="text-[12.5px] text-clay-500">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" loading={busy}>
          <ArrowRightLeft className="size-3.5" />
          Change supervisor
        </Button>
      </div>
    </form>
  );
}

/** Past moves of a group (or of the viewer's groups), newest first. */
export function SupervisorHistory({
  changes,
  showGroup = false,
  viewerFacultyId,
}: {
  changes: SupervisorChange[];
  showGroup?: boolean;
  /** Teachers see "moved to you" / "moved away" from their side. */
  viewerFacultyId?: string;
}) {
  return (
    <ul className="divide-y divide-sand-200/70">
      {changes.map((c) => {
        const direction =
          viewerFacultyId == null
            ? null
            : c.toFacultyId === viewerFacultyId
              ? { label: "Moved to you", tone: "bg-sage-100 text-sage-500" }
              : { label: "Moved away", tone: "bg-gold-50 text-gold-600" };
        return (
          <li key={c.id} className="px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-2 text-[13.5px] text-ink-900">
              {showGroup && c.groupNumber != null ? (
                <span className="font-semibold">Group {c.groupNumber}{c.groupName ? ` · ${c.groupName}` : ""}</span>
              ) : null}
              {direction ? (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${direction.tone}`}>{direction.label}</span>
              ) : null}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13.5px] text-ink-800">
              <span className={c.fromName ? "" : "text-stone-500"}>{c.fromName ?? "No supervisor"}</span>
              <ArrowRight className="size-3.5 text-azure-600" aria-label="to" />
              <span className="font-medium">{c.toName}</span>
              <span className="text-[12px] text-stone-500" title={formatDateTime(c.createdAt)}>· {timeAgo(c.createdAt)}</span>
            </p>
            <p className="mt-1.5 rounded-[10px] bg-ivory-200/70 px-3 py-2 text-[12.5px] whitespace-pre-line text-stone-600">
              <span className="font-semibold text-ink-800">Reason: </span>
              {c.reason}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
