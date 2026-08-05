create table entries (
  date        text primary key,
  records     jsonb not null default '[]',
  reflection  text  not null default '',
  module_data jsonb not null default '{}',
  created_at  bigint not null,
  updated_at  bigint not null,
  user_id     uuid references auth.users default auth.uid()
);

alter table entries enable row level security;

create policy "own data" on entries
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
