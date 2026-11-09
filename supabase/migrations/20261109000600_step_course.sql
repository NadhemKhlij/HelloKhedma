-- Roadmap steps that point to a HelloKhedma course (2026-11-09, owner request "learn without going elsewhere"):
-- training_steps.course_id = a course id of content/courses (or the AI track, "ai-…"). When it is set, the Training page
-- opens our course for that step (with its progress) and shows the step's outside resource as an optional extra; the
-- weekly study plan counts the course once. Filled by the "HelloKhedma courses on the roadmaps" block of seed.sql.
-- Safe to run more than once.
alter table public.training_steps add column if not exists course_id text
  check (course_id is null or course_id ~ '^[a-z0-9-]{2,40}$');
