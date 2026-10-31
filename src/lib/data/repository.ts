import { isAuthRetryableFetchError } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase/client";
import type {
  Achievement,
  AchievementDocument,
  AchievementParticipant,
  LinkedInAccount,
  Announcement,
  Faculty,
  Group,
  GroupGrade,
  GroupInvitation,
  GroupMilestone,
  GroupMember,
  MentorRequest,
  MilestoneSlot,
  Notification,
  Role,
  SentInvitation,
  Student,
  StudentGrade,
  StoredFile,
  SupervisorChange,
  Ticket,
  TicketAttachment,
  TicketCategory,
  User,
  WeeklyReport,
} from "@/lib/types";

/**
 * Data access boundary.
 *
 * Every page reads and writes through these functions. Queries run as the
 * signed-in user, so row-level security in the database decides what each
 * role may see; actions with rules attached (forming a group, approving a
 * mentor request, grading) are database functions that check the caller.
 * Errors carry the database's own message so screens can show it as-is.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- rows are mapped field by field below */

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------- mappers */

const toStudent = (r: any): Student => ({
  id: r.id,
  userId: r.user_id,
  fullName: r.full_name,
  dateOfBirth: r.date_of_birth ?? "",
  gender: r.gender ?? "prefer_not_to_say",
  contactNumber: r.contact_number ?? "",
  personalEmail: r.personal_email ?? "",
  address: r.address ?? "",
  avatarUrl: r.avatar_url ?? undefined,
  registrationNumber: r.registration_number,
  universityEmail: r.university_email,
  programme: r.programme,
  branch: r.branch,
  specialization: r.specialization,
  semester: r.semester,
  section: r.section,
  batch: r.batch,
  cgpa: Number(r.cgpa),
  linkedin: r.linkedin ?? "",
});

const toFaculty = (r: any): Faculty => ({
  id: r.id,
  userId: r.user_id ?? null,
  fullName: r.full_name,
  facultyId: r.faculty_code ?? "",
  department: r.department,
  designation: r.designation,
  email: r.email ?? "",
  contactNumber: r.contact_number ?? "",
  officeLocation: r.office_location ?? "",
  expertise: r.expertise ?? "",
  profileUrl: r.profile_url ?? undefined,
  onPortal: r.user_id != null,
  maxGroups: r.max_groups ?? 7,
  avatarUrl: r.avatar_url ?? undefined,
});

const GROUP_SELECT =
  "*, group_members(student_id, team_role, students(full_name, registration_number, university_email, avatar_url, linkedin))";

const toGroup = (r: any): Group => ({
  id: r.id,
  number: r.number,
  name: r.name,
  projectTitle: r.project_title,
  projectIdea: r.project_idea,
  domain: r.domain,
  progress: r.progress,
  leaderStudentId: r.leader_student_id,
  mentorId: r.mentor_id,
  assignedAt: r.assigned_at ?? undefined,
  createdAt: r.created_at,
  reportCount: r.report_count ?? 5,
  invited: r.group_invitations
    ?.filter((i: any) => i.status === "pending")
    .map((i: any) => ({
      fullName: i.students?.full_name ?? "Student",
      registrationNumber: i.students?.registration_number ?? "",
    })),
  members: (r.group_members ?? [])
    .map(
      (m: any): GroupMember => ({
        studentId: m.student_id,
        fullName: m.students?.full_name ?? "Student",
        registrationNumber: m.students?.registration_number ?? "",
        email: m.students?.university_email ?? "",
        teamRole: m.team_role,
        avatarUrl: m.students?.avatar_url ?? undefined,
        linkedin: m.students?.linkedin ?? "",
      }),
    )
    // Leader first, then alphabetical.
    .sort((a: GroupMember, b: GroupMember) =>
      a.studentId === r.leader_student_id
        ? -1
        : b.studentId === r.leader_student_id
          ? 1
          : a.fullName.localeCompare(b.fullName),
    ),
});

/** The `files` jsonb column on a row, as uploaded files. */
const toFiles = (r: any): StoredFile[] =>
  Array.isArray(r.files)
    ? r.files
        .filter((f: any) => f && f.path && f.name)
        .map((f: any) => ({ path: String(f.path), name: String(f.name) }))
    : [];

const toReport = (r: any): WeeklyReport => ({
  id: r.id,
  groupId: r.group_id,
  week: r.week,
  summary: r.summary,
  filePath: r.file_path ?? undefined,
  fileName: r.file_name ?? undefined,
  files: toFiles(r),
  submittedBy: r.submitted_by ?? undefined,
  submittedAt: r.submitted_at,
  grade: r.grade == null ? undefined : Number(r.grade),
  feedback: r.feedback ?? undefined,
  gradedAt: r.graded_at ?? undefined,
});

const toMilestone = (r: any): GroupMilestone => ({
  slot: r.slot,
  filePath: r.file_path ?? undefined,
  fileName: r.file_name ?? undefined,
  files: toFiles(r),
  submittedBy: r.submitted_by ?? undefined,
  submittedAt: r.submitted_at,
});

const toGrade = (r: any): StudentGrade => ({
  id: r.id,
  studentId: r.student_id,
  title: r.title,
  score: Number(r.score),
  maxScore: Number(r.max_score),
  improvements: r.improvements,
  createdAt: r.created_at,
});

const toTicket = (r: any): Ticket => ({
  id: r.id,
  groupId: r.group_id,
  groupNumber: r.groups?.number,
  studentId: r.student_id,
  studentName: r.students?.full_name,
  subject: r.subject,
  body: r.body,
  category: r.category ?? "general",
  status: r.status,
  attachments: (r.ticket_attachments ?? []).map((a: any) => ({
    filePath: a.file_path,
    fileName: a.file_name,
  })),
  reply: r.reply ?? undefined,
  createdAt: r.created_at,
  repliedAt: r.replied_at ?? undefined,
  forwardedAt: r.forwarded_at ?? undefined,
  adminReply: r.admin_reply ?? undefined,
  adminRepliedAt: r.admin_replied_at ?? undefined,
  targetFacultyId: r.target_faculty_id ?? undefined,
  targetName: r.target?.full_name ?? undefined,
  currentApprovedAt: r.current_approved_at ?? undefined,
  currentNote: r.current_note ?? undefined,
  targetApprovedAt: r.target_approved_at ?? undefined,
  targetNote: r.target_note ?? undefined,
});

