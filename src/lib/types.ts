/**
 * Domain model for the PBL Management Platform.
 *
 * Three levels: students form groups and submit work, a supervisor (teacher)
 * mentors up to seven groups and grades them, and administrators oversee
 * everything and allocate mentors to groups that have none.
 */

export type Role = "student" | "faculty" | "supervisor" | "admin";

/** Account record. Role drives both routing and navigation. */
export interface User {
  id: string;
  email: string;
  role: Role;
  displayName: string;
  avatarUrl?: string;
  /** Links to the role-specific profile record (Student.id, Faculty.id, ...). */
  profileId: string;
  lastLoginAt?: string;
}

export type Gender = "male" | "female" | "other" | "prefer_not_to_say";

export interface Student {
  id: string;
  userId: string | null;

  // Personal - student-editable
  fullName: string;
  dateOfBirth: string;
  gender: Gender;
  contactNumber: string;
  personalEmail: string;
  address: string;
  avatarUrl?: string;

  // Academic - university-controlled, read-only in the portal
  registrationNumber: string;
  universityEmail: string;
  programme: string;
  branch: string;
  specialization: string;
  semester: number;
  section: string;
  batch: string;
  cgpa: number;
  /** LinkedIn profile link, remembered from the last achievement filed. */
  linkedin: string;
}

export interface Faculty {
  id: string;
  userId: string | null;
  fullName: string;
  facultyId: string;
  department: string;
  designation: string;
  email: string;
  contactNumber: string;
  officeLocation: string;
  expertise: string;
  profileUrl?: string;
  /** True when this teacher has a portal login (can approve requests, grade). */
  onPortal: boolean;
  /** Most groups this teacher may supervise. */
  maxGroups: number;
  avatarUrl?: string;
}

export interface GroupMember {
  studentId: string;
  fullName: string;
  registrationNumber: string;
  email: string;
  teamRole: string;
  avatarUrl?: string;
  /** LinkedIn profile link, or "". */
  linkedin?: string;
}

export interface Group {
  id: string;
  /** Human-facing group number - "Group 4". */
  number: number;
  name: string;
  projectTitle: string;
  projectIdea: string;
  domain: string;
  progress: number;
  leaderStudentId: string;
  mentorId: string | null;
  assignedAt?: string;
  createdAt: string;
  /** How many weekly reports the group owes (5 by default, set by the supervisor). */
  reportCount: number;
  members: GroupMember[];
  /** Teammates invited but not joined yet (staff views). */
  invited?: Array<{ fullName: string; registrationNumber: string }>;
}

/** An invitation waiting for the signed-in student, with what they need to decide. */
export interface GroupInvitation {
  id: string;
  createdAt: string;
  group: {
    id: string;
    number: number;
    name: string;
    projectTitle: string;
    projectIdea: string;
    domain: string;
  };
  leader: { fullName: string; registrationNumber: string; email: string };
  members: Array<{ fullName: string; registrationNumber: string }>;
  /** Set once a teacher has approved the group's mentor request. */
  mentor: { fullName: string; designation: string; department: string; email: string } | null;
  /** Teachers the group is still waiting on. */
  requestedTeachers: string[];
}

/** An invitation the signed-in student's group has sent. */
export interface SentInvitation {
  id: string;
  status: "pending" | "declined";
  createdAt: string;
  decidedAt?: string;
  fullName: string;
  registrationNumber: string;
  /** False until the classmate has signed up - they see the invitation then. */
  hasAccount: boolean;
}

export type RequestStatus = "pending" | "changes_requested" | "approved" | "rejected" | "closed";

export interface MentorRequest {
  id: string;
  groupId: string;
  facultyId: string;
  facultyName: string;
  message: string;
  status: RequestStatus;
  /** The first signed PBL form, in the submissions bucket. */
  formPath?: string;
  formName?: string;
  /** Every file attached to the request (the first is formPath/formName). */
  files: StoredFile[];
  /** The teacher's note: what to change, or why it was rejected. */
  reviewNote: string;
  createdAt: string;
  resubmittedAt?: string;
  decidedAt?: string;
}

export interface WeeklyReport {
  id: string;
  groupId: string;
  week: number;
  summary: string;
  filePath?: string;
  fileName?: string;
  /** Every file submitted with this report (the first is filePath/fileName). */
  files: StoredFile[];
  submittedBy?: string;
  submittedAt: string;
  /** Out of 10, set by the mentor. */
  grade?: number;
  feedback?: string;
  gradedAt?: string;
}

/** One uploaded file in the private `submissions` bucket. */
export interface StoredFile {
  path: string;
  name: string;
}

/** One milestone slot: the PPT or synopsis due in a phase. */
export type MilestoneSlot = "mid_ppt" | "mid_synopsis" | "ete_ppt" | "ete_synopsis";

export interface GroupMilestone {
  slot: MilestoneSlot;
  filePath?: string;
  fileName?: string;
  /** Every file in this slot (the first is filePath/fileName). */
  files: StoredFile[];
  submittedBy?: string;
  submittedAt: string;
}

