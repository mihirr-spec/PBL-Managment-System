"use client";

import { useMemo, useState, type ReactNode } from "react";
import { BookOpen, ExternalLink, Mail, Search } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Card, EmptyState } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { listFaculty } from "@/lib/data/repository";
import type { Faculty } from "@/lib/types";
import { useLoad } from "@/lib/use-load";

const PAGE = 30;

/**
 * Searchable MUJ faculty directory (scraped from the university site into
 * Supabase). `action` renders an extra control per teacher - students use it
 * to request a mentor.
 */
export function FacultyDirectory({
  action,
  defaultDepartment = "",
}: {
  action?: (faculty: Faculty) => ReactNode;
  defaultDepartment?: string;
}) {
  const { data, error } = useLoad(listFaculty, "faculty");
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState(defaultDepartment);
  const [shown, setShown] = useState(PAGE);

  const departments = useMemo(
    () => [...new Set((data ?? []).map((f) => f.department).filter(Boolean))].sort(),
    [data],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter(
      (f) =>
        (!department || f.department === department) &&
        (!q ||
          f.fullName.toLowerCase().includes(q) ||
          f.expertise.toLowerCase().includes(q) ||
          f.email.toLowerCase().includes(q)),
    )
      // Teachers on the portal first - they can act on a request straight away.
      .sort((a, b) => Number(b.onPortal) - Number(a.onPortal));
  }, [data, query, department]);

  if (error) return <Card><EmptyState title="Could not load the directory" description={error} /></Card>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_18rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
            placeholder="Search by name, email or expertise (e.g. machine learning)"
            className="h-11 pl-9"
            aria-label="Search faculty"
          />
        </div>
        <Select
          value={department}
          onChange={(e) => {
            setDepartment(e.target.value);
            setShown(PAGE);
          }}
          className="h-11"
          aria-label="Department"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
      </div>

      {!data ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : (
        <>
          <p className="text-[12.5px] text-stone-500">
            {matches.length} of {data.length} faculty
          </p>
          {matches.length === 0 ? (
            <Card>
              <EmptyState title="No one matches" description="Try a different name, department or topic." />
            </Card>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {matches.slice(0, shown).map((f) => (
                <li
                  key={f.id}
                  className="flex flex-col gap-3 rounded-[18px] border border-white/70 bg-white/70 p-4 shadow-[0_16px_40px_-32px_rgba(61,78,92,0.5)] backdrop-blur-xl"
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={f.fullName} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-[16px] leading-snug tracking-tight text-ink-900">
                        {f.fullName}
                      </p>
                      <p className="text-[12px] text-stone-500">{f.designation}</p>
                      <p className="text-[12px] text-stone-500">{f.department}</p>
                    </div>
                    {f.onPortal ? (
                      <span className="shrink-0 rounded-full bg-sage-100 px-2 py-0.5 text-[10.5px] font-semibold text-sage-500">
                        On portal
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-1.5 text-[12.5px] text-stone-600">
                    {f.email ? (
                      <p className="flex items-center gap-2">
                        <Mail className="size-3.5 shrink-0 text-stone-400" />
                        <span className="truncate select-all">{f.email}</span>
                      </p>
                    ) : null}
                    {f.expertise ? (
                      <p className="flex items-start gap-2">
                        <BookOpen className="mt-0.5 size-3.5 shrink-0 text-stone-400" />
                        <span className="line-clamp-2">{f.expertise}</span>
                      </p>
                    ) : null}
                  </div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                    {f.profileUrl ? (
                      <a
                        href={f.profileUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-[12px] text-azure-600 hover:underline"
                      >
                        University profile <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span />
                    )}
                    {action ? action(f) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {shown < matches.length ? (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE)}
                className="rounded-full bg-white/75 px-4 py-2 text-[13px] font-medium text-ink-800 ring-1 ring-white hover:bg-white"
              >
                Show more ({matches.length - shown} left)
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