const toSupervisorChange = (r: any): SupervisorChange => ({
  id: r.id,
  groupId: r.group_id,
  groupNumber: r.groups?.number,
  groupName: r.groups?.name,
  fromFacultyId: r.from_faculty_id ?? undefined,
  fromName: r.from?.full_name ?? undefined,
  toFacultyId: r.to_faculty_id,
  toName: r.to?.full_name ?? "",
  reason: r.reason,
  queryId: r.query_id ?? undefined,
  createdAt: r.created_at,
});

const toAnnouncement = (r: any): Announcement => ({
  id: r.id,
  title: r.title,
  body: r.body,
  scope: r.scope,
  postedByName: r.posted_by_name,
  postedByRole: r.posted_by_role,
  attachmentPath: r.attachment_path ?? undefined,
  attachmentName: r.attachment_name ?? undefined,
  createdAt: r.created_at,
});

const toNotification = (r: any): Notification => ({
  id: r.id,
  userId: r.user_id,
  kind: r.kind,
  title: r.title,
  body: r.body,
  createdAt: r.created_at,
  read: r.read,
  href: r.href ?? undefined,
});

const toAchievement = (r: any): Achievement => ({
  id: r.id,
  studentId: r.student_id,
  student: r.students
    ? {
        fullName: r.students.full_name,
        registrationNumber: r.students.registration_number,
        programme: r.students.programme,
        branch: r.students.branch,
        semester: r.students.semester,
      }
    : undefined,
  groupNumber: r.groups?.number,
  facultyId: r.faculty_id ?? undefined,
  reviewerName: r.faculty?.full_name ?? undefined,
  category: r.category,
  template: r.template,
  title: r.title,
  description: r.description ?? "",
  answers: r.answers ?? {},
  achievedOn: r.achieved_on ?? undefined,
  documents: r.documents ?? [],
  status: r.status,
  bonusMarks: r.bonus_marks == null ? undefined : Number(r.bonus_marks),
  reviewedAt: r.reviewed_at ?? undefined,
  linkedIn: r.linkedin_post_urn
    ? { urn: r.linkedin_post_urn, postedAt: r.linkedin_posted_at, postedBy: r.linkedin_posted_by ?? "" }
    : undefined,
  linkedInRemovedAt: r.linkedin_removed_at ?? undefined,
  linkedin: r.linkedin ?? "",
  participants: (r.participants ?? []).map(
    (p: any): AchievementParticipant => ({
      name: p.name ?? "",
      registrationNumber: p.registration_number ?? "",
      studentId: p.student_id ?? undefined,
      linkedin: p.linkedin ?? "",
      inTeam: !!p.in_team,
    }),
  ),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  events: (r.achievement_events ?? [])
    .map((e: any) => ({
      id: e.id,
      actorName: e.actor_name,
      actorRole: e.actor_role,
      action: e.action,
      note: e.note ?? "",
      createdAt: e.created_at,
    }))
    .sort((a: { createdAt: string }, b: { createdAt: string }) => a.createdAt.localeCompare(b.createdAt)),
});

const safeFileName = (name: string) => name.replace(/[^\w.\-]+/g, "_");

/* ---------------------------------------------------------------- auth */

export interface Credentials {
  email: string;
  password: string;
  /** Roles the chosen sign-in tab accepts; omitted means any role. */
  roles?: Role[];
}

export type AuthResult = { ok: true; user: User } | { ok: false; error: string };

const ROLE_LABEL: Record<Role, string> = {
  student: "a student",
  faculty: "a team supervisor",
  supervisor: "a team supervisor",
  admin: "an administrator",
};

/** Builds the app's User from the auth account plus its profiles row. */
export async function loadUser(
  authUserId: string,
  lastLoginAt?: string | null,
): Promise<User | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, display_name, profile_id, avatar_url")
    .eq("id", authUserId)
    .maybeSingle();
  fail(error);
  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    role: data.role,
    displayName: data.display_name,
    profileId: data.profile_id,
    avatarUrl: data.avatar_url ?? undefined,
    lastLoginAt: lastLoginAt ?? undefined,
  };
}

/** Students sign in with @muj.manipal.edu; teachers and the PBL office with @jaipur.manipal.edu. */
export const STUDENT_DOMAIN = "@muj.manipal.edu";
export const STAFF_DOMAIN = "@jaipur.manipal.edu";

/** Null when the address is a university one, otherwise what is wrong with it. */
export function checkUniversityEmail(email: string, kind?: "student" | "staff"): string | null {
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(e)) return "Enter your full university email address.";
  const student = e.endsWith(STUDENT_DOMAIN);
  const staff = e.endsWith(STAFF_DOMAIN);
  if (kind === "student" && !student) return `Students use their ${STUDENT_DOMAIN} address.`;
  if (kind === "staff" && !staff) return `Team supervisors and administrators use their ${STAFF_DOMAIN} address.`;
  if (!student && !staff) return `Use your university email (${STUDENT_DOMAIN} or ${STAFF_DOMAIN}).`;
  return null;
}

/** MUJ student addresses end in the registration number: name.2427010544@muj.manipal.edu. */
export function registrationFromEmail(email: string): string | null {
  const local = email.trim().toLowerCase().split("@")[0] ?? "";
  return /(\d{6,})$/.exec(local)?.[1] ?? null;
}

export interface SignUpDetails {
  email: string;
  password: string;
  /** Students only - used when the university roster has no record yet. */
  fullName?: string;
  registrationNumber?: string;
  programme?: string;
  branch?: string;
  specialization?: string;
  semester?: number;
  section?: string;
  /** Supervisors and administrators - the faculty list row picked by name. */
  facultyId?: string;
}

/** A row of the MUJ faculty list, as shown while typing a name on the sign-up page. */
export interface DirectoryMatch {
  id: string;
  fullName: string;
  department: string;
  designation: string;
  email: string;
  isAdmin: boolean;
  hasAccount: boolean;
}

