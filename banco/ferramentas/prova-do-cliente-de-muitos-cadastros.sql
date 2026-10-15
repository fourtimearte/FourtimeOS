-- ===========================================================================
-- A PROVA DA 082: os extras do cliente, o juntar e o frete preferido. Roda no
-- SQL Editor quantas vezes quiser: termina levantando um erro de proposito, e
-- por isso tudo que fez e desfeito.
-- ===========================================================================
do $$
declare
  a uuid := gen_random_uuid();
  fica uuid; sai uuid; outro uuid; cot1 uuid; cot2 uuid; cot3 uuid; ped1 uuid; ped2 uuid; ped3 uuid; moto uuid; lan uuid;
  n int; q numeric;
  r record;
  x jsonb;
  txt text := '';
begin
  insert into public.convite (email, papel) values ('prova-82@prova.test', 'admin');
  insert into auth.users (id, email) values (a, 'prova-82@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values (a, 'Admin da Prova', 'admin', 'aprovado', 'prova-82@prova.test')
  on conflict (id) do update set papel = 'admin', situacao = 'aprovado', nome = excluded.nome;
  perform set_config('request.jwt.claim.sub', a::text, true);

  insert into public.cliente (nome, documento, contato, celular, endereco, cidade, uf, cep, pedidos_antigos, total_antigo, ultimo_pedido_antigo)
    values ('ESCOLA PROVA 082', '11222333000181', 'Marta', '62999990001', 'Rua A, 10', 'Goiania', 'GO', '74000000', 3, 1000, '2024-01-10')
    returning id into fica;
  insert into public.cliente (nome, fantasia, documento, contato, celular, email, endereco, cidade, uf, cep, pedidos_antigos, total_antigo, ultimo_pedido_antigo)
    values ('ESCOLA PROVA 082 FILIAL', 'Filial', '44555666000199', 'Joao', '62988880002', 'joao@prova.test', 'Av B, 20', 'Anapolis', 'GO', '75000000', 2, 500, '2025-03-01')
    returning id into sai;

  -- 1. gravar os extras: linha vazia some, documento so com digitos, ordem da tela
  perform public.salvar_extras_do_cliente(fica,
    '[{"tipo":"J","documento":"55.666.777/0001-88","nome":"ESCOLA PROVA LTDA"},{"documento":"  "}]',
    '[{"apelido":"Quadra","endereco":"Rua Q, 5","cidade":"Goiania","uf":"go","cep":"74.100-000"},{"apelido":"vazio"}]',
    '[{"nome":"Carlos","cargo":"Financeiro","celular":"(62) 97777-0003"}]');
  select * into r from public.extras_do_cliente where cliente_id = fica;
  txt := txt || E'\n' || case when jsonb_array_length(r.documentos) = 1 and r.documentos -> 0 ->> 'documento' = '55666777000188'
                                 and jsonb_array_length(r.enderecos) = 1 and r.enderecos -> 0 ->> 'uf' = 'GO' and r.enderecos -> 0 ->> 'cep' = '74100000'
                                 and jsonb_array_length(r.contatos) = 1 and r.contatos -> 0 ->> 'celular' = '62977770003'
                              then 'ok  ' else 'RUIM' end || ' 1. os extras gravam limpos, sem a linha vazia';

  -- 2. gravar de novo troca a lista inteira
  perform public.salvar_extras_do_cliente(fica, '[]', (r.enderecos), (r.contatos));
  select * into r from public.extras_do_cliente where cliente_id = fica;
  txt := txt || E'\n' || case when jsonb_array_length(r.documentos) = 0 and jsonb_array_length(r.enderecos) = 1
                              then 'ok  ' else 'RUIM' end || ' 2. o que nao veio sai';
  perform public.salvar_extras_do_cliente(fica, '[{"documento":"55666777000188"}]', (r.enderecos), (r.contatos));

  -- 3. quem sai tem um extra igual ao de quem fica, e um proprio
  perform public.salvar_extras_do_cliente(sai, '[{"documento":"55666777000188"},{"documento":"99888777000166"}]',
    '[{"endereco":"Rua C, 30","cidade":"Anapolis","uf":"GO"}]', '[]');

  -- as cotacoes e os pedidos das duas fichas
  insert into public.cotacao (numero, cliente_id, corpo, versao_do_formato, estado)
    values ('CO-PROVA-082A', sai, jsonb_build_object('cliente', jsonb_build_object('id', sai::text, 'nome', 'ESCOLA PROVA 082 FILIAL'),
                                                     'informe', jsonb_build_object('entrega', 'TRANSPORTADORA')), 6, 'aprovada')
    returning id into cot1;
  insert into public.cotacao (numero, cliente_id, corpo, versao_do_formato, estado)
    values ('CO-PROVA-082B', fica, jsonb_build_object('cliente', jsonb_build_object('id', fica::text), 'informe', jsonb_build_object('entrega', 'TRANSPORTADORA')), 6, 'aprovada')
    returning id into cot2;
  insert into public.cotacao (numero, cliente_id, corpo, versao_do_formato, estado)
    values ('CO-PROVA-082C', fica, jsonb_build_object('cliente', jsonb_build_object('id', fica::text), 'informe', jsonb_build_object('entrega', 'RETIRADA')), 6, 'aprovada')
    returning id into cot3;
  insert into public.pedido (numero, cotacao_id, cliente_id, estado, aprovado_em) values ('PD-PROVA-082A', cot1, sai, 'aprovado', now() - interval '3 days') returning id into ped1;
  insert into public.pedido (numero, cotacao_id, cliente_id, estado, aprovado_em) values ('PD-PROVA-082B', cot2, fica, 'aprovado', now() - interval '2 days') returning id into ped2;
  insert into public.pedido (numero, cotacao_id, cliente_id, estado, aprovado_em) values ('PD-PROVA-082C', cot3, fica, 'aprovado', now() - interval '1 days') returning id into ped3;

  insert into public.transportador (nome, meio) values ('MOTO PROVA 082', 'motoboy') returning id into moto;
  insert into public.lancamento_de_transporte (transportador_id, motivo, pedido_id, valor, forma, quando)
    values (moto, 'entrega', ped2, 30, 'pix', now() - interval '1 day') returning id into lan;
  insert into public.pedido_do_lancamento (lancamento_id, pedido_id) values (lan, ped2);

  -- 4. o frete preferido: transportadora e retirada empatam em 1, e ganha a mais recente
  select * into r from public.frete_do_cliente where cliente_id = fica;
  txt := txt || E'\n' || case when r.pedidos = 2 and r.modo = 'RETIRADA' and r.ultimo_transportador = 'MOTO PROVA 082'
                              then 'ok  ' else 'RUIM' end
         || ' 4. frete de quem fica: 2 pedidos, empate desempata pelo mais recente, levou a moto (' || coalesce(r.modo, 'nada') || ', ' || coalesce(r.ultimo_transportador, 'nada') || ')';

  -- 5. juntar
  select * into r from public.juntar_clientes(fica, sai);
  txt := txt || E'\n' || case when r.nome = 'ESCOLA PROVA 082' and r.documento = '11222333000181' and r.fantasia = 'Filial'
                                 and r.email = 'joao@prova.test' and r.pedidos_antigos = 5 and r.total_antigo = 1500
                                 and r.ultimo_pedido_antigo = '2025-03-01'
                              then 'ok  ' else 'RUIM' end || ' 5. o principal fica, o vazio e preenchido, o historico soma';
  select count(*) into n from public.cliente where id = sai;
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 5b. a ficha que saiu some';

  select * into r from public.extras_do_cliente where cliente_id = fica;
  x := r.documentos;
  txt := txt || E'\n' || case when jsonb_array_length(x) = 3
                                 and x @> '[{"documento":"44555666000199","nome":"ESCOLA PROVA 082 FILIAL"}]'
                                 and x @> '[{"documento":"55666777000188"}]' and x @> '[{"documento":"99888777000166"}]'
                              then 'ok  ' else 'RUIM' end || ' 6. documentos: o principal de quem saiu vira extra, o repetido nao duplica (' || jsonb_array_length(x) || ')';
  txt := txt || E'\n' || case when jsonb_array_length(r.enderecos) = 3 and r.enderecos @> '[{"endereco":"Av B, 20","apelido":"ESCOLA PROVA 082 FILIAL"}]'
                              then 'ok  ' else 'RUIM' end || ' 7. enderecos: Quadra, o principal da filial e o extra dela (' || jsonb_array_length(r.enderecos) || ')';
  txt := txt || E'\n' || case when jsonb_array_length(r.contatos) = 2 and r.contatos @> '[{"nome":"Joao","celular":"62988880002"}]'
                              then 'ok  ' else 'RUIM' end || ' 8. contatos: Carlos e o Joao da filial (' || jsonb_array_length(r.contatos) || ')';

  select count(*) into n from public.pedido where cliente_id = fica and numero like 'PD-PROVA-082%';
  txt := txt || E'\n' || case when n = 3 then 'ok  ' else 'RUIM' end || ' 9. os pedidos passam para quem fica (' || n || ')';
  select * into r from public.cotacao where id = cot1;
  txt := txt || E'\n' || case when r.cliente_id = fica and r.corpo -> 'cliente' ->> 'id' = fica::text
                                 and r.corpo -> 'cliente' ->> 'nome' = 'ESCOLA PROVA 082 FILIAL'
                              then 'ok  ' else 'RUIM' end || ' 10. a cotacao aponta para quem fica, dentro e fora do corpo, e guarda o nome escrito';

  select * into r from public.juntada_de_cliente where ficou_id = fica;
  txt := txt || E'\n' || case when r.saiu ->> 'nome' = 'ESCOLA PROVA 082 FILIAL' and r.saiu -> 'extras' is not null and r.quem = a
                              then 'ok  ' else 'RUIM' end || ' 11. a juntada guarda a ficha que saiu inteira, com quem juntou';

  select * into r from public.frete_do_cliente where cliente_id = fica;
  txt := txt || E'\n' || case when r.pedidos = 3 and r.modo = 'TRANSPORTADORA' and r.vezes = 2
                              then 'ok  ' else 'RUIM' end || ' 12. depois de juntar, transportadora 2 de 3 (' || coalesce(r.modo, 'nada') || ', ' || r.vezes || ')';

  -- 13. juntar consigo mesmo e recusado
  begin
    perform public.juntar_clientes(fica, fica);
    txt := txt || E'\nRUIM 13. juntou consigo mesmo';
  exception when others then
    txt := txt || E'\nok   13. juntar com a mesma ficha e recusado';
  end;

  -- 14. quem nao pode editar cliente nao grava extras
  insert into public.cliente (nome) values ('OUTRO PROVA 082') returning id into outro;
  update public.pessoa set papel = 'producao' where id = a;
  begin
    perform public.salvar_extras_do_cliente(outro, '[]', '[]', '[]');
    txt := txt || E'\nRUIM 14. a producao gravou extras';
  exception when insufficient_privilege then
    txt := txt || E'\nok   14. sem acesso de clientes, os extras sao recusados';
  end;
  begin
    perform public.juntar_clientes(fica, outro);
    txt := txt || E'\nRUIM 15. a producao juntou fichas';
  exception when insufficient_privilege then
    txt := txt || E'\nok   15. sem acesso, juntar e recusado';
  end;

  raise exception E'\nPROVA DA 082 (tudo desfeito)%', txt;
end $$;
