-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users profile table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Research jobs table
create table public.research_jobs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  hypothesis text not null,
  status text check (status in ('pending', 'processing', 'completed', 'failed')) default 'pending',
  pain_signals jsonb default '[]'::jsonb,
  competitors jsonb default '[]'::jsonb,
  interview_guide jsonb,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.research_jobs enable row level security;

-- Profiles policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Research jobs policies
create policy "Users can view own research jobs"
  on public.research_jobs for select
  using (auth.uid() = user_id);

create policy "Users can create own research jobs"
  on public.research_jobs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own research jobs"
  on public.research_jobs for update
  using (auth.uid() = user_id);

create policy "Users can delete own research jobs"
  on public.research_jobs for delete
  using (auth.uid() = user_id);

-- Function to handle new user creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user creation
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to update updated_at timestamp
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at();

create trigger update_research_jobs_updated_at
  before update on public.research_jobs
  for each row execute procedure public.update_updated_at();