/** Faculty list names close to `query` (works before sign-in). */
export async function searchFacultyDirectory(query: string): Promise<DirectoryMatch[]> {
  const { data, error } = await supabase.rpc("search_faculty_directory", { p_query: query });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    fullName: String(r.full_name ?? ""),
    department: String(r.department ?? ""),
    designation: String(r.designation ?? ""),
    email: String(r.email ?? ""),
    isAdmin: Boolean(r.is_admin),
    hasAccount: Boolean(r.has_account),
  }));
}

/**
 * Creates the account. With email confirmation on in Supabase, a code is
 * emailed and `user` is null until it is entered; with it off, the account is
 * signed in straight away and `user` is set. The database decides the role
 * from the address (see the sign-up trigger) and refuses anything not MUJ.
 */
export async function signUp(
  details: SignUpDetails,
): Promise<{ ok: true; user: User | null } | { ok: false; error: string }> {
  const email = details.email.trim().toLowerCase();
  const invalid = checkUniversityEmail(email);
  if (invalid) return { ok: false, error: invalid };
  if (details.password.length < 8) return { ok: false, error: "Use a password of at least 8 characters." };

  const { data, error } = await supabase.auth.signUp({
    email,
    password: details.password,
    options: {
      emailRedirectTo: `${window.location.origin}/login?verified=1`,
      data: {
        full_name: details.fullName?.trim() ?? "",
        registration_number: details.registrationNumber?.trim() ?? "",
        programme: details.programme ?? "",
        branch: details.branch ?? "",
        specialization: details.specialization?.trim() ?? "",
        semester: details.semester ? String(details.semester) : "",
        section: details.section?.trim() ?? "",
        faculty_id: details.facultyId ?? "",
      },
    },
  });
  if (error) {
    if (error.code === "over_email_send_rate_limit") {
      return { ok: false, error: "Too many verification emails were sent just now. Please try again in a little while." };
    }
    // The sign-up trigger's own message does not reach the client.
    if (/database error/i.test(error.message)) {
      return {
        ok: false,
        error: email.endsWith(STAFF_DOMAIN)
          ? "We could not find this address in the MUJ faculty list. Contact the administrator."
          : "We could not create this account - it may already be registered, or the registration number is taken.",
      };
    }
    return { ok: false, error: error.message };
  }
  // With email confirmation on, an address that is already registered comes
  // back as a user with no identities instead of an error.
  if (data.user && (data.user.identities ?? []).length === 0) {
    return { ok: false, error: "An account with this email already exists. Sign in instead." };
  }
  // No confirmation needed: Supabase has already signed the account in.
  if (data.session && data.user) {
    const user = await loadUser(data.user.id, data.user.last_sign_in_at);
    if (!user) {
      await supabase.auth.signOut();
      return { ok: false, error: "This account has no portal profile yet. Contact your PBL coordinator." };
    }
    return { ok: true, user };
  }
  return { ok: true, user: null };
}

/**
 * Throws away a sign-up still waiting for its code, so the details can be
 * corrected and sent again. The password typed on the form proves it is theirs.
 */
export async function discardSignup(email: string, password: string): Promise<void> {
  const { error } = await supabase.rpc("discard_unverified_signup", {
    p_email: email.trim().toLowerCase(),
    p_password: password,
  });
  fail(error);
}

/** Sends the verification email (with its code) again. */
export async function resendConfirmation(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: `${window.location.origin}/login?verified=1` },
  });
  if (error?.code === "over_email_send_rate_limit") {
    return { ok: false, error: "Too many verification emails were sent just now. Please try again in a little while." };
  }
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Checks the code from the sign-up email. A code is used instead of the link
 * because Outlook's link scanner opens links before the student does, which
 * uses up a one-time link. On success the account is verified and signed in.
 */
export async function verifySignupCode(email: string, code: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.replace(/\s/g, ""),
    type: "signup",
  });
  if (error || !data.user) {
    return {
      ok: false,
      error: /expired/i.test(error?.message ?? "")
        ? "This code has expired. Send a new one and try again."
        : "That code is not right. Check the latest email and try again.",
    };
  }
  const user = await loadUser(data.user.id, data.user.last_sign_in_at);
  if (!user) {
    await supabase.auth.signOut();
    return { ok: false, error: "This account has no portal profile yet. Contact your PBL coordinator." };
  }
  return { ok: true, user };
}

// No address check here: the database only has accounts it accepted.
// Sign-up enforces the MUJ domains.
export async function authenticate({ email, password, roles }: Credentials): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error?.code === "email_not_confirmed") {
    return { ok: false, error: "Verify your email first with the code we sent to your inbox." };
  }
  // A paused or unreachable backend is not a wrong password - say so.
  if (error && (isAuthRetryableFetchError(error) || error.status === 0 || (error.status ?? 0) >= 500)) {
    return {
      ok: false,
      error:
        "Can't reach the portal's server right now, so no account can sign in. If you run this portal, check that the Supabase project is active (not paused); otherwise try again in a few minutes.",
    };
  }
  if (error || !data.user) {
    return { ok: false, error: "Incorrect email or password. Please try again." };
  }

  const user = await loadUser(data.user.id, data.user.last_sign_in_at);
  if (!user) {
    await supabase.auth.signOut();
    return { ok: false, error: "This account has no portal profile yet. Contact your PBL coordinator." };
  }
  if (roles && !roles.includes(user.role)) {
    await supabase.auth.signOut();
    return {
      ok: false,
      error: `This is ${ROLE_LABEL[user.role]} account - switch to the matching tab above to sign in.`,
    };
  }
  return { ok: true, user };
}

export async function signOutEverywhere(): Promise<void> {
  await supabase.auth.signOut();
}

export async function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (newPassword.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters." };
  }
  const check = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (check.error) return { ok: false, error: "Your current password is incorrect." };
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* ------------------------------------------------------------ students */

export async function getStudentByUserId(userId: string): Promise<Student | null> {
  const { data, error } = await supabase.from("students").select("*").eq("user_id", userId).maybeSingle();
  fail(error);
  return data ? toStudent(data) : null;
}

export async function getStudent(studentId: string): Promise<Student | null> {
  const { data, error } = await supabase.from("students").select("*").eq("id", studentId).maybeSingle();
  fail(error);
  return data ? toStudent(data) : null;
}

