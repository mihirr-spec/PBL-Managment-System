"use client";

import { FacultyDirectory } from "@/components/shared/faculty-directory";
import { PageHeader } from "@/components/ui/page-header";

export default function StudentFacultyPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Faculty Directory"
        title="Find a"
        emphasis="supervisor."
        description="Every MUJ faculty member with their department, email and area of expertise."
        scene="directory"
      />
      <FacultyDirectory />
    </div>
  );
}
