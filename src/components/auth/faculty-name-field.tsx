"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { Loader2 } from "lucide-react";

import { searchFacultyDirectory, type DirectoryMatch } from "@/lib/data/repository";
import { cn } from "@/lib/utils";

/**
 * Name box that looks people up in the MUJ faculty list while they type and
 * shows each match with its department. Picking one hands the row to
 * `onPick`; typing again after a pick clears it (`onPick(null)`).
 */
export function FacultyNameField({
  id,
  value,
  onChange,
  onPick,
  adminsOnly,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onPick: (match: DirectoryMatch | null) => void;
  /** Only list people on the administrator list. */
  adminsOnly?: boolean;
  className: string;
}) {
  const listId = useId();
  const [results, setResults] = useState<{ query: string; matches: DirectoryMatch[] } | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  const query = value.trim();
  const searching = query.length >= 2 && query !== picked;

  // Waits for a short pause in typing before asking the database.
  useEffect(() => {
    if (!searching) return;
    let stale = false;
    const timer = setTimeout(() => {
      searchFacultyDirectory(query)
        .then((matches) => {
          if (!stale) setResults({ query, matches });
        })
        .catch(() => {
          if (!stale) setResults({ query, matches: [] });
        });
    }, 200);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query, searching]);

  const fresh = results?.query === query;
  const matches = (fresh ? results.matches : []).filter((m) => !adminsOnly || m.isAdmin);
  const loading = searching && !fresh;
  const showList = open && searching && (loading || fresh);

  function pick(match: DirectoryMatch) {
    if (match.hasAccount) return;
    setPicked(match.fullName);
    setOpen(false);
    onChange(match.fullName);
    onPick(match);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showList || matches.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + matches.length) % matches.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(matches[Math.min(active, matches.length - 1)]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && matches[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder="Start typing your name"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (picked) {
            setPicked(null);
            onPick(null);
          }
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={className}
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-[#c9d1dc] bg-white py-1 shadow-[0_18px_40px_-20px_rgba(13,31,63,0.45)]"
        >
          {loading ? (
            <li className="flex items-center gap-2 px-4 py-2.5 text-[13.5px] text-stone-500">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Looking up the faculty list
            </li>
          ) : matches.length === 0 ? (
            <li className="px-4 py-2.5 text-[13.5px] text-stone-500">
              {adminsOnly ? "No one on the administrator list matches." : "No one in the faculty list matches."} You can
              still type your email below.
            </li>
          ) : (
            matches.map((m, i) => (
              <li
                key={m.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                aria-disabled={m.hasAccount}
                // Picks before the input's blur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(m);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "px-4 py-2",
                  m.hasAccount ? "cursor-not-allowed opacity-55" : "cursor-pointer",
                  i === active && !m.hasAccount && "bg-azure-100/60",
                )}
              >
                <p className="text-[14px] font-medium text-ink-900">
                  {m.fullName}
                  {m.hasAccount ? <span className="ml-2 text-[12px] font-normal text-stone-500">Already has an account</span> : null}
                </p>
                <p className="truncate text-[12.5px] text-stone-500">
                  {[m.designation, m.department].filter(Boolean).join(", ")}
                </p>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