/** Fields a student is permitted to change. Academic data is excluded by design. */
export type EditableStudentFields = Pick<
  Student,
  "fullName" | "dateOfBirth" | "gender" | "contactNumber" | "personalEmail" | "address" | "avatarUrl"
>;

const EDITABLE_COLUMNS: Record<keyof EditableStudentFields, string> = {
  fullName: "full_name",
  dateOfBirth: "date_of_birth",
  gender: "gender",
  contactNumber: "contact_number",
  personalEmail: "personal_email",
  address: "address",
  avatarUrl: "avatar_url",
};

export async function updateStudent(
  studentId: string,
  patch: Partial<EditableStudentFields>,
): Promise<Student> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const column = EDITABLE_COLUMNS[key as keyof EditableStudentFields];
    if (!column) continue;
    // A removed photo or emptied date is stored as null; text fields as "".
    const nullable = key === "avatarUrl" || key === "dateOfBirth" || key === "gender";
    row[column] = nullable && (value === undefined || value === "") ? null : (value ?? "");
  }
  const { data, error } = await supabase.from("students").update(row).eq("id", studentId).select("*").single();
  fail(error);
  return toStudent(data);
}

/** Uploads a profile photo to the public `avatars` bucket and returns its URL. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/avatar-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
  fail(error);
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

/** Students who are not in any group yet (admin view). */
export async function listUngroupedStudents(): Promise<Student[]> {
  const { data, error } = await supabase
    .from("students")
    .select("*, group_members(group_id)")
    .order("full_name");
  fail(error);
  return (data ?? []).filter((r: any) => (r.group_members ?? []).length === 0).map(toStudent);
}

/* ------------------------------------------------------------- faculty */

export async function getFaculty(facultyId: string | null): Promise<Faculty | null> {
  if (!facultyId) return null;
  const { data, error } = await supabase.from("faculty").select("*").eq("id", facultyId).maybeSingle();
  fail(error);
  return data ? toFaculty(data) : null;
}

/** The whole directory (about 820 teachers) - filtered on the client. */
export async function listFaculty(): Promise<Faculty[]> {
  const { data, error } = await supabase
    .from("faculty")
    .select("*")
    .order("full_name")
    .range(0, 1999);
  fail(error);
  return (data ?? []).map(toFaculty);
}

/* -------------------------------------------------------------- groups */

export async function getGroup(groupId: string): Promise<Group | null> {
  const { data, error } = await supabase.from("groups").select(GROUP_SELECT).eq("id", groupId).maybeSingle();
  fail(error);
  return data ? toGroup(data) : null;
}

export async function getGroupForStudent(studentId: string): Promise<Group | null> {
  const { data: link, error } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("student_id", studentId)
    .maybeSingle();
  fail(error);
  return link ? getGroup(link.group_id) : null;
}

/** All groups, or just one teacher's. Includes members and the mentor's name. */
export async function listGroups(
  mentorId?: string,
): Promise<Array<Group & { mentorName?: string }>> {
  let query = supabase
    .from("groups")
    .select(`${GROUP_SELECT}, mentor:faculty(full_name)`)
    .order("number");
  if (mentorId) query = query.eq("mentor_id", mentorId);
  const { data, error } = await query;
  fail(error);
  return (data ?? []).map((r: any) => ({ ...toGroup(r), mentorName: r.mentor?.full_name ?? undefined }));
}

/** The caller becomes team lead; each teammate (name + registration number) is invited. */
export async function createGroup(input: {
  name: string;
  projectTitle: string;
  projectIdea: string;
  domain: string;
  teammates: Array<{ fullName: string; registrationNumber: string }>;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_group", {
    p_name: input.name,
    p_project_title: input.projectTitle,
    p_project_idea: input.projectIdea,
    p_domain: input.domain,
    p_member_regs: input.teammates.map((t) => t.registrationNumber),
    p_member_names: input.teammates.map((t) => t.fullName),
  });
  fail(error);
  return data as string;
}

/* --------------------------------------------------------- invitations */

/** Saves the team's project idea after the group has been created. */
export async function setGroupIdea(idea: string): Promise<void> {
  const { error } = await supabase.rpc("set_group_idea", { p_idea: idea });
  fail(error);
}

/** Invitations waiting for the signed-in student. */
export async function listMyInvitations(): Promise<GroupInvitation[]> {
  const { data, error } = await supabase.rpc("my_invitations");
  fail(error);
  return (data ?? []) as GroupInvitation[];
}

/** Pending and declined invitations the signed-in student's group has sent. */
export async function listSentInvitations(): Promise<SentInvitation[]> {
  const { data, error } = await supabase.rpc("group_invitations");
  fail(error);
  return (data ?? []) as SentInvitation[];
}

/** Returns "accepted" or "declined". */
export async function respondToInvitation(invitationId: string, accept: boolean): Promise<string> {
  const { data, error } = await supabase.rpc("respond_to_invitation", {
    p_invitation: invitationId,
    p_accept: accept,
  });
  fail(error);
  return data as string;
}

/** Team lead only. The name, when given, must match the registration number. */
export async function inviteMember(registrationNumber: string, fullName?: string): Promise<void> {
  const { error } = await supabase.rpc("invite_member", { p_reg: registrationNumber, p_name: fullName ?? null });
  fail(error);
}

/** Team lead only. */
export async function cancelInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_invitation", { p_invitation: invitationId });
  fail(error);
}

/* ----------------------------------------------------- mentor requests */

export async function listRequestsForGroup(groupId: string): Promise<MentorRequest[]> {
  const { data, error } = await supabase
    .from("mentor_requests")
    .select("*, faculty(full_name)")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  fail(error);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    groupId: r.group_id,
    facultyId: r.faculty_id,
    facultyName: r.faculty?.full_name ?? "",
    ...requestFields(r),
  }));
}

function requestFields(r: any) {
  return {
    message: r.message,
    status: r.status,
    formPath: r.form_path ?? undefined,
    formName: r.form_name ?? undefined,
    files: toFiles(r),
    reviewNote: r.review_note ?? "",
    createdAt: r.created_at,
    resubmittedAt: r.resubmitted_at ?? undefined,
    decidedAt: r.decided_at ?? undefined,
  };
}

