-- ============================================================
-- Contador de visitas de 404heaven
--
-- Pegar entero en el SQL Editor de Supabase y darle Run. Es
-- idempotente: se puede correr de nuevo sin romper ni resetear
-- nada (la fila solo se crea si no existe).
--
-- La idea: nadie escribe la tabla desde el navegador. La única
-- puerta es bump_visits(), que sabe hacer una sola cosa —sumar
-- uno y devolver el total— y corre con los permisos del dueño.
-- ============================================================

-- 1. la tabla. Una fila por contador, por si algún día querés otro
create table if not exists public.counters (
  id text primary key,
  n  bigint not null default 0
);

-- 2. el contador de visitas, arrancando en 0.
--    el on conflict es lo que hace que re-correr esto no lo pise
insert into public.counters (id, n)
values ('visits', 0)
on conflict (id) do nothing;

-- 3. RLS prendido y ninguna policy de insert/update/delete:
--    con la llave pública se puede leer el número, nada más.
alter table public.counters enable row level security;

drop policy if exists "counters readable by anyone" on public.counters;
create policy "counters readable by anyone"
  on public.counters
  for select
  to anon, authenticated
  using (true);

-- 4. la única forma de sumar.
--    security definer = corre como el dueño de la función, así que
--    saltea RLS; pero como no recibe parámetros, lo peor que puede
--    hacer quien la llame es sumar de a uno.
--    search_path fijo para que nadie pueda secuestrar los nombres.
create or replace function public.bump_visits()
returns bigint
language sql
security definer
set search_path = public
as $$
  update public.counters
     set n = n + 1
   where id = 'visits'
  returning n;
$$;

revoke all on function public.bump_visits() from public;
grant execute on function public.bump_visits() to anon, authenticated;

-- ============================================================
-- Para mirar el número sin sumar:
--   select * from public.counters;
--
-- Para resetear (por ejemplo después de probar):
--   update public.counters set n = 0 where id = 'visits';
-- Acordate de borrar también la marca del navegador:
--   localStorage.removeItem("heaven404_visitor_no")
-- ============================================================
