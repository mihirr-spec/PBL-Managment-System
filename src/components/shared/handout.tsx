"use client";

import { Download, FileText } from "lucide-react";

import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

const HANDOUT = "/PBL-III-Handout.pdf";

/**
 * The PBL course handout, viewable in place on any portal. Served straight
 * from the public assets, so no sign-in or storage check is needed to open it.
 */
export function HandoutPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="PBL Handout"
        title="The PBL"
        emphasis="handout."
        description="The course handout for the whole portal. Read it, then refer back to it any time this semester."
        scene="directory"
        action={
          <a
            href={HANDOUT}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-azure-50 px-3 py-1.5 text-[12.5px] font-medium text-azure-600 ring-1 ring-azure-100 transition-colors hover:bg-azure-50/70"
          >
            <Download className="size-3.5" />
            Open / download
          </a>
        }
      />
      <Card>
        <CardHeader title="PBL-III Handout" description="Scroll to read. Use the button above to open it full screen or keep a copy." />
        <div className="px-5 pb-5">
          <div className="overflow-hidden rounded-[14px] ring-1 ring-sand-200">
            <iframe
              src={`${HANDOUT}#view=FitH`}
              title="PBL-III Handout"
              className="h-[70vh] min-h-[420px] w-full bg-white"
            />
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-stone-500">
            <FileText className="size-3.5 text-azure-600" />
            If it does not load here, use the Open / download button.
          </p>
        </div>
      </Card>
    </div>
  );
}