/** Requests sent to one teacher, each with the requesting group's details. */
export async function listRequestsForFaculty(
  facultyId: string,
): Promise<Array<MentorRequest & { group: Group | null }>> {
  const { data, error } = await supabase
    .from("mentor_requests")
    .select(`*, groups(${GROUP_SELECT}, group_invitations(status, students!group_invitations_student_id_fkey(full_name, registration_number)))`)
    .eq("faculty_id", facultyId)
    .order("created_at", { ascending: false });
  fail(error);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    groupId: r.group_id,
    facultyId: r.faculty_id,
    facultyName: "",
    ...requestFields(r),
    group: r.groups ? toGroup(r.groups) : null,
  }));
}

async function uploadMentorForms(groupId: string, files: File[]) {
  const rows: StoredFile[] = [];
  for (const file of files) {
    const path = `${groupId}/mentor-form/${Date.now()}-${safeFileName(file.name)}`;
    const upload = await supabase.storage.from("submissions").upload(path, file, { contentType: file.type });
    fail(upload.error);
    rows.push({ path, name: file.name });
  }
  return { p_files: rows };
}

/** Team lead only: sends the signed PBL form(s) to the agreed teacher. */
export async function requestMentor(input: {
  groupId: string;
  facultyId: string;
  message: string;
  forms: File[];
}): Promise<void> {
  const files = await uploadMentorForms(input.groupId, input.forms);
  const { error } = await supabase.rpc("request_mentor", {
    p_faculty_id: input.facultyId,
    p_message: input.message,
    ...files,
  });
  fail(error);
}

/** Team lead only: sends corrected form(s) after the teacher asked for changes. */
export async function resubmitMentorRequest(input: {
  requestId: string;
  groupId: string;
  message: string;
  forms: File[];
}): Promise<void> {
  const files = await uploadMentorForms(input.groupId, input.forms);
  const { error } = await supabase.rpc("resubmit_mentor_request", {
    p_request: input.requestId,
    p_message: input.message,
    ...files,
  });
  fail(error);
}

export type MentorDecision = "approve" | "reject" | "changes";

/** Returns "approved", "rejected", "changes_requested", "already_assigned" or "full". */
export async function reviewMentorRequest(requestId: string, decision: MentorDecision, note: string): Promise<string> {
  const { data, error } = await supabase.rpc("review_mentor_request", {
    p_request: requestId,
    p_decision: decision,
    p_note: note,
  });
  fail(error);
  return data as string;
}

export async function autoAllocateMentors(): Promise<number> {
  const { data, error } = await supabase.rpc("auto_allocate_mentors");
  fail(error);
  return data as number;
}

/* ------------------------------------------------------ weekly reports */

export async function listReports(groupId: string): Promise<WeeklyReport[]> {
  const { data, error } = await supabase
    .from("weekly_reports")
    .select("*")
    .eq("group_id", groupId)
    .order("week", { ascending: false });
  fail(error);
  return (data ?? []).map(toReport);
}

/** Submits (or, until graded, replaces) a group's report for one week. */
export async function submitReport(input: {
  groupId: string;
  studentId: string;
  week: number;
  summary: string;
  files?: File[];
}): Promise<void> {
  let file: { file_path: string; file_name: string; files: StoredFile[] } | Record<string, never> = {};
  if (input.files && input.files.length > 0) {
    const rows: StoredFile[] = [];
    for (const f of input.files) {
      const path = `${input.groupId}/week-${input.week}/${Date.now()}-${safeFileName(f.name)}`;
      const upload = await supabase.storage
        .from("submissions")
        .upload(path, f, { contentType: f.type });
      fail(upload.error);
      rows.push({ path, name: f.name });
    }
    file = {
      file_path: rows[0].path,
      file_name: rows[0].name,
      files: rows,
    };
  }

  const { data: existing, error: lookupError } = await supabase
    .from("weekly_reports")
    .select("id, grade")
    .eq("group_id", input.groupId)
    .eq("week", input.week)
    .maybeSingle();
  fail(lookupError);
  if (existing?.grade != null) {
    throw new Error(`Week ${input.week} has already been graded and can no longer be changed.`);
  }

  const { error } = existing
    ? await supabase
        .from("weekly_reports")
        .update({
          summary: input.summary,
          submitted_by: input.studentId,
          submitted_at: new Date().toISOString(),
          ...file,
        })
        .eq("id", existing.id)
    : await supabase.from("weekly_reports").insert({
        group_id: input.groupId,
        week: input.week,
        summary: input.summary,
        submitted_by: input.studentId,
        ...file,
      });
  fail(error);
}

/** Supervisor or PBL office: how many weekly reports the group owes. */
export async function setReportCount(groupId: string, count: number): Promise<void> {
  const { error } = await supabase.rpc("set_report_count", { p_group: groupId, p_count: count });
  fail(error);
}

/** group id → number of reports still awaiting a grade (within what the caller can see). */
export async function countUngradedReports(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from("weekly_reports").select("group_id").is("grade", null);
  fail(error);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.group_id] = (counts[row.group_id] ?? 0) + 1;
  return counts;
}

export async function gradeReport(reportId: string, grade: number, feedback: string): Promise<void> {
  const { error } = await supabase.rpc("grade_report", {
    p_report: reportId,
    p_grade: grade,
    p_feedback: feedback,
  });
  fail(error);
}

export type FileBucket = "submissions" | "announcements" | "achievements";

/** A group's milestone uploads (midterm and endterm PPT and synopsis). */
export async function listMilestones(groupId: string): Promise<GroupMilestone[]> {
  const { data, error } = await supabase
    .from("group_milestones")
    .select("*")
    .eq("group_id", groupId)
    .order("slot");
  fail(error);
  return (data ?? []).map(toMilestone);
}

/** Uploads (or adds to) one of the group's milestone files. */
export async function submitMilestone(groupId: string, slot: MilestoneSlot, files: File[]): Promise<void> {
  if (files.length === 0) return;
  const rows: StoredFile[] = [];
  for (const file of files) {
    const path = `${groupId}/milestone-${slot}/${Date.now()}-${safeFileName(file.name)}`;
    const upload = await supabase.storage
      .from("submissions")
      .upload(path, file, { contentType: file.type });
    fail(upload.error);
    rows.push({ path, name: file.name });
  }
  const { error } = await supabase.rpc("submit_milestone", {
    p_slot: slot,
    p_files: rows,
  });
  fail(error);
}

