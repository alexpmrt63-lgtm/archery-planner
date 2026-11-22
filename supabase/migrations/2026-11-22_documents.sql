-- Espace « Documents » du pôle : fichiers partagés entre le coach et les archers.
-- À lancer une fois dans Supabase (SQL Editor). Le script peut être relancé sans risque.

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'autre'
    check (category in ('administratif', 'competitions', 'stages', 'sante', 'autre')),
  file_path text not null unique,   -- emplacement dans le stockage « documents »
  file_name text not null,          -- nom d'origine du fichier
  mime_type text not null,
  size_bytes integer not null default 0,
  uploaded_by uuid references users(id) on delete set null,
  uploader_name text not null,
  uploader_role text not null default 'archer',
  pinned boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists documents_list_idx on documents (pinned desc, created_at desc);

-- Accès uniquement par le serveur de l'app (clé service) : la table est fermée au public.
alter table documents enable row level security;

-- Espace de stockage privé (10 Mo max par fichier)
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;
