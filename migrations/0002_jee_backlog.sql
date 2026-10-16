create table if not exists lecture_buckets (
  id text primary key,
  user_id text not null,
  subject text not null,
  label text not null,
  remaining integer not null,
  completed integer not null default 0,
  avg_hours double precision not null,
  sort_order integer not null
);
create index if not exists lecture_buckets_user_idx on lecture_buckets (user_id, sort_order);

create table if not exists lecture_logs (
  id text primary key,
  user_id text not null,
  bucket_id text not null,
  day date not null,
  created_at timestamptz not null default now()
);
create index if not exists lecture_logs_user_day_idx on lecture_logs (user_id, day);
create index if not exists lecture_logs_user_time_idx on lecture_logs (user_id, created_at desc);

create table if not exists question_days (
  user_id text not null,
  day date not null,
  physics integer not null default 0,
  chemistry integer not null default 0,
  maths integer not null default 0,
  primary key (user_id, day)
);

create table if not exists weak_topics (
  id text primary key,
  user_id text not null,
  subject text not null,
  name text not null,
  cleared boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists weak_topics_user_idx on weak_topics (user_id, cleared, created_at desc);

create table if not exists todos (
  id text primary key,
  user_id text not null,
  body text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists todos_user_idx on todos (user_id, done, created_at desc);

create table if not exists desk_settings (
  user_id text primary key,
  target_date date not null,
  jan_date date not null,
  april_date date,
  advanced_date date
);
