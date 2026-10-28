"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { Mail, Search, X } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Field, Input, Select } from "@/components/ui/field";
import { listFaculty } from "@/lib/data/repository";
import type { Faculty } from "@/lib/types";
import { useLoad } from "@/lib/use-load";
import { cn } from "@/lib/utils";

/** How many matches the suggestion list shows at once. */
const SHOWN = 8;

/**
 * Choose a mentor by name. Typing searches every teacher; the department is
 * optional (it only narrows the search) and fills itself in once a teacher is
 * chosen. The chosen teacher's details show underneath.
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
  const [query, setQuery] = useState(value?.fullName ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const departments = useMemo(
    () => [...new Set((faculty ?? []).map((f) => f.department).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [faculty],
  );

  const matches = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (faculty ?? []).filter(
      (f) =>
        (!department || f.department === department) &&
        words.every((w) => f.fullName.toLowerCase().includes(w)),
    );
  }, [faculty, department, query]);
  const shown = matches.slice(0, SHOWN);

  function choose(f: Faculty) {
    onChange(f);
    setDepartment(f.department);
    setQuery(f.fullName);
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setQuery("");
    setOpen(false);
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (shown.length ? (i + step + shown.length) % shown.length : 0));
    } else if (event.key === "Enter" && open && shown[active]) {
      event.preventDefault();
      choose(shown[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  if (error) return <p role="alert" className="text-[13px] text-clay-500">{error}</p>;

  const listId = `${idPrefix}-mentor-list`;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr]">
        <Field label="Department (optional)" htmlFor={`${idPrefix}-dept`}>
          <Select
            id={`${idPrefix}-dept`}
            value={department}
            disabled={!faculty}
            onChange={(e) => {
              setDepartment(e.target.value);
              // Keep the chosen teacher only if they are in the new department.
              if (value && e.target.value && value.department !== e.target.value) clear();
            }}
          >
            <option value="">{faculty ? "All departments" : "Loading…"}</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
        </Field>

        <Field label="Mentor" htmlFor={`${idPrefix}-mentor`}>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" aria-hidden />
            <Input
              id={`${idPrefix}-mentor`}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              autoComplete="off"
              disabled={!faculty}
              value={query}
              placeholder={faculty ? "Type the mentor's name" : "Loading…"}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                setOpen(true);
                if (value) onChange(null);
              }}
              onFocus={() => setOpen(true)}
              // Let a click on a suggestion land before the list closes.
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onKeyDown={onKey}
              className="pr-9 pl-9"
            />
            {query ? (
              <button
                type="button"
                onClick={clear}
                aria-label="Clear mentor"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-stone-400 hover:text-clay-500"
              >
                <X className="size-3.5" />
              </button>
            ) : null}

            {open && faculty && !value ? (
              <ul
                id={listId}
                role="listbox"
                className="absolute top-full right-0 left-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-xl bg-white py-1 shadow-[0_18px_40px_-18px_rgba(13,31,63,0.45)] ring-1 ring-sand-200"
              >
                {shown.length === 0 ? (
                  <li className="px-3 py-2.5 text-[13px] text-stone-500">
                    No faculty member matches{department ? " in this department. Try All departments." : "."}
                  </li>
                ) : (
                  shown.map((f, i) => (
                    <li
                      key={f.id}
                      role="option"
                      aria-selected={i === active}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(f)}
                      className={cn("cursor-pointer px-3 py-2", i === active && "bg-azure-50")}
                    >
                      <p className="text-[13.5px] font-medium text-ink-900">{f.fullName}</p>
                      <p className="truncate text-[12px] text-stone-500">
                        {f.designation}{f.department ? ` · ${f.department}` : ""}
                      </p>
                    </li>
                  ))
                )}
                {matches.length > SHOWN ? (
                  <li className="px-3 py-1.5 text-[11.5px] text-stone-400">
                    {matches.length - SHOWN} more: keep typing to narrow it down
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
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
