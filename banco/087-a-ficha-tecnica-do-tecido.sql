-- ===========================================================================
-- 087: A FICHA TECNICA DO TECIDO (05/11/2026)
--
-- O Henrique pediu: "ficha tecnica por categoria de tecido universal,
-- significa que composicao e cuidados sao para todas as cores daquele tecido,
-- exemplo: algodao 100%. E em caso de 1 tecido ter algum cuidado ou
-- composicao especifica, ai se usa a ficha interna da cor. Hoje o tecido nao
-- tem ficha tecnica, so as cores dele."
--
-- A 048 pos a ficha na COR (material). Ela continua la, mas muda de papel:
-- vira a EXCECAO. A regra passa a morar no TECIDO (o catalogo), e vale para
-- todas as cores dele. A cor so precisa de ficha propria quando foge da regra.
--
--   composicao  da cor quando a cor tem a sua; senao, a do tecido
--   cuidados    da cor quando a cor tem os seus; senao, os do tecido
--   gramatura e largura: ja eram do catalogo (026), com a da cor por cima
--
-- Quem decide qual vale e a tela, pela regra acima. Nada da cor foi apagado:
-- as cores que ja tinham ficha continuam com ela, e a tela mostra que e
-- "so desta cor".
--
-- O QUE ENTRA:
--   1. composicao, cuidados e cuidados_a_confirmar no tecido
--   2. o gatilho que confere a ficha do tecido (as mesmas regras da 048)
--   3. a funcao que muda a ficha do tecido, para quem edita o Estoque
--   4. os cuidados de partida, pelo nome do tecido
--
-- A CONFIRMAR: os simbolos de partida (4) sairam de pesquisa, pela fibra que
-- o nome do tecido diz. Os que dependem da composicao de verdade, que ainda
-- ninguem cadastrou, entram marcados "a confirmar". O estoqueiro confere com
-- a etiqueta do fornecedor e tira a marca. A COMPOSICAO NAO ENTRA: quem
-- preenche e o estoqueiro.
--
-- Roda quantas vezes quiser. Os cuidados de partida so entram no tecido que
-- ainda nao tem nenhum.
-- ===========================================================================


-- ---------- 1. a ficha no tecido ----------------------------------------------
alter table public.tecido
  -- [{"fibra": "Algodão", "pct": 100}]; vazia enquanto ninguem cadastrou
  add column if not exists composicao jsonb not null default '[]'::jsonb,
  -- os codigos de simbolo_de_cuidado, um por grupo, na ordem da etiqueta
  add column if not exists cuidados text[] not null default '{}'::text[],
  -- os que alguem ainda precisa conferir com a etiqueta do fornecedor
  add column if not exists cuidados_a_confirmar text[] not null default '{}'::text[];

comment on column public.tecido.composicao is
  'A composicao que vale para todas as cores do tecido. A cor com composicao propria (material.composicao) passa por cima.';
comment on column public.tecido.cuidados is
  'Os simbolos de cuidado de todas as cores do tecido. A cor com cuidados proprios (material.cuidados) passa por cima.';
comment on column public.tecido.cuidados_a_confirmar is
  'Os simbolos de cuidado que ainda precisam ser conferidos com a etiqueta do fornecedor. Sempre um pedaco de cuidados.';


-- ---------- 2. o gatilho que confere a ficha do tecido -------------------------
-- As mesmas regras da ficha da cor (048): a composicao soma 100 ou esta vazia,
-- nenhuma fibra se repete, os cuidados sao simbolos que existem, um por grupo,
-- na ordem da etiqueta. E o "a confirmar" so guarda simbolo que esta marcado.
create or replace function public.conferir_a_ficha_do_tecido()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  it     jsonb;
  fibra  text;
  pct    numeric;
  soma   numeric := 0;
  vistas text[] := '{}';
  limpa  jsonb := '[]'::jsonb;
  n      int;