/** The saved 100-point grading for one group, or null. */
export async function getGroupGrade(groupId: string): Promise<GroupGrade | null> {
  const { data, error } = await supabase
    .from("group_grades")
    .select("*")
    .eq("group_id", groupId)
    .maybeSingle();
  fail(error);
  if (!data) return null;
  return {
    groupId: data.group_id,
    synopsis1: data.synopsis1 == null ? null : Number(data.synopsis1),
    synopsis2: data.synopsis2 == null ? null : Number(data.synopsis2),
    weekly15: data.weekly15 == null ? null : Number(data.weekly15),
    ppt15: data.ppt15 == null ? null : Number(data.ppt15),
    design20: data.design20 == null ? null : Number(data.design20),
    ete40: data.ete40 == null ? null : Number(data.ete40),
    visible: Boolean(data.visible),
    updatedAt: data.updated_at,
  };
}

/** Makes the group's saved grading visible to its students. */
export async function publishGroupGrades(groupId: string): Promise<void> {
  const { error } = await supabase.rpc("publish_group_grades", { p_group: groupId });
  fail(error);
}

/** Corrects one student's existing mark and note. */
export async function updateStudentGrade(gradeId: string, score: number | null, improvements: string): Promise<void> {
  const { error } = await supabase.rpc("update_student_grade", {
    p_grade: gradeId,
    p_score: score,
    p_improvements: improvements,
  });
  fail(error);
}

/** Saves the group's final grading. `weekly15` may be null to keep the average. */
export async function saveGroupGrades(
  groupId: string,
  marks: {
    synopsis1: number | null;
    synopsis2: number | null;
    weekly15: number | null;
    ppt15: number | null;
    design20: number | null;
    ete40: number | null;
  },
): Promise<void> {
  const { error } = await supabase.rpc("save_group_grades", {
    p_group: groupId,
    p_s1: marks.synopsis1,
    p_s2: marks.synopsis2,
    p_weekly: marks.weekly15,
    p_ppt: marks.ppt15,
    p_design: marks.design20,
    p_ete: marks.ete40,
  });
  fail(error);
}

/** The average of the group's graded weekly reports, scaled to the 15-point component. */
export async function weeklyAverage(groupId: string): Promise<number | null> {
  const reports = await listReports(groupId);
  const graded = reports.map((r) => r.grade).filter((g): g is number => g != null);
  if (graded.length === 0) return null;
  const avg = graded.reduce((a, b) => a + b, 0) / graded.length;
  return Math.round(avg * 1.5 * 10) / 10;
}

/** Short-lived link to a private file (report or announcement attachment). */
export async function getFileUrl(bucket: FileBucket, path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10);
  fail(error);
  return data!.signedUrl;
}

/* -------------------------------------------------------------- grades */

export async function listGrades(studentIds: string[]): Promise<StudentGrade[]> {
  if (studentIds.length === 0) return [];
  const { data, error } = await supabase
    .from("student_grades")
    .select("*")
    .in("student_id", studentIds)
    .order("created_at", { ascending: false });
  fail(error);
  return (data ?? []).map(toGrade);
}

export async function gradeStudent(input: {
  studentId: string;
  title: string;
  score: number;
  maxScore: number;
  improvements: string;
}): Promise<void> {
  const { error } = await supabase.rpc("grade_student", {
    p_student: input.studentId,
    p_title: input.title,
    p_score: input.score,
    p_max: input.maxScore,
    p_improvements: input.improvements,
  });
  fail(error);
}

/* ------------------------------------------------------------- tickets */

/** Tickets the caller may see - their group's, their mentored groups', or all (admin). */
export async function listTickets(groupId?: string): Promise<Ticket[]> {
  let query = supabase
    .from("tickets")
    .select(
      "*, groups(number), students(full_name), ticket_attachments(file_path, file_name), target:faculty!tickets_target_faculty_id_fkey(full_name)",
    )
    .order("created_at", { ascending: false });
  if (groupId) query = query.eq("group_id", groupId);
  const { data, error } = await query;
  fail(error);
  return (data ?? []).map(toTicket);
}

export async function raiseTicket(input: {
  groupId: string;
  studentId: string;
  subject: string;
  body: string;
  category?: TicketCategory;
  files?: File[];
}): Promise<string> {
  const { data, error } = await supabase.from("tickets").insert({
    group_id: input.groupId,
    student_id: input.studentId,
    subject: input.subject,
    body: input.body,
    category: input.category ?? "general",
  }).select("id");
  if (error?.code === "23505") {
    throw new Error("Your group already has a change-of-supervisor request in progress.");
  }
  fail(error);
  const ticketId = String(data![0].id);
  if (input.files?.length) {
    for (const file of input.files) {
      const path = `${input.groupId}/ticket-${ticketId}/${Date.now()}-${safeFileName(file.name)}`;
      const upload = await supabase.storage
        .from("submissions")
        .upload(path, file, { contentType: file.type });
      fail(upload.error);
      const row = await supabase.from("ticket_attachments").insert({
        ticket_id: ticketId,
        file_path: path,
        file_name: file.name,
      });
      fail(row.error);
    }
  }
  return ticketId;
}

/**
 * The team lead asks to move the group to `targetId`. Both the current and the
 * requested supervisor are asked; supporting files are attached afterwards.
 */
export async function raiseSupervisorChange(input: {
  groupId: string;
  targetId: string;
  reason: string;
  files?: File[];
}): Promise<string> {
  const { data, error } = await supabase.rpc("raise_supervisor_change", {
    p_target: input.targetId,
    p_reason: input.reason,
    p_files: null,
  });
  if (error?.code === "23505") {
    throw new Error("Your group already has a change-of-supervisor request in progress.");
  }
  fail(error);
  const ticketId = String(data);
  for (const file of input.files ?? []) await addTicketAttachment(ticketId, file);
  return ticketId;
}

