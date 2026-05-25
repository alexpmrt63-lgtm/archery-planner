-- ============================================================
-- Schéma Supabase — Pôle France Relève Planificateur
-- À exécuter dans Supabase > SQL Editor
-- ============================================================

-- Utilisateurs (coach + archers)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  name text not null,
  role text not null check (role in ('coach', 'archer')),
  created_at timestamptz default now()
);

-- Types d'entraînement définis par le coach
create table if not exists training_types (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  color text not null default '#3b82f6',
  created_at timestamptz default now()
);

-- Créneaux extraits de l'emploi du temps scolaire (type='cours')
create table if not exists schedule_slots (
  id uuid primary key default gen_random_uuid(),
  archer_id uuid not null references users(id) on delete cascade,
  week_start date not null,
  day_of_week smallint not null check (day_of_week between 1 and 6),
  start_time time not null,
  end_time time not null,
  label text,
  type text not null default 'cours',
  created_at timestamptz default now()
);

-- Séances d'entraînement planifiées par le coach
create table if not exists training_sessions (
  id uuid primary key default gen_random_uuid(),
  archer_id uuid not null references users(id) on delete cascade,
  coach_id uuid references users(id),
  week_start date not null,
  day_of_week smallint not null check (day_of_week between 1 and 6),
  start_time time not null,
  end_time time not null,
  training_type_id uuid references training_types(id) on delete set null,
  notes text,
  created_at timestamptz default now()
);

-- Storage bucket pour les captures d'écran
insert into storage.buckets (id, name, public)
values ('schedule-images', 'schedule-images', false)
on conflict (id) do nothing;

-- RLS désactivé (le backend utilise la service key)
alter table users disable row level security;
alter table training_types disable row level security;
alter table schedule_slots disable row level security;
alter table training_sessions disable row level security;

-- Index utiles
create index if not exists idx_schedule_archer_week on schedule_slots(archer_id, week_start);
create index if not exists idx_training_archer_week on training_sessions(archer_id, week_start);
create index if not exists idx_users_role on users(role);

-- Données initiales : insérer un coach de test
-- (remplacez le hash par bcrypt de votre mot de passe)
-- insert into users (email, password_hash, name, role)
-- values ('coach@example.com', '$2b$10$...', 'Coach Dupont', 'coach');
