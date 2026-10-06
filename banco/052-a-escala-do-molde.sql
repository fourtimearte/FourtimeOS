-- ===========================================================================
-- 052: A ESCALA DO MOLDE
--
-- A terceira parte da pagina Fichas tecnicas (wireframe de 05/10/2026, prancha
-- 67): o molde em tela cheia, com a largura e a altura de cada parte medidas
-- no proprio SVG.
--
-- O SVG NAO DIZ O TAMANHO DE NADA. O Affinity costuma exportar em pixel, e o
-- mesmo molde exportado a 72 e a 300 pontos por polegada da numeros quatro
-- vezes diferentes. A tela mede a caixa de cada parte na unidade do desenho;
-- para virar centimetro falta saber quanto vale uma unidade. Quando o arquivo
-- diz (largura em milimetro, centimetro ou polegada), a tela usa. Quando nao
-- diz, quem edita ACERTA A ESCALA: escolhe uma parte, digita quanto ela mede
-- de verdade, e a conta fica guardada aqui, junto do desenho.
--
-- TROCOU O DESENHO, A ESCALA CAI. A escala e daquele arquivo. Um arquivo novo
-- pode ter saido com outra resolucao, e centimetro errado em molde e pano
-- cortado errado: melhor pedir para acertar de novo do que confiar.
--
-- O QUE ENTRA:
--   1. a coluna da escala no molde
--   2. salvar o molde derruba a escala quando o desenho muda
--   3. a funcao que acerta (ou tira) a escala
-- ===========================================================================


-- ---------- 1. a coluna ------------------------------------------------------
alter table public.molde_da_referencia
  add column if not exists cm_por_unidade numeric;

alter table public.molde_da_referencia
  drop constraint if exists molde_escala_possivel;
/* uma unidade do desenho nunca vale mais que um metro: acima disso e engano
   de digitacao, e a tela mostraria uma camiseta de um quilometro */
alter table public.molde_da_referencia
  add constraint molde_escala_possivel
  check (cm_por_unidade is null or (cm_por_unidade > 0 and cm_por_unidade <= 100));

comment on column public.molde_da_referencia.cm_por_unidade is
  'Quantos centimetros vale uma unidade deste desenho, acertado a mao. Nulo: vale o que o arquivo diz, ou nada';


-- ---------- 2. salvar o molde ------------------------------------------------
-- A mesma funcao da 050, com uma diferenca: quando o desenho que chega nao e
-- o que estava guardado, a escala acertada cai junto.
create or replace function public.salvar_molde_da_referencia(
  p_referencia uuid,
  p_svg        text,
  p_tamanho    text default ''
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  tam text := coalesce(p_tamanho, '');
  svg text := btrim(coalesce(p_svg, ''));
begin
  if not public.posso('produtos', 'editar') then
    raise exception 'Seu acesso não permite mudar o molde.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.referencia where id = p_referencia) then
    raise exception 'Referência não encontrada.' using errcode = 'P0002';
  end if;
  if tam <> '' and not (tam = any (public.tamanhos_da_fabrica())) then
    raise exception 'Esse tamanho a fábrica não usa.' using errcode = '23514';
  end if;

  if svg = '' then
    delete from public.molde_da_referencia where referencia_id = p_referencia and tamanho = tam;
    return false;
  end if;
  if svg !~* '<svg[\s>]' then
    raise exception 'O arquivo não é um SVG.' using errcode = '23514';
  end if;
  if char_length(svg) > 600000 then
    raise exception 'O SVG é grande demais. Exporte o molde sem imagem dentro.' using errcode = '23514';
  end if;
  /* DESENHO, E NAO PROGRAMA. Um SVG pode carregar script, e este vai ser
     mostrado na tela de quem abrir a ficha. A tela ja o mostra de um jeito que
     nao roda nada, e mesmo assim ele nao entra no banco com isso dentro */
  if svg ~* '<script|<foreignobject|javascript:|\son[a-z]+\s*=' then
    raise exception 'O SVG tem programa dentro (script ou evento). Exporte só o desenho.' using errcode = '23514';
  end if;

  insert into public.molde_da_referencia as m (referencia_id, tamanho, svg, atualizado_em)
  values (p_referencia, tam, svg, now())
  on conflict (referencia_id, tamanho) do update
    set cm_por_unidade = case when m.svg is distinct from excluded.svg then null else m.cm_por_unidade end,
        svg = excluded.svg,
        atualizado_em = now();
  return true;
end $$;

grant execute on function public.salvar_molde_da_referencia(uuid, text, text) to authenticated;


-- ---------- 3. acertar a escala ----------------------------------------------
-- Nulo tira a escala acertada, e a tela volta ao que o arquivo diz.
create or replace function public.acertar_escala_do_molde(
  p_referencia     uuid,
  p_cm_por_unidade numeric,
  p_tamanho        text default ''
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  tam text := coalesce(p_tamanho, '');
begin
  if not public.posso('produtos', 'editar') then
    raise exception 'Seu acesso não permite acertar a escala do molde.' using errcode = '42501';
  end if;
  if p_cm_por_unidade is not null and (p_cm_por_unidade <= 0 or p_cm_por_unidade > 100) then
    raise exception 'Essa medida não fecha com o desenho. Confira o número digitado.' using errcode = '23514';
  end if;

  update public.molde_da_referencia
     set cm_por_unidade = p_cm_por_unidade
   where referencia_id = p_referencia and tamanho = tam;
  if not found then
    raise exception 'Este molde ainda não tem desenho para acertar a escala.' using errcode = 'P0002';
  end if;
  return p_cm_por_unidade;
end $$;

grant execute on function public.acertar_escala_do_molde(uuid, numeric, text) to authenticated;
