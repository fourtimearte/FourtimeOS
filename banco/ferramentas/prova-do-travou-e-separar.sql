-- ===========================================================================
-- A PROVA DA 076: travou aqui e separar, no cartao do kanban.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. Cria os proprios dados (com
-- "PROVA 076" no nome), e nenhum sobra.
-- ===========================================================================
do $$
declare
  g uuid := gen_random_uuid();  -- gerente (libera a fabrica: recebe o aviso)
  o uuid := gen_random_uuid();  -- producao (edita o kanban)
  v uuid := gen_random_uuid();  -- vendedor (so ve o kanban)
  cot uuid; ped uuid; fa public.fatia; nova public.fatia;
  n int; t text; b boolean;
  txt text := '';
begin
  insert into public.convite (email, papel) values
    ('prova-76g@prova.test', 'gerente'), ('prova-76o@prova.test', 'producao'), ('prova-76v@prova.test', 'vendedor');
  insert into auth.users (id, email) values
    (g, 'prova-76g@prova.test'), (o, 'prova-76o@prova.test'), (v, 'prova-76v@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (g, 'Gerente da Prova 076', 'gerente', 'aprovado', 'prova-76g@prova.test'),
    (o, 'Operador da Prova 076', 'producao', 'aprovado', 'prova-76o@prova.test'),
    (v, 'Dani da Prova 076', 'vendedor', 'aprovado', 'prova-76v@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = 'aprovado', nome = excluded.nome;

  insert into public.cotacao (numero, cliente_nome, corpo, versao_do_formato)
  values ('CO-PROVA-076', 'Escola PROVA 076', '{}'::jsonb, 6) returning id into cot;
  insert into public.pedido (numero, cotacao_id, estado) values ('PD-PROVA-076', cot, 'producao') returning id into ped;
  insert into public.fatia (pedido_id, tecnica, etapa, layouts, pecas)
  values (ped, 'subli', 'calandra', '{1,2,3}', 300) returning * into fa;

  -- 1. o operador trava com motivo: a view mostra, a linha do tempo anota, o gerente e avisado
  perform set_config('request.jwt.claim.sub', o::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', o)::text, true);
  fa := public.travar_a_fatia(fa.id, '  calandra   quebrou ');
  select travada_motivo || ' / ' || travada_por_nome into t from public.fatia_na_fabrica where id = fa.id;
  txt := E'\n' || case when t = 'calandra quebrou / Operador da Prova 076' and fa.travada_em is not null then 'ok  ' else 'RUIM' end
         || ' 1. travar marca o cartao e a view mostra o motivo (' || coalesce(t, '-') || ')';
  select count(*) into n from public.evento_da_fatia where fatia_id = fa.id and tipo = 'travou';
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 2. a linha do tempo anota o travou';
  select count(*), max(link) into n, t from public.aviso_do_sino where pessoa_id = g and tipo = 'travou' and pedido_id = ped;
  txt := txt || E'\n' || case when n = 1 and t = '/kanban?cartao=' || fa.id then 'ok  ' else 'RUIM' end
         || ' 3. o gerente e avisado no sino, com o link do cartao (' || coalesce(t, '-') || ')';
  select count(*) into n from public.aviso_do_sino where pessoa_id = o and tipo = 'travou';
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 4. quem travou nao se avisa';

  -- 5. sem motivo nao trava
  b := false;
  begin
    perform public.travar_a_fatia(fa.id, ' ');
  exception when sqlstate '22023' then b := true;
  end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 5. travar pede o motivo';

  -- 6. andar de posto destrava
  update public.fatia set etapa = 'futurize' where id = fa.id returning * into fa;
  txt := txt || E'\n' || case when fa.travada_em is null and fa.travada_motivo = '' then 'ok  ' else 'RUIM' end || ' 6. andar de posto destrava';

  -- 7. destravar na mao
  fa := public.travar_a_fatia(fa.id, 'falta a arte');
  fa := public.destravar_a_fatia(fa.id);
  select count(*) into n from public.evento_da_fatia where fatia_id = fa.id and tipo = 'destravou';
  txt := txt || E'\n' || case when fa.travada_em is null and n = 1 then 'ok  ' else 'RUIM' end || ' 7. destravar limpa e anota';

  -- 8. separar: o L-02 volta para a impressao com 80 pecas; o resto segue
  nova := public.separar_da_fatia(fa.id, '{2}', 80, 'subli', 'reimpressao da manga');
  select * into fa from public.fatia where id = fa.id;
  txt := txt || E'\n' || case when nova.layouts = '{2}' and nova.pecas = 80 and nova.etapa = 'subli' and nova.tecnica = 'subli'
                               and fa.layouts = '{1,3}' and fa.pecas = 220 and fa.etapa = 'futurize' then 'ok  ' else 'RUIM' end
         || ' 8. separar cria o cartao novo e o de origem fica com o resto (' || array_to_string(fa.layouts, ',') || ' / ' || fa.pecas || ')';
  select count(*) into n from public.evento_da_fatia where tipo = 'separou' and fatia_id in (fa.id, nova.id);
  txt := txt || E'\n' || case when n = 2 then 'ok  ' else 'RUIM' end || ' 9. os dois cartoes anotam a separacao';
  select etapa::text into t from public.pedido where id = ped;
  txt := txt || E'\n' || case when t = 'subli' then 'ok  ' else 'RUIM' end || ' 10. o pedido segue o cartao mais atrasado, agora o separado (' || t || ')';

  -- 11 a 14. o que separar recusa
  b := false;
  begin perform public.separar_da_fatia(fa.id, '{1,3}', 10, 'subli', 'tudo'); exception when sqlstate '22023' then b := true; end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 11. separar todos os layouts e recusado';
  b := false;
  begin perform public.separar_da_fatia(fa.id, '{2}', 10, 'subli', 'nao esta aqui'); exception when sqlstate '22023' then b := true; end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 12. layout que nao esta no cartao e recusado';
  b := false;
  begin perform public.separar_da_fatia(fa.id, '{1}', 220, 'subli', 'pecas demais'); exception when sqlstate '22023' then b := true; end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 13. pecas iguais ou acima das do cartao sao recusadas';
  b := false;
  begin perform public.separar_da_fatia(fa.id, '{1}', 10, 'dtf', 'fora da rota'); exception when sqlstate '23514' then b := true; end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 14. posto fora da rota e recusado';

  -- 15. o vendedor (so ve o kanban) nao trava nem separa
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v)::text, true);
  b := false;
  begin perform public.travar_a_fatia(fa.id, 'teste'); exception when sqlstate '42501' then b := true; end;
  begin perform public.separar_da_fatia(fa.id, '{1}', 10, 'subli', 'teste'); b := false; exception when sqlstate '42501' then null; end;
  txt := txt || E'\n' || case when b then 'ok  ' else 'RUIM' end || ' 15. quem so ve o kanban nao trava nem separa (42501)';

  raise exception E'\nPROVA DO TRAVOU AQUI E DO SEPARAR (076)%\n\nNada foi gravado: este erro e de proposito e desfaz tudo.', txt;
end $$;
