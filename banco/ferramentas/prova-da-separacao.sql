-- ============================================================
-- A PROVA DA SEPARACAO
-- ============================================================
-- Roda no SQL Editor quantas vezes quiser. Ele termina levantando um erro de
-- proposito, e por isso TUDO que ele fez e desfeito: nenhuma linha do banco
-- fica diferente, nem o estado do pedido que ele move.
--
-- Como a prova da reserva, ela pega um pedido de VERDADE e monta em volta do
-- primeiro layout dele o material e o consumo que faltavam. Depois separa,
-- desfaz, separa de novo e conclui.
--
-- A regra que ela confere esta na migracao 027:
--   separar tira da PRATELEIRA e nao mexe no LIVRE, porque o livre ja estava
--     descontado pela reserva: a promessa virou fato, e o total nao muda;
--   separar menos do que foi reservado DEVOLVE a diferenca para o livre;
--   desfazer e uma devolucao com linha propria, e nao um movimento apagado;
--   concluir move o pedido para o PCP mesmo com falta, e carimba o aviso;
--   e o pedido passa por `separacao` no caminho, para a trava da 022 deixar.
do $$
declare
  eu      uuid;
  ped     public.pedido;
  doc     jsonb;
  bloco   jsonb;
  pano    jsonb;
  ref_id  uuid;
  id_pano uuid;
  id_cor  uuid;
  id_mat  uuid;
  id_ped  uuid;
  id_res  uuid;
  par     record;
  r       text := E'\n';
  n       int;
  pecas   int;
  /* `reservado`, `est` e `av` e nao `reservado`, `estado` e `aviso`: variavel
     com o mesmo nome de uma tabela ou de uma coluna faz o Postgres recusar a
     consulta por ambiguidade, e a mensagem nao ajuda ninguem */
  reservado numeric;
  saldo   numeric;
  livre   numeric;
  recado  text;
  est     text;
  av      text;

