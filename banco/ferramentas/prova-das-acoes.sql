do $$
declare
  eu    uuid;
  r     text := E'\n';
  n     int;
  ok    boolean;
  lista text[];
begin
  select id into eu from public.pessoa where papel = 'admin' and situacao = 'aprovado' limit 1;
  if eu is null then raise exception 'PROVA >> nao ha admin aprovado'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', eu)::text, true);

  select count(*) into n from public.acao;
  r := r || case when n = 14 then 'ok    ' else 'FALHA ' end
         || 'o catalogo tem so acao que a matriz manda [' || n || ']' || E'\n';

  select count(*) into n from public.permissao_da_acao;
  r := r || case when n > 30 then 'ok    ' else 'FALHA ' end
         || 'a matriz das acoes nasceu preenchida [' || n || ' linha(s)]' || E'\n';

  r := r || 'info  --- nada pode mudar de comportamento hoje: as passagens ---' || E'\n';

  lista := public.quem_pode_a_passagem('aprovado', 'separacao');
  r := r || case when lista @> array['admin','gerente','producao','estoquista']
                  and array_length(lista,1) = 4 then 'ok    ' else 'FALHA ' end
         || 'aprovado para separacao continua com os quatro [' || array_to_string(lista, ',') || ']' || E'\n';

  lista := public.quem_pode_a_passagem('pcp', 'producao');
  r := r || case when lista @> array['admin','gerente'] and array_length(lista,1) = 2
                 then 'ok    ' else 'FALHA ' end
         || 'O PORTAO continua so do admin e do gerente [' || array_to_string(lista, ',') || ']' || E'\n';

  lista := public.quem_pode_a_passagem('pronto', 'enviado');
  r := r || case when lista @> array['admin','gerente','vendedor'] then 'ok    ' else 'FALHA ' end
         || 'pronto para enviado continua com o vendedor' || E'\n';

  /* PASSAGEM QUE NAO EXISTE E PASSAGEM QUE NINGUEM PODE SAO COISAS DIFERENTES,
     e a 022 ja dizia isso: nulo quer dizer que o caminho nao existe, lista
     vazia quer dizer que existe e voce nao pode. As duas dao erro, com
     mensagens diferentes, e quem esta na tela precisa saber qual das duas e. */
  lista := public.quem_pode_a_passagem('aprovado', 'entregue');
  r := r || case when lista is null then 'ok    ' else 'FALHA ' end
         || 'pular do aprovado direto para o entregue nao existe, e devolve nulo' || E'\n';

  lista := public.quem_pode_a_passagem('cancelado', 'aprovado');
  r := r || case when lista @> array['admin'] then 'ok    ' else 'FALHA ' end
         || 'e ressuscitar um cancelado existe, e continua so do admin' || E'\n';

  r := r || 'info  --- e as acoes de pagina seguem a matriz de 21/09 ---' || E'\n';

  select exists (select 1 from public.permissao_da_acao
                  where papel = 'estoquista' and acao = 'separacao.separar') into ok;
  r := r || case when ok then 'ok    ' else 'FALHA ' end
         || 'o estoquista separa, porque ele EDITA a separacao' || E'\n';

  select exists (select 1 from public.permissao_da_acao
                  where papel = 'producao' and acao = 'separacao.separar') into ok;
  r := r || case when not ok then 'ok    ' else 'FALHA ' end
         || 'e a producao nao separa, porque ela so OLHA a separacao' || E'\n';

  select exists (select 1 from public.permissao_da_acao
                  where papel = 'vendedor' and acao = 'estoque.mexer') into ok;
  r := r || case when not ok then 'ok    ' else 'FALHA ' end
         || 'vendedor ve o estoque e nao mexe nele' || E'\n';

  r := r || 'info  --- a acao exige enxergar a pagina ---' || E'\n';

  r := r || case when public.posso_a_acao('separacao.separar') then 'ok    ' else 'FALHA ' end
         || 'o admin separa' || E'\n';

  perform public.salvar_permissao('admin', 'separacao', false, false, false, false);
  r := r || case when not public.posso_a_acao('separacao.separar') then 'ok    ' else 'FALHA ' end
         || 'tirando a pagina, a acao cai junto, mesmo com a linha da acao de pe' || E'\n';
  perform public.salvar_permissao('admin', 'separacao', false, false, false, true);
  r := r || case when public.posso_a_acao('separacao.separar') then 'ok    ' else 'FALHA ' end
         || 'e devolvendo a pagina ela volta' || E'\n';

  r := r || case when not public.posso_a_acao('acao.que.nao.existe') then 'ok    ' else 'FALHA ' end
         || 'acao inventada responde nao, em vez de explodir' || E'\n';

  r := r || 'info  --- a funcao pergunta mesmo ---' || E'\n';

  delete from public.permissao_da_acao where papel = 'admin' and acao = 'estoque.mexer';
  begin
    perform public.mexer_no_estoque(
      (select id from public.material limit 1), 1, 'entrada', 'prova');
    r := r || 'FALHA mexeu no estoque sem a acao' || E'\n';
  exception when others then
    r := r || 'ok    sem a acao, mexer_no_estoque recusa (' || sqlstate || ')' || E'\n';
  end;
  insert into public.permissao_da_acao (papel, acao) values ('admin', 'estoque.mexer');

  r := r || 'info  --- a conferencia ---' || E'\n';
  select count(*) into n from public.conferir_os_acessos();
  r := r || case when n = 0 then 'ok    ' else 'info  ' end
         || 'conferir_os_acessos() achou ' || n || ' aviso(s)' || E'\n';
  for lista in select array[aviso, detalhe] from public.conferir_os_acessos() loop
    r := r || '      ' || lista[1] || ': ' || lista[2] || E'\n';
  end loop;

  select count(*) into n from regexp_matches(r, 'FALHA', 'g');
  raise exception 'PROVA DAS ACOES >> % %',
    case when n = 0 then 'tudo passou' else n || ' falha(s)' end, r;
end $$;
