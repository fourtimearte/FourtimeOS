-- ===========================================================================
-- 067: O CADASTRO DO CLIENTE NASCE DO LEAD, COMPLETO
--
-- Pedido do Henrique em 12/10/2026: "cria uma forma de adicionar cliente ao
-- banco de clientes de um lead, para cadastro, e se tiver o cadastro pronto,
-- essas informacoes irao no cabecalho da cotacao".
--
-- Ate aqui, "Criar cliente" no funil chamava lead_vira_cliente(p_lead), que
-- criava o cliente so com nome, contato e celular. O resto do cadastro (CPF ou
-- CNPJ, e-mail, endereco, cidade) ficava para alguem lembrar de abrir a ficha
-- depois, e a cotacao saia com o cabecalho pela metade.
--
-- O que muda: a MESMA funcao ganha dois argumentos opcionais.
--   p_cadastro (jsonb): o cadastro preenchido na tela. Cliente novo nasce com
--     ele inteiro. Se o nome ja existe na base (a trava do nome, 001), o lead
--     se liga ao cliente que ja existe e o cadastro so PREENCHE O QUE ESTA
--     VAZIO nele: nunca escreve por cima de um dado que alguem ja conferiu.
--   p_cliente (uuid): ligar o lead a um cliente que ja existe, escolhido na
--     tela (mesmo telefone, nome parecido). Nao muda nada no cliente alem do
--     vendedor, quando ele ainda nao tem.
-- Chamada so com p_lead faz exatamente o que fazia antes.
--
-- O resto continua como na 039: a marca de teste viaja com o lead, o cliente
-- sem dono passa a ser do vendedor do lead, e tudo numa transacao so.
--
-- Por que DROP e nao so "create or replace": mudar os argumentos cria uma
-- segunda funcao com o mesmo nome, e a chamada com um argumento so ficaria
-- ambigua entre as duas. O grant vai logo embaixo, no mesmo arquivo.
-- ===========================================================================

drop function if exists public.lead_vira_cliente(uuid);

create or replace function public.lead_vira_cliente(
  p_lead uuid,
  p_cadastro jsonb default null,
  p_cliente uuid default null
)
returns public.cliente
language plpgsql
security definer
set search_path = public
as $$
declare
  l        public.lead;
  cli      public.cliente;
  f        jsonb := coalesce(p_cadastro, '{}'::jsonb);
  v_nome   text;
  v_tipo   public.tipo_de_pessoa;
  v_doc    text;
  v_cel    text;
  v_fixo   text;
  v_email  text;
  v_uf     text;
  v_cep    text;
  v_seg    public.segmento;
  -- o texto de um campo, aparado e com tamanho de cadastro
  t        text;
