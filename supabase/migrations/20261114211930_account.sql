-- «Conto» diventa «account», anche nel nome della funzione che cancella il proprio account.
alter function public.elimina_conto() rename to elimina_account;
comment on function public.elimina_account() is 'Cancella l''account di chi la chiama (profilo e progetti in cascata).';
