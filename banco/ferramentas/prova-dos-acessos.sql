-- ===========================================================================
-- PROVA DOS ACESSOS (migracao 028)
--
-- Roda no SQL Editor e desfaz tudo ao terminar: ela termina com um raise, que
-- e o que derruba a transacao inteira. Nada do que ela cria fica.
--
-- Ela prova a escada, a trava de papel, o cascade da chave, e o principal:
-- que a matriz e quem responde o que a pessoa enxerga.
-- ===========================================================================
do $$
declare
  eu     uuid;
  outro  uuid;
  r      text := E'\n';
  n      int;
  ok     boolean;
  linha  public.permissao;
  perfil record;
  pap    public.papel_do_sistema;
begin
  select id into eu from public.pessoa where papel = 'admin' and situacao = 'aprovado' limit 1;
  if eu is null then raise exception 'PROVA >> nao ha admin aprovado'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', eu)::text, true);

  -- ---------- a fundacao ----------
  select count(*) into n from public.papel_do_sistema;
  r := r || case when n >= 6 then 'ok    ' else 'FALHA ' end
         || 'os papeis viraram tabela [' || n || ' papel(is)]' || E'\n';

  select count(*) into n from public.permissao;
  r := r || case when n > 40 then 'ok    ' else 'FALHA ' end
         || 'a matriz nasceu preenchida [' || n || ' linha(s)]' || E'\n';

  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'pessoa' and column_name = 'papel'
     and data_type = 'text';
  r := r || case when n = 1 then 'ok    ' else 'FALHA ' end
         || 'a coluna papel da pessoa deixou de ser enum' || E'\n';

  -- ---------- a escada ----------
  begin
    insert into public.permissao (papel, painel, ver, editar, deletar, total)
    values ('analista', 'config', false, false, true, false);
    r := r || 'FALHA o banco aceitou deletar sem ver' || E'\n';
  exception when check_violation then
    r := r || 'ok    o banco recusa deletar sem ver (23514)' || E'\n';
  end;

  select * into linha from public.salvar_permissao('analista', 'config', false, false, true, false);
  r := r || case when linha.ver and linha.editar and linha.deletar then 'ok    ' else 'FALHA ' end
         || 'e salvar_permissao ARRUMA em vez de recusar: marcou deletar, acendeu ver e editar' || E'\n';

  select * into linha from public.salvar_permissao('analista', 'config', false, false, false, true);
  r := r || case when linha.total and linha.ver and linha.editar and linha.deletar then 'ok    ' else 'FALHA ' end
         || 'controle total acende os tres de baixo' || E'\n';

  perform public.salvar_permissao('analista', 'config', false, false, false, false);
  select count(*) into n from public.permissao where papel = 'analista' and painel = 'config';
  r := r || case when n = 0 then 'ok    ' else 'FALHA ' end
         || 'desmarcar ver apaga a linha, em vez de guardar quatro nao' || E'\n';

  -- ---------- o que o Henrique decidiu ----------
  select ver and editar into ok from public.permissao where papel = 'producao' and painel = 'pcp';
  r := r || case when ok then 'ok    ' else 'FALHA ' end
         || 'producao EDITA o PCP, senao quem confere nao marca e as duas aprovacoes viram uma' || E'\n';

  select ver and not editar into ok from public.permissao where papel = 'gerente' and painel = 'config';
  r := r || case when ok then 'ok    ' else 'FALHA ' end
         || 'gerente ve Configuracoes e nao edita' || E'\n';

  select count(*) into n from public.permissao where papel = 'gerente' and painel = 'kit';
  r := r || case when n = 0 then 'ok    ' else 'FALHA ' end
         || 'gerente nao entra no Design System' || E'\n';

  select total into ok from public.permissao where papel = 'vendedor' and painel = 'clientes';
  r := r || case when ok then 'ok    ' else 'FALHA ' end
         || 'vendedor tem controle total em Clientes, como ele pediu' || E'\n';

  -- ---------- a matriz manda no perfil ----------
  select * into perfil from public.meu_perfil;
  r := r || case when jsonb_exists(perfil.permissoes, 'config') then 'ok    ' else 'FALHA ' end
         || 'meu_perfil devolve as permissoes, e nao so a lista de paginas' || E'\n';
  r := r || case when array_length(perfil.paineis, 1) = (select count(*)::int from jsonb_object_keys(perfil.permissoes))
                 then 'ok    ' else 'FALHA ' end
         || 'a lista de paineis sai de dentro das permissoes, entao as duas nao discordam' || E'\n';

  r := r || case when public.posso('config', 'total') then 'ok    ' else 'FALHA ' end
         || 'posso() responde para o admin' || E'\n';
  r := r || case when not public.posso('config', 'inventado') then 'ok    ' else 'FALHA ' end
         || 'e nivel que nao existe responde nao, em vez de explodir' || E'\n';

  -- ---------- a lista propria da pessoa ----------
  select (public.permissoes_de('analista', array['config','relatorio']) -> 'config' ->> 'ver')::boolean
    into ok;
  r := r || case when ok then 'ok    ' else 'FALHA ' end
         || 'a lista propria da pessoa DA a pagina, mesmo que o papel nao tenha' || E'\n';

  select (public.permissoes_de('analista', array['config']) -> 'config' ->> 'editar')::boolean into ok;
  r := r || case when not ok then 'ok    ' else 'FALHA ' end
         || 'e nessa pagina ela ve e nao mexe: editar nasce do papel' || E'\n';

  select (public.permissoes_de('gerente', null) -> 'config' ->> 'ver')::boolean into ok;
  r := r || case when ok then 'ok    ' else 'FALHA ' end
         || 'sem lista propria, quem manda e o papel' || E'\n';

  -- ---------- papel novo, renomear, apagar ----------
  select * into pap from public.criar_papel('prova_diretor', 'Diretor de prova', 'papel da prova');
  r := r || case when pap.chave = 'prova_diretor' and not pap.fixo then 'ok    ' else 'FALHA ' end
         || 'papel novo nasce pela funcao, sem migracao' || E'\n';

  perform public.salvar_permissao('prova_diretor', 'pcp', true, true, false, false);
  select * into pap from public.salvar_papel('prova_diretor', 'prova_diretoria', 'Diretoria de prova', 'renomeada');
  select count(*) into n from public.permissao where papel = 'prova_diretoria' and painel = 'pcp';
  r := r || case when n = 1 then 'ok    ' else 'FALHA ' end
         || 'trocar a chave do papel leva a matriz junto (on update cascade)' || E'\n';

  begin
    perform public.salvar_papel('admin', 'chefao', 'Administrador', '');
    r := r || 'FALHA trocou a chave do admin' || E'\n';
  exception when others then
    r := r || 'ok    a chave do admin nao muda (' || sqlstate || ')' || E'\n';
  end;

  begin
    perform public.apagar_papel('admin');
    r := r || 'FALHA apagou o admin' || E'\n';
  exception when others then
    r := r || 'ok    o admin nao se apaga (' || sqlstate || ')' || E'\n';
  end;

  select count(*) into n from public.pessoa where papel = 'producao';
  if n > 0 then
    begin
      perform public.apagar_papel('producao');
      r := r || 'FALHA apagou um papel que tem gente dentro' || E'\n';
    exception when others then
      r := r || 'ok    papel com gente dentro nao se apaga (' || sqlstate || ')' || E'\n';
    end;
  else
    r := r || 'info  nenhuma pessoa com papel producao para provar a trava' || E'\n';
  end if;

  perform public.apagar_papel('prova_diretoria');
  select count(*) into n from public.permissao where papel = 'prova_diretoria';
  r := r || case when n = 0 then 'ok    ' else 'FALHA ' end
         || 'apagar o papel leva a matriz dele junto (on delete cascade)' || E'\n';

  -- ---------- a trava de papel ----------
  select id into outro from public.pessoa
   where papel <> 'admin' and situacao = 'aprovado' limit 1;
  if outro is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', outro)::text, true);
    begin
      perform public.salvar_permissao('analista', 'relatorio', true, true, false, false);
      r := r || 'FALHA quem nao e admin mexeu na matriz' || E'\n';
    exception when others then
      r := r || 'ok    so o admin mexe nos acessos (' || sqlstate || ')' || E'\n';
    end;
    begin
      perform public.criar_papel('prova_invasor', 'Invasor', '');
      r := r || 'FALHA quem nao e admin criou papel' || E'\n';
    exception when others then
      r := r || 'ok    so o admin cria papel (' || sqlstate || ')' || E'\n';
    end;
    perform set_config('request.jwt.claims', json_build_object('sub', eu)::text, true);
  else
    r := r || 'info  so existe admin aprovado, sem como provar a trava de papel' || E'\n';
  end if;

  -- ---------- a conferencia ----------
  select count(*) into n from public.conferir_os_acessos();
  r := r || 'info  conferir_os_acessos() achou ' || n || ' aviso(s)' || E'\n';
  for perfil in select * from public.conferir_os_acessos() loop
    r := r || '      ' || perfil.aviso || ': ' || perfil.detalhe || E'\n';
  end loop;

  select count(*) into n from regexp_matches(r, 'FALHA', 'g');
  raise exception 'PROVA DOS ACESSOS >> % %',
    case when n = 0 then 'tudo passou' else n || ' falha(s)' end, r;
end $$;