begin
  if public.meu_papel() not in ('admin','gerente','vendedor') then
    raise exception 'Seu acesso não permite cadastrar cliente.' using errcode = '42501';
  end if;

  select * into l from public.lead where id = p_lead for update;
  if not found then
    raise exception 'Lead não encontrado.' using errcode = 'P0002';
  end if;

  -- ---------- 1. ligar a um cliente que ja existe, escolhido na tela ----------
  if p_cliente is not null then
    select * into cli from public.cliente where id = p_cliente;
    if not found then
      raise exception 'Cliente não encontrado.' using errcode = 'P0002';
    end if;
    if l.cliente_id is not null and l.cliente_id <> cli.id then
      raise exception 'Este lead já está ligado a outro cliente.' using errcode = '22023';
    end if;
    if cli.vendedor_id is null and l.vendedor_id is not null then
      update public.cliente set vendedor_id = l.vendedor_id where id = cli.id
      returning * into cli;
    end if;
    update public.lead set cliente_id = cli.id where id = l.id;
    return cli;
  end if;

  -- ---------- 2. o lead ja tem cliente: devolve ele, sem mexer ----------------
  if l.cliente_id is not null then
    select * into cli from public.cliente where id = l.cliente_id;
    if found then return cli; end if;
  end if;

  -- ---------- 3. o cadastro que veio da tela, limpo ---------------------------
  v_nome := left(btrim(coalesce(f->>'nome', '')), 200);
  if v_nome = '' then v_nome := btrim(l.nome); end if;
  if v_nome = '' then
    raise exception 'O nome do cliente não pode ficar vazio.' using errcode = '22023';
  end if;
  v_tipo := case when f->>'tipo' = 'J' then 'J'::public.tipo_de_pessoa else 'F'::public.tipo_de_pessoa end;
  v_doc := left(regexp_replace(coalesce(f->>'documento', ''), '\D', '', 'g'), 14);
  -- o celular do lead vem como +55 e o numero; o do cliente e so DDD e numero
  v_cel := regexp_replace(coalesce(nullif(f->>'celular', ''), l.telefone, ''), '\D', '', 'g');
  if length(v_cel) in (12, 13) and v_cel like '55%' then v_cel := substr(v_cel, 3); end if;
  v_cel := left(v_cel, 11);
  v_fixo := left(regexp_replace(coalesce(f->>'telefone', ''), '\D', '', 'g'), 11);
  v_email := left(lower(btrim(coalesce(nullif(f->>'email', ''), l.email, ''))), 200);
  v_uf := upper(btrim(coalesce(f->>'uf', '')));
  if v_uf !~ '^[A-Z]{2}$' then v_uf := ''; end if;
  v_cep := left(regexp_replace(coalesce(f->>'cep', ''), '\D', '', 'g'), 8);
  v_seg := case when f->>'segmento' in (select unnest(enum_range(null::public.segmento))::text)
                then (f->>'segmento')::public.segmento else 'outros'::public.segmento end;

  -- ---------- 4. o nome ja existe: liga, e so preenche o que esta vazio -------
  select * into cli from public.cliente
   where public.chave_do_nome(nome) = public.chave_do_nome(v_nome) limit 1;

  if found then
    update public.cliente set
      fantasia    = case when fantasia = ''    then left(btrim(coalesce(f->>'fantasia', '')), 200)    else fantasia end,
      documento   = case when documento = ''   then v_doc                                             else documento end,
      contato     = case when contato = ''     then left(btrim(coalesce(nullif(f->>'contato', ''), l.contato, '')), 120) else contato end,
      celular     = case when celular = ''     then v_cel                                             else celular end,
      telefone    = case when telefone = ''    then v_fixo                                            else telefone end,
      email       = case when email = ''       then v_email                                           else email end,
      endereco    = case when endereco = ''    then left(btrim(coalesce(f->>'endereco', '')), 200)    else endereco end,
      complemento = case when complemento = '' then left(btrim(coalesce(f->>'complemento', '')), 120) else complemento end,
      bairro      = case when bairro = ''      then left(btrim(coalesce(f->>'bairro', '')), 120)      else bairro end,
      cidade      = case when cidade = ''      then left(btrim(coalesce(f->>'cidade', '')), 120)      else cidade end,
      uf          = case when uf = ''          then v_uf                                              else uf end,
      cep         = case when cep = ''         then v_cep                                             else cep end,
      vendedor_id = coalesce(vendedor_id, l.vendedor_id)
    where id = cli.id
    returning * into cli;
  else
    -- A MARCA DE TESTE VIAJA COM O LEAD (039).
    insert into public.cliente (
      nome, fantasia, tipo, documento, contato, celular, telefone, email,
      endereco, complemento, bairro, cidade, uf, cep, segmento, vendedor_id, teste
    ) values (
      v_nome,
      left(btrim(coalesce(f->>'fantasia', '')), 200),
      v_tipo,
      v_doc,
      left(btrim(coalesce(nullif(f->>'contato', ''), l.contato, '')), 120),
      v_cel,
      v_fixo,
      v_email,
      left(btrim(coalesce(f->>'endereco', '')), 200),
      left(btrim(coalesce(f->>'complemento', '')), 120),
      left(btrim(coalesce(f->>'bairro', '')), 120),
      left(btrim(coalesce(f->>'cidade', '')), 120),
      v_uf,
      v_cep,
      v_seg,
      l.vendedor_id,
      l.teste
    )
    returning * into cli;
  end if;

  update public.lead set cliente_id = cli.id where id = l.id;
  return cli;
end $$;

revoke all on function public.lead_vira_cliente(uuid, jsonb, uuid) from public, anon;
grant execute on function public.lead_vira_cliente(uuid, jsonb, uuid) to authenticated;


-- ---------- a conferencia --------------------------------------------------
do $$
declare
  corpo text;
begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'lead_vira_cliente') <> 1 then
    raise exception 'ficou mais de uma lead_vira_cliente (ou nenhuma)';
  end if;
  corpo := pg_get_functiondef('public.lead_vira_cliente(uuid, jsonb, uuid)'::regprocedure);
  if position('l.teste' in corpo) = 0 then
    raise exception 'a funcao nao esta levando a marca de teste do lead';
  end if;
  if not has_function_privilege('authenticated', 'public.lead_vira_cliente(uuid, jsonb, uuid)', 'execute')
     or has_function_privilege('anon', 'public.lead_vira_cliente(uuid, jsonb, uuid)', 'execute') then
    raise exception 'lead_vira_cliente com o acesso errado';
  end if;
  raise notice '067 ok: o cadastro do cliente nasce do lead, completo';
end $$;
