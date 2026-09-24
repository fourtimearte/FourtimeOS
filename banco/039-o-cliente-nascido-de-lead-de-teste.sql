-- ===========================================================================
-- 039. O CLIENTE NASCIDO DE UM LEAD DE TESTE TAMBEM E DE TESTE
--
-- Achado em 24/09, ao ligar o botao "Criar cliente" do funil e ANTES de
-- apertar ele num lead de verdade.
--
-- O QUE ACONTECERIA: `lead_vira_cliente` nasceu na migracao 011. A coluna
-- `teste` so chegou na 014, tres migracoes depois, e ninguem voltou para ensinar
-- a funcao sobre ela. Entao o insert dela cria o cliente SEM a marca, mesmo
-- vindo de um lead marcado.
--
-- POR QUE ISSO E PIOR DO QUE PARECE: `apagar_dados_de_teste` so apaga o que
-- esta marcado, de proposito. Um cliente nascido de lead de teste passaria pela
-- limpeza inteiro, e ficaria na base parecendo cliente de verdade. Pior: ele
-- passa a ser encontrado pela chave do nome, entao o proximo ensaio o encontra,
-- reusa, e o lixo de ontem vira o cliente de hoje sem ninguem decidir isso.
--
-- A LICAO, e ela e a mesma de 035 e 037 com outra roupa: coluna nova nao chega
-- sozinha nas funcoes que escrevem naquela tabela. A 014 lembrou das tabelas e
-- esqueceu de quem escreve nelas.
--
-- Roda inteiro. So reescreve a funcao; nao apaga e nao marca nada do que ja
-- esta na base, porque marcar cliente antigo como teste seria eu decidindo
-- sozinho o que some na proxima limpeza.
-- ===========================================================================

create or replace function public.lead_vira_cliente(p_lead uuid)
returns public.cliente
language plpgsql
security definer
set search_path = public
as $$
declare
  l   public.lead;
  cli public.cliente;
begin
  if public.meu_papel() not in ('admin','gerente','vendedor') then
    raise exception 'Seu acesso não permite cadastrar cliente.' using errcode = '42501';
  end if;

  select * into l from public.lead where id = p_lead for update;
  if not found then
    raise exception 'Lead não encontrado.' using errcode = 'P0002';
  end if;

  if l.cliente_id is not null then
    select * into cli from public.cliente where id = l.cliente_id;
    if found then return cli; end if;
  end if;

  select * into cli from public.cliente
   where public.chave_do_nome(nome) = public.chave_do_nome(l.nome) limit 1;

  if not found then
    -- A MARCA DE TESTE VIAJA COM O LEAD. Era a unica linha que faltava.
    insert into public.cliente (nome, contato, celular, vendedor_id, teste)
    values (l.nome, l.contato, l.telefone, l.vendedor_id, l.teste)
    returning * into cli;
  elsif cli.vendedor_id is null and l.vendedor_id is not null then
    update public.cliente set vendedor_id = l.vendedor_id where id = cli.id
    returning * into cli;
  end if;

  -- NAO DESMARCA O CLIENTE QUE JA EXISTE. Um lead de teste que cai num cliente
  -- de verdade pelo nome nao pode arrastar esse cliente para a limpeza, e um
  -- lead de verdade que cai num cliente de teste nao deve promove-lo em
  -- silencio: quem decide isso e uma pessoa, e nao um encontro de nomes.

  update public.lead set cliente_id = cli.id where id = l.id;
  return cli;
end $$;

grant execute on function public.lead_vira_cliente(uuid) to authenticated;


-- ---------- a conferencia --------------------------------------------------
-- Le o CORPO da funcao no banco, e nao o arquivo: o que importa e o que o
-- Postgres vai executar amanha.
do $$
declare
  corpo text;
begin
  select pg_get_functiondef(p.oid) into corpo
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'lead_vira_cliente';

  if corpo is null then
    raise exception 'lead_vira_cliente nao existe';
  end if;

  if position('l.teste' in corpo) = 0 then
    raise exception 'a funcao nao esta levando a marca de teste do lead';
  end if;

  raise notice 'lead_vira_cliente agora leva a marca de teste';
end $$;
