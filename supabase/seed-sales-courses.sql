-- Sales courses on the Sales roadmap (2026-11-19): the steps open the four HelloKhedma sales courses first.
-- Same rows as the block "HelloKhedma courses on the roadmaps" in supabase/seed.sql. Safe to run twice.
update public.training_steps s set course_id = v.c from (values
  ('sales-foundations','HubSpot Academy sales courses','sales-prospecting'),
  ('sales-foundations','Practice: an ideal customer profile and 30 target accounts','sales-prospecting'),
  ('sales-deals','Practice: a recorded mock discovery call','sales-discovery'),
  ('sales-deals','Successful Negotiation: Essential Strategies and Skills','sales-negotiation'),
  ('sales-deals','Program on Negotiation: free articles','sales-negotiation'),
  ('sales-deals','Practice: answer the ten classic objections','sales-negotiation'),
  ('sales-pipeline','Salesforce Trailhead','sales-pipeline'), ('sales-pipeline','HubSpot free CRM','sales-pipeline')
) as v(tid, title, c)
where s.id = md5(v.tid || ':' || v.title)::uuid;

-- Check: should show 13 sales steps, 11 of them linked to a course (the 2 projects are not).
select count(*) as sales_steps, count(course_id) as with_course
from public.training_steps where track_id like 'sales-%';

-- End of file. The lines below are padding: a phone copy sometimes loses the last lines of a page.
--
--
--
--
--
