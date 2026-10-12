-- ===========================================================================
-- A PROVA DA 070: as mensagens rapidas.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito.
-- ===========================================================================
do $$
declare
  g uuid := gen_random_uuid();   -- gerente
  v1 uuid := gen_random_uuid();  -- vendedora que escreve
  v2 uuid := gen_random_uuid();  -- outro vendedor
  sufixo text := substr(md5(random()::text), 1, 6);
  equipe uuid; minha uuid;
  n int; b boolean;
  txt text := '';
begin
  insert into public.convite (email, papel) values
    ('prova-70g-' || sufixo || '@prova.test', 'gerente'),
    ('prova-70a-' || sufixo || '@prova.test', 'vendedor'),
    ('prova-70b-' || sufixo || '@prova.test', 'vendedor');
  insert into auth.users (id, email) values
    (g, 'prova-70g-' || sufixo || '@prova.test'), (v1, 'prova-70a-' || sufixo || '@prova.test'), (v2, 'prova-70b-' || sufixo || '@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (g, 'Gerente da Prova 70', 'gerente', 'aprovado', 'prova-70g-' || sufixo || '@prova.test'),
    (v1, 'Dani da Prova 70', 'vendedor', 'aprovado', 'prova-70a-' || sufixo || '@prova.test'),
    (v2, 'Lucas da Prova 70', 'vendedor', 'aprovado', 'prova-70b-' || sufixo || '@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = 'aprovado';

  -- 1. a vendedora escreve uma da equipe e uma so dela
  perform set_config('request.jwt.claim.sub', v1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.mensagem_rapida (titulo, texto, grupo, dono_id, criado_por)
    values ('Pix ' || sufixo, 'A chave Pix e ...', 'Pagamento', null, v1) returning id into equipe;
  insert into public.mensagem_rapida (titulo, texto, grupo, dono_id, criado_por)
    values ('Minha ' || sufixo, 'Oi {nome}!', 'Geral', v1, v1) returning id into minha;
  select count(*) into n from public.mensagem_rapida where id in (equipe, minha);
  txt := txt || E'\n' || case when n = 2 then 'ok  ' else 'RUIM' end || ' 1. a vendedora cria uma da equipe e uma so dela, e ve as duas';
  reset role;

  -- 2. o outro vendedor ve a da equipe, nao ve a dela, e nao muda nem apaga a da equipe
  perform set_config('request.jwt.claim.sub', v2::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.mensagem_rapida where id in (equipe, minha);
  b := n = 1;
  update public.mensagem_rapida set titulo = 'mexi' where id = equipe;
  get diagnostics n = row_count;
  b := b and n = 0;
  delete from public.mensagem_rapida where id = equipe;
  get diagnostics n = row_count;
  b := b and n = 0;
  begin
    insert into public.mensagem_rapida (titulo, texto, dono_id, criado_por) values ('Em nome dela', 'x', v1, v2);
    b := false;
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.mensagem_rapida (titulo, texto, dono_id, criado_por) values ('Fingindo', 'x', null, v1);
    b := false;
  exception when insufficient_privilege then null;
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 2. outro vendedor ve a da equipe, nao a dela; nao muda, nao apaga e nao escreve em nome dela';
  reset role;

  -- 3. o gerente muda a da equipe, e nao ve a so dela
  perform set_config('request.jwt.claim.sub', g::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.mensagem_rapida set texto = 'A chave Pix e o CNPJ' where id = equipe;
  get diagnostics n = row_count;
  b := n = 1;
  update public.mensagem_rapida set titulo = 'mexi' where id = minha;
  get diagnostics n = row_count;
  b := b and n = 0;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 3. o gerente muda a da equipe e nao alcanca a so dela';
  reset role;

  -- 4. a vendedora apaga a dela; titulo vazio nao entra
  perform set_config('request.jwt.claim.sub', v1::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from public.mensagem_rapida where id = minha;
  get diagnostics n = row_count;
  b := n = 1;
  begin
    insert into public.mensagem_rapida (titulo, texto, criado_por) values ('   ', 'x', v1);
    b := false;
  exception when check_violation then null;
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 4. a vendedora apaga a dela, e titulo vazio nao entra';
  reset role;

  select count(*) into n from public.mensagem_rapida where dono_id is null and criado_por is null;
  txt := txt || E'\n' || case when n >= 4 then 'ok  ' else 'RUIM' end || ' 5. as quatro respostas do v5 estao la, da equipe';

  raise exception E'\nPROVA DAS MENSAGENS RAPIDAS (070)%\n\nNada foi gravado: este erro e de proposito e desfaz tudo.', txt;
end $$;
