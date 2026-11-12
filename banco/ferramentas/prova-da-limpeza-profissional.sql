-- ===========================================================================
-- A PROVA DA 088: a limpeza profissional com um simbolo a seco e um a umido.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. O relatorio sai dentro da
-- mensagem de erro, uma linha por caso.
--
-- Mexe direto no tecido e na cor da prova (os gatilhos conferem a ficha de
-- quem quer que grave), sem vestir ninguem.
-- ===========================================================================
do $$
declare
  t uuid;
  m uuid;
  r record;
  n int;
  txt text := '';
begin
  -- 1. as vagas
  select count(*) into n from public.simbolo_de_cuidado where vaga is null;
  txt := txt || E'\n' || case when n = 0
         and (select count(*) from public.simbolo_de_cuidado where vaga = 'profissional-seco') = 5
         and (select count(*) from public.simbolo_de_cuidado where vaga = 'profissional-umido') = 4
         and (select count(distinct vaga) from public.simbolo_de_cuidado) = 7
         then 'ok  ' else 'RUIM' end || ' 1. sete vagas: cinco grupos e a limpeza profissional em seco (5) e umido (4)';

  insert into public.tecido (nome) values ('TECIDO DA PROVA 088') returning id into t;

  -- 2. no tecido, um a seco e um a umido entram juntos, na ordem da etiqueta
  update public.tecido set cuidados = '{umido-w,lavar-30,nao-seco}' where id = t;
  select * into r from public.tecido where id = t;
  txt := txt || E'\n' || case when r.cuidados = '{lavar-30,nao-seco,umido-w}'
         then 'ok  ' else 'RUIM' end || ' 2. tecido: nao limpar a seco e limpeza a umido juntos (' || r.cuidados::text || ')';

  -- 3. no tecido, dois a seco continuam recusados
  begin
    update public.tecido set cuidados = '{seco-p,seco-f}' where id = t;
    txt := txt || E'\nRUIM 3. tecido aceitou dois simbolos a seco';
  exception when check_violation then
    txt := txt || E'\nok   3. tecido: dois a seco continuam recusados';
  end;

  -- 4. no tecido, dois a umido continuam recusados
  begin
    update public.tecido set cuidados = '{umido-w,nao-umido}' where id = t;
    txt := txt || E'\nRUIM 4. tecido aceitou dois simbolos a umido';
  exception when check_violation then
    txt := txt || E'\nok   4. tecido: dois a umido continuam recusados';
  end;

  -- 5. os outros grupos continuam com um so
  begin
    update public.tecido set cuidados = '{lavar-30,lavar-40}' where id = t;
    txt := txt || E'\nRUIM 5. tecido aceitou duas lavagens';
  exception when check_violation then
    txt := txt || E'\nok   5. tecido: a lavagem continua com um so';
  end;

  -- 6. na cor, a mesma regra
  insert into public.material (categoria, nome, unidade, tecido_id)
    values ('tecido', 'COR DA PROVA 088', 'kg', t) returning id into m;
  update public.material set cuidados = '{seco-p-suave,umido-w-muito-suave}' where id = m;
  select cuidados into r from public.material where id = m;
  txt := txt || E'\n' || case when r.cuidados = '{seco-p-suave,umido-w-muito-suave}'
         then 'ok  ' else 'RUIM' end || ' 6. cor: um a seco e um a umido juntos';
  begin
    update public.material set cuidados = '{nao-seco,seco-f}' where id = m;
    txt := txt || E'\nRUIM 7. cor aceitou dois simbolos a seco';
  exception when check_violation then
    txt := txt || E'\nok   7. cor: dois a seco continuam recusados';
  end;

  raise exception E'PROVA DA 088 (tudo desfeito):%', txt;
end $$;
