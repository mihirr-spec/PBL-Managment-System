import {
  Award,
  Bell,
  BookOpen,
  BookUser,
  FileText,
  Inbox,
  LayoutDashboard,
  Megaphone,
  MessageCircleQuestion,
  Settings,
  Trophy,
  UserPlus,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/lib/types";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Key into the badge-count map supplied by the sidebar. */
  badge?: "notifications" | "invitations";
  /** Also highlight for nested routes under this path (e.g. a group's page). */
  matchPrefix?: string;
}

export interface NavSection {
  heading?: string;
  items: NavItem[];
}

const teacherNav: NavSection[] = [
  {
    items: [
      { label: "My Groups", href: "/faculty/dashboard", icon: UsersRound, matchPrefix: "/faculty/groups" },
      { label: "Mentor Requests", href: "/faculty/requests", icon: UserPlus },
      { label: "Queries", href: "/faculty/queries", icon: MessageCircleQuestion },
      { label: "Achievements", href: "/faculty/achievements", icon: Trophy },
      { label: "Announcements", href: "/faculty/announcements", icon: Megaphone },
      { label: "Notifications", href: "/faculty/notifications", icon: Bell, badge: "notifications" },
      { label: "PBL Handout", href: "/faculty/handout", icon: BookOpen },
    ],
  },
];

/** Navigation per role; the sidebar itself is role-agnostic. */
export const NAV_BY_ROLE: Record<Role, NavSection[]> = {
  student: [
    {
      items: [
        { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
        { label: "My Group & Mentor", href: "/student/group", icon: UsersRound },
        { label: "Requests", href: "/student/requests", icon: Inbox, badge: "invitations" },
        { label: "Weekly Reports", href: "/student/reports", icon: FileText },
        { label: "Grades & Feedback", href: "/student/grades", icon: Award },
        { label: "Achievements", href: "/student/achievements", icon: Trophy },
        { label: "Queries", href: "/student/queries", icon: MessageCircleQuestion },
      ],
    },
    {
      heading: "Stay informed",
      items: [
        { label: "Notifications", href: "/student/notifications", icon: Bell, badge: "notifications" },
        { label: "PBL Handout", href: "/student/handout", icon: BookOpen },
        { label: "Faculty Directory", href: "/student/faculty", icon: BookUser },
      ],
    },
    {
      heading: "Account",
      items: [
        { label: "My Profile", href: "/student/profile", icon: UserRound },
        { label: "Settings", href: "/student/settings", icon: Settings },
      ],
    },
  ],

  faculty: teacherNav,
  supervisor: teacherNav,

  admin: [
    {
      items: [
        { label: "Overview", href: "/admin/dashboard", icon: LayoutDashboard, matchPrefix: "/admin/groups" },
        { label: "Announcements", href: "/admin/announcements", icon: Megaphone },
        { label: "Excellence & LinkedIn", href: "/admin/achievements", icon: Trophy },
        { label: "Notifications", href: "/admin/notifications", icon: Bell, badge: "notifications" },
        { label: "PBL Handout", href: "/admin/handout", icon: BookOpen },
      ],
    },
  ],
};