begin
  /* a composicao */
  new.composicao := coalesce(new.composicao, '[]'::jsonb);
  if jsonb_typeof(new.composicao) <> 'array' then
    raise exception 'A composição veio num formato que eu não entendo.' using errcode = '22023';
  end if;
  if jsonb_array_length(new.composicao) > 8 then
    raise exception 'A composição cabe em até 8 fibras.' using errcode = '23514';
  end if;
  for it in select * from jsonb_array_elements(new.composicao) loop
    if jsonb_typeof(it) <> 'object' then
      raise exception 'A composição veio num formato que eu não entendo.' using errcode = '22023';
    end if;
    fibra := btrim(coalesce(it ->> 'fibra', ''));
    if fibra = '' or length(fibra) > 40 then
      raise exception 'Toda linha da composição precisa do nome da fibra.' using errcode = '23514';
    end if;
    begin
      pct := (it ->> 'pct')::numeric;
    exception when others then
      raise exception 'A porcentagem de % não é um número.', fibra using errcode = '23514';
    end;
    if pct is null or pct <= 0 or pct > 100 then
      raise exception 'A porcentagem de % tem de ficar entre 0 e 100.', fibra using errcode = '23514';
    end if;
    if lower(fibra) = any (vistas) then
      raise exception 'A fibra % aparece duas vezes na composição.', fibra using errcode = '23514';
    end if;
    vistas := vistas || lower(fibra);
    soma := soma + pct;
    limpa := limpa || jsonb_build_object('fibra', fibra, 'pct', pct);
  end loop;
  if jsonb_array_length(limpa) > 0 and abs(soma - 100) > 0.01 then
    raise exception 'A composição soma %, e tem de somar 100.', trim(to_char(soma, 'FM999990.##')) || '%'
      using errcode = '23514';
  end if;
  new.composicao := limpa;

  /* os cuidados */
  new.cuidados := coalesce(new.cuidados, '{}');
  select count(*) into n
    from unnest(new.cuidados) c
   where not exists (select 1 from public.simbolo_de_cuidado s where s.cod = c);
  if n > 0 then
    raise exception 'Há símbolo de cuidado que eu não conheço.' using errcode = '23514';
  end if;
  select count(*) into n
    from (select s.grupo
            from public.simbolo_de_cuidado s
           where s.cod = any (new.cuidados)
           group by s.grupo
          having count(*) > 1) g;
  if n > 0 or cardinality(new.cuidados) <> (select count(distinct c) from unnest(new.cuidados) c) then
    raise exception 'A ficha leva um símbolo de cuidado por grupo.' using errcode = '23514';
  end if;
  select coalesce(array_agg(s.cod order by s.ordem), '{}') into new.cuidados
    from public.simbolo_de_cuidado s
   where s.cod = any (new.cuidados);

  /* o "a confirmar" so guarda o que esta marcado, na mesma ordem */
  select coalesce(array_agg(s.cod order by s.ordem), '{}') into new.cuidados_a_confirmar
    from public.simbolo_de_cuidado s
   where s.cod = any (coalesce(new.cuidados_a_confirmar, '{}'))
     and s.cod = any (new.cuidados);

  return new;
end $$;

drop trigger if exists tecido_ficha on public.tecido;
create trigger tecido_ficha
  before insert or update of composicao, cuidados, cuidados_a_confirmar on public.tecido
  for each row execute function public.conferir_a_ficha_do_tecido();


