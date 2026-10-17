-- Demo data for the PBL workflow. All demo logins use the password pbl@2026.
--
--   Students with logins : Mihir (in group 1), Priya, Arjun, Sneha (no group
--                          yet - use them to try forming a group)
--   Teachers             : Dr. Anagha Deshpande (mentors groups 1–4),
--                          Dr. Ramesh Kulkarni (group 5)
--   Groups 6 and 7       : no mentor yet - 6 has a pending request to Anagha,
--                          7 is waiting for the admin's random allocation.

-- Earlier notifications pointed at pages that no longer exist.
update public.notifications set href = '/student/notifications', read = true
where href in ('/student/deadlines', '/student/announcements', '/student/project');

-- --------------------------------------------- three more student logins

with accounts (id, email) as (
  values
    ('a1000000-0000-4000-8000-000000001002'::uuid, 'priya.sharma@university.edu.in'),
    ('a1000000-0000-4000-8000-000000001003'::uuid, 'arjun.mehta@university.edu.in'),
    ('a1000000-0000-4000-8000-000000001004'::uuid, 'sneha.iyer@university.edu.in')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
  extensions.crypt('pbl@2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from accounts;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.id in ('a1000000-0000-4000-8000-000000001002', 'a1000000-0000-4000-8000-000000001003',
               'a1000000-0000-4000-8000-000000001004');

insert into public.profiles (id, email, role, display_name, profile_id) values
  ('a1000000-0000-4000-8000-000000001002', 'priya.sharma@university.edu.in', 'student', 'Priya Sharma', 's-2210'),
  ('a1000000-0000-4000-8000-000000001003', 'arjun.mehta@university.edu.in', 'student', 'Arjun Mehta', 's-2211'),
  ('a1000000-0000-4000-8000-000000001004', 'sneha.iyer@university.edu.in', 'student', 'Sneha Iyer', 's-2212');

-- ------------------------------------------------------------- students
-- Only some students have logins; the rest exist so groups are realistic.

insert into public.students (id, user_id, full_name, registration_number, university_email, programme, branch, specialization, semester, section, batch, cgpa) values
  ('s-2210', 'a1000000-0000-4000-8000-000000001002', 'Priya Sharma', 'URN-2023-CSE-1301', 'priya.sharma@university.edu.in', 'B.Tech', 'Computer Science & Engineering', 'Data Science', 5, 'A', '2023 – 2027', 8.91),
  ('s-2211', 'a1000000-0000-4000-8000-000000001003', 'Arjun Mehta', 'URN-2023-CSE-1302', 'arjun.mehta@university.edu.in', 'B.Tech', 'Computer Science & Engineering', 'Cyber Security', 5, 'A', '2023 – 2027', 7.84),
  ('s-2212', 'a1000000-0000-4000-8000-000000001004', 'Sneha Iyer', 'URN-2023-CSE-1303', 'sneha.iyer@university.edu.in', 'B.Tech', 'Computer Science & Engineering', 'Artificial Intelligence & Machine Learning', 5, 'B', '2023 – 2027', 9.12),
  ('s-2202', null, 'Rahul Verma', 'URN-2023-CSE-1192', 'rahul.verma@university.edu.in', 'B.Tech', 'Computer Science & Engineering', '', 5, 'B', '2023 – 2027', 8.10),
  ('s-2203', null, 'Aryan Pillai', 'URN-2023-CSE-1207', 'aryan.pillai@university.edu.in', 'B.Tech', 'Computer Science & Engineering', '', 5, 'B', '2023 – 2027', 7.95),
  ('s-2204', null, 'Dhruv Mehta', 'URN-2023-CSE-1219', 'dhruv.mehta@university.edu.in', 'B.Tech', 'Computer Science & Engineering', '', 5, 'B', '2023 – 2027', 8.32),
  ('s-2221', null, 'Kavya Nair', 'URN-2023-CSE-1221', 'kavya.nair@university.edu.in', 'B.Tech', 'Computer Science & Engineering', '', 5, 'A', '2023 – 2027', 8.60),
  ('s-2222', null, 'Rohan Gupta', 'URN-2023-CSE-1222', 'rohan.gupta@university.edu.in', 'B.Tech', 'Computer Science & Engineering', '', 5, 'A', '2023 – 2027', 7.70),
  ('s-2223', null, 'Ishita Rao', 'URN-2023-CSE-1223', 'ishita.rao@university.edu.in', 'B.Tech', 'Computer Science & Engineering', '', 5, 'A', '2023 – 2027', 8.45),
  ('s-2224', null, 'Aditya Joshi', 'URN-2023-CSE-1224', 'aditya.joshi@university.edu.in', 'B.Tech', 'Computer Science & Engineering', '', 5, 'C', '2023 – 2027', 7.55),
  ('s-2225', null, 'Meera Pillai', 'URN-2023-CSE-1225', 'meera.pillai@university.edu.in', 'B.Tech', 'Computer Science & Engineering', '', 5, 'C', '2023 – 2027', 8.02),
  ('s-2226', null, 'Yash Agarwal', 'URN-2023-CSE-1226', 'yash.agarwal@university.edu.in', 'B.Tech', 'Computer Science & Engineering', '', 5, 'C', '2023 – 2027', 7.88),
  ('s-2227', null, 'Tanvi Kulkarni', 'URN-2023-CSE-1227', 'tanvi.kulkarni@university.edu.in', 'B.Tech', 'Computer Science & Engineering', '', 5, 'B', '2023 – 2027', 9.01),
  ('s-2228', null, 'Kabir Singh', 'URN-2023-CSE-1228', 'kabir.singh@university.edu.in', 'B.Tech', 'Computer Science & Engineering', '', 5, 'B', '2023 – 2027', 7.40),
  ('s-2229', null, 'Ananya Das', 'URN-2023-CSE-1229', 'ananya.das@university.edu.in', 'B.Tech', 'Computer Science & Engineering', '', 5, 'A', '2023 – 2027', 8.75),
  ('s-2230', null, 'Nikhil Bansal', 'URN-2023-CSE-1230', 'nikhil.bansal@university.edu.in', 'B.Tech', 'Computer Science & Engineering', '', 5, 'A', '2023 – 2027', 7.66),
  ('s-2231', null, 'Riya Chopra', 'URN-2023-CSE-1231', 'riya.chopra@university.edu.in', 'B.Tech', 'Computer Science & Engineering', '', 5, 'C', '2023 – 2027', 8.20),
  ('s-2232', null, 'Sahil Khan', 'URN-2023-CSE-1232', 'sahil.khan@university.edu.in', 'B.Tech', 'Computer Science & Engineering', '', 5, 'C', '2023 – 2027', 7.93);

-- --------------------------------------------------------------- groups

insert into public.groups (number, name, project_title, project_idea, domain, progress, leader_student_id, mentor_id, assigned_at) values
  (1, 'Team Kisan', 'AI-Based Crop Disease Detection',
   'A phone app that photographs a crop leaf and identifies the disease offline, with a treatment suggestion, for farmers in low-connectivity districts.',
   'Artificial Intelligence', 65, 's-2201', 'f-301', now() - interval '50 days'),
  (2, 'Watt Watchers', 'Smart Campus Energy Monitor',
   'IoT sensors in each campus block report electricity use to a dashboard that flags waste and idle labs.',
   'Internet of Things', 48, 's-2221', 'f-301', now() - interval '48 days'),
  (3, 'Wayfinders', 'Accessible Library Navigator',
   'An indoor navigation app with audio cues that guides visually impaired students to shelves in the central library.',
   'Mobile · Accessibility', 72, 's-2224', 'f-301', now() - interval '47 days'),
  (4, 'Campus Bazaar', 'Student Marketplace',
   'A verified buy/sell board for books, cycles and hostel essentials, restricted to university accounts.',
   'Web Development', 35, 's-2227', 'f-301', now() - interval '40 days'),
  (5, 'Green Route', 'Carpool Planner for Day Scholars',
   'Matches day scholars from the same area into carpools and estimates fuel savings.',
   'Web Development', 55, 's-2229', 'f-302', now() - interval '45 days'),
  (6, 'Hostel Helpdesk', 'Hostel Complaint Tracker',
   'Students log hostel maintenance complaints with photos; wardens see a queue with priorities and turnaround times.',
   'Web Development', 0, 's-2231', null, null),
  (7, 'Lab Buddy', 'Lab Equipment Booking',
   'A booking calendar for shared lab equipment so groups stop clashing over the same kit.',
   'Web Development', 0, 's-2203', null, null);
select setval(pg_get_serial_sequence('public.groups', 'number'), 7);

insert into public.group_members (group_id, student_id, team_role)
select g.id, m.student_id, m.team_role
from (values
  (1, 's-2201', 'Team Lead · Model Training'), (1, 's-2202', 'Mobile Application'),
  (1, 's-2204', 'Backend & Deployment'),
  (2, 's-2221', 'Team Lead'), (2, 's-2222', 'Hardware'), (2, 's-2223', 'Dashboard'),
  (3, 's-2224', 'Team Lead'), (3, 's-2225', 'Mobile'), (3, 's-2226', 'Audio & Testing'),
  (4, 's-2227', 'Team Lead'), (4, 's-2228', 'Frontend'),
  (5, 's-2229', 'Team Lead'), (5, 's-2230', 'Routing Logic'),
  (6, 's-2231', 'Team Lead'), (6, 's-2232', 'Backend'),
  (7, 's-2203', 'Team Lead')
) as m (num, student_id, team_role)
join public.groups g on g.number = m.num;

insert into public.mentor_requests (group_id, faculty_id, message)
select id, 'f-301',
  'We are building a hostel complaint tracker and would value your guidance on the database design and the warden-side workflow.'
from public.groups where number = 6;

-- ------------------------------------------------------- reports & grades

insert into public.weekly_reports (group_id, week, summary, submitted_by, submitted_at, grade, feedback, graded_at)
select g.id, r.week, r.summary, 's-2201', now() - (r.days_ago || ' days')::interval, r.grade, r.feedback,
  case when r.grade is null then null else now() - ((r.days_ago - 2) || ' days')::interval end
from (values
  (1, 'Finalised the problem statement and collected 4,000 leaf images from PlantVillage.', 28, 8.0, 'Good start. Document where each image source came from.'),
  (2, 'Trained a baseline CNN; 82% validation accuracy. Started augmentation.', 21, 8.5, 'Solid baseline. Track per-class accuracy, not just overall.'),
  (3, 'Augmentation raised accuracy to 89%. Began model compression for mobile.', 14, 7.5, 'Compression results need a latency table on an actual phone.'),
  (4, 'Quantised the model to 9 MB; on-device inference at 120 ms. Mobile UI wireframes done.', 7, null, null)
) as r (week, summary, days_ago, grade, feedback)
cross join public.groups g where g.number = 1;

insert into public.student_grades (student_id, group_id, title, score, max_score, improvements, graded_by)
select 's-2201', g.id, t.title, t.score, t.max_score, t.improvements, 'f-301'
from (values
  ('Review I - Problem & Literature', 8.5, 10, 'Strong literature survey. Tighten the scope statement - the field study is ambitious for one semester.'),
  ('Lab participation (Weeks 1–4)', 9.0, 10, 'Consistently prepared. Share your experiment logs with the team earlier.')
) as t (title, score, max_score, improvements)
cross join public.groups g where g.number = 1;

insert into public.tickets (group_id, student_id, subject, body, created_at)
select g.id, 's-2201', 'GPU lab access for training', 'Our training runs take 6+ hours. Can we get evening access to the GPU lab this week?', now() - interval '6 days'
from public.groups g where g.number = 1;
-- reply_ticket() checks who is calling, so the seed writes the reply directly.
update public.tickets set reply = 'Approved for Tue–Thu, 6–9 PM. Collect the access card from the lab office.',
  status = 'resolved', replied_at = now() - interval '5 days'
where subject = 'GPU lab access for training';

insert into public.tickets (group_id, student_id, subject, body)
select g.id, 's-2201', 'Review II slot clash', 'Our Review II slot clashes with an NPTEL proctored exam for two members. Could we move to the afternoon?'
from public.groups g where g.number = 1;

-- ---------------------------------------------------------- announcements

insert into public.announcements (title, body, scope, faculty_id, posted_by, posted_by_name, posted_by_role, created_at) values
  ('PBL Review II schedule published',
   'Mid-term reviews run 9–11 October in Seminar Halls 1 and 2. Each group gets 15 minutes plus 5 for questions. Bring a working demo.',
   'all', null, 'a1000000-0000-4000-8000-000000009001', 'PBL Office', 'admin', now() - interval '2 days'),
  ('Week 5 report: include a demo video',
   'For week 5, attach a short screen recording (under 2 minutes) of your current build along with the written summary.',
   'mentor_groups', 'f-301', 'a1000000-0000-4000-8000-000000002001', 'Dr. Anagha Deshpande', 'faculty', now() - interval '1 day');
