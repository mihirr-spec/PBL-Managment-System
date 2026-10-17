import type { ReactNode } from "react";

import { PortalShell } from "@/components/layout/portal-shell";

/** Teacher portal - coordinators and supervisors both land here for now. */
export default function FacultyLayout({ children }: { children: ReactNode }) {
  return <PortalShell role={["faculty", "supervisor"]}>{children}</PortalShell>;
}
