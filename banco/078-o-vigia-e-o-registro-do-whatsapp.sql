-- ===========================================================================
-- 078: O VIGIA DA EXTENSAO E O REGISTRO DO WHATSAPP NO LEAD (W3)
--
-- Duas partes, uma migracao so (um Run so para o Henrique):
--   PARTE 1, os erros da extensao (o vigia), logo abaixo;
--   PARTE 2, o registro das conversas de lead no funil (W3), no fim.
--
-- ---------------------------------------------------------------------------
-- PARTE 1: OS ERROS DA EXTENSAO
--
-- 13/10/2026, pedido do Henrique: o WhatsApp Web muda o desenho dele sem
-- avisar, e a extensao Fourtime OS (que procura o campo de escrever, o botao
-- de enviar e a identidade da conversa) para de achar o que procura. Uma
-- tarefa agendada olha a cada 3 horas se algo quebrou e prepara o conserto.
--
-- O QUE A EXTENSAO GRAVA quando nao acha o que procura:
--   versao     a versao da extensao (0.6.0)
--   onde       a peca que sumiu: campo-de-escrever, botao-de-enviar,
--              identidade-da-conversa, lista-de-conversas, escrever, enviar
--   o_que      uma frase curta
--   estrutura  o ESQUELETO da pagina do WhatsApp em volta: so o nome das
--              etiquetas e os marcadores do proprio WhatsApp (data-testid,
--              data-icon, role). NENHUM texto, nome, numero ou titulo.
--
-- Agrupa por dia: o mesmo erro, da mesma pessoa, no mesmo dia, vira uma linha
-- com a conta de vezes.
--
-- QUEM LE:
--   o admin, pela tabela;
--   o vigia (a tarefa agendada, que nao entra como ninguem), pela funcao
--   erros_da_extensao_para_o_vigia: devolve so versao, onde, o que, o
--   esqueleto, as vezes e quantas pessoas, SEM dizer quem. Decisao do Claude
--   para o vigia nao precisar de senha nenhuma; o que sai dali e o desenho do
--   WhatsApp Web, que qualquer pessoa ve abrindo o site.
-- ===========================================================================

create table if not exists public.erro_da_extensao (
  id bigint generated always as identity primary key,
  dia date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  versao text not null,
  onde text not null,
  o_que text not null default '',
  estrutura jsonb,
  vezes int not null default 1,
  primeira_em timestamptz not null default now(),
  ultima_em timestamptz not null default now(),
  quem uuid references public.pessoa (id) on delete set null,
  constraint erro_da_extensao_um_por_dia unique nulls not distinct (dia, versao, onde, o_que, quem)
);
create index if not exists erro_da_extensao_ultima on public.erro_da_extensao (ultima_em desc);

alter table public.erro_da_extensao enable row level security;
grant select on public.erro_da_extensao to authenticated;

drop policy if exists "o admin le os erros da extensao" on public.erro_da_extensao;
create policy "o admin le os erros da extensao" on public.erro_da_extensao
  for select to authenticated
  using (exists (select 1 from public.pessoa p where p.id = auth.uid() and p.papel::text = 'admin' and p.situacao = 'aprovado'));

