-- Abyssinia Games — Supabase PostgreSQL Schema & Row-Level Security
-- Virtual-Points-Only Platform (No real-money deposits, withdrawals, or gambling)

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- 1. Profiles Table (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  username text unique not null,
  display_name text not null,
  avatar_id text not null default 'lion',
  role text not null default 'player' check (role in ('player', 'admin')),
  virtual_points integer not null default 100 check (virtual_points >= 0),
  games_played integer not null default 0 check (games_played >= 0),
  wins integer not null default 0 check (wins >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  is_banned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Games Catalog Table
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  subtitle text not null,
  description text not null,
  category text not null check (category in ('Strategy', 'Arcade', 'Puzzle', 'Trivia')),
  difficulty text not null check (difficulty in ('Casual', 'Standard', 'Challenging')),
  reward_points integer not null default 25 check (reward_points >= 0),
  estimated_minutes text not null default '2-4 min',
  engine text not null check (engine in ('tictactoe', 'memory', 'snake', 'trivia', 'gebeta', 'mines', 'keno', 'bingo')),
  is_featured boolean not null default false,
  is_popular boolean not null default false,
  is_active boolean not null default true,
  play_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- 3. Game Sessions History
create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_slug text not null,
  game_title text not null,
  score integer not null default 0,
  points_earned integer not null default 0 check (points_earned >= 0),
  outcome text not null check (outcome in ('win', 'draw', 'completed', 'loss')),
  played_at timestamptz not null default now()
);

-- 4. Daily Challenges Table
create table if not exists public.daily_challenges (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  description text not null,
  game_slug text not null,
  target_value integer not null check (target_value > 0),
  reward_points integer not null check (reward_points > 0),
  active_date date not null default current_date
);

-- 5. User Challenge Progress
create table if not exists public.user_challenge_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id uuid not null references public.daily_challenges (id) on delete cascade,
  progress_value integer not null default 0 check (progress_value >= 0),
  is_claimed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, challenge_id)
);

-- Helper to check admin role safely
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_banned = false
  );
$$;

-- Trigger to auto-create profile on Supabase Auth signup (first user becomes admin)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  assigned_role text;
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    assigned_role := 'player';
  else
    assigned_role := 'admin';
  end if;

  insert into public.profiles (id, email, username, display_name, avatar_id, role, virtual_points)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_id', 'lion'),
    assigned_role,
    0
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable Row-Level Security
alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.game_sessions enable row level security;
alter table public.daily_challenges enable row level security;
alter table public.user_challenge_progress enable row level security;

-- Profiles RLS
create policy "Public leaderboard profiles readable"
  on public.profiles for select
  using (is_banned = false or auth.uid() = id or public.is_admin());

create policy "Users can update own non-privileged profile fields"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Admins can manage all profiles"
  on public.profiles for all
  using (public.is_admin());

-- Games RLS
create policy "Anyone can view active games"
  on public.games for select
  using (is_active = true or public.is_admin());

create policy "Admins can manage games"
  on public.games for all
  using (public.is_admin());

-- Game Sessions RLS
create policy "Users view own game sessions"
  on public.game_sessions for select
  using (auth.uid() = user_id or public.is_admin());

create policy "Users insert own game sessions"
  on public.game_sessions for insert
  with check (auth.uid() = user_id);

-- Daily Challenges RLS
create policy "Anyone can view daily challenges"
  on public.daily_challenges for select
  using (true);

create policy "Admins manage daily challenges"
  on public.daily_challenges for all
  using (public.is_admin());

-- User Challenge Progress RLS
create policy "Users manage own challenge progress"
  on public.user_challenge_progress for all
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- 6. Telebirr Deposit Requests (Virtual Points Top-Up Verification)
create table if not exists public.deposit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_etb integer not null check (amount_etb >= 10),
  virtual_points_requested integer not null check (virtual_points_requested > 0),
  agent_name text not null default 'kura',
  agent_phone text not null default '0911626671',
  telebirr_reference text,
  sender_phone text,
  screenshot_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint deposit_proof_required check (
    coalesce(length(trim(telebirr_reference)), 0) > 0
    or coalesce(length(trim(screenshot_url)), 0) > 0
  )
);

alter table public.deposit_requests enable row level security;

create policy "Users view own deposit requests"
  on public.deposit_requests for select
  using (auth.uid() = user_id or public.is_admin());

create policy "Users submit own deposit requests"
  on public.deposit_requests for insert
  with check (auth.uid() = user_id and status = 'pending');

create policy "Admins review deposit requests"
  on public.deposit_requests for update
  using (public.is_admin());

-- 7. Telebirr Withdrawal Requests
create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  points_requested integer not null check (points_requested >= 100),
  amount_etb numeric(10, 2) not null check (amount_etb >= 10),
  telebirr_phone text not null,
  recipient_name text not null,
  payout_reference text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.withdrawal_requests enable row level security;

create policy "Users view own withdrawal requests"
  on public.withdrawal_requests for select
  using (auth.uid() = user_id or public.is_admin());

create policy "Users submit own withdrawal requests"
  on public.withdrawal_requests for insert
  with check (auth.uid() = user_id and status = 'pending');

create policy "Admins review withdrawal requests"
  on public.withdrawal_requests for update
  using (public.is_admin());

-- 8. Server-Managed Platform State (Accessed strictly via SUPABASE_SERVICE_ROLE_KEY on backend)
create table if not exists public.platform_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.platform_state enable row level security;

-- 9. Extended Player Columns (Safe additive migration)
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists account_type text not null default 'player' check (account_type in ('player', 'agent', 'admin'));
alter table public.profiles add column if not exists player_status text not null default 'active' check (player_status in ('active', 'suspended'));
alter table public.profiles add column if not exists balance_etb numeric(14, 2) not null default 0 check (balance_etb >= 0);