/** Attaches more files to an already-raised query. */
export async function addTicketAttachment(ticketId: string, file: File): Promise<void> {
  const ticket = await supabase.from("tickets").select("group_id").eq("id", ticketId).single();
  fail(ticket.error);
  if (!ticket.data) return;
  const path = `${ticket.data.group_id}/ticket-${ticketId}/${Date.now()}-${safeFileName(file.name)}`;
  const upload = await supabase.storage
    .from("submissions")
    .upload(path, file, { contentType: file.type });
  fail(upload.error);
  const row = await supabase.from("ticket_attachments").insert({
    ticket_id: ticketId,
    file_path: path,
    file_name: file.name,
  });
  fail(row.error);
}

/** A ticket's attached files. */
export async function listTicketAttachments(ticketId: string): Promise<TicketAttachment[]> {
  const { data, error } = await supabase
    .from("ticket_attachments")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at");
  fail(error);
  return (data ?? []).map((r) => ({ filePath: r.file_path, fileName: r.file_name }));
}

/* --------------------------------------------------- supervisor changes */

/** The current or the requested supervisor approves a change; the note is optional. */
export async function approveSupervisorChange(ticketId: string, note: string): Promise<void> {
  const { error } = await supabase.rpc("approve_supervisor_change", { p_ticket: ticketId, p_note: note });
  fail(error);
}

/** The current or the requested supervisor declines a change, with a reason. */
export async function declineSupervisorChange(ticketId: string, note: string): Promise<void> {
  const { error } = await supabase.rpc("decline_supervisor_change", { p_ticket: ticketId, p_note: note });
  fail(error);
}

/** The PBL office lets an at-capacity supervisor take the group anyway. */
export async function adminApproveSupervisorChange(ticketId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_approve_supervisor_change", { p_ticket: ticketId });
  fail(error);
}

/** The PBL office declines a request waiting on it, with a reason. */
export async function adminDeclineSupervisorChange(ticketId: string, note: string): Promise<void> {
  const { error } = await supabase.rpc("admin_decline_supervisor_change", { p_ticket: ticketId, p_note: note });
  fail(error);
}

/** The PBL office moves a group to another teacher, optionally closing a request. */
export async function changeSupervisor(input: {
  groupId: string;
  facultyId: string;
  reason: string;
  queryId?: string;
}): Promise<void> {
  const { error } = await supabase.rpc("change_supervisor", {
    p_group: input.groupId,
    p_faculty: input.facultyId,
    p_reason: input.reason,
    p_query: input.queryId ?? null,
  });
  fail(error);
}

const CHANGE_SELECT =
  "*, groups(number, name), from:faculty!supervisor_changes_from_faculty_id_fkey(full_name), to:faculty!supervisor_changes_to_faculty_id_fkey(full_name)";

/** Changes for one group, or (with no group) every change the caller may see. */
export async function listSupervisorChanges(groupId?: string): Promise<SupervisorChange[]> {
  let query = supabase.from("supervisor_changes").select(CHANGE_SELECT).order("created_at", { ascending: false });
  if (groupId) query = query.eq("group_id", groupId);
  const { data, error } = await query;
  fail(error);
  return (data ?? []).map(toSupervisorChange);
}

/** Teachers with a portal account, each with how many groups they supervise. */
export async function listPortalTeachers(): Promise<Array<Faculty & { groupCount: number }>> {
  const [{ data, error }, { data: groups, error: groupError }] = await Promise.all([
    supabase.from("faculty").select("*").not("user_id", "is", null).order("full_name"),
    supabase.from("groups").select("mentor_id").not("mentor_id", "is", null),
  ]);
  fail(error);
  fail(groupError);
  const counts: Record<string, number> = {};
  for (const g of groups ?? []) counts[g.mentor_id] = (counts[g.mentor_id] ?? 0) + 1;
  return (data ?? []).map((r: any) => ({ ...toFaculty(r), groupCount: counts[r.id] ?? 0 }));
}

export async function replyTicket(ticketId: string, reply: string, resolve: boolean): Promise<void> {
  const { error } = await supabase.rpc("reply_ticket", {
    p_ticket: ticketId,
    p_reply: reply,
    p_resolve: resolve,
  });
  fail(error);
}

/* -------------------------------------------------------- achievements */

const ACHIEVEMENT_SELECT =
  "*, students(full_name, registration_number, programme, branch, semester), groups(number), faculty(full_name), achievement_events(*)";

/** Every achievement the caller may see: their own, the ones they review, or all (PBL office). */
export async function listAchievements(): Promise<Achievement[]> {
  const { data, error } = await supabase
    .from("achievements")
    .select(ACHIEVEMENT_SELECT)
    .order("created_at", { ascending: false });
  fail(error);
  return (data ?? []).map(toAchievement);
}

/** Uploads supporting documents to achievements/<student id>/. */
export async function uploadAchievementFiles(studentId: string, files: File[]): Promise<AchievementDocument[]> {
  const documents: AchievementDocument[] = [];
  for (const file of files) {
    const path = `${studentId}/${Date.now()}-${safeFileName(file.name)}`;
    const upload = await supabase.storage.from("achievements").upload(path, file, { contentType: file.type });
    fail(upload.error);
    documents.push({ path, name: file.name });
  }
  return documents;
}

/** Someone added to an achievement; the server fills in the rest from the registration number. */
export type ParticipantInput = Pick<AchievementParticipant, "name" | "registrationNumber" | "linkedin">;

export interface AchievementInput {
  title: string;
  description: string;
  answers: Record<string, string>;
  achievedOn: string;
  /** The filing student's LinkedIn profile. */
  linkedin: string;
  participants: ParticipantInput[];
}

const participantRows = (people: ParticipantInput[]) =>
  people.map((p) => ({ name: p.name.trim(), registration_number: p.registrationNumber.trim(), linkedin: p.linkedin.trim() }));

/** Size in bytes of a stored file, or null when it can't be read. */
export async function getFileSize(bucket: FileBucket, path: string): Promise<number | null> {
  const slash = path.lastIndexOf("/");
  const { data } = await supabase.storage
    .from(bucket)
    .list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 1 });
  const size = data?.[0]?.metadata?.size;
  return typeof size === "number" ? size : null;
}

