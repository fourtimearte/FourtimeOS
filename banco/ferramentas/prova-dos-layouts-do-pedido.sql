-- ===========================================================================
-- A PROVA DA 053: os layouts do pedido.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. O relatorio sai dentro da
-- mensagem de erro, uma linha por caso.
--
-- Ela cria as proprias referencias, as proprias pessoas, as proprias cotacoes
-- e os proprios pedidos. Nada do cadastro de verdade e tocado.
-- ===========================================================================
do $$
declare
  g uuid := gen_random_uuid();  -- gerente
  v uuid := gen_random_uuid();  -- vendedor, que le
  cot uuid; cot2 uuid; cot3 uuid; ped uuid; ped2 uuid; ped3 uuid;
  peca uuid; o_kit uuid; so_nome uuid;
  doc jsonb; corpo_torto jsonb;
  n int; t text; b boolean; r record;
  recusou boolean;
  txt text := '';
begin
  insert into public.convite (email, papel) values ('prova-lg@prova.test', 'gerente'), ('prova-lv@prova.test', 'vendedor');
  insert into auth.users (id, email) values (g, 'prova-lg@prova.test'), (v, 'prova-lv@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (g, 'Gerente da Prova', 'gerente', 'aprovado', 'prova-lg@prova.test'),
    (v, 'Vendedor da Prova', 'vendedor', 'aprovado', 'prova-lv@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = excluded.situacao, nome = excluded.nome;

  insert into public.grupo_de_referencia (cod, nome, ordem) values ('KIT', 'Kits (conjuntos)', 990) on conflict (cod) do nothing;
  insert into public.referencia (cod, nome, genero) values ('FT-998-001M', 'PECA DA PROVA 053', 'M') returning id into peca;
  insert into public.referencia (cod, nome, genero, grupo) values ('FT-KIT-998-001M-998-002M', 'KIT DA PROVA 053', 'M', 'KIT') returning id into o_kit;
  insert into public.referencia (cod, nome, genero) values ('', 'PECA SO COM NOME DA PROVA 053', 'M') returning id into so_nome;

  /* um orcamento com cinco modulos: dois layouts de verdade, um de
     informacoes, um sem peca nenhuma e um kit */
  doc := jsonb_build_object('produtos', jsonb_build_array(
    jsonb_build_object('bloco', jsonb_build_object(
      'n', 7, 'referencia', 'FT-998-001M', 'nomeDaReferencia', 'PECA DA PROVA 053', 'genero', 'masculino', 'faixa', 'adulto', 'arte', 'linha',
      'grade', jsonb_build_object('P', 10, 'M', 32, 'G', 0, 'GG', '', 'XG', 'x'),
      'design', jsonb_build_array(
        jsonb_build_object('tag', 'Patch', 'tecnica', 'patch'),
        jsonb_build_object('tag', 'Gola Tecido', 'tecnica', 'gola'),
        jsonb_build_object('tag', 'Subli', 'tecnica', 'subli'),
        jsonb_build_object('tag', 'Subli 2', 'tecnica', 'subli')),
      'imagem', 'data:image/png;base64,AAAA')),
    jsonb_build_object('bloco', jsonb_build_object(
      'n', 9, 'informacoes', true, 'referencia', 'FT-998-001M', 'grade', jsonb_build_object('P', 5))),
    jsonb_build_object('bloco', jsonb_build_object(
      'n', 2, 'referencia', 'FT-998-001M', 'nomeDaReferencia', 'PECA DA PROVA 053', 'grade', jsonb_build_object('P', 0))),
    jsonb_build_object('bloco', jsonb_build_object(
      'referencia', '', 'nomeDaReferencia', 'PECA SO COM NOME DA PROVA 053', 'grade', jsonb_build_object('4A', 8, '6A', 14),
      'design', jsonb_build_array(jsonb_build_object('tag', 'Silk', 'tecnica', 'silk')))),
    jsonb_build_object('bloco', jsonb_build_object(
      'n', 5, 'referencia', 'FT-KIT-998-001M-998-002M', 'nomeDaReferencia', 'KIT DA PROVA 053', 'grade', jsonb_build_object('M', 89)))));

  insert into public.cotacao (numero, corpo, versao_do_formato, cliente_nome)
    values ('CO-PROVA-053', doc, 4, 'Cliente da Prova 053') returning id into cot;
  insert into public.pedido (numero, cotacao_id) values ('PD-PROVA-053', cot) returning id into ped;

  -- 1. o pedido nasceu e os layouts foram copiados: tres, e nao cinco
  select count(*) into n from public.layout_do_pedido where pedido_id = ped;
  txt := txt || E'\n' || case when n = 3 then 'ok  ' else 'RUIM' end || ' 1. pedido novo: tres layouts copiados (o de informacoes e o sem peca ficam de fora)';

  -- 2. a grade vem limpa, e as pecas sao a soma dela
  select * into r from public.layout_do_pedido where pedido_id = ped and ordem = 1;
  txt := txt || E'\n' || case when r.grade = '{"P": 10, "M": 32}'::jsonb and r.pecas = 42 then 'ok  ' else 'RUIM' end
             || ' 2. a grade so com tamanho que tem peca (zero, vazio e letra saem), e as pecas sao a soma';

  -- 3. as tecnicas na ordem da fabrica, sem repetir e sem o acabamento
  txt := txt || E'\n' || case when r.tecnicas = array['subli', 'patch'] then 'ok  ' else 'RUIM' end
             || ' 3. as tecnicas na ordem da fabrica, uma vez cada, sem gola nem etiqueta';

  -- 4. o numero do layout e o do orcamento, e sem ele vale a posicao
  select count(*) into n from public.layout_do_pedido
   where pedido_id = ped and ((ordem = 1 and layout = 7) or (ordem = 4 and layout = 4) or (ordem = 5 and layout = 5));
  txt := txt || E'\n' || case when n = 3 and r.arte = 'linha' and r.nome = 'PECA DA PROVA 053' and r.genero = 'masculino' then 'ok  ' else 'RUIM' end
             || ' 4. o numero do layout e o do orcamento (L-07 na primeira posicao) e, sem ele, a posicao; a arte, o nome e o genero vem juntos';

  -- 5. a imagem do orcamento nao e copiada
  select to_jsonb(l) ? 'imagem' into b from public.layout_do_pedido l where pedido_id = ped and ordem = 1;
  txt := txt || E'\n' || case when not b then 'ok  ' else 'RUIM' end || ' 5. a copia nao leva a imagem da arte';

  -- 6. a view acha a referencia pelo codigo, e pelo nome quando nao ha codigo
  select count(*) into n from public.layout_na_fabrica f
   where pedido_id = ped and ((ordem = 1 and referencia_id = peca and not f.kit) or (ordem = 4 and referencia_id = so_nome and not f.kit));
  txt := txt || E'\n' || case when n = 2 then 'ok  ' else 'RUIM' end || ' 6. a view liga o layout a referencia, pelo codigo ou pelo nome';

  -- 7. a referencia do grupo KIT sai marcada como kit
  select count(*) into n from public.layout_na_fabrica f where pedido_id = ped and ordem = 5 and f.kit and referencia_id = o_kit and pecas = 89;
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 7. o layout de um kit sai marcado como kit';

  -- 8. a view traz o pedido e o cliente
  select count(*) into n from public.layout_na_fabrica where pedido_id = ped and numero = 'PD-PROVA-053' and cliente = 'Cliente da Prova 053' and estado = 'aprovado';
  txt := txt || E'\n' || case when n = 3 then 'ok  ' else 'RUIM' end || ' 8. cada linha da view traz o numero do pedido, o cliente e o estado';

  -- 9. mudou o corpo da cotacao aprovada: a copia acompanha
  update public.cotacao set corpo = jsonb_build_object('produtos', jsonb_build_array(
    jsonb_build_object('bloco', jsonb_build_object('n', 1, 'referencia', 'FT-998-001M', 'nomeDaReferencia', 'PECA DA PROVA 053', 'grade', jsonb_build_object('G', 7)))))
   where id = cot;
  select count(*), max(pecas) into n, r.pecas from public.layout_do_pedido where pedido_id = ped;
  txt := txt || E'\n' || case when n = 1 and r.pecas = 7 then 'ok  ' else 'RUIM' end || ' 9. o corpo da cotacao mudou: os layouts do pedido foram refeitos';

  -- 10. mudar outra coluna da cotacao nao mexe na copia
  update public.layout_do_pedido set arte = 'marca da prova' where pedido_id = ped;
  update public.cotacao set cliente_nome = 'Outro Nome da Prova 053' where id = cot;
  select count(*) into n from public.layout_do_pedido where pedido_id = ped and arte = 'marca da prova';
  txt := txt || E'\n' || case when n = 1 then 'ok  ' else 'RUIM' end || ' 10. mudar o nome do cliente na cotacao nao refaz a copia';

  -- 11. cotacao sem pedido: salvar o rascunho nao cria layout de ninguem
  insert into public.cotacao (numero, corpo, versao_do_formato, cliente_nome)
    values ('CO-PROVA-053-B', doc, 4, 'Rascunho da Prova 053') returning id into cot2;
  select count(*) into n from public.layout_do_pedido;
  update public.cotacao set corpo = doc where id = cot2;
  txt := txt || E'\n' || case when (select count(*) from public.layout_do_pedido) = n then 'ok  ' else 'RUIM' end
             || ' 11. rascunho salvo nao cria layout';

  -- 12. documento torto nao derruba o pedido: ele nasce, sem layouts
  corpo_torto := jsonb_build_object('produtos', jsonb_build_array(
    'uma frase', jsonb_build_object('bloco', 'outra frase'),
    jsonb_build_object('bloco', jsonb_build_object('n', 'tres', 'referencia', 'FT-998-001M', 'grade', 'nao e objeto', 'design', 'nao e lista')),
    jsonb_build_object('bloco', jsonb_build_object('n', 'tres', 'referencia', 'FT-998-001M', 'grade', jsonb_build_object('P', 3), 'design', jsonb_build_object('tecnica', 'subli')))));
  insert into public.cotacao (numero, corpo, versao_do_formato, cliente_nome)
    values ('CO-PROVA-053-C', corpo_torto, 4, 'Torto da Prova 053') returning id into cot3;
  insert into public.pedido (numero, cotacao_id) values ('PD-PROVA-053-C', cot3) returning id into ped3;
  select count(*) into n from public.layout_do_pedido where pedido_id = ped3 and ordem = 4 and layout = 4 and pecas = 3 and tecnicas = '{}';
  txt := txt || E'\n' || case when n = 1 and (select count(*) from public.layout_do_pedido where pedido_id = ped3) = 1 then 'ok  ' else 'RUIM' end
             || ' 12. documento torto: o pedido nasce, e so o layout que da para ler e copiado';

  -- 13. cotacao sem produtos: pedido nasce com zero layouts
  insert into public.pedido (numero, cotacao_id) values ('PD-PROVA-053-B', (select id from public.cotacao where numero = 'CO-PROVA-053-B')) returning id into ped2;
  update public.cotacao set corpo = '{}'::jsonb where id = cot2;
  txt := txt || E'\n' || case when (select count(*) from public.layout_do_pedido where pedido_id = ped2) = 0 then 'ok  ' else 'RUIM' end
             || ' 13. cotacao que ficou sem produtos: o pedido fica sem layouts';

  -- 14. quem so le ve a view, e ninguem escreve na tabela por fora
  perform set_config('request.jwt.claim.sub', v::text, true);
  set local role authenticated;
  select count(*) into n from public.layout_na_fabrica where pedido_id = ped;
  recusou := false;
  begin update public.layout_do_pedido set pecas = 999 where pedido_id = ped; exception when insufficient_privilege then recusou := true; end;
  if recusou then recusou := false; begin insert into public.layout_do_pedido (pedido_id, ordem, layout, pecas) values (ped, 99, 99, 1); exception when insufficient_privilege then recusou := true; end; end if;
  if recusou then recusou := false; begin perform public.copiar_layouts_do_pedido(ped); exception when insufficient_privilege then recusou := true; end; end if;
  txt := txt || E'\n' || case when n = 1 and recusou then 'ok  ' else 'RUIM' end || ' 14. o vendedor le a view; escrever na tabela e chamar a copia, ninguem de fora faz';
  reset role;

  -- 15. pedido cancelado sai da view, e a copia fica guardada
  perform set_config('request.jwt.claim.sub', g::text, true);
  set local role authenticated;
  perform public.mover_pedido(ped, 'cancelado');
  reset role;
  txt := txt || E'\n' || case when (select count(*) from public.layout_na_fabrica where pedido_id = ped) = 0
                                and (select count(*) from public.layout_do_pedido where pedido_id = ped) = 1 then 'ok  ' else 'RUIM' end
             || ' 15. pedido cancelado nao aparece na view';

  -- 16. apagar o pedido leva os layouts dele
  delete from public.pedido where id = ped3;
  txt := txt || E'\n' || case when (select count(*) from public.layout_do_pedido where pedido_id = ped3) = 0 then 'ok  ' else 'RUIM' end
             || ' 16. apagar o pedido leva os layouts junto';

  raise exception E'\nPROVA DOS LAYOUTS DO PEDIDO (053)%\n\nNada foi gravado: este erro e de proposito e desfaz tudo.', txt;
end $$;
