-- Demo accounts and data for the PBL Portal.
-- Every account signs in with the password pbl@2026.
-- Dates are relative to the moment this runs so deadlines demo sensibly.

-- ----------------------------------------------------------- auth accounts

with accounts (id, email) as (
  values
    ('a1000000-0000-4000-8000-000000001001'::uuid, 'mihir.sanghvi@university.edu.in'),
    ('a1000000-0000-4000-8000-000000002001'::uuid, 'a.deshpande@university.edu.in'),
    ('a1000000-0000-4000-8000-000000003001'::uuid, 'r.kulkarni@university.edu.in'),
    ('a1000000-0000-4000-8000-000000009001'::uuid, 'pbl.admin@university.edu.in')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
  extensions.crypt('pbl@2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', ''
from accounts;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.id in (
  'a1000000-0000-4000-8000-000000001001', 'a1000000-0000-4000-8000-000000002001',
  'a1000000-0000-4000-8000-000000003001', 'a1000000-0000-4000-8000-000000009001'
);

insert into public.profiles (id, email, role, display_name, profile_id) values
  ('a1000000-0000-4000-8000-000000001001', 'mihir.sanghvi@university.edu.in', 'student', 'Mihir Sanghvi', 's-2201'),
  ('a1000000-0000-4000-8000-000000002001', 'a.deshpande@university.edu.in', 'faculty', 'Dr. Anagha Deshpande', 'f-301'),
  ('a1000000-0000-4000-8000-000000003001', 'r.kulkarni@university.edu.in', 'supervisor', 'Dr. Ramesh Kulkarni', 'f-302'),
  ('a1000000-0000-4000-8000-000000009001', 'pbl.admin@university.edu.in', 'admin', 'PBL Office', 'adm-1');

-- ------------------------------------------------------------------ people

insert into public.faculty (id, user_id, full_name, faculty_code, department, designation, email, contact_number, office_location) values
  ('f-301', 'a1000000-0000-4000-8000-000000002001', 'Dr. Anagha Deshpande', 'FAC-CSE-0147',
   'Computer Science & Engineering', 'Associate Professor · PBL Coordinator',
   'a.deshpande@university.edu.in', '+91 98220 41178', 'Block C, Cabin 214 · Mon–Fri, 2:00–4:00 PM'),
  ('f-302', 'a1000000-0000-4000-8000-000000003001', 'Dr. Ramesh Kulkarni', 'FAC-CSE-0032',
   'Computer Science & Engineering', 'Professor & Head · PBL Supervisor',
   'r.kulkarni@university.edu.in', '+91 98220 10094', 'Block C, Cabin 101');

insert into public.projects (id, title, description, domain, status, progress, start_date, expected_completion_date, coordinator_id, supervisor_id, team_id, repository_url) values
  ('p-501', 'AI-Based Crop Disease Detection',
   'A field-deployable system that identifies crop leaf diseases from smartphone photographs. A convolutional model trained on the PlantVillage corpus is distilled for on-device inference, wrapped in an offline-first mobile client so that farmers in low-connectivity districts receive a diagnosis and a treatment recommendation within seconds of capture. The project covers dataset curation, model compression, mobile integration and a field validation study with the university''s agriculture department.',
   'Artificial Intelligence · Computer Vision', 'active', 65, '2026-08-12', '2026-11-20',
   'f-301', 'f-302', 't-701', 'https://github.com/pbl-cse-1184/crop-disease-detection'),
  ('p-502', 'Smart Campus Energy Monitor',
   'IoT sensors and a dashboard that track electricity use across campus blocks and flag waste.',
   'Internet of Things', 'active', 48, '2026-08-12', '2026-11-20', 'f-301', 'f-302', 't-702', null),
  ('p-503', 'Accessible Library Navigator',
   'An indoor navigation app that guides visually impaired students through the central library.',
   'Mobile · Accessibility', 'under_review', 72, '2026-08-12', '2026-11-20', 'f-302', 'f-301', 't-703', null);

insert into public.students (
  id, user_id, full_name, date_of_birth, gender, contact_number, personal_email, address,
  registration_number, university_email, programme, branch, specialization,
  semester, section, batch, cgpa, project_id, coordinator_id
) values (
  's-2201', 'a1000000-0000-4000-8000-000000001001', 'Mihir Sanghvi', '2005-03-14', 'male',
  '+91 90280 14422', 'sanghvimihir04@gmail.com',
  '14, Shantiniketan Residency, Civil Lines, Nagpur, Maharashtra 440001',
  'URN-2023-CSE-1184', 'mihir.sanghvi@university.edu.in', 'B.Tech',
  'Computer Science & Engineering', 'Artificial Intelligence & Machine Learning',
  5, 'B', '2023 – 2027', 8.64, 'p-501', 'f-301'
);

insert into public.teams (id, name, project_id, lead_student_id) values
  ('t-701', 'Team Kisan', 'p-501', 's-2201');

insert into public.team_members (team_id, student_id, full_name, registration_number, team_role, position) values
  ('t-701', 's-2201', 'Mihir Sanghvi', 'URN-2023-CSE-1184', 'Team Lead · Model Training', 0),
  ('t-701', 's-2202', 'Rahul Verma', 'URN-2023-CSE-1192', 'Mobile Application', 1),
  ('t-701', 's-2203', 'Aryan Pillai', 'URN-2023-CSE-1207', 'Dataset & Annotation', 2),
  ('t-701', 's-2204', 'Dhruv Mehta', 'URN-2023-CSE-1219', 'Backend & Deployment', 3);

-- --------------------------------------------------------------- deadlines

insert into public.deadlines (id, project_id, title, description, kind, due_date, status, submitted_at, weightage) values
  ('d-9001', 'p-501', 'Weekly Progress Report - Week 8',
   'Summarise the week''s model-compression experiments, note blockers, and attach the updated accuracy/latency table.',
   'weekly_progress', now() + interval '2 days', 'pending', null, 5),
  ('d-9002', 'p-501', 'PBL Review II - Mid-Term Presentation',
   'Fifteen-minute panel presentation covering problem statement, dataset, architecture and a live demonstration of the mobile client.',
   'review', now() + interval '5 days', 'pending', null, 25),
  ('d-9003', 'p-501', 'Certificate Submission - NPTEL Deep Learning',
   'Upload the course completion certificate for coordinator verification. Scanned PDF, under 5 MB.',
   'certificate', now() + interval '12 days', 'pending', null, 5),
  ('d-9004', 'p-501', 'Literature Survey Document',
   'Comparative survey of at least twelve papers on plant-disease classification, in IEEE format.',
   'document', now() - interval '3 days', 'under_review', now() - interval '4 days', 10),
  ('d-9005', 'p-501', 'Weekly Progress Report - Week 7',
   'Dataset augmentation results and baseline model metrics.',
   'weekly_progress', now() - interval '5 days', 'submitted', now() - interval '6 days', 5),
  ('d-9006', 'p-501', 'Synopsis & Problem Statement',
   'Signed synopsis with the coordinator''s approval, defining scope and deliverables.',
   'document', now() - interval '28 days', 'submitted', now() - interval '30 days', 10),
  ('d-9007', 'p-501', 'Industry Mentor Consent Form',
   'Consent form signed by the external mentor, required for the field validation study.',
   'document', now() - interval '9 days', 'overdue', null, 5),
  ('d-9008', 'p-501', 'Final Project Report',
   'Complete report with results, field-study findings, and future scope. Hard and soft copy.',
   'document', now() + interval '44 days', 'pending', null, 30);

-- ----------------------------------------------------------- announcements

insert into public.announcements (id, title, body, posted_by_name, posted_by_role, posted_at, priority, attachment_name, attachment_size_label, attachment_url, project_id) values
  ('a-8001', 'Week 8 progress report submission window',
   'The Week 8 progress report must be submitted before Friday, 11:59 PM. Reports submitted after the window will be marked late and carry a deduction on the continuous-assessment component. Please attach your updated experiment log along with the report - several teams omitted it last week.',
   'Dr. Anagha Deshpande', 'faculty', now() - interval '1 day', 'urgent', null, null, null, 'p-501'),
  ('a-8002', 'PBL Review II schedule published',
   'The mid-term review panel schedule for all Semester 5 teams is now available. Team Kisan is slotted on 9 October at 11:20 AM in Seminar Hall 2. Each team gets fifteen minutes for presentation and five for questions. Bring a working demonstration - slides alone will not be evaluated.',
   'Dr. Ramesh Kulkarni', 'supervisor', now() - interval '2 days', 'important',
   'PBL-Review-II-Schedule.pdf', '248 KB', '#', null),
  ('a-8003', 'Certificate verification drive',
   'Students who have completed online certifications relevant to their project domain should upload them before 16 October. Verified certificates contribute to the professional-development component of your PBL evaluation.',
   'Dr. Anagha Deshpande', 'faculty', now() - interval '4 days', 'normal', null, null, null, null),
  ('a-8004', 'GPU lab extended hours during review week',
   'The AI research lab in Block C will remain open until 9:00 PM from 6 to 11 October for teams running training jobs ahead of Review II. Entry requires your library card. Jobs left unattended beyond thirty minutes may be terminated by the lab assistant.',
   'Dr. Ramesh Kulkarni', 'supervisor', now() - interval '6 days', 'normal', null, null, null, null),
  ('a-8005', 'Plagiarism policy for project documents',
   'All submitted documents are checked through the university''s similarity software. A similarity index above 15 percent, excluding references, will be returned for revision. Teams are advised to paraphrase surveyed literature rather than quote it.',
   'Dr. Ramesh Kulkarni', 'supervisor', now() - interval '11 days', 'important',
   'Academic-Integrity-Guidelines.pdf', '512 KB', '#', null);

-- ----------------------------------------------------------- notifications

insert into public.notifications (id, user_id, kind, title, body, created_at, read, href) values
  ('n-7001', 'a1000000-0000-4000-8000-000000001001', 'deadline', 'Weekly Progress Report due in 2 days',
   'Week 8 report closes Friday at 11:59 PM.', now() - interval '5 hours', false, '/student/deadlines'),
  ('n-7002', 'a1000000-0000-4000-8000-000000001001', 'announcement', 'New announcement from Dr. Anagha Deshpande',
   'Week 8 progress report submission window.', now() - interval '1 day', false, '/student/announcements'),
  ('n-7003', 'a1000000-0000-4000-8000-000000001001', 'submission', 'Literature Survey is under review',
   'Your coordinator has picked up the document for review.', now() - interval '84 hours', false, '/student/deadlines'),
  ('n-7004', 'a1000000-0000-4000-8000-000000001001', 'feedback', 'Feedback on Week 7 progress report',
   'Good augmentation results. Please quantify the latency trade-off before Review II.', now() - interval '5 days', true, '/student/project'),
  ('n-7005', 'a1000000-0000-4000-8000-000000001001', 'deadline', 'Industry Mentor Consent Form is overdue',
   'This submission passed its due date and is now flagged to your coordinator.', now() - interval '8 days', true, '/student/deadlines'),
  ('n-7006', 'a1000000-0000-4000-8000-000000001001', 'profile', 'Profile updated',
   'Your contact number was changed successfully.', now() - interval '14 days', true, '/student/profile');
