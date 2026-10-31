"use client";

import { ShieldCheck } from "lucide-react";

import { MentorCard } from "@/components/profile/mentor-card";
import { PersonalInfoSection } from "@/components/profile/personal-info-section";
import { ProfilePhotoCard } from "@/components/profile/profile-photo-card";
import { ChangePasswordButton } from "@/components/auth/change-password-dialog";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ReadOnlyField } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/skeleton";
import { usePortal } from "@/lib/data/portal-store";

export default function ProfilePage() {
  const { loading, student, mentor, supervisorChange } = usePortal();

  if (loading || !student) return <PageSkeleton />;

  return (
    <div>
      <PageHeader
        eyebrow="My Profile"
        title="Your student"
        emphasis="record."
        scene="profile"
        description="Personal details are yours to maintain. Academic information is issued by the university and shown here for reference."
        action={
          <ChangePasswordButton />
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-1">
          <ProfilePhotoCard student={student} />
          <MentorCard mentor={mentor} lastChange={supervisorChange} />
        </div>

        <div className="space-y-5 lg:col-span-2">
          <PersonalInfoSection student={student} />

          <Card>
            <CardHeader
              title="Academic information"
              description="Maintained by the academic office."
              action={
                <span className="flex items-center gap-1.5 rounded-full bg-azure-50 px-2.5 py-1 text-[11px] font-medium text-azure-600">
                  <ShieldCheck className="size-3.5" />
                  Read only
                </span>
              }
            />
            <CardBody className="grid gap-5 sm:grid-cols-2">
              <ReadOnlyField
                label="Registration number"
                value={<span className="tnum">{student.registrationNumber}</span>}
                locked
              />
              <ReadOnlyField
                label="University email"
                value={student.universityEmail}
                locked
              />
              <ReadOnlyField label="Programme" value={student.programme} locked />
              <ReadOnlyField label="Branch" value={student.branch} locked />
              <ReadOnlyField
                label="Specialization"
                value={student.specialization}
                locked
                className="sm:col-span-2"
              />
              <ReadOnlyField
                label="Semester"
                value={`Semester ${student.semester}`}
                locked
              />
              <ReadOnlyField
                label="Section"
                value={`Section ${student.section}`}
                locked
              />
              <ReadOnlyField label="Batch" value={student.batch} locked />
              <ReadOnlyField
                label="CGPA"
                value={
                  <span className="tnum font-semibold text-azure-600">
                    {student.cgpa.toFixed(2)}
                  </span>
                }
                locked
              />
            </CardBody>
          </Card>

          <p className="px-1 text-[12px] leading-relaxed text-stone-400">
            Found an error in your academic record? Academic data cannot be
            edited here - raise it with your coordinator or the academic office,
            and the correction will appear once processed.
          </p>
        </div>
      </div>
    </div>
  );
}
