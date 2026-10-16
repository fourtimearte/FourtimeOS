-- ===========================================================================
-- 083: OS ADICIONAIS DA TABELA DE PRECO (16/10/2026)
--
-- O resumo do Henrique, com o wireframe "Tabela de preço nova" aprovado
-- ("você entendeu muito bem, gostei de todos os wireframes, pode
-- implementar"): o preço de cada peça vira uma SOMA. A peça continua como na
-- 068 (faixas, preço base, plus e infantil), e por cima vêm os adicionais:
--
--   MATERIAL  o que cada tecido soma na peça;
--   TECNICA   a Sublimacao (por peça) e o Silk (por tela) moram nos ITENS,
--             ao lado da base (campos sub e silk, dentro do itens jsonb que
--             ja existe: nao muda coluna nenhuma);
--             o DTF vem de uma COMBINACAO de posicoes (peito, costas,
--             manga...), cada uma com o seu preço, ou e escrito na cotacao;
--   EXTRAS    o Patch (tipos), o Bordado (tamanhos) e outros que vierem,
--             cada opcao com o seu preço.
--
-- Tudo isso e o que alguem escreveu, numa coluna so desta tabela, lida e
-- gravada junto com ela (como os itens):
--
--   adicionais: {
--     "materiais": [{"tecido":"DRY FIT PET 160","valor":2.5}],
--     "extras":    [{"id":"patch","nome":"Patch","tecnica":"patch",
--                    "opcoes":[{"id":"relevo","nome":"Relevo","medida":"","valor":5}]}],
--     "dtf":       [{"id":"c1","nome":"Peito grande e manga",
--                    "posicoes":["peito-grande","manga-direita"],"valor":14}]
--   }
--
-- A CONTA continua sendo do sistema (src/dominio/preco), num lugar so, para
-- a pagina, a cotacao e a folha darem o mesmo numero.
-- ===========================================================================

alter table public.tabela_de_preco
  add column if not exists adicionais jsonb not null default '{}'::jsonb;

alter table public.tabela_de_preco drop constraint if exists tabela_de_preco_adicionais_objeto;
alter table public.tabela_de_preco
  add constraint tabela_de_preco_adicionais_objeto check (jsonb_typeof(adicionais) = 'object');

comment on column public.tabela_de_preco.adicionais is
  'Os adicionais da tabela (083): o preço de cada tecido, os extras (Patch, Bordado) com as opcoes e as combinacoes de DTF. A Sublimacao e o Silk moram nos itens (sub, silk).';

-- ---------- conferencia ----------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'tabela_de_preco' and column_name = 'adicionais') then
    raise exception 'a coluna adicionais nao ficou de pe';
  end if;
  raise notice '083 pronta: % tabela(s) de preco com a coluna dos adicionais', (select count(*) from public.tabela_de_preco);
end $$;
