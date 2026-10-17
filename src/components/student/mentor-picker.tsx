"use client";

import { useMemo, useState } from "react";
import { Mail } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Field, Select } from "@/components/ui/field";
import { listFaculty } from "@/lib/data/repository";
import type { Faculty } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

/**
 * Choose a mentor in two steps: the department, then a teacher in it. The
 * chosen teacher's details show underneath so the student can check them.
 */
export function MentorPicker({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: Faculty | null;
  onChange: (faculty: Faculty | null) => void;
}) {
  const { data: faculty, error } = useLoad(() => listFaculty(), "faculty");
  const [department, setDepartment] = useState(value?.department ?? "");

  const departments = useMemo(
    () => [...new Set((faculty ?? []).map((f) => f.department).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [faculty],
  );
  const teachers = useMemo(
    () => (faculty ?? []).filter((f) => f.department === department),
    [faculty, department],
  );

  if (error) return <p role="alert" className="text-[13px] text-clay-500">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Department" htmlFor={`${idPrefix}-dept`}>
          <Select
            id={`${idPrefix}-dept`}
            value={department}
            disabled={!faculty}
            onChange={(e) => {
              setDepartment(e.target.value);
              onChange(null);
            }}
          >
            <option value="">{faculty ? "Choose department" : "Loading…"}</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
        </Field>
        <Field label="Mentor" htmlFor={`${idPrefix}-mentor`}>
          <Select
            id={`${idPrefix}-mentor`}
            value={value?.id ?? ""}
            disabled={!department}
            onChange={(e) => onChange(teachers.find((t) => t.id === e.target.value) ?? null)}
          >
            <option value="">{department ? `Choose mentor (${teachers.length})` : "Choose a department first"}</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}{t.designation ? ` · ${t.designation}` : ""}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {value ? (
        <div className="flex items-center gap-3 rounded-[14px] bg-white/70 p-3 ring-1 ring-sand-200">
          <Avatar name={value.fullName} src={value.avatarUrl} size="md" />
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-ink-900">{value.fullName}</p>
            <p className="text-[12px] text-stone-500">{value.designation} · {value.department}</p>
            {value.email ? (
              <p className="mt-0.5 flex items-center gap-1 text-[12px] text-stone-500">
                <Mail className="size-3" aria-hidden />
                {value.email}
              </p>
            ) : null}
            {!value.onPortal ? (
              <p className="mt-1 text-[12px] text-gold-600">
                Not on the portal yet: they will see your request once their account is set up.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
