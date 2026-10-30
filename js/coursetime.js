// Course and lesson durations, computed from the content itself so they stay honest when a course changes.
// - Reading: 200 words a minute for the text, points and example note; code is read slower (about 6 lines a minute).
// - Practice: 5 minutes to type and run each lesson example; 10 minutes per exercise; 2 minutes per interview
//   question (answer out loud, then compare); 15 minutes for the quiz and flashcards.
// courseTime(c) gives { reading, practice, total } in minutes for a full course file (content/courses/<id>.json).
// content/courses/index.json carries "minutes" (= courseTime(c).total) so the course list and the study plan don't
// have to load every course; a smoke test checks that each value still matches its course.
const words = (s) => String(s || "").split(/\s+/).filter(Boolean).length;
const READ_WPM = 200, CODE_LPM = 6, TRY_EXAMPLE = 5, PER_EXERCISE = 10, PER_INTERVIEW = 2, QUIZ_AND_CARDS = 15;

export function lessonTime(l) {
  const w = [...(l.text || []), ...(l.points || []), l.example?.note].reduce((a, s) => a + words(s), 0);
  const code = l.example?.code ? l.example.code.split("\n").length : 0;
  const reading = Math.max(2, Math.ceil(w / READ_WPM + code / CODE_LPM));
  const practice = l.example ? TRY_EXAMPLE : 0;
  return { reading, practice, total: reading + practice };
}

export function courseTime(c) {
  const lessons = (c.lessons || []).map(lessonTime);
  const reading = lessons.reduce((a, x) => a + x.reading, 0);
  const practice = lessons.reduce((a, x) => a + x.practice, 0) + (c.exercises?.length || 0) * PER_EXERCISE
    + (c.interview?.length || 0) * PER_INTERVIEW + (c.cheatsheet?.length ? QUIZ_AND_CARDS : 0);
  return { reading, practice, total: reading + practice };
}

// "45 min", "1 h 20", "3 h" (rounded to 5 minutes above an hour).
export function formatMinutes(m) {
  if (m < 60) return `${Math.round(m)} min`;
  const r = Math.round(m / 5) * 5, hh = Math.floor(r / 60), mm = r % 60;
  return mm ? `${hh} h ${String(mm).padStart(2, "0")}` : `${hh} h`;
}