export async function submitAchievement(
  studentId: string,
  input: AchievementInput & { category: string; template: string; files: File[] },
): Promise<string> {
  const documents = await uploadAchievementFiles(studentId, input.files);
  const { data, error } = await supabase.rpc("submit_achievement", {
    p_category: input.category,
    p_template: input.template,
    p_title: input.title,
    p_description: input.description,
    p_answers: input.answers,
    p_achieved_on: input.achievedOn || null,
    p_documents: documents,
    p_participants: participantRows(input.participants),
    p_linkedin: input.linkedin.trim(),
  });
  fail(error);
  return data as string;
}

/** Edits the submission (adding any new files) and sends it back to the supervisor. */
export async function updateAchievement(
  studentId: string,
  achievementId: string,
  input: AchievementInput & { files: File[]; note: string },
): Promise<void> {
  const documents = await uploadAchievementFiles(studentId, input.files);
  const { error } = await supabase.rpc("update_achievement", {
    p_achievement: achievementId,
    p_title: input.title,
    p_description: input.description,
    p_answers: input.answers,
    p_achieved_on: input.achievedOn || null,
    p_new_documents: documents,
    p_note: input.note,
    p_participants: participantRows(input.participants),
    p_linkedin: input.linkedin.trim(),
  });
  fail(error);
}

export async function commentAchievement(achievementId: string, note: string): Promise<void> {
  const { error } = await supabase.rpc("comment_achievement", { p_achievement: achievementId, p_note: note });
  fail(error);
}

export type AchievementDecision = "approve" | "needs_info" | "reject";

export async function reviewAchievement(
  achievementId: string,
  decision: AchievementDecision,
  note: string,
  marks?: number,
): Promise<void> {
  const { error } = await supabase.rpc("review_achievement", {
    p_achievement: achievementId,
    p_decision: decision,
    p_note: note,
    p_marks: marks ?? null,
  });
  fail(error);
}

/* ------------------------------------------------------------ LinkedIn */

/** Calls one of the /api/linkedin route handlers as the signed-in user. */
async function linkedInApi<T>(path: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(`/api/linkedin/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error ?? `Request failed (${response.status}).`);
  return json as T;
}

/** The portal's central LinkedIn account that posts go out from, if connected (staff only). */
export async function getLinkedInAccount(): Promise<LinkedInAccount | null> {
  const { data, error } = await supabase.rpc("linkedin_account");
  fail(error);
  const row = (data as any[] | null)?.[0];
  return row
    ? {
        name: row.name,
        picture: row.picture ?? undefined,
        expiresAt: row.expires_at,
        connectedBy: row.connected_by,
        connectedAt: row.connected_at,
      }
    : null;
}

/** PBL office: sends the browser to LinkedIn to connect the central account; it comes back to `returnTo`. */
export async function connectLinkedIn(returnTo: string): Promise<void> {
  const { url } = await linkedInApi<{ url: string }>("connect", { returnTo });
  window.location.assign(url);
}

/** Second half of connecting, from /linkedin/callback. Returns where to go next. */
export async function finishLinkedInConnect(code: string, state: string): Promise<string> {
  const { returnTo } = await linkedInApi<{ returnTo: string }>("callback", { code, state });
  return returnTo;
}

/** PBL office: stop posting from the central account. */
export async function disconnectLinkedIn(): Promise<void> {
  const { error } = await supabase.rpc("disconnect_linkedin_account");
  fail(error);
}

/** Publishes an approved achievement from the central LinkedIn account; returns the post's link. */
export async function postAchievementToLinkedIn(
  achievementId: string,
  text: string,
  imagePath?: string,
): Promise<{ urn: string; url: string }> {
  return linkedInApi("post", { achievementId, text, imagePath });
}

/** Deletes the achievement's post from LinkedIn; it goes back to the supervisor's list. */
export async function removeAchievementFromLinkedIn(achievementId: string): Promise<void> {
  await linkedInApi("remove", { achievementId });
}

/** Checks posted achievements against LinkedIn; returns the ids whose post was deleted there. */
export async function checkLinkedInPosts(): Promise<string[]> {
  const { removed } = await linkedInApi<{ removed: string[] }>("check", {});
  return removed;
}

/* ------------------------------------------------------- announcements */

export async function listAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });
  fail(error);
  return (data ?? []).map(toAnnouncement);
}

export async function postAnnouncement(input: {
  user: User;
  title: string;
  body: string;
  file?: File;
}): Promise<void> {
  let attachment: { attachment_path: string; attachment_name: string } | Record<string, never> = {};
  if (input.file) {
    const path = `${input.user.id}/${Date.now()}-${safeFileName(input.file.name)}`;
    const upload = await supabase.storage
      .from("announcements")
      .upload(path, input.file, { contentType: input.file.type });
    fail(upload.error);
    attachment = { attachment_path: path, attachment_name: input.file.name };
  }
  const isAdmin = input.user.role === "admin";
  const { error } = await supabase.from("announcements").insert({
    title: input.title,
    body: input.body,
    scope: isAdmin ? "all" : "mentor_groups",
    faculty_id: isAdmin ? null : input.user.profileId,
    posted_by: input.user.id,
    posted_by_name: input.user.displayName,
    posted_by_role: input.user.role,
    ...attachment,
  });
  fail(error);
}

/* ------------------------------------------------------- notifications */

export async function getNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  fail(error);
  return (data ?? []).map(toNotification);
}

export async function setNotificationRead(notificationId: string, read: boolean): Promise<void> {
  const { error } = await supabase.from("notifications").update({ read }).eq("id", notificationId);
  fail(error);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
  fail(error);
}

/* --------------------------------------------------------------- admin */

export interface Overview {
  students: number;
  groups: number;
  unassignedGroups: number;
  teachersOnPortal: number;
  openTickets: number;
}

export async function getOverview(): Promise<Overview> {
  const count = async (table: string, filter?: (q: any) => any) => {
    let query: any = supabase.from(table).select("*", { count: "exact", head: true });
    if (filter) query = filter(query);
    const { count: n, error } = await query;
    fail(error);
    return n ?? 0;
  };
  const [students, groups, unassignedGroups, teachersOnPortal, openTickets] = await Promise.all([
    count("students"),
    count("groups"),
    count("groups", (q) => q.is("mentor_id", null)),
    count("faculty", (q) => q.not("user_id", "is", null)),
    count("tickets", (q) => q.in("status", ["open", "forwarded"])),
  ]);
  return { students, groups, unassignedGroups, teachersOnPortal, openTickets };
}
