"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Check, Megaphone, Save } from "lucide-react";

import { GradingPlanCard } from "@/components/staff/grading-plan";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth/session";
import * as repo from "@/lib/data/repository";
import type { Group, GroupGrade } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

async function loadGrading(groupId: string) {
  const group = await repo.getGroup(groupId);
  if (!group) throw new Error("This group does not exist or is not visible to you.");
  const [milestones, grade, weeklyAverage] = await Promise.all([
    repo.listMilestones(groupId),
    repo.getGroupGrade(groupId),
    repo.weeklyAverage(groupId),
  ]);
  return { group, milestones, grade, weeklyAverage };
}

/**
 * The group's final grading, in its own window. The supervisor fills in the
 * six marks; the total out of 100 updates as they type.
 */
export default function GradingPage() {
  const { user } = useSession();
  const { id: groupId } = useParams<{ id: string }>();
  const { data, error, reload } = useLoad(() => loadGrading(groupId), groupId);

  if (user?.role === "student") return <PageSkeleton />;
  if (error) {
    return (
      <div>
        <PageHeader eyebrow="Final grading" title="Could not open" emphasis="this grading." scene="team" />
        <Card>
          <EmptyState title="Could not load this grading" description={error} scene="team" />
        </Card>
      </div>
    );
  }
  if (!data) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Final grading"
        title={`Group ${data.group.number}: ${data.group.projectTitle}`}
        emphasis="assessment."
        description="Internal assessment is out of 60 (updated synopsis 10, weekly progress 15, analysis PPT 15, design and implementation 20) plus the end term exam, out of 40."
        scene="team"
      />
      <GradingPlanCard
        groupId={data.group.id}
        milestones={data.milestones}
        grade={data.grade}
        weeklyAverage={data.weeklyAverage}
        canGrade
      />
      <GradingForm group={data.group} savedGrade={data.grade} weeklyAverage={data.weeklyAverage} onReloaded={() => void reload()} />
    </div>
  );
}

/** The editable form. Mounted only once the group is loaded, so it seeds its
 *  inputs straight from any saved grade instead of an effect. */