-- ---------- gravar (a extensao, pela pagina ou pela coluna) -----------------
create or replace function public.registrar_erro_da_extensao(
  p_versao text,
  p_onde text,
  p_o_que text,
  p_estrutura jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  quem uuid := (select p.id from public.pessoa p where p.id = auth.uid() and p.situacao = 'aprovado');
  esq jsonb := p_estrutura;
begin
  if quem is null then
    return;  -- so quem e da casa grava; o resto some calado
  end if;
  if coalesce(trim(p_versao), '') = '' or coalesce(trim(p_onde), '') = '' then
    return;
  end if;
  /* o esqueleto tem teto: 16 mil letras. Maior que isso nao e esqueleto */
  if esq is not null and length(esq::text) > 16000 then
    esq := jsonb_build_object('cortado', true);
  end if;
  insert into public.erro_da_extensao (versao, onde, o_que, estrutura, quem)
  values (left(p_versao, 20), left(p_onde, 40), left(coalesce(p_o_que, ''), 200), esq, quem)
  on conflict on constraint erro_da_extensao_um_por_dia do update
    set vezes = public.erro_da_extensao.vezes + 1,
        ultima_em = now(),
        estrutura = coalesce(excluded.estrutura, public.erro_da_extensao.estrutura);
end;
$$;
revoke all on function public.registrar_erro_da_extensao(text, text, text, jsonb) from public, anon;
grant execute on function public.registrar_erro_da_extensao(text, text, text, jsonb) to authenticated;

-- ---------- ler (o vigia, sem entrar como ninguem) ----------------------------
create or replace function public.erros_da_extensao_para_o_vigia(p_desde timestamptz)
returns table (
  versao text,
  onde text,
  o_que text,
  estrutura jsonb,
  vezes bigint,
  pessoas bigint,
  primeira_em timestamptz,
  ultima_em timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select e.versao, e.onde, e.o_que,
         (array_agg(e.estrutura order by e.ultima_em desc) filter (where e.estrutura is not null))[1],
         sum(e.vezes), count(distinct e.quem), min(e.primeira_em), max(e.ultima_em)
    from public.erro_da_extensao e
   where e.ultima_em >= greatest(p_desde, now() - interval '7 days')
   group by e.versao, e.onde, e.o_que
   order by max(e.ultima_em) desc
   limit 50
$$;
revoke all on function public.erros_da_extensao_para_o_vigia(timestamptz) from public;
grant execute on function public.erros_da_extensao_para_o_vigia(timestamptz) to anon, authenticated;


-- ===========================================================================
-- PARTE 2: O REGISTRO DO WHATSAPP NO LEAD (W3)
--
-- 13/10/2026, autorizado pelo Henrique: "pode registrar, os aparelhos dos
-- vendedores sao todos da Fourtime, e so registraria conversa de cliente
-- sobre pedido e conversa de trabalho". O que vale (FOURTIME OS - 16,
-- secao 4):
--   - so conversa de quem e LEAD do funil: a pagina so pede a conversa
--     quando o telefone dela e de um lead, e a extensao so le essa;
--   - o texto das mensagens, com quem mandou (o cliente ou nos) e a hora;
--   - foto, audio, video e documento: so o fato, o arquivo fica no WhatsApp;
--   - nada de figurinha, mensagem apagada ou localizacao.
--
-- A mensagem do WhatsApp ganha id_externo "wa:<data-id do WhatsApp>": a
-- mesma mensagem lida duas vezes nao vira duas linhas (o indice unico de
-- id_externo e da 011). Canal whatsapp_vendedor: nao abre a janela de 24
-- horas, que e regra da API oficial e so do numero da Fourtime (065).
--
-- QUEM GRAVA: quem edita o Funil, e so no lead que ela enxerga. A funcao roda
-- com o acesso da pessoa (security invoker): as regras da mensagem e do lead
-- valem como valem na tela.
-- ===========================================================================
create or replace function public.registrar_conversa_do_whatsapp(p_lead uuid, p_mensagens jsonb)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  m jsonb;
  quando timestamptz;
  n int := 0;
  k int;
  tipo_dela text;
  ultima record;
begin
  if not public.posso('funil', 'editar') then
    raise exception 'Seu acesso não permite fazer isso.' using errcode = '42501';
  end if;
  if p_mensagens is null or jsonb_typeof(p_mensagens) <> 'array' or jsonb_array_length(p_mensagens) > 200 then
    raise exception 'Lista de mensagens fora do formato (no máximo 200).' using errcode = '22023';
  end if;
  /* o lead que a pessoa nao enxerga (as regras do lead valem aqui) e
     recusado com recado proprio: o 404 do PostgREST quer dizer "a funcao nao
     existe" para a tela, que entao para de tentar */
  perform 1 from public.lead where id = p_lead;
  if not found then
    raise exception 'Esse lead não está no seu funil.' using errcode = 'P0001';
  end if;

  for m in select * from jsonb_array_elements(p_mensagens) loop
    if coalesce(m ->> 'id', '') = '' then
      continue;
    end if;
    quando := case when coalesce(m ->> 'em', '') ~ '^\d{4}-\d{2}-\d{2}T' then (m ->> 'em')::timestamptz else now() end;
    if quando > now() + interval '5 minutes' then
      quando := now();
    end if;
    tipo_dela := coalesce(m ->> 'tipo', 'texto');
    insert into public.mensagem (lead_id, quem, tipo, texto, nome_do_arquivo, id_externo, canal, pessoa_id, em)
    values (
      p_lead,
      (case when (m ->> 'eu')::boolean then 'nos' else 'cliente' end)::public.quem_falou,
      (case tipo_dela when 'audio' then 'audio' when 'imagem' then 'imagem'
                      when 'arquivo' then 'arquivo' when 'video' then 'arquivo' else 'texto' end)::public.tipo_de_mensagem,
      left(coalesce(m ->> 'texto', ''), 4000),
      case when tipo_dela = 'video' then 'vídeo' else '' end,
      'wa:' || left(m ->> 'id', 200),
      'whatsapp_vendedor',
      case when (m ->> 'eu')::boolean then (select p.id from public.pessoa p where p.id = auth.uid()) end,
      quando
    )
    on conflict (id_externo) where id_externo <> '' do nothing;
    get diagnostics k = row_count;
    n := n + k;
  end loop;

  /* o resumo do cartao: a ultima mensagem, se for mais nova que a de la */
  if n > 0 then
    select x.texto, x.tipo, x.em into ultima
      from public.mensagem x
     where x.lead_id = p_lead and x.canal = 'whatsapp_vendedor'
     order by x.em desc
     limit 1;
    update public.lead l
       set ultima_msg = left(case when ultima.texto <> '' then ultima.texto
                                  when ultima.tipo = 'audio' then 'Áudio'
                                  when ultima.tipo = 'imagem' then 'Foto'
                                  else 'Arquivo' end, 280),
           ultima_msg_em = ultima.em
     where l.id = p_lead
       and (l.ultima_msg_em is null or ultima.em > l.ultima_msg_em);
  end if;
  return n;
end;
$$;
revoke all on function public.registrar_conversa_do_whatsapp(uuid, jsonb) from public, anon;
grant execute on function public.registrar_conversa_do_whatsapp(uuid, jsonb) to authenticated;
