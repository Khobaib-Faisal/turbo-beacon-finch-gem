alter table desk_settings
  add column if not exists monthly_question_target integer not null default 300;

create table if not exists study_journal (
  user_id text not null,
  day date not null,
  reflection text not null default '',
  next_step text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create index if not exists study_journal_user_day_idx on study_journal (user_id, day desc);
