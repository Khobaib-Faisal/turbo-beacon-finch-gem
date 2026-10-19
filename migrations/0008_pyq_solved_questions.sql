create table if not exists pyq_solved_questions (
  user_id text not null,
  question_id text not null,
  solved_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