create unique index if not exists idx_profiles_phone_unique on public.profiles (phone) where phone is not null and phone <> '';

-- 10. Agent Profiles (Upgraded from existing Player account; encrypted financial fields)
create table if not exists public.agent_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references public.profiles (id) on delete cascade,
  agent_code text unique,
  full_legal_name text not null,
  phone text not null,
  bank_name text not null,
  bank_account_name text not null,
  encrypted_bank_account text not null,
  encrypted_cbe_account text not null,
  encrypted_telebirr_account text not null,
  verification_status text not null default 'pending' check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  application_status text not null default 'pending' check (application_status in ('pending', 'approved', 'rejected', 'suspended')),
  rejection_reason text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_profiles_user_id on public.agent_profiles (user_id);
create index if not exists idx_agent_profiles_status on public.agent_profiles (application_status);
create unique index if not exists idx_agent_profiles_code on public.agent_profiles (agent_code) where agent_code is not null;

alter table public.agent_profiles enable row level security;

create policy "Users view own agent profile or admin"
  on public.agent_profiles for select
  using (auth.uid() = user_id or public.is_admin());

create policy "Users submit own agent profile"
  on public.agent_profiles for insert
  with check (auth.uid() = user_id);

create policy "Admins manage agent profiles"
  on public.agent_profiles for all
  using (public.is_admin());

-- 11. Multi-Level Unlimited-Depth Referral Relationships
create table if not exists public.referral_relationships (
  id uuid primary key default gen_random_uuid(),
  parent_agent_id uuid not null references public.agent_profiles (id) on delete restrict,
  referred_user_id uuid unique not null references public.profiles (id) on delete cascade,
  referral_code text not null,
  referral_type text not null default 'player' check (referral_type in ('player', 'agent')),
  is_flagged_duplicate boolean not null default false,
  fraud_flag_reason text,
  created_at timestamptz not null default now(),
  constraint no_self_referral check (parent_agent_id is not null)
);

create index if not exists idx_referral_rel_parent on public.referral_relationships (parent_agent_id);
create index if not exists idx_referral_rel_referred on public.referral_relationships (referred_user_id);
create index if not exists idx_referral_rel_code on public.referral_relationships (referral_code);

alter table public.referral_relationships enable row level security;

create policy "Users and agents view permitted referral links"
  on public.referral_relationships for select
  using (
    auth.uid() = referred_user_id
    or exists (select 1 from public.agent_profiles ap where ap.id = parent_agent_id and ap.user_id = auth.uid())
    or public.is_admin()
  );

-- 12. Referral Rewards (Non-deposit-funded promotional rewards)
create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agent_profiles (id) on delete cascade,
  referral_id uuid references public.referral_relationships (id) on delete set null,
  reward_amount numeric(14, 2) not null check (reward_amount >= 0),
  reward_status text not null default 'pending' check (reward_status in ('pending', 'approved', 'rejected', 'redeemed')),
  reward_reference text unique not null,
  policy_note text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  redeemed_at timestamptz
);

create index if not exists idx_referral_rewards_agent on public.referral_rewards (agent_id);
create index if not exists idx_referral_rewards_status on public.referral_rewards (reward_status);

alter table public.referral_rewards enable row level security;

create policy "Agents view own rewards or admin"
  on public.referral_rewards for select
  using (
    exists (select 1 from public.agent_profiles ap where ap.id = agent_id and ap.user_id = auth.uid())
    or public.is_admin()
  );

-- 13. Unified Financial Transactions Ledger
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  transaction_type text not null check (transaction_type in ('deposit', 'withdrawal', 'reward_redemption', 'bonus', 'wager', 'payout', 'adjustment')),
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'ETB',
  status text not null check (status in ('pending', 'completed', 'approved', 'rejected', 'refunded')),
  reference_number text unique not null,
  idempotency_key text unique,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_user on public.transactions (user_id, created_at desc);

alter table public.transactions enable row level security;

create policy "Users view own transactions or admin"
  on public.transactions for select
  using (auth.uid() = user_id or public.is_admin());

-- 14. Immutable Administrator Audit Logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  administrator_id uuid not null references public.profiles (id) on delete restrict,
  action text not null,
  affected_user_id uuid references public.profiles (id) on delete set null,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_admin on public.audit_logs (administrator_id, created_at desc);
create index if not exists idx_audit_logs_affected on public.audit_logs (affected_user_id, created_at desc);

alter table public.audit_logs enable row level security;

create policy "Only admins read audit logs"
  on public.audit_logs for select
  using (public.is_admin());

-- 15. Player Support Tickets & Configurable Platform Settings
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null default 'other',
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_tickets enable row level security;

create policy "Users view own support tickets or admin"
  on public.support_tickets for select
  using (auth.uid() = user_id or public.is_admin());

create policy "Users create own support tickets"
  on public.support_tickets for insert
  with check (auth.uid() = user_id);

create table if not exists public.platform_settings (
  id text primary key default 'default',
  min_deposit_etb numeric(10, 2) not null default 5.00 check (min_deposit_etb >= 1),
  min_withdrawal_etb numeric(10, 2) not null default 10.00 check (min_withdrawal_etb >= 1),
  default_min_stake_etb numeric(10, 2) not null default 0.10 check (default_min_stake_etb >= 0.10),
  agent_eligibility jsonb not null default '{}'::jsonb,
  reward_policy jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

create policy "Anyone can view public platform settings"
  on public.platform_settings for select
  using (true);

create policy "Admins manage platform settings"
  on public.platform_settings for all
  using (public.is_admin());

