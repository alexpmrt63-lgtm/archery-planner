-- Autorise le dimanche (7) dans les créneaux et les séances.
-- À lancer une fois dans Supabase › SQL Editor. Ne supprime aucune donnée.

do $$
declare c record;
begin
  -- Retire les anciennes règles « jour entre 1 et 6 », quel que soit leur nom
  for c in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in ('public.schedule_slots'::regclass, 'public.training_sessions'::regclass)
      and pg_get_constraintdef(oid) ilike '%day_of_week%'
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;

alter table public.schedule_slots
  add constraint schedule_slots_day_of_week_check check (day_of_week between 1 and 7);

alter table public.training_sessions
  add constraint training_sessions_day_of_week_check check (day_of_week between 1 and 7);