/** The supervisor's 100-point assessment for one group. */
export interface GroupGrade {
  groupId: string;
  /** Each 0-10; the two average to the 10-point "updated synopsis" component. */
  synopsis1: number | null;
  synopsis2: number | null;
  /** 0-15. May be null, in which case the average of the weekly grades is used. */
  weekly15: number | null;
  ppt15: number | null;
  design20: number | null;
  ete40: number | null;
  /** False until the supervisor publishes it; students see the score only after that. */
  visible: boolean;
  updatedAt: string;
}

export interface StudentGrade {
  id: string;
  studentId: string;
  title: string;
  score: number;
  maxScore: number;
  /** What the student should improve, written by the mentor. */
  improvements: string;
  createdAt: string;
}

/** open = with the supervisor; forwarded = with the PBL office. */
export type TicketStatus = "open" | "forwarded" | "resolved" | "declined";

/** A query is general, or a request to change the group's supervisor. */
export type TicketCategory = "general" | "supervisor_change";

/** One file attached to a student query. */
export interface TicketAttachment {
  filePath: string;
  fileName: string;
}

export interface Ticket {
  id: string;
  groupId: string;
  groupNumber?: number;
  studentId: string;
  studentName?: string;
  subject: string;
  body: string;
  category: TicketCategory;
  status: TicketStatus;
  /** Files the student attached: screenshots, certificates, PDFs. */
  attachments: TicketAttachment[];
  /** The supervisor's reply (or their note when reviewing a change request). */
  reply?: string;
  createdAt: string;
  repliedAt?: string;
  forwardedAt?: string;
  /** The PBL office's answer to a change-of-supervisor request. */
  adminReply?: string;
  adminRepliedAt?: string;
}

/** One move of a group from one supervisor to another, with the reason. */
export interface SupervisorChange {
  id: string;
  groupId: string;
  groupNumber?: number;
  groupName?: string;
  fromFacultyId?: string;
  fromName?: string;
  toFacultyId: string;
  toName: string;
  reason: string;
  /** Set when the change came from a student's change-of-supervisor query. */
  queryId?: string;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  /** "all" - every student (admin); "mentor_groups" - the poster's own groups. */
  scope: "all" | "mentor_groups";
  postedByName: string;
  postedByRole: Role;
  attachmentPath?: string;
  attachmentName?: string;
  createdAt: string;
}

export type NotificationKind =
  | "announcement"
  | "report"
  | "grade"
  | "ticket"
  | "request"
  | "group"
  | "profile"
  | "deadline"
  | "submission"
  | "feedback"
  | "achievement";

export interface Notification {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  /** In-app destination for the notification's primary action. */
  href?: string;
}

/** submitted = with the supervisor; needs_info = the supervisor asked for more details. */
export type AchievementStatus = "submitted" | "needs_info" | "approved" | "rejected";

export interface AchievementDocument {
  path: string;
  name: string;
}

export interface AchievementEvent {
  id: string;
  actorName: string;
  actorRole: Role;
  action: "submitted" | "resubmitted" | "comment" | "needs_info" | "approved" | "rejected" | "posted" | "unposted";
  note: string;
  createdAt: string;
}

/** Something one student achieved, reviewed by their group's supervisor. */
/** Someone who achieved it together with the student who filed it. */
export interface AchievementParticipant {
  name: string;
  registrationNumber: string;
  /** Set when they are a student on the portal. */
  studentId?: string;
  /** LinkedIn profile link, or "". */
  linkedin: string;
  /** In the filing student's team. */
  inTeam: boolean;
}

export interface Achievement {
  id: string;
  studentId: string;
  student?: Pick<Student, "fullName" | "registrationNumber" | "programme" | "branch" | "semester">;
  groupNumber?: number;
  facultyId?: string;
  reviewerName?: string;
  /** Keys into ACHIEVEMENT_CATEGORIES (src/lib/achievements.ts). */
  category: string;
  template: string;
  title: string;
  description: string;
  answers: Record<string, string>;
  achievedOn?: string;
  documents: AchievementDocument[];
  status: AchievementStatus;
  /** Out of 5, set when approved. */
  bonusMarks?: number;
  reviewedAt?: string;
  /** Set once it has been posted on LinkedIn from the portal. */
  linkedIn?: { urn: string; postedAt: string; postedBy: string };
  /** When its LinkedIn post was deleted; it then waits to be posted again. */
  linkedInRemovedAt?: string;
  /** The filing student's LinkedIn profile link, or "". */
  linkedin: string;
  /** Who achieved it with the student. Only they (and the student) are notified. */
  participants: AchievementParticipant[];
  createdAt: string;
  updatedAt: string;
  events: AchievementEvent[];
}

/** The portal's central LinkedIn account, connected by the PBL office; every achievement post goes out from it. */
export interface LinkedInAccount {
  name: string;
  picture?: string;
  expiresAt: string;
  connectedBy: string;
  connectedAt: string;
}
