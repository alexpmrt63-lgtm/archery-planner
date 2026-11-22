-- Vue « Année » : compétitions et stages de la saison, planning individuel par archer.
-- À lancer une fois dans Supabase (SQL Editor). Le script peut être relancé sans risque :
-- il ne recrée rien et ne pré-remplit le calendrier que si la table est vide.

create table if not exists season_events (
  id uuid primary key default gen_random_uuid(),
  archer_id uuid not null references users(id) on delete cascade,
  -- Même valeur pour un même évènement chez plusieurs archers :
  -- permet au coach de modifier « pour tous les archers qui l'ont ».
  group_key uuid not null default gen_random_uuid(),
  title text not null,
  kind text not null default 'competition' check (kind in ('competition', 'stage')),
  color text not null default '#3b82f6',
  start_date date not null,
  end_date date not null,
  notes text,
  created_at timestamptz default now(),
  check (end_date >= start_date)
);

create index if not exists season_events_archer_idx on season_events (archer_id, start_date);
create index if not exists season_events_group_idx on season_events (group_key);

-- Une séance du planning peut venir d'un évènement (proposition « Cette semaine » de la banque)
alter table training_sessions
  add column if not exists season_event_id uuid references season_events(id) on delete set null;

-- Calendrier 2026-2027 du coach, copié pour chaque archer
with ev as materialized (
  select gen_random_uuid() as group_key, v.*
  from (values
    ('Stage PFR Boulouris',        'stage',       '#70AD47', date '2026-09-28', date '2026-10-02'),
    ('Stage Pôle Nancy',           'stage',       '#70AD47', date '2026-10-17', date '2026-10-22'),
    ('GT Open Strassen',           'competition', '#AD4ADE', date '2026-11-20', date '2026-11-22'),
    ('Nîmes',                      'competition', '#AD4ADE', date '2027-01-15', date '2027-01-17'),
    ('Stage PFR Vichy',            'stage',       '#70AD47', date '2027-02-06', date '2027-02-12'),
    ('Europe salle Samsun',        'competition', '#AD4ADE', date '2027-02-22', date '2027-02-26'),
    ('France jeunes salle',        'competition', '#AD4ADE', date '2027-02-26', date '2027-02-28'),
    ('EGP 1 Antalya (TUR)',        'competition', '#FFFF00', date '2027-03-22', date '2027-03-27'),
    ('Stage PFR',                  'stage',       '#70AD47', date '2027-04-10', date '2027-04-16'),
    ('TNJ 1',                      'competition', '#5B9BD5', date '2027-04-17', date '2027-04-18'),
    ('D1',                         'competition', '#FFC000', date '2027-04-23', date '2027-04-25'),
    ('TNJ 2',                      'competition', '#5B9BD5', date '2027-05-14', date '2027-05-16'),
    ('Junior Cup Sofia (BUL)',     'competition', '#ED7D31', date '2027-05-17', date '2027-05-22'),
    ('D1',                         'competition', '#FFC000', date '2027-05-28', date '2027-05-30'),
    ('TNJ 3',                      'competition', '#5B9BD5', date '2027-06-11', date '2027-06-13'),
    ('Jeux Européens Istanbul',    'competition', '#44546A', date '2027-06-16', date '2027-06-27'),
    ('D1',                         'competition', '#FFC000', date '2027-07-02', date '2027-07-04'),
    ('EGP 2 Catez (SLO)',          'competition', '#FFFF00', date '2027-07-19', date '2027-07-20'),
    ('France jeunes',              'competition', '#FF0000', date '2027-07-21', date '2027-07-24'),
    ('France élite',               'competition', '#FF0000', date '2027-07-24', date '2027-07-25'),
    ('Junior Cup Catez (SLO)',     'competition', '#ED7D31', date '2027-07-26', date '2027-07-31'),
    ('Monde jeunes Antalya (TUR)', 'competition', '#FF0000', date '2027-10-04', date '2027-10-10')
  ) as v(title, kind, color, start_date, end_date)
)
insert into season_events (archer_id, group_key, title, kind, color, start_date, end_date)
select u.id, ev.group_key, ev.title, ev.kind, ev.color, ev.start_date, ev.end_date
from ev
cross join users u
where u.role = 'archer'
  and not exists (select 1 from season_events);
