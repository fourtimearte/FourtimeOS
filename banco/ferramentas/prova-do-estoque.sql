-- ============================================================
-- A PROVA DO ESTOQUE
-- ============================================================
-- Roda no SQL Editor quantas vezes quiser. Ele termina levantando um erro de
-- proposito, e por isso TUDO que ele fez e desfeito: nenhuma linha do banco
-- fica diferente. O relatorio sai dentro da mensagem de erro.
--
-- A regra que ele confere esta na migracao 025, e e uma so:
--   O SALDO E UM CACHE, E O RAZAO E A VERDADE.
--
-- Isso se parte em coisas que da para provar:
--   o saldo nunca e escrito na mao, e sim pelo gatilho do razao;
--   apagar ou corrigir um movimento reacerta o saldo;
--   conferir_o_razao() acha o saldo escrito por fora, que e a unica forma de
--     a palavra "cache" continuar significando alguma coisa;
--   mexer_no_estoque carimba QUEM, e nao aceita quantidade zero;
--   quem nao cuida de estoque nao mexe nele;
--   o razao nao se edita nem se apaga pela tela;
--   o mesmo nome e o mesmo tecido+cor nao viram dois materiais.
do $$
declare
  eu     uuid;
  outro  uuid;
  mat    uuid;
  mov    uuid;
  r      text := E'\n';
  n      int;
  tem    numeric;
  autor  uuid;
  tec    uuid;
  cor    uuid;

begin
  select id into eu from public.pessoa where papel = 'admin' and situacao = 'aprovado' limit 1;
  if eu is null then raise exception 'PROVA >> nao ha admin aprovado'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', eu)::text, true);

  /* 1. material nasce com saldo zero, e o saldo nao e um campo que se digita */
  insert into public.material (categoria, nome, unidade, minimo, saldo, teste)
  values ('insumo', 'PROVA tinta de teste', 'L', 2, 999, true)
  returning id into mat;
  select saldo into tem from public.material where id = mat;
  r := r || case when tem = 999 then 'ok    ' else 'FALHA ' end
         || 'o insert aceita o numero, porque so o gatilho do razao o corrige ['
         || tem || ']' || E'\n';
  select count(*) into n from public.conferir_o_razao() where material = 'PROVA tinta de teste';
  r := r || case when n = 1 then 'ok    ' else 'FALHA ' end
         || 'e conferir_o_razao() acha esse saldo sem explicacao [' || n || ']' || E'\n';

  /* 2. o primeiro movimento poe o saldo no lugar */
  perform public.mexer_no_estoque(mat, 10, 'entrada', 'NF de prova');
  select saldo into tem from public.material where id = mat;
  r := r || case when tem = 10 then 'ok    ' else 'FALHA ' end
         || 'o movimento manda no saldo, e nao o contrario [' || tem || ']' || E'\n';

  /* 3. quem mexeu fica carimbado */
  select quem, id into autor, mov from public.movimento_de_estoque
   where material_id = mat order by quando desc limit 1;
  r := r || case when autor = eu then 'ok    ' else 'FALHA ' end
         || 'o movimento guarda quem o fez' || E'\n';

  /* 4. saida e o mesmo caminho com sinal trocado */
  perform public.mexer_no_estoque(mat, -3.5, 'saida', 'separacao de prova');
  select saldo into tem from public.material where id = mat;
  r := r || case when tem = 6.5 then 'ok    ' else 'FALHA ' end
         || 'a saida desce o saldo [' || tem || ']' || E'\n';

  /* 5. o saldo acompanha um movimento corrigido ou apagado */
  update public.movimento_de_estoque set quantidade = 20 where id = mov;
  select saldo into tem from public.material where id = mat;
  r := r || case when tem = 16.5 then 'ok    ' else 'FALHA ' end
         || 'corrigir um movimento reacerta o saldo [' || tem || ']' || E'\n';
  delete from public.movimento_de_estoque where id = mov;
  select saldo into tem from public.material where id = mat;
  r := r || case when tem = -3.5 then 'ok    ' else 'FALHA ' end
         || 'apagar um movimento tambem [' || tem || ']' || E'\n';

  /* 6. e agora o cache e o razao concordam de novo */
  select count(*) into n from public.conferir_o_razao() where material = 'PROVA tinta de teste';
  r := r || case when n = 0 then 'ok    ' else 'FALHA ' end
         || 'com o razao mandando, nao sobra discordancia [' || n || ']' || E'\n';

  /* 7. movimento de zero nao diz nada */
  begin
    perform public.mexer_no_estoque(mat, 0, 'ajuste', '');
    r := r || 'FALHA movimento de zero passou' || E'\n';
  exception when others then
    r := r || 'ok    movimento de zero e recusado (' || sqlstate || ')' || E'\n';
  end;

  /* 8. o razao nao se edita pela tela: nao ha policy de insert nem de delete.
        O teste finge ser um vendedor, que le mas nao mexe no estoque. */
  select id into outro from public.pessoa
   where papel = 'vendedor' and situacao = 'aprovado' and id <> eu limit 1;
  if outro is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', outro)::text, true);
    begin
      perform public.mexer_no_estoque(mat, 5, 'entrada', 'vendedor tentando');
      r := r || 'FALHA vendedor mexeu no estoque' || E'\n';
    exception when others then
      r := r || 'ok    vendedor nao mexe no estoque (' || sqlstate || ')' || E'\n';
    end;
    perform set_config('request.jwt.claims', json_build_object('sub', eu)::text, true);
  else
    r := r || 'info  sem vendedor aprovado para provar a trava de papel' || E'\n';
  end if;

  /* 9. o mesmo nome nao vira dois materiais */
  begin
    insert into public.material (categoria, nome, unidade, teste)
    values ('insumo', 'prova TINTA de teste', 'L', true);
    r := r || 'FALHA o mesmo nome entrou duas vezes' || E'\n';
  exception when unique_violation then
    r := r || 'ok    o mesmo nome e um material so, com maiuscula ou sem' || E'\n';
  end;

  /* 10. nem o mesmo tecido na mesma cor */
  select id into tec from public.tecido limit 1;
  select id into cor from public.cor_de_tecido limit 1;
  if tec is not null and cor is not null then
    insert into public.material (categoria, nome, unidade, tecido_id, cor_id, teste)
    values ('tecido', 'PROVA malha A', 'kg', tec, cor, true);
    begin
      insert into public.material (categoria, nome, unidade, tecido_id, cor_id, teste)
      values ('tecido', 'PROVA malha B', 'kg', tec, cor, true);
      r := r || 'FALHA o mesmo tecido na mesma cor virou dois saldos' || E'\n';
    exception when unique_violation then
      r := r || 'ok    o mesmo tecido na mesma cor e um material so' || E'\n';
    end;
  else
    r := r || 'info  catalogo de tecido vazio, nao deu para provar a trava do tecido' || E'\n';
  end if;

  /* 11. o razao do material sai junto com o material */
  perform public.mexer_no_estoque(mat, 4, 'entrada', 'antes de apagar');
  delete from public.material where id = mat;
  select count(*) into n from public.movimento_de_estoque where material_id = mat;
  r := r || case when n = 0 then 'ok    ' else 'FALHA ' end
         || 'apagar o material leva o razao dele junto [' || n || ']' || E'\n';

  select count(*) into n from regexp_matches(r, 'FALHA', 'g');
  raise exception 'PROVA DO ESTOQUE >> % %',
    case when n = 0 then 'tudo passou' else n || ' falha(s)' end, r;
end $$;
