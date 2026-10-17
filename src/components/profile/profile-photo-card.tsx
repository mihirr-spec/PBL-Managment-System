"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Camera, Trash2 } from "lucide-react";

import { Art } from "@/components/layout/art";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { usePortal } from "@/lib/data/portal-store";
import type { Student } from "@/lib/types";

/**
 * Photo upload to the public `avatars` storage bucket; the student record
 * keeps only the resulting URL.
 */
export function ProfilePhotoCard({ student }: { student: Student }) {
  const { updateProfile, uploadAvatar } = usePortal();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    if (file.size > 2_000_000) {
      setError("Image must be under 2 MB.");
      return;
    }

    setBusy(true);
    try {
      await uploadAvatar(file);
    } catch {
      setError("That photo could not be uploaded. Try a PNG, JPG or WebP under 2 MB.");
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    setBusy(true);
    await updateProfile({ avatarUrl: undefined });
    setBusy(false);
  }

  return (
    <Card>
      {/* Watercolour cover - the campus the student belongs to */}
      <div className="relative h-32 overflow-hidden bg-gradient-to-b from-wash-sky to-wash-low">
        <Art
          name="capitol"
          sizes="400px"
          className="animate-art-drift absolute inset-0 h-full w-full object-[center_35%]"
        />
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/80 to-transparent" />
      </div>
      <CardBody className="-mt-16 flex flex-col items-center pt-0 pb-7 text-center">
        <Avatar
          name={student.fullName}
          src={student.avatarUrl}
          size="2xl"
          className="relative ring-4 ring-white/90 shadow-[0_16px_36px_-18px_rgba(13,31,63,0.6)]"
        />

        <h2 className="mt-4 font-display text-xl tracking-tight text-ink-900">
          {student.fullName}
        </h2>
        <p className="tnum mt-0.5 text-[12.5px] text-stone-500">
          {student.registrationNumber}
        </p>
        <p className="mt-3 rounded-full bg-azure-50 px-3 py-1 text-[11.5px] font-medium text-azure-600">
          {student.programme} · Semester {student.semester}
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="size-3.5" />
            Change photo
          </Button>
          {student.avatarUrl ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={removePhoto}
            >
              <Trash2 className="size-3.5" />
              Remove
            </Button>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="mt-3 text-[12px] text-clay-500">
            {error}
          </p>
        ) : (
          <p className="mt-3 text-[11.5px] text-stone-400">
            JPG or PNG, up to 2 MB.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
