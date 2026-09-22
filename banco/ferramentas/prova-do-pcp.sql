do $$
declare
  eu     uuid;
  id_ped uuid;
  est    text;
  r      text := E'\n';
  n      int;
  ok     boolean;
begin
  select id into eu from public.pessoa where papel = 'admin' and situacao = 'aprovado' limit 1;
  if eu is null then raise exception 'PROVA >> nao ha admin aprovado'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', eu)::text, true);

  -- um pedido de verdade, andando ate o PCP um degrau de cada vez
  select id, estado::text into id_ped, est from public.pedido
   where estado in ('pcp','producao','separacao','aprovado') order by criado_em desc limit 1;
  if id_ped is null then raise exception 'PROVA >> nenhum pedido para usar'; end if;

  if est = 'producao' then update public.pedido set estado = 'pcp' where id = id_ped;
  elsif est = 'separacao' then update public.pedido set estado = 'pcp' where id = id_ped;
  elsif est = 'aprovado' then
    update public.pedido set estado = 'separacao' where id = id_ped;
    update public.pedido set estado = 'pcp' where id = id_ped;
  end if;
  select estado::text into est from public.pedido where id = id_ped;
  r := r || case when est = 'pcp' then 'ok    ' else 'FALHA ' end
         || 'o pedido esta no PCP [' || est || ']' || E'\n';

  update public.pedido set marcado_em = null, marcado_por = null,
         devolvido_motivo = '', devolvido_em = null where id = id_ped;

  -- ---------- a segunda trava ----------
  begin
    perform public.liberar_para_producao(id_ped, '[{"tecnica":"subli","layouts":[1],"pecas":1}]'::jsonb);
    r := r || 'FALHA liberou um pedido que ninguem marcou' || E'\n';
  exception when others then
    r := r || 'ok    NAO LIBERA sem a marca do PCP (' || sqlstate || ')' || E'\n';
  end;

  -- ---------- marcar ----------
  perform public.marcar_para_aprovacao(id_ped);
  select marcado_em is not null into ok from public.pedido where id = id_ped;
  r := r || case when ok then 'ok    ' else 'FALHA ' end || 'marcar carimba quem e quando' || E'\n';
  select estado::text into est from public.pedido where id = id_ped;
  r := r || case when est = 'pcp' then 'ok    ' else 'FALHA ' end
         || 'e MARCAR NAO MOVE O PEDIDO: ele continua no PCP [' || est || ']' || E'\n';

  -- ---------- devolver ----------
  begin
    perform public.devolver_do_pcp(id_ped, 'x');
    r := r || 'FALHA devolveu sem motivo de verdade' || E'\n';
  exception when others then
    r := r || 'ok    o motivo e obrigatorio (' || sqlstate || ')' || E'\n';
  end;

  perform public.devolver_do_pcp(id_ped, 'Falta confirmar a malha com o cliente.');
  select estado::text into est from public.pedido where id = id_ped;
  select marcado_em is null and devolvido_motivo <> '' into ok from public.pedido where id = id_ped;
  r := r || case when ok then 'ok    ' else 'FALHA ' end
         || 'devolver derruba a marca e guarda o motivo' || E'\n';
  r := r || case when est = 'pcp' then 'ok    ' else 'FALHA ' end
         || 'e DEVOLVER NAO VOLTA DE ESTADO: o pedido nunca saiu do PCP [' || est || ']' || E'\n';

  -- ---------- marcar de novo limpa a devolucao ----------
  perform public.marcar_para_aprovacao(id_ped);
  select devolvido_motivo = '' into ok from public.pedido where id = id_ped;
  r := r || case when ok then 'ok    ' else 'FALHA ' end
         || 'marcar de novo limpa o motivo velho, senao o diretor recusa duas vezes pelo mesmo' || E'\n';

  -- ---------- quem pode o que ----------
  r := r || 'info  quem marca: ' || array_to_string(public.papeis_da_acao('pcp.marcar'), ',') || E'\n';
  r := r || 'info  quem aprova: ' || array_to_string(public.papeis_da_acao('pedido.a_producao'), ',') || E'\n';
  select 'producao' = any (public.papeis_da_acao('pcp.marcar')) into ok;
  r := r || case when ok then 'ok    ' else 'FALHA ' end || 'a producao MARCA' || E'\n';
  select 'producao' = any (public.papeis_da_acao('pedido.a_producao')) into ok;
  r := r || case when not ok then 'ok    ' else 'FALHA ' end
         || 'e a producao NAO APROVA: sem isso as duas aprovacoes viram uma so' || E'\n';

  select count(*) into n from public.pedido_no_pcp where id = id_ped;
  r := r || case when n = 1 then 'ok    ' else 'FALHA ' end || 'a tela enxerga este pedido' || E'\n';

  select count(*) into n from regexp_matches(r, 'FALHA', 'g');
  raise exception 'PROVA DO PCP >> % %',
    case when n = 0 then 'tudo passou' else n || ' falha(s)' end, r;
end $$;
