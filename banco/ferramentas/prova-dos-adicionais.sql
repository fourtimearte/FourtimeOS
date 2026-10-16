-- A PROVA DA 083: a coluna dos adicionais existe, aceita objeto, recusa lista,
-- e as tabelas que ja existiam ficam com o objeto vazio. Termina com erro de
-- proposito: tudo desfeito.
do $$
declare
  t uuid;
  r record;
  txt text := '';
begin
  insert into public.tabela_de_preco (nome) values ('PROVA 083') returning id into t;
  select * into r from public.tabela_de_preco where id = t;
  txt := txt || E'\n' || case when r.adicionais = '{}'::jsonb then 'ok  ' else 'RUIM' end || ' 1. nasce com os adicionais vazios';
  update public.tabela_de_preco
     set adicionais = '{"materiais":[{"tecido":"DRY","valor":2.5}],"extras":[],"dtf":[{"id":"c1","nome":"Peito","posicoes":["peito-grande"],"valor":14}]}',
         itens = '[{"codigo":"CT01","tipo":"referencia","base":49.9,"precos":[null,null,null,null],"sub":8,"silk":10}]'
   where id = t;
  select * into r from public.tabela_de_preco where id = t;
  txt := txt || E'\n' || case when (r.adicionais->'dtf'->0->>'valor')::numeric = 14 and (r.itens->0->>'silk')::numeric = 10
                              then 'ok  ' else 'RUIM' end || ' 2. guarda o DTF nos adicionais e o Silk no item';
  begin
    update public.tabela_de_preco set adicionais = '[]' where id = t;
    txt := txt || E'\nRUIM 3. aceitou lista';
  exception when check_violation then
    txt := txt || E'\nok   3. recusa lista no lugar do objeto';
  end;
  raise exception E'\nPROVA DA 083 (tudo desfeito)%', txt;
end $$;
