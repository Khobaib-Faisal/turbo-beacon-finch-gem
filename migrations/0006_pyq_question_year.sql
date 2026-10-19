alter table pyq_questions
  add column if not exists year integer;

update pyq_questions
set year = substring(concat_ws(' ', source, source_pdf) from '\m(20(1[3-9]|2[0-6]))\M')::integer
where year is null
  and concat_ws(' ', source, source_pdf) ~ '\m20(1[3-9]|2[0-6])\M';

create index if not exists pyq_questions_subject_chapter_year_idx
  on pyq_questions (subject, chapter, year);