begin
  select id into eu from public.pessoa where papel = 'admin' and situacao = 'aprovado' limit 1;
  if eu is null then raise exception 'PROVA >> nao ha admin aprovado'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', eu)::text, true);

  /* 1. um layout de verdade que resolva referencia, tecido e cor */
  select p.id, x -> 'bloco' into id_ped, bloco
    from public.pedido p
    join public.cotacao c on c.id = p.cotacao_id
    cross join lateral jsonb_array_elements(coalesce(c.corpo -> 'produtos', '[]'::jsonb)) x
   where p.estado in ('aprovado', 'separacao', 'pcp', 'producao')
     and not coalesce((x -> 'bloco' ->> 'informacoes')::boolean, false)
     and jsonb_array_length(coalesce(x -> 'bloco' -> 'tecidos', '[]'::jsonb)) > 0
     and coalesce(x -> 'bloco' -> 'grade', '{}'::jsonb) <> '{}'::jsonb
     and exists (select 1 from public.referencia rr
                  where rr.cod <> '' and rr.cod = coalesce(x -> 'bloco' ->> 'referencia', ''))
     and exists (select 1 from public.tecido t
                  where t.nome = coalesce(x -> 'bloco' -> 'tecidos' -> 0 ->> 'nome', ''))
     and exists (select 1 from public.cor_de_tecido cc
                  where cc.nome = coalesce(x -> 'bloco' -> 'tecidos' -> 0 ->> 'cor', ''))
   order by p.criado_em desc
   limit 1;
  if bloco is null then
    raise exception 'PROVA >> nenhum pedido esperando separacao com layout que resolve';
  end if;

  select * into ped from public.pedido where id = id_ped;

  /* O ENSAIO NAO DEIXA PEDIDO PARADO EM `aprovado`. A semente aponta uma etapa
     em cada pedido, e o gatilho da 020 diz que o pedido entra em producao no
     instante em que a fabrica encosta nele: no fim da semeadura os quatro estao
     em `producao`. Entao a prova anda com um deles PARA TRAS ate a separacao,
     um degrau de cada vez, que e o unico caminho que a trava da 022 aceita.
     Como tudo aqui e desfeito no fim, o pedido volta para onde estava. */
  if ped.estado = 'producao' then
    update public.pedido set estado = 'pcp' where id = id_ped;
    update public.pedido set estado = 'separacao' where id = id_ped;
  elsif ped.estado = 'pcp' then
    update public.pedido set estado = 'separacao' where id = id_ped;
  end if;
  select * into ped from public.pedido where id = id_ped;
  r := r || case when ped.estado in ('aprovado','separacao') then 'ok    ' else 'FALHA ' end
         || 'o pedido anda para tras ate a separacao, um degrau de cada vez ['
         || ped.estado || ']' || E'\n';

  pano := bloco -> 'tecidos' -> 0;
  select sum(v::int)::int into pecas from jsonb_each_text(bloco -> 'grade') as g(k, v);
  r := r || 'info  pedido ' || ped.numero || ' (' || ped.estado || '), layout com '
         || pecas || ' peca(s)' || E'\n';

  select id into ref_id  from public.referencia
   where cod <> '' and cod = coalesce(bloco ->> 'referencia', '') limit 1;
  select id into id_pano from public.tecido        where nome = coalesce(pano ->> 'nome', '') limit 1;
  select id into id_cor  from public.cor_de_tecido where nome = coalesce(pano ->> 'cor', '')  limit 1;

  /* 2. montar o que faltava e reservar */
  update public.tecido set gramatura = 145, largura = 1.600 where id = id_pano;
  insert into public.material (categoria, nome, unidade, minimo, tecido_id, cor_id, teste)
  values ('tecido', 'PROVA malha da separacao', 'kg', 20, id_pano, id_cor, true)
  returning id into id_mat;
  perform public.mexer_no_estoque(id_mat, 100, 'entrada', 'saldo inicial da prova');

  for par in select k as tamanho from jsonb_each_text(bloco -> 'grade') as g(k, v) loop
    insert into public.consumo_da_referencia (referencia_id, tamanho, metros)
    values (ref_id, par.tamanho, 0.6000)
    on conflict (referencia_id, tamanho) do update set metros = excluded.metros;
  end loop;

  perform public.reservar_o_pedido(id_ped);
  select id, quantidade into id_res, reservado
    from public.reserva where pedido_id = id_ped and material_id = id_mat;
  r := r || case when reservado > 0 then 'ok    ' else 'FALHA ' end
         || 'a reserva nasceu com tamanho [' || round(coalesce(reservado,0), 3) || ' kg]' || E'\n';

  select m.saldo, m.livre into saldo, livre
    from public.material_na_prateleira m where m.id = id_mat;
  r := r || case when saldo = 100 and livre = 100 - reservado then 'ok    ' else 'FALHA ' end
         || 'antes de separar: prateleira 100, livre ' || round(coalesce(livre,0), 3) || E'\n';

  /* 3. SEPARAR NAO MEXE NO LIVRE, MEXE NA PRATELEIRA.
        O livre ja estava descontado pela reserva: a promessa virou fato e o
        total disponivel nao muda. Se o livre caisse de novo aqui, o mesmo
        material teria sido descontado duas vezes. */
  perform public.separar_material(id_res, reservado, 'prova');
  select m.saldo, m.livre into saldo, livre
    from public.material_na_prateleira m where m.id = id_mat;
  r := r || case when saldo = 100 - reservado then 'ok    ' else 'FALHA ' end
         || 'separar tira da prateleira [' || round(coalesce(saldo,0), 3) || ']' || E'\n';
  r := r || case when livre = 100 - reservado then 'ok    ' else 'FALHA ' end
         || 'e NAO mexe no livre, que a reserva ja tinha descontado ['
         || round(coalesce(livre,0), 3) || ']' || E'\n';

  select count(*) into n from public.movimento_de_estoque
   where material_id = id_mat and motivo = 'separacao' and pedido_id = id_ped;
  r := r || case when n = 1 then 'ok    ' else 'FALHA ' end
         || 'e o razao guarda de que pedido a saida veio' || E'\n';

  /* 4. separar duas vezes a mesma linha e recusado */
  begin
    perform public.separar_material(id_res, 1, 'de novo');
    r := r || 'FALHA separou a mesma linha duas vezes' || E'\n';
  exception when others then
    r := r || 'ok    a mesma linha nao separa duas vezes (' || sqlstate || ')' || E'\n';
  end;

  /* 5. desfazer e uma DEVOLUCAO, e nao um movimento apagado */
  perform public.desfazer_a_separacao(id_res);
  select m.saldo into saldo from public.material_na_prateleira m where m.id = id_mat;
  r := r || case when saldo = 100 then 'ok    ' else 'FALHA ' end
         || 'desfazer devolve a prateleira [' || round(coalesce(saldo,0), 3) || ']' || E'\n';
  select count(*) into n from public.movimento_de_estoque where material_id = id_mat;
  r := r || case when n = 3 then 'ok    ' else 'FALHA ' end
         || 'e o razao fica com tres linhas, e nao com uma apagada [' || n || ']' || E'\n';

  /* 6. separar MENOS devolve a diferenca para o livre */
  perform public.separar_material(id_res, round(reservado / 2, 3), 'metade');
  select m.saldo, m.livre into saldo, livre
    from public.material_na_prateleira m where m.id = id_mat;
  r := r || case when livre = saldo then 'ok    ' else 'FALHA ' end
         || 'separando metade, o que sobrou da reserva volta a ficar livre ['
         || round(coalesce(livre,0), 3) || ']' || E'\n';

  /* 7. concluir move para o PCP e carimba a falta */
  select public.concluir_a_separacao(id_ped) into recado;
  select p.estado::text, p.aviso into est, av from public.pedido p where p.id = id_ped;
  r := r || case when est = 'pcp' then 'ok    ' else 'FALHA ' end
         || 'concluir move o pedido para o PCP [' || est || ']' || E'\n';
  r := r || case when av = 'falta-material' then 'ok    ' else 'FALHA ' end
         || 'e carimba a falta, porque saiu menos do que a conta pedia ['
         || coalesce(av, '') || ']' || E'\n';
  r := r || 'info  ' || recado || E'\n';

  /* 8. concluir de novo nao vale: o pedido nao esta mais na separacao */
  begin
    perform public.concluir_a_separacao(id_ped);
    r := r || 'FALHA concluiu a separacao de um pedido que ja saiu dela' || E'\n';
  exception when others then
    r := r || 'ok    pedido fora da separacao nao conclui de novo (' || sqlstate || ')' || E'\n';
  end;

  /* 9. quem nao cuida de producao nao separa */
  select id into eu from public.pessoa
   where papel = 'vendedor' and situacao = 'aprovado' limit 1;
  if eu is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', eu)::text, true);
    begin
      perform public.separar_material(id_res, 1, 'vendedor');
      r := r || 'FALHA vendedor separou material' || E'\n';
    exception when others then
      r := r || 'ok    vendedor nao separa material (' || sqlstate || ')' || E'\n';
    end;
  else
    r := r || 'info  sem vendedor aprovado para provar a trava de papel' || E'\n';
  end if;

  select count(*) into n from regexp_matches(r, 'FALHA', 'g');
  raise exception 'PROVA DA SEPARACAO >> % %',
    case when n = 0 then 'tudo passou' else n || ' falha(s)' end, r;
end $$;
