import {
  Award,
  CalendarClock,
  CheckCircle2,
  FileText,
  Megaphone,
  MessageCircleQuestion,
  MessageSquareQuote,
  Trophy,
  UserPlus,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import type { NotificationKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<NotificationKind, { icon: LucideIcon; className: string }> = {
  announcement: { icon: Megaphone, className: "bg-sky-100 text-sky-500" },
  report: { icon: FileText, className: "bg-azure-50 text-azure-600" },
  grade: { icon: Award, className: "bg-gold-50 text-gold-600" },
  ticket: { icon: MessageCircleQuestion, className: "bg-plum-100 text-plum-500" },
  request: { icon: UserPlus, className: "bg-sage-100 text-sage-500" },
  group: { icon: UsersRound, className: "bg-sage-100 text-sage-500" },
  profile: { icon: UserRound, className: "bg-azure-50 text-azure-600" },
  deadline: { icon: CalendarClock, className: "bg-gold-50 text-gold-600" },
  submission: { icon: CheckCircle2, className: "bg-sage-100 text-sage-500" },
  feedback: { icon: MessageSquareQuote, className: "bg-plum-100 text-plum-500" },
  achievement: { icon: Trophy, className: "bg-gold-50 text-gold-600" },
};

export function NotificationIcon({
  kind,
  className,
}: {
  kind: NotificationKind;
  className?: string;
}) {
  const { icon: Icon, className: tone } = STYLES[kind] ?? STYLES.announcement;
  return (
    <span
      className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", tone, className)}
      aria-hidden
    >
      <Icon className="size-4" />
    </span>
  );
}
