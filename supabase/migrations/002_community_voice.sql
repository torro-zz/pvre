-- Community Voice Module Schema

-- Reddit posts cache (to avoid re-fetching)
create table public.reddit_cache (
  id uuid default uuid_generate_v4() primary key,
  subreddit text not null,
  search_query text not null,
  posts jsonb not null,
  fetched_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '24 hours')
);

-- Index for cache lookups
create index idx_reddit_cache_lookup
  on public.reddit_cache(subreddit, search_query);

-- Index for cache expiration cleanup
create index idx_reddit_cache_expires
  on public.reddit_cache(expires_at);

-- Research results table (for storing module outputs)
create table public.research_results (
  id uuid default uuid_generate_v4() primary key,
  job_id uuid references public.research_jobs(id) on delete cascade,
  module_name text not null check (module_name in ('community_voice', 'competitor_intel', 'interview_prep')),
  data jsonb not null,
  created_at timestamptz default now()
);

-- Index for looking up results by job
create index idx_research_results_job
  on public.research_results(job_id, module_name);

-- Enable RLS on new tables
alter table public.reddit_cache enable row level security;
alter table public.research_results enable row level security;

-- Reddit cache is public (read-only, no user data)
create policy "Reddit cache is readable by authenticated users"
  on public.reddit_cache for select
  to authenticated
  using (true);

-- Only service role can insert/update cache
create policy "Service role can manage reddit cache"
  on public.reddit_cache for all
  using (auth.role() = 'service_role');

-- Research results policies - users can only see their own
create policy "Users can view own research results"
  on public.research_results for select
  using (
    job_id in (
      select id from public.research_jobs
      where user_id = auth.uid()
    )
  );

create policy "Users can create research results for own jobs"
  on public.research_results for insert
  with check (
    job_id in (
      select id from public.research_jobs
      where user_id = auth.uid()
    )
  );

-- Add module_status to research_jobs for tracking progress
alter table public.research_jobs
add column if not exists module_status jsonb default '{
  "community_voice": "pending",
  "competitor_intel": "pending",
  "interview_prep": "pending"
}'::jsonb;

-- Function to clean up expired cache entries
create or replace function public.cleanup_expired_reddit_cache()
returns void as $$
begin
  delete from public.reddit_cache
  where expires_at < now();
end;
$$ language plpgsql security definer;
