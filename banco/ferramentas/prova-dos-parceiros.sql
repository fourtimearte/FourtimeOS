-- ===========================================================================
-- A PROVA DA 043 E DA 044: os parceiros da loja.
--
-- Roda no SQL Editor quantas vezes quiser: termina levantando um erro de
-- proposito, e por isso tudo que fez e desfeito. O relatorio sai dentro da
-- mensagem de erro, uma linha por caso.
--
-- Ela veste duas pessoas (admin e vendedor), faz o papel do porteiro (que
-- registra o pedido da loja) e o do parceiro (que abre a pagina sem entrar no
-- sistema, pelo papel anon). A regra mora no banco, entao o teste tambem.
-- ===========================================================================
do $$
declare
  a uuid := gen_random_uuid();  -- admin
  v uuid := gen_random_uuid();  -- vendedor, que nem ve
  g uuid; vi uuid; y uuid;      -- os tres parceiros
  r record;
  j jsonb;
  txt text := '';
  n int;
  chave_g text; senha_g text; chave_velha text;
  antes timestamptz := now() - interval '40 days';
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  insert into public.convite (email, papel) values
    ('prova-pa@prova.test', 'admin'), ('prova-pv@prova.test', 'vendedor');
  insert into auth.users (id, email) values
    (a, 'prova-pa@prova.test'), (v, 'prova-pv@prova.test');
  insert into public.pessoa (id, nome, papel, situacao, email) values
    (a, 'Admin da Prova', 'admin', 'aprovado', 'prova-pa@prova.test'),
    (v, 'Venda da Prova', 'vendedor', 'aprovado', 'prova-pv@prova.test')
  on conflict (id) do update set papel = excluded.papel, situacao = 'aprovado', nome = excluded.nome;

  -- 1. o vendedor nao cadastra parceiro
  perform set_config('request.jwt.claim.sub', v::text, true);
  begin
    perform public.salvar_parceiro(null, 'Parceiro do Vendedor', '', '', true);
    txt := txt || E'\nRUIM 1. vendedor cadastrou parceiro';
  exception when insufficient_privilege then
    txt := txt || E'\nok   1. vendedor nao cadastra parceiro';
  end;

  -- 2. o admin cadastra tres, e o link e a senha nascem sozinhos
  perform set_config('request.jwt.claim.sub', a::text, true);
  g  := public.salvar_parceiro(null, 'Goias da Prova', 'colecao-goias-prova', 'Goias da Prova Completo', true);
  vi := public.salvar_parceiro(null, 'Viapol da Prova', 'colecao-viapol-prova', 'Viapol da Prova', true);
  y  := public.salvar_parceiro(null, 'Colegio da Prova', 'colecao-colegio-prova', 'Colegio da Prova', true);
  select * into r from public.parceiro where id = g;
  chave_g := r.chave; senha_g := r.senha;
  txt := txt || E'\n' || case when length(r.chave) = 32 and r.senha ~ '^[A-HJ-NP-Z2-9]{8}$' and r.ativo
                              then 'ok  ' else 'RUIM' end
             || ' 2. parceiro nasce com link de 32 caracteres e senha de 8 (' || length(r.chave) || ', ' || length(r.senha) || ')';

  -- 3. nome e colecao repetidos sao recusados
  begin
    perform public.salvar_parceiro(null, 'goias da prova', '', '', true);
    txt := txt || E'\nRUIM 3. aceitou nome repetido';
  exception when unique_violation then
    txt := txt || E'\nok   3. nome repetido e recusado';
  end;
  begin
    perform public.salvar_parceiro(null, 'Outro da Prova', 'colecao-goias-prova', '', true);
    txt := txt || E'\nRUIM 3b. aceitou colecao de outro parceiro';
  exception when unique_violation then
    txt := txt || E'\nok   3b. colecao de outro parceiro e recusada';
  end;

  -- 4. os acordos: percentual sobre o pago, valor por peca, percentual sobre o cheio
  perform public.salvar_acordo_do_parceiro(g,  'percentual',     10, 'valor_pago',  hoje - 60);
  perform public.salvar_acordo_do_parceiro(vi, 'valor_por_peca', 25, 'valor_pago',  hoje - 60);
  perform public.salvar_acordo_do_parceiro(y,  'percentual',     15, 'preco_cheio', hoje - 60);
  select count(*) into n from public.acordo_do_parceiro where parceiro_id in (g, vi, y);
  txt := txt || E'\n' || case when n = 3 then 'ok  ' else 'RUIM' end || ' 4. tres acordos gravados, com data no passado e sem venda (' || n || ')';
  begin
    perform public.salvar_acordo_do_parceiro(g, 'percentual', 120, 'valor_pago', hoje);
    txt := txt || E'\nRUIM 4b. aceitou percentual acima de 100';
  exception when check_violation then
    txt := txt || E'\nok   4b. percentual acima de 100 e recusado';
  end;

  -- 5. o porteiro registra os produtos; produto de um nao passa para outro
  perform set_config('request.jwt.claim.sub', '', true);
  n := public.registrar_produtos_do_parceiro(g, '[{"id": 900101, "titulo": "Camisa Verde"}, {"id": 900102, "titulo": "Camisa Branca"}]'::jsonb);
  perform public.registrar_produtos_do_parceiro(vi, '[{"id": 900201, "titulo": "Camisa Azul"}, {"id": 900101, "titulo": "Tentativa"}]'::jsonb);
  perform public.registrar_produtos_do_parceiro(y, '[{"id": 900301, "titulo": "Moletom"}]'::jsonb);
  txt := txt || E'\n' || case when n = 2
                               and (select parceiro_id from public.produto_do_parceiro where produto_id = 900101) = g
                               and (select titulo from public.produto_do_parceiro where produto_id = 900101) = 'Camisa Verde'
                               and (select produtos_em from public.parceiro where id = g) is not null
                              then 'ok  ' else 'RUIM' end
             || ' 5. produtos registrados, e produto que ja e de um parceiro nao muda de dono';

  -- 6. um pedido pago, com desconto, de 40 dias atras: 10% sobre o que foi pago
  j := public.registrar_pedido_da_loja(jsonb_build_object(
         'id', 800001, 'nome', '#P1', 'criado_em', antes, 'atualizado_em', antes,
         'situacao', 'paid', 'teste', false,
         'itens', jsonb_build_array(
           jsonb_build_object('id', 700001, 'produto_id', 900101, 'variante_id', 1, 'produto', 'Camisa Verde',
                              'variante', 'M', 'quantidade', 2, 'devolvida', 0, 'preco', 100, 'desconto', 20),
           jsonb_build_object('id', 700002, 'produto_id', 999999, 'variante_id', 2, 'produto', 'Peca da Casa',
                              'variante', 'G', 'quantidade', 1, 'devolvida', 0, 'preco', 50, 'desconto', 0))),
       'orders/paid');
  select * into r from public.venda_do_parceiro where item_id = 700001;
  txt := txt || E'\n' || case when (j ->> 'itens')::int = 2 and r.parceiro_id = g and r.conta and r.pecas = 2
                               and r.valor = 180 and r.cheio = 200 and r.parte = 18
                              then 'ok  ' else 'RUIM' end
             || ' 6. venda paga com desconto: 2 pecas, R$ 180 pagos, parte de 10% = R$ 18 (' || coalesce(r.parte::text, 'nula') || ')';
  select count(*) into n from public.venda_do_parceiro where item_id = 700002;
  txt := txt || E'\n' || case when n = 0 and exists (select 1 from public.venda_da_loja where item_id = 700002)
                              then 'ok  ' else 'RUIM' end
             || ' 6b. peca que nao e de parceiro fica guardada e nao aparece para ninguem';

  -- 7. valor por peca: 3 pecas a R$ 25
  perform public.registrar_pedido_da_loja(jsonb_build_object(
         'id', 800002, 'nome', '#P2', 'criado_em', antes, 'atualizado_em', antes, 'situacao', 'paid',
         'itens', jsonb_build_array(
           jsonb_build_object('id', 700003, 'produto_id', 900201, 'produto', 'Camisa Azul', 'variante', 'P',
                              'quantidade', 3, 'devolvida', 0, 'preco', 239.90, 'desconto', 0))), 'orders/paid');
  select * into r from public.venda_do_parceiro where item_id = 700003;
  txt := txt || E'\n' || case when r.parceiro_id = vi and r.pecas = 3 and r.valor = 719.70 and r.parte = 75
                              then 'ok  ' else 'RUIM' end
             || ' 7. valor por peca: 3 pecas, parte de R$ 75 (' || coalesce(r.parte::text, 'nula') || ')';

  -- 8. percentual sobre o preco cheio: o desconto nao diminui a parte
  perform public.registrar_pedido_da_loja(jsonb_build_object(
         'id', 800003, 'nome', '#P3', 'criado_em', antes, 'atualizado_em', antes, 'situacao', 'paid',
         'itens', jsonb_build_array(
           jsonb_build_object('id', 700004, 'produto_id', 900301, 'produto', 'Moletom', 'variante', '10 anos',
                              'quantidade', 1, 'devolvida', 0, 'preco', 200, 'desconto', 40))), 'orders/paid');
  select * into r from public.venda_do_parceiro where item_id = 700004;
  txt := txt || E'\n' || case when r.valor = 160 and r.cheio = 200 and r.parte = 30
                              then 'ok  ' else 'RUIM' end
             || ' 8. 15% sobre o preco cheio: pago R$ 160, parte de R$ 30 (' || coalesce(r.parte::text, 'nula') || ')';

  -- 9. devolucao de uma das duas pecas: a linha passa a contar uma
  perform public.registrar_pedido_da_loja(jsonb_build_object(
         'id', 800001, 'nome', '#P1', 'criado_em', antes, 'atualizado_em', antes + interval '2 days',
         'situacao', 'partially_refunded',
         'itens', jsonb_build_array(
           jsonb_build_object('id', 700001, 'produto_id', 900101, 'produto', 'Camisa Verde', 'variante', 'M',
                              'quantidade', 2, 'devolvida', 1, 'preco', 100, 'desconto', 20))), 'orders/updated');
  select * into r from public.venda_do_parceiro where item_id = 700001;
  txt := txt || E'\n' || case when r.conta and r.pecas = 1 and r.valor = 90 and r.parte = 9
                              then 'ok  ' else 'RUIM' end
             || ' 9. uma das duas devolvida: conta 1 peca, R$ 90, parte de R$ 9 (' || coalesce(r.parte::text, 'nula') || ')';

  -- 10. aviso mais velho que o guardado nao pisa no novo
  perform public.registrar_pedido_da_loja(jsonb_build_object(
         'id', 800001, 'nome', '#P1', 'criado_em', antes, 'atualizado_em', antes + interval '1 day',
         'situacao', 'paid',
         'itens', jsonb_build_array(
           jsonb_build_object('id', 700001, 'produto_id', 900101, 'produto', 'Camisa Verde', 'variante', 'M',
                              'quantidade', 2, 'devolvida', 0, 'preco', 100, 'desconto', 20))), 'orders/paid');
  select * into r from public.venda_da_loja where item_id = 700001;
  txt := txt || E'\n' || case when r.devolvida = 1 and r.situacao = 'partially_refunded' then 'ok  ' else 'RUIM' end
             || ' 10. aviso atrasado nao desfaz a devolucao';

  -- 11. pedido cancelado: aparece, e nao conta
  perform public.registrar_pedido_da_loja(jsonb_build_object(
         'id', 800002, 'nome', '#P2', 'criado_em', antes, 'atualizado_em', antes + interval '3 days',
         'situacao', 'paid', 'cancelado_em', antes + interval '3 days',
         'itens', jsonb_build_array(
           jsonb_build_object('id', 700003, 'produto_id', 900201, 'produto', 'Camisa Azul', 'variante', 'P',
                              'quantidade', 3, 'devolvida', 0, 'preco', 239.90, 'desconto', 0))), 'orders/cancelled');
  select * into r from public.venda_do_parceiro where item_id = 700003;
  txt := txt || E'\n' || case when not r.conta and r.aparece and r.motivo = 'cancelada' and r.pecas = 0 and r.parte = 0
                              then 'ok  ' else 'RUIM' end
             || ' 11. pedido cancelado aparece como cancelada e nao conta';

  -- 12. pedido que nunca foi pago nao e venda; devolvido inteiro aparece e nao conta
  perform public.registrar_pedido_da_loja(jsonb_build_object(
         'id', 800004, 'nome', '#P4', 'criado_em', antes, 'atualizado_em', antes, 'situacao', 'EXPIRED',
         'itens', jsonb_build_array(
           jsonb_build_object('id', 700005, 'produto_id', 900102, 'produto', 'Camisa Branca', 'variante', 'G',
                              'quantidade', 1, 'devolvida', 0, 'preco', 249.90, 'desconto', 0))), 'orders/updated');
  perform public.registrar_pedido_da_loja(jsonb_build_object(
         'id', 800005, 'nome', '#P5', 'criado_em', antes, 'atualizado_em', antes, 'situacao', 'refunded',
         'itens', jsonb_build_array(
           jsonb_build_object('id', 700006, 'produto_id', 900102, 'produto', 'Camisa Branca', 'variante', 'GG',
                              'quantidade', 1, 'devolvida', 0, 'preco', 249.90, 'desconto', 0))), 'orders/updated');
  select * into r from public.venda_do_parceiro where item_id = 700005;
  txt := txt || E'\n' || case when not r.conta and not r.aparece and r.situacao = 'expired' then 'ok  ' else 'RUIM' end
             || ' 12. Pix vencido nao conta nem aparece';
  select * into r from public.venda_do_parceiro where item_id = 700006;
  txt := txt || E'\n' || case when not r.conta and r.aparece and r.motivo = 'devolvida' then 'ok  ' else 'RUIM' end
             || ' 12b. pedido devolvido inteiro aparece como devolvida e nao conta';

  -- 13. pedido de teste da loja e anotado e nao e gravado
  j := public.registrar_pedido_da_loja(jsonb_build_object(
         'id', 800099, 'nome', '#TESTE', 'criado_em', now(), 'atualizado_em', now(), 'situacao', 'paid', 'teste', true,
         'itens', jsonb_build_array(
           jsonb_build_object('id', 700099, 'produto_id', 900101, 'produto', 'Camisa Verde', 'variante', 'M',
                              'quantidade', 9, 'devolvida', 0, 'preco', 1, 'desconto', 0))), 'orders/paid');
  txt := txt || E'\n' || case when not exists (select 1 from public.venda_da_loja where pedido_id = 800099)
                               and exists (select 1 from public.aviso_da_loja where pedido_id = 800099)
                               and (j ->> 'teste')::boolean
                              then 'ok  ' else 'RUIM' end
             || ' 13. pedido de teste da loja fica no registro de avisos e fora das vendas';

  -- 14. acordo novo a partir de hoje: a venda antiga fica com o acordo antigo
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.salvar_acordo_do_parceiro(g, 'percentual', 20, 'valor_pago', hoje);
  perform set_config('request.jwt.claim.sub', '', true);
  perform public.registrar_pedido_da_loja(jsonb_build_object(
         'id', 800006, 'nome', '#P6', 'criado_em', now(), 'atualizado_em', now(), 'situacao', 'paid',
         'itens', jsonb_build_array(
           jsonb_build_object('id', 700007, 'produto_id', 900102, 'produto', 'Camisa Branca', 'variante', 'M',
                              'quantidade', 1, 'devolvida', 0, 'preco', 250, 'desconto', 0))), 'orders/paid');
  txt := txt || E'\n' || case when (select parte from public.venda_do_parceiro where item_id = 700001) = 9
                               and (select parte from public.venda_do_parceiro where item_id = 700007) = 50
                              then 'ok  ' else 'RUIM' end
             || ' 14. acordo novo vale para a venda de hoje (20%) e a antiga fica com o antigo (10%)';

  -- 15. acordo com data no passado, havendo venda: so com confirmacao
  perform set_config('request.jwt.claim.sub', a::text, true);
  begin
    perform public.salvar_acordo_do_parceiro(g, 'percentual', 30, 'valor_pago', hoje - 50);
    txt := txt || E'\nRUIM 15. mudou venda passada sem confirmar';
  exception when check_violation then
    txt := txt || E'\nok   15. acordo que muda venda passada pede confirmacao';
  end;
  perform public.salvar_acordo_do_parceiro(g, 'percentual', 30, 'valor_pago', hoje - 50, true);
  select count(*) into n from public.acordo_do_parceiro where parceiro_id = g;
  txt := txt || E'\n' || case when n = 2
                               and (select parte from public.venda_do_parceiro where item_id = 700001) = 27
                               and (select parte from public.venda_do_parceiro where item_id = 700007) = 75
                               and not exists (select 1 from public.acordo_do_parceiro where parceiro_id = g and vale_desde = hoje)
                              then 'ok  ' else 'RUIM' end
             || ' 15b. confirmado, refaz a conta (R$ 27 e R$ 75) e apaga o acordo que vinha depois (' || n || ' acordos)';

  -- 16. a pagina do parceiro, pelo papel anon: link errado, senha errada, trava
  set local role anon;
  j := public.painel_do_parceiro('chave-que-nao-existe', senha_g);
  reset role;
  txt := txt || E'\n' || case when (j ->> 'ok') = 'false' and j ->> 'erro' = 'indisponivel' then 'ok  ' else 'RUIM' end
             || ' 16. link que nao existe: pagina indisponivel';
  set local role anon;
  j := public.painel_do_parceiro(chave_g, 'ERRADA');
  reset role;
  txt := txt || E'\n' || case when j ->> 'erro' = 'senha' and (j ->> 'restam')::int = 4 then 'ok  ' else 'RUIM' end
             || ' 16b. senha errada: restam 4 tentativas';
  set local role anon;
  perform public.painel_do_parceiro(chave_g, 'ERRADA');
  perform public.painel_do_parceiro(chave_g, 'ERRADA');
  perform public.painel_do_parceiro(chave_g, 'ERRADA');
  j := public.painel_do_parceiro(chave_g, 'ERRADA');
  reset role;
  txt := txt || E'\n' || case when j ->> 'erro' = 'travado' and (j ->> 'minutos')::int = 15 then 'ok  ' else 'RUIM' end
             || ' 16c. quinta senha errada trava por 15 minutos';
  set local role anon;
  j := public.painel_do_parceiro(chave_g, senha_g);
  reset role;
  txt := txt || E'\n' || case when j ->> 'erro' = 'travado' then 'ok  ' else 'RUIM' end
             || ' 16d. travada, nem a senha certa abre';

  -- 17. gerar outra senha destrava; a antiga para de abrir; a nova abre
  senha_g := public.trocar_senha_do_parceiro(g);
  set local role anon;
  j := public.painel_do_parceiro(chave_g, lower(senha_g));
  reset role;
  txt := txt || E'\n' || case when (j ->> 'ok') = 'true' and j ->> 'parceiro' = 'Goias da Prova'
                               and (select aberta_em from public.parceiro where id = g) is not null
                              then 'ok  ' else 'RUIM' end
             || ' 17. senha nova destrava e abre, mesmo digitada em minusculas';

  -- 18. o que a pagina recebe: os totais, as vendas que aparecem, e nada alem
  select coalesce(sum((m ->> 'pecas')::int), 0) into n from jsonb_array_elements(j -> 'meses') m;
  txt := txt || E'\n' || case when n = 2
                               and jsonb_array_length(j -> 'vendas') = 3
                               and (j -> 'acordo' ->> 'valor')::numeric = 30
                               and not (j::text ~ 'pedido|item_id|produto_id|chave|senha')
                              then 'ok  ' else 'RUIM' end
             || ' 18. o painel traz 2 pecas que contam, 3 linhas (uma devolvida) e nenhum id nem numero de pedido (' || n || ', ' || jsonb_array_length(j -> 'vendas') || ')';

  -- 19. pagina desligada e link trocado
  perform public.salvar_parceiro(vi, 'Viapol da Prova', 'colecao-viapol-prova', 'Viapol da Prova', false);
  select chave, senha into r from public.parceiro where id = vi;
  set local role anon;
  j := public.painel_do_parceiro(r.chave, r.senha);
  reset role;
  txt := txt || E'\n' || case when j ->> 'erro' = 'indisponivel' then 'ok  ' else 'RUIM' end
             || ' 19. pagina desligada fica indisponivel';
  chave_velha := chave_g;
  chave_g := public.trocar_link_do_parceiro(g);
  set local role anon;
  j := public.painel_do_parceiro(chave_velha, senha_g);
  reset role;
  txt := txt || E'\n' || case when j ->> 'erro' = 'indisponivel' and chave_g <> chave_velha then 'ok  ' else 'RUIM' end
             || ' 19b. link trocado: o antigo para de abrir';

  -- 20. o papel anon nao le tabela nenhuma nem registra pedido
  begin
    set local role anon;
    select count(*) into n from public.parceiro;
    reset role;
    txt := txt || E'\nRUIM 20. anon leu a tabela de parceiros';
  exception when insufficient_privilege then
    reset role;
    txt := txt || E'\nok   20. quem nao entrou no sistema nao le a tabela de parceiros';
  end;
  begin
    set local role anon;
    perform public.registrar_pedido_da_loja('{"id": 1}'::jsonb, 'x');
    reset role;
    txt := txt || E'\nRUIM 20b. anon registrou pedido';
  exception when insufficient_privilege then
    reset role;
    txt := txt || E'\nok   20b. quem nao entrou no sistema nao registra pedido';
  end;

  -- 21. quem entrou tambem nao registra pedido nem produto, nem grava direto
  begin
    set local role authenticated;
    perform public.registrar_pedido_da_loja('{"id": 1}'::jsonb, 'x');
    reset role;
    txt := txt || E'\nRUIM 21. o admin registrou pedido pela mao';
  exception when insufficient_privilege then
    reset role;
    txt := txt || E'\nok   21. nem o admin registra pedido: so o porteiro';
  end;
  begin
    set local role authenticated;
    insert into public.venda_da_loja (item_id, pedido_id, vendido_em, quantidade, preco, atualizado_em)
      values (1, 1, now(), 1, 1, now());
    reset role;
    txt := txt || E'\nRUIM 21b. gravou venda direto na tabela';
  exception when insufficient_privilege then
    reset role;
    txt := txt || E'\nok   21b. ninguem grava venda direto na tabela';
  end;
  begin
    set local role authenticated;
    update public.parceiro set senha = 'AAAAAAAA' where id = g;
    reset role;
    txt := txt || E'\nRUIM 21c. trocou a senha direto na tabela';
  exception when insufficient_privilege then
    reset role;
    txt := txt || E'\nok   21c. ninguem troca senha direto na tabela';
  end;
  txt := txt || E'\n' || case when has_function_privilege('service_role', 'public.registrar_pedido_da_loja(jsonb, text, text)', 'execute')
                               and has_function_privilege('service_role', 'public.registrar_produtos_do_parceiro(uuid, jsonb)', 'execute')
                               and has_function_privilege('service_role', 'public.colecoes_dos_parceiros()', 'execute')
                              then 'ok  ' else 'RUIM' end
             || ' 21d. o porteiro (chave de servico) chama as tres funcoes dele';

  -- 22. o admin le pelo caminho do usuario; o vendedor nao ve nada
  set local role authenticated;
  select count(*) into n from public.venda_do_parceiro where parceiro_id = g;
  reset role;
  txt := txt || E'\n' || case when n = 4 then 'ok  ' else 'RUIM' end || ' 22. o admin le as vendas do parceiro (' || n || ')';
  perform set_config('request.jwt.claim.sub', v::text, true);
  set local role authenticated;
  select count(*) into n from public.parceiro;
  select n + count(*) into n from public.parceiro_na_lista;
  select n + count(*) into n from public.venda_da_loja;
  select n + count(*) into n from public.venda_do_parceiro;
  select n + count(*) into n from public.acordo_do_parceiro;
  select n + count(*) into n from public.aviso_da_loja;
  reset role;
  txt := txt || E'\n' || case when n = 0 then 'ok  ' else 'RUIM' end || ' 22b. vendedor nao ve parceiro, venda, acordo nem aviso (' || n || ' linhas)';

  -- 23. trocar a colecao esvazia a lista de produtos, e as vendas somem do parceiro
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.salvar_parceiro(y, 'Colegio da Prova', 'colecao-outra-prova', 'Outra', true);
  txt := txt || E'\n' || case when not exists (select 1 from public.produto_do_parceiro where parceiro_id = y)
                               and (select produtos_em from public.parceiro where id = y) is null
                               and not exists (select 1 from public.venda_do_parceiro where parceiro_id = y)
                               and exists (select 1 from public.venda_da_loja where item_id = 700004)
                              then 'ok  ' else 'RUIM' end
             || ' 23. trocar a colecao esvazia os produtos; a venda continua guardada';

  -- 24. as colecoes que o porteiro le: a de todo parceiro, com a pagina ligada ou nao (044)
  select count(*) into n from public.colecoes_dos_parceiros() c where c.parceiro_id in (g, vi, y);
  txt := txt || E'\n' || case when n = 3 then 'ok  ' else 'RUIM' end
             || ' 24. o porteiro le a colecao dos tres, inclusive do que esta com a pagina desligada (' || n || ')';
  perform set_config('request.jwt.claim.sub', '', true);
  /* so o parceiro desligado fica sem leitura: e ele que tem de bastar para pedir a releitura */
  update public.parceiro set produtos_em = now() where id in (g, y);
  update public.parceiro set produtos_em = null where id = vi;
  j := public.registrar_pedido_da_loja(jsonb_build_object(
         'id', 800007, 'nome', '#P7', 'criado_em', now(), 'atualizado_em', now(), 'situacao', 'paid',
         'itens', jsonb_build_array(
           jsonb_build_object('id', 700008, 'produto_id', 999998, 'produto', 'Produto novo', 'variante', 'M',
                              'quantidade', 1, 'devolvida', 0, 'preco', 10, 'desconto', 0))), 'orders/paid');
  txt := txt || E'\n' || case when (j ->> 'reler_produtos')::boolean then 'ok  ' else 'RUIM' end
             || ' 24b. produto sem dono manda reler os produtos mesmo quando so o parceiro desligado esta sem leitura';
  perform set_config('request.jwt.claim.sub', a::text, true);

  -- 25. a lista do OS: acordo de hoje e contagem de produtos
  select * into r from public.parceiro_na_lista where id = g;
  txt := txt || E'\n' || case when r.acordo_tipo = 'percentual' and r.acordo_valor = 30 and r.produtos = 2 and r.ultimo_valor = 30
                              then 'ok  ' else 'RUIM' end
             || ' 25. a lista traz o acordo de hoje e os 2 produtos';

  raise exception E'PROVA DA 043 (tudo desfeito):%', txt;
end $$;
