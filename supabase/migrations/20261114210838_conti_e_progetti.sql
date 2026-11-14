-- Conti e progetti di Flockets.
-- Il sito funziona senza conto; il conto serve solo a ritrovare i propri progetti, anche su altri dispositivi.
-- Ognuno vede e modifica solo le proprie righe (RLS).

-- ---------------------------------------------------------------- profili
create table public.profili (
  id          uuid primary key references auth.users (id) on delete cascade,
  nome        text check (char_length(nome) <= 80),
  azienda     text check (char_length(azienda) <= 120),
  creato      timestamptz not null default now(),
  aggiornato  timestamptz not null default now()
);
comment on table public.profili is 'Dati del profilo, uno per utente.';

-- ---------------------------------------------------------------- progetti
-- Un progetto è un''analisi fatta sul sito: cosa è stato chiesto (prompt, file) e il risultato del motore,
-- quanto basta per riaprirla identica senza ricalcolare.
create table public.progetti (
  id          uuid primary key default gen_random_uuid(),
  utente      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo        text not null check (tipo in ('annuncio', 'storico', 'nuova')),
  titolo      text not null check (char_length(titolo) between 1 and 200),
  fonte       text check (char_length(fonte) <= 300),
  dal         date,
  al          date,
  riassunto   jsonb not null default '{}'::jsonb,   -- poche cifre per l'elenco (pubblico migliore, click, acquisti…)
  dati        jsonb not null,                        -- tutto quello che serve per riaprire l'analisi
  creato      timestamptz not null default now(),
  aggiornato  timestamptz not null default now(),
  constraint dati_non_enormi check (pg_column_size(dati) < 8 * 1024 * 1024)
);
comment on table public.progetti is 'Analisi salvate dagli utenti con un conto.';
create index progetti_utente_creato on public.progetti (utente, creato desc);

-- ---------------------------------------------------------------- aggiornato
create function public.tocca_aggiornato() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.aggiornato := now();
  return new;
end $$;
create trigger profili_aggiornato before update on public.profili for each row execute function public.tocca_aggiornato();
create trigger progetti_aggiornato before update on public.progetti for each row execute function public.tocca_aggiornato();

-- ---------------------------------------------------------------- profilo alla registrazione
-- Gira come proprietario perché scrive in public da un trigger su auth.users; sta in uno schema non esposto.
create schema if not exists privato;
revoke all on schema privato from public, anon, authenticated;

create function privato.nuovo_profilo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profili (id, nome)
  values (new.id, nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 80), ''));
  return new;
end $$;
revoke all on function privato.nuovo_profilo() from public, anon, authenticated;
create trigger alla_registrazione after insert on auth.users for each row execute function privato.nuovo_profilo();

-- ---------------------------------------------------------------- accesso (Data API + RLS)
alter table public.profili enable row level security;
alter table public.progetti enable row level security;

revoke all on public.profili, public.progetti from anon, authenticated;
grant select, update on public.profili to authenticated;
grant select, insert, update, delete on public.progetti to authenticated;

create policy "profilo: leggo il mio" on public.profili for select to authenticated
  using ((select auth.uid()) = id);
create policy "profilo: modifico il mio" on public.profili for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "progetti: leggo i miei" on public.progetti for select to authenticated
  using ((select auth.uid()) = utente);
create policy "progetti: creo i miei" on public.progetti for insert to authenticated
  with check ((select auth.uid()) = utente);
create policy "progetti: modifico i miei" on public.progetti for update to authenticated
  using ((select auth.uid()) = utente) with check ((select auth.uid()) = utente);
create policy "progetti: cancello i miei" on public.progetti for delete to authenticated
  using ((select auth.uid()) = utente);

-- ---------------------------------------------------------------- cancellare il proprio conto
-- Serve il diritto di cancellare da auth.users: gira come proprietario, ma tocca solo l'utente che la chiama.
-- Profilo e progetti se ne vanno in cascata.
create function public.elimina_conto() returns void
language plpgsql security definer set search_path = '' as $$
declare io uuid := auth.uid();
begin
  if io is null then
    raise exception 'serve un utente collegato';
  end if;
  delete from auth.users where id = io;
end $$;
revoke all on function public.elimina_conto() from public, anon;
grant execute on function public.elimina_conto() to authenticated;
revoke all on function public.tocca_aggiornato() from public, anon, authenticated;
