create table if not exists pyq_question_attempts (
  user_id text not null,
  attempt_id text not null,
  question_id text not null,
  subject text not null check (subject in ('physics', 'chemistry', 'maths')),
  is_correct boolean not null,
  xp_delta integer not null default 0,
  attempted_at timestamptz not null default now(),
  primary key (user_id, attempt_id)
);

create index if not exists pyq_question_attempts_user_question_idx
  on pyq_question_attempts (user_id, question_id, attempted_at desc);

create index if not exists pyq_question_attempts_user_subject_idx
  on pyq_question_attempts (user_id, subject);