-- ---------- 3. mudar a ficha do tecido ----------------------------------------
-- O catalogo de tecidos so deixa admin e gerente mexerem (008). A ficha do
-- tecido e trabalho do estoqueiro, entao ela passa por esta funcao, que
-- pergunta o acesso do Estoque. Ela so mexe na ficha: o nome, o grupo e a
-- ordem do tecido continuam com quem cuida do catalogo.
--
-- p_mudanca traz SO O QUE E PARA MUDAR:
--   composicao            [{fibra, pct}], vazia para apagar
--   cuidados              [codigo]
--   cuidados_a_confirmar  [codigo], um pedaco de cuidados
--   gramatura             numero ou null
--   largura               numero ou null
create or replace function public.definir_ficha_do_tecido(
  p_tecido  uuid,
  p_mudanca jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  mud   jsonb := coalesce(p_mudanca, '{}'::jsonb);
  chave text;
  g     numeric;
  l     numeric;
begin
  if not public.posso('estoque', 'editar') then
    raise exception 'Seu acesso não permite mudar a ficha dos tecidos.' using errcode = '42501';
  end if;
  if jsonb_typeof(mud) <> 'object' then
    raise exception 'A mudança veio num formato que eu não entendo.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.tecido where id = p_tecido) then
    raise exception 'Não achei esse tecido.' using errcode = 'P0002';
  end if;
  for chave in select jsonb_object_keys(mud) loop
    if chave not in ('composicao', 'cuidados', 'cuidados_a_confirmar', 'gramatura', 'largura') then
      raise exception 'Não sei mudar "%" na ficha do tecido.', chave using errcode = '22023';
    end if;
  end loop;

  if mud ? 'gramatura' and jsonb_typeof(mud -> 'gramatura') <> 'null' then
    g := (mud ->> 'gramatura')::numeric;
    if g < 20 or g > 1500 then
      raise exception 'A gramatura fica entre 20 e 1.500 g/m².' using errcode = '23514';
    end if;
  end if;
  if mud ? 'largura' and jsonb_typeof(mud -> 'largura') <> 'null' then
    l := (mud ->> 'largura')::numeric;
    if l < 0.2 or l > 5 then
      raise exception 'A largura fica entre 0,20 e 5 metros.' using errcode = '23514';
    end if;
  end if;

  update public.tecido t
     set composicao = case when mud ? 'composicao' then coalesce(mud -> 'composicao', '[]'::jsonb) else t.composicao end,
         cuidados = case when mud ? 'cuidados'
                         then coalesce(array(select jsonb_array_elements_text(mud -> 'cuidados')), '{}')
                         else t.cuidados end,
         cuidados_a_confirmar = case when mud ? 'cuidados_a_confirmar'
                         then coalesce(array(select jsonb_array_elements_text(mud -> 'cuidados_a_confirmar')), '{}')
                         else t.cuidados_a_confirmar end,
         gramatura = case when mud ? 'gramatura' then g else t.gramatura end,
         largura = case when mud ? 'largura' then l else t.largura end
   where t.id = p_tecido;
end $$;

revoke all on function public.definir_ficha_do_tecido(uuid, jsonb) from public, anon;
grant execute on function public.definir_ficha_do_tecido(uuid, jsonb) to authenticated;


-- ---------- 4. os cuidados de partida, pelo nome do tecido ----------------------
-- Pesquisa de 05/11/2026, em guias de cuidado por fibra de lavanderia e de
-- fabricante (Sportisimo, Care of Carl, Marley Lilly, Ginetex), com os
-- simbolos da ABNT NBR NM ISO 3758. A regra e pela fibra que o nome do tecido diz.
-- O primeiro padrao que combina vence, por isso os mais especificos vem antes.
--
-- O que a pesquisa nao confirmou para aquela fibra, ou o que depende de uma
-- composicao que o nome nao diz (misto, mescla, moletom, piquet, helanca),
-- entra em "a_confirmar". Tecido que nenhum padrao reconhece fica sem nada.
with regra (ordem, padrao, cuidados, a_confirmar) as (
  values
  -- neoprene: borracha. Mao, frio, sombra, nunca calor.
  (10, 'neoprene',
       array['lavar-mao','nao-alvejar','nao-tambor','varal-sombra','nao-passar','nao-seco'],
       array['nao-seco']),
  -- viscose com poliester (PV): a mistura muda a passadoria e a lavagem
  (20, 'viscose.*\mpv\M|\mpv\M.*viscose',
       array['lavar-30-suave','nao-alvejar','nao-tambor','horizontal-sombra','passar-1','nao-seco'],
       array['lavar-30-suave','horizontal-sombra','passar-1','nao-seco']),
  -- viscose: agua fria, sem torcer, ferro baixo
  (30, 'viscose',
       array['lavar-30-suave','nao-alvejar','nao-tambor','horizontal-sombra','passar-1','nao-seco'],
       array['horizontal-sombra','nao-seco']),
  -- helanca: pode ser de poliester ou de poliamida, o nome nao diz
  (40, 'helanca',
       array['lavar-30','nao-alvejar','nao-tambor','varal-sombra','passar-1','nao-seco'],
       array['lavar-30','varal-sombra','passar-1','nao-seco']),
  -- poliamida, suplex e tactel de poliamida (quase sempre com elastano)
  (50, 'poliamida|nylon',
       array['lavar-30-suave','nao-alvejar','nao-tambor','varal-sombra','passar-1','nao-seco'],
       array['varal-sombra','nao-seco']),
  -- terbrim: plano de poliester, de uniforme
  (60, 'terbrim',
       array['lavar-40','nao-alvejar','nao-tambor','varal','passar-1','nao-seco'],
       array['lavar-40','nao-tambor','varal','passar-1','nao-seco']),
  -- brim: plano, quase sempre de algodao, mas pode ser misto
  (70, 'brim',
       array['lavar-40','nao-alvejar','nao-tambor','varal','passar-2','nao-seco'],
       array['nao-tambor','varal','passar-2','nao-seco']),
  -- moletom sublimavel: de poliester, porque sublimacao so pega em poliester
  (80, 'moletom.*sublim',
       array['lavar-30','nao-alvejar','nao-tambor','varal','passar-1','nao-seco'],
       array['varal','nao-seco']),
  -- moletom e moletinho: algodao com poliester, em proporcao que o nome nao diz
  (90, 'moletom|moletinho',
       array['lavar-30','nao-alvejar','nao-tambor','varal','passar-1','nao-seco'],
       array['lavar-30','varal','passar-1','nao-seco']),
  -- piquet: pode ser de algodao, de poliester ou misto
  (100, 'piquet|pique\M',
       array['lavar-30','nao-alvejar','nao-tambor','varal','passar-1','nao-seco'],
       array['lavar-30','varal','passar-1','nao-seco']),
  -- dry fit, poliester, suplex e tactel de poliester
  (110, 'dry ?fit|poliest|\mpp\M',
       array['lavar-30','nao-alvejar','nao-tambor','varal','passar-1','nao-seco'],
       array['varal','nao-seco']),
  -- algodao com elastano, mescla e mix: o elastano pede agua e ferro mais frios
  (120, 'algod.*(elastano|mescla|mix|confort)',
       array['lavar-30','nao-alvejar','nao-tambor','varal','passar-1','nao-seco'],
       array['varal','passar-1','nao-seco']),
  -- algodao: aguenta mais calor, mas a cor e a estampa nao
  (130, 'algod',
       array['lavar-40','nao-alvejar','nao-tambor','varal','passar-2','nao-seco'],
       array['varal','passar-2','nao-seco'])
),
escolhida as (
  select distinct on (t.id) t.id, r.cuidados, r.a_confirmar
    from public.tecido t
    join regra r
      on translate(lower(t.nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') ~ r.padrao
   where cardinality(t.cuidados) = 0
   order by t.id, r.ordem
)
update public.tecido t
   set cuidados = e.cuidados,
       cuidados_a_confirmar = e.a_confirmar
  from escolhida e
 where t.id = e.id;
