-- Portachiavi con QR.
-- Ogni portachiavi stampato ha un codice (nel QR: https://flockets.site/#/q/CODICE). I codici li crea Mekai Games
-- quando stampa un lotto. Chi inquadra un codice libero, se ha un account, lo collega a uno dei suoi progetti;
-- da lì in poi il codice apre quel progetto a chiunque, con o senza account. Solo chi l'ha collegato può scollegarlo.

create table public.qr (
  codice     text primary key check (codice ~ '^[2-9A-HJ-NP-Z]{6}$'),   -- 6 caratteri senza 0/O, 1/I/L
  progetto   uuid references public.progetti (id) on delete set null,
  utente     uuid references auth.users (id) on delete set null,
  collegato  timestamptz,
  lotto      text check (char_length(lotto) <= 80),                  -- es. «targhetta 2026-11-14»
  creato     timestamptz not null default now(),
  constraint collegamento_completo check ((progetto is null) = (utente is null))
);
comment on table public.qr is 'Codici dei portachiavi e il progetto a cui rimandano.';
create index qr_utente on public.qr (utente);
create index qr_progetto on public.qr (progetto);

-- se un progetto collegato viene cancellato, il codice torna libero (anche l'utente)
create function public.qr_libera() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.progetto is null then
    new.utente := null;
    new.collegato := null;
  end if;
  return new;
end $$;
revoke all on function public.qr_libera() from public, anon, authenticated;
create trigger qr_libera before update on public.qr for each row execute function public.qr_libera();

-- Accesso: nessuno legge la tabella intera (si potrebbero elencare i codici liberi).
-- Ognuno vede solo i codici che ha collegato lui; il resto passa dalle funzioni qui sotto.
alter table public.qr enable row level security;
revoke all on public.qr from anon, authenticated;
grant select on public.qr to authenticated;
create policy "qr: vedo quelli che ho collegato" on public.qr for select to authenticated
  using ((select auth.uid()) = utente);

-- Cosa c'è dietro un codice. Chiamabile da tutti, anche senza account: è il punto del portachiavi.
-- Restituisce solo il progetto collegato a quel codice, mai altro.
create function public.apri_qr(p_codice text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  q public.qr%rowtype;
  p public.progetti%rowtype;
begin
  select * into q from public.qr where codice = upper(trim(p_codice));
  if not found then
    return jsonb_build_object('stato', 'inesistente');
  end if;
  if q.progetto is null then
    return jsonb_build_object('stato', 'libero', 'codice', q.codice);
  end if;
  select * into p from public.progetti where id = q.progetto;
  return jsonb_build_object(
    'stato', 'collegato', 'codice', q.codice, 'mio', q.utente = auth.uid(),
    'progetto', jsonb_build_object('id', p.id, 'tipo', p.tipo, 'titolo', p.titolo, 'fonte', p.fonte,
                                   'riassunto', p.riassunto, 'dati', p.dati));
end $$;
revoke all on function public.apri_qr(text) from public;
grant execute on function public.apri_qr(text) to anon, authenticated;

-- Collega un codice libero (o già suo) a un proprio progetto.
create function public.collega_qr(p_codice text, p_progetto uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare io uuid := auth.uid();
begin
  if io is null then
    raise exception 'serve un account' using errcode = '42501';
  end if;
  if not exists (select 1 from public.progetti where id = p_progetto and utente = io) then
    raise exception 'progetto non tuo' using errcode = '42501';
  end if;
  update public.qr set progetto = p_progetto, utente = io, collegato = now()
   where codice = upper(trim(p_codice)) and (progetto is null or utente = io);
  if not found then
    raise exception 'codice inesistente o già collegato' using errcode = 'P0002';
  end if;
end $$;
revoke all on function public.collega_qr(text, uuid) from public, anon;
grant execute on function public.collega_qr(text, uuid) to authenticated;

-- Scollega un codice: solo chi l'ha collegato. Il codice torna libero.
create function public.scollega_qr(p_codice text) returns void
language plpgsql security definer set search_path = '' as $$
declare io uuid := auth.uid();
begin
  if io is null then
    raise exception 'serve un account' using errcode = '42501';
  end if;
  update public.qr set progetto = null where codice = upper(trim(p_codice)) and utente = io;
  if not found then
    raise exception 'codice non tuo' using errcode = '42501';
  end if;
end $$;
revoke all on function public.scollega_qr(text) from public, anon;
grant execute on function public.scollega_qr(text) to authenticated;
