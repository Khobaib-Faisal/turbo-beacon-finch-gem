create table if not exists jee_test_attempts (
  id text primary key,
  user_id text not null,
  title text not null,
  mode text not null check (mode in ('jee-main', 'custom')),
  duration_seconds integer not null,
  elapsed_seconds integer not null default 0,
  question_snapshot jsonb not null,
  answer_snapshot jsonb not null default '{}'::jsonb,
  analysis_snapshot jsonb,
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

create index if not exists jee_test_attempts_user_submitted_idx
  on jee_test_attempts (user_id, submitted_at desc);
