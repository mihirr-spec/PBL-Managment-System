"use client";

import { AvatarEditor } from "@/components/profile/avatar-editor";
import { STUDENT_AVATAR } from "@/components/ui/avatar";
import { Card, CardBody } from "@/components/ui/card";
import { usePortal } from "@/lib/data/portal-store";
import type { Student } from "@/lib/types";

/**
 * The student's photo, name and programme. Clicking the photo changes it; the
 * file goes to the public `avatars` bucket and the student record keeps its URL.
 */
export function ProfilePhotoCard({ student }: { student: Student }) {
  const { updateProfile, uploadAvatar } = usePortal();

  return (
    <Card>
      {/* Plain sky-wash cover behind the photo */}
      <div className="relative h-32 overflow-hidden bg-gradient-to-b from-wash-sky to-wash-low">
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/80 to-transparent" />
      </div>
      <CardBody className="-mt-16 flex flex-col items-center pt-0 pb-7 text-center">
        <AvatarEditor
          name={student.fullName}
          src={student.avatarUrl ?? STUDENT_AVATAR}
          onPick={uploadAvatar}
          onRemove={student.avatarUrl ? () => updateProfile({ avatarUrl: undefined }) : undefined}
        />

        <h2 className="mt-2 font-display text-xl tracking-tight text-ink-900">{student.fullName}</h2>
        <p className="tnum mt-0.5 text-[12.5px] text-stone-500">{student.registrationNumber}</p>
        <p className="mt-3 rounded-full bg-azure-50 px-3 py-1 text-[11.5px] font-medium text-azure-600">
          {student.programme} · Semester {student.semester}
        </p>
        <p className="mt-4 text-[11.5px] text-stone-400">Click your photo to change it. JPG or PNG, up to 2 MB.</p>
      </CardBody>
    </Card>
  );
}