function GradingForm({
  group,
  savedGrade,
  weeklyAverage,
  onReloaded,
}: {
  group: Group;
  savedGrade: GroupGrade | null;
  weeklyAverage: number | null;
  onReloaded: () => void;
}) {
  const [s1, setS1] = useState(savedGrade?.synopsis1 != null ? String(savedGrade.synopsis1) : "");
  const [s2, setS2] = useState(savedGrade?.synopsis2 != null ? String(savedGrade.synopsis2) : "");
  const [w, setW] = useState(savedGrade?.weekly15 != null ? String(savedGrade.weekly15) : "");
  const [ppt, setPpt] = useState(savedGrade?.ppt15 != null ? String(savedGrade.ppt15) : "");
  const [design, setDesign] = useState(savedGrade?.design20 != null ? String(savedGrade.design20) : "");
  const [ete, setEte] = useState(savedGrade?.ete40 != null ? String(savedGrade.ete40) : "");
  const [busy, setBusy] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishFlash, setPublishFlash] = useState(false);

  const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));
  const vals = { s1: num(s1), s2: num(s2), w: num(w), ppt: num(ppt), design: num(design), ete: num(ete) };
  const synopsis = [vals.s1, vals.s2].filter((x): x is number => x != null);
  const synopsisScore = synopsis.length
    ? Math.round((synopsis.reduce((a, b) => a + b, 0) / synopsis.length) * 10) / 10
    : null;
  const weeklyScore = vals.w ?? weeklyAverage;
  const internalParts = [synopsisScore, weeklyScore, vals.ppt, vals.design];
  const internal = internalParts.every((x) => x != null)
    ? Math.round((internalParts as number[]).reduce((a, b) => a + b, 0) * 10) / 10
    : null;
  const total = internal != null && vals.ete != null ? Math.round((internal + vals.ete) * 10) / 10 : null;

  async function save() {
    setBusy(true);
    setSaveError(null);
    try {
      await repo.saveGroupGrades(group.id, {
        synopsis1: vals.s1,
        synopsis2: vals.s2,
        weekly15: vals.w,
        ppt15: vals.ppt,
        design20: vals.design,
        ete40: vals.ete,
      });
      onReloaded();
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 4000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save the grading.");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setPublishing(true);
    setPublishError(null);
    try {
      await repo.publishGroupGrades(group.id);
      onReloaded();
      setPublishError(null);
      setPublishFlash(true);
      setTimeout(() => setPublishFlash(false), 4000);
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Could not publish the grading.");
    } finally {
      setPublishing(false);
    }
  }

  const published = savedGrade?.visible ?? false;

  return (
    <Card>
      <CardHeader
        title="Save the final grading"
        description="Synopsis 1 and 2 are each out of 10; they average to the 10-point updated-synopsis component. Leave weekly blank to keep the average of your graded reports."
      />
      <div className="px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Synopsis 1 (out of 10)" htmlFor="fg-s1" help="The midterm synopsis.">
            <Input id="fg-s1" type="number" min={0} max={10} step="0.5" value={s1} onChange={(e) => setS1(e.target.value)} />
          </Field>
          <Field label="Synopsis 2 (out of 10)" htmlFor="fg-s2" help="The updated, endterm synopsis.">
            <Input id="fg-s2" type="number" min={0} max={10} step="0.5" value={s2} onChange={(e) => setS2(e.target.value)} />
          </Field>
          <Field
            label="Weekly progress (out of 15)"
            htmlFor="fg-w"
            help={
              weeklyAverage != null
                ? `Blank keeps the average of your graded reports, ${weeklyAverage}/15. Set it to override.`
                : "Blank until the group's reports are graded."
            }
          >
            <Input
              id="fg-w"
              type="number"
              min={0}
              max={15}
              step="0.5"
              value={w}
              onChange={(e) => setW(e.target.value)}
              placeholder={weeklyAverage != null ? String(weeklyAverage) : "auto"}
            />
          </Field>
          <Field label="Analysis process PPT (out of 15)" htmlFor="fg-ppt">
            <Input id="fg-ppt" type="number" min={0} max={15} step="0.5" value={ppt} onChange={(e) => setPpt(e.target.value)} />
          </Field>
          <Field label="Design and implementation (out of 20)" htmlFor="fg-design">
            <Input id="fg-design" type="number" min={0} max={20} step="0.5" value={design} onChange={(e) => setDesign(e.target.value)} />
          </Field>
          <Field label="End term exam (out of 40)" htmlFor="fg-ete">
            <Input id="fg-ete" type="number" min={0} max={40} step="0.5" value={ete} onChange={(e) => setEte(e.target.value)} />
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[14px] bg-ivory-200/60 px-4 py-3 ring-1 ring-sand-200">
          <div className="flex flex-wrap gap-6 text-[13px] text-stone-600">
            <p>
              Internal <span className="tnum font-semibold text-ink-900">{internal != null ? internal : "-"}</span>
              <span className="text-stone-400">/60</span>
            </p>
            <p>
              ETE <span className="tnum font-semibold text-ink-900">{vals.ete != null ? vals.ete : "-"}</span>
              <span className="text-stone-400">/40</span>
            </p>
            <p>
              Total{" "}
              <span className={`tnum font-display text-[1.5rem] ${total != null ? "text-sage-500" : "text-stone-400"}`}>
                {total != null ? total : "-"}
              </span>
              <span className="text-stone-400">/100</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void save()} loading={busy}>
              <Save className="size-3.5" />
              Save grading
            </Button>
            <Button variant="secondary" onClick={() => void publish()} loading={publishing} disabled={!savedGrade}>
              <Megaphone className="size-3.5" />
              {published ? "Published - publish again after new marks" : "Publish to students"}
            </Button>
          </div>
        </div>

        {savedFlash ? (
          <p role="status" className="mt-3 flex items-center gap-1.5 text-[13px] text-sage-500">
            <Check className="size-4" />
            Saved.
          </p>
        ) : null}
        {publishFlash ? (
          <p role="status" className="mt-3 flex items-center gap-1.5 text-[13px] text-sage-500">
            <Check className="size-4" />
            Published - the group&apos;s students can now see this score.
          </p>
        ) : null}
        {saveError ? <p role="alert" className="mt-3 text-[13px] text-clay-500">{saveError}</p> : null}
        {publishError ? <p role="alert" className="mt-3 text-[13px] text-clay-500">{publishError}</p> : null}
      </div>
    </Card>
  );
}
