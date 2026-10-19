-- Shared JEE PYQ bank (not per-user). Imports are admin-only.
create table if not exists pyq_questions (
  id text primary key,
  subject text not null,
  chapter text not null,
  topic text,
  source text not null,
  question_number integer,
  type text not null check (type in ('mcq', 'integer')),
  question_text text not null,
  options jsonb,
  correct_answer text,
  explanation text not null default '',
  answer_verified boolean not null default false,
  needs_review boolean not null default false,
  page_number integer,
  source_pdf text,
  external_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pyq_questions_external_key_uidx
  on pyq_questions (external_key);

create index if not exists pyq_questions_subject_chapter_idx
  on pyq_questions (subject, chapter);

create index if not exists pyq_questions_chapter_idx
  on pyq_questions (chapter);
