-- ============================================================
-- Fourtime OS - 027 a separacao
-- ============================================================
-- A reserva (026) diz o que um pedido aprovado comprometeu. A separacao e onde
-- isso deixa de ser promessa: o material sai da prateleira de verdade, e o que
-- nao saiu vira um aviso que viaja com o pedido ate o PCP.
--
-- A SEPARACAO SEMPRE PERGUNTA QUANTO SAIU. O numero reservado ja vem escrito no
-- campo, mas quem separa confirma ou corrige. Parece trabalho a mais e nao e:
-- a reserva e uma conta e a separacao e uma pesagem, e quando as duas
-- discordam quem esta certo e a balanca. Um botao que so dissesse "separado"
-- gravaria a conta como se fosse a pesagem, e o razao passaria a guardar o que
-- o sistema achou em vez do que aconteceu.
--
-- E e por isso que a linha SEM CONSUMO cadastrado tambem da para separar: o
-- campo nasce vazio e a pessoa escreve o que pesou. O sistema nao sabia quanto
-- era, mas a fabrica sabe.


-- ---------- o que saiu de verdade ------------------------------------------
-- `quantidade` continua sendo o que a conta reservou e `separado` e o que a
-- balanca achou. Sobrescrever um com o outro apagaria justamente a diferenca,
-- que e a informacao que o PCP precisa para decidir se o pedido desce assim.
alter table public.reserva add column if not exists separado numeric(12,3);

comment on column public.reserva.separado is
  'o que saiu da prateleira de verdade; nulo enquanto nao separou';


-- ---------- o aviso de falta cresceu ---------------------------------------
-- Ate aqui a lista tinha um aviso so, 'falta-tecido', e isso era de proposito.
-- Agora a falta pode ser de aviamento ou de insumo, e chamar um cone de linha
-- de "falta tecido" mandaria o PCP procurar no lugar errado. A lista cresce
-- pela segunda vez em toda a vida do sistema, e continua sendo lista.
alter table public.pedido drop constraint if exists pedido_aviso_conhecido;
alter table public.pedido
  add constraint pedido_aviso_conhecido
  check (aviso in ('', 'falta-tecido', 'falta-material'));


-- ---------- separar uma linha ----------------------------------------------
-- Uma linha de cada vez, e nao o pedido inteiro num clique. Quem separa anda
-- pela prateleira item por item, e um botao que baixasse tudo de uma vez
-- gravaria como separado o material que a pessoa ainda nao foi buscar.
--
-- O MOVIMENTO E A BAIXA DA RESERVA SAO A MESMA TRANSACAO. Se fossem duas
-- chamadas, existiria o instante em que o razao ja tirou do saldo e a reserva
-- continua segurando o mesmo material: o livre cairia duas vezes pela mesma
-- peca, e ninguem entenderia o numero.
create or replace function public.separar_material(
  p_reserva    uuid,
  p_quantidade numeric,
  p_observacao text default ''
) returns public.reserva
language plpgsql
security definer
set search_path = public
as $$
declare
  res public.reserva;
begin
  if public.meu_papel() not in ('admin','gerente','producao','estoquista') then
    raise exception 'Seu acesso não permite separar material.' using errcode = '42501';
  end if;

  select * into res from public.reserva where id = p_reserva for update;
  if not found then
    raise exception 'Reserva não encontrada.' using errcode = 'P0002';
  end if;
  if res.baixada then
    raise exception 'Este material já foi separado.' using errcode = '23505';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Escreva quanto saiu da prateleira.' using errcode = '23514';
  end if;

  perform public.mexer_no_estoque(
    res.material_id, -p_quantidade, 'separacao',
    coalesce(nullif(btrim(p_observacao), ''), 'separação do pedido'),
    res.pedido_id);

  update public.reserva
     set baixada = true,
         separado = p_quantidade,
         atualizado_em = now()
   where id = p_reserva
  returning * into res;

  return res;
end $$;

grant execute on function public.separar_material(uuid, numeric, text) to authenticated;


-- ---------- desfazer ------------------------------------------------------
-- Gente clica errado, e a prateleira tem que voltar ao que era. O que NAO pode
-- e o razao esquecer: desfazer e uma devolucao, com linha propria e hora
-- propria. Apagar o movimento original deixaria o saldo certo e a historia
-- errada, e e a historia que responde "por que o saldo e esse".
create or replace function public.desfazer_a_separacao(p_reserva uuid)
returns public.reserva
language plpgsql
security definer
set search_path = public
as $$
declare
  res public.reserva;
begin
  if public.meu_papel() not in ('admin','gerente','producao','estoquista') then
    raise exception 'Seu acesso não permite desfazer uma separação.' using errcode = '42501';
  end if;

  select * into res from public.reserva where id = p_reserva for update;
  if not found then
    raise exception 'Reserva não encontrada.' using errcode = 'P0002';
  end if;
  if not res.baixada then
    raise exception 'Este material não foi separado.' using errcode = '23514';
  end if;

  if coalesce(res.separado, 0) > 0 then
    perform public.mexer_no_estoque(
      res.material_id, res.separado, 'devolucao',
      'separação desfeita', res.pedido_id);
  end if;

  update public.reserva
     set baixada = false, separado = null, atualizado_em = now()
   where id = p_reserva
  returning * into res;

  return res;
end $$;

grant execute on function public.desfazer_a_separacao(uuid) to authenticated;


-- ---------- concluir ------------------------------------------------------
-- Move o pedido para o PCP e carimba a falta. O aviso e o unico pedaco da
-- separacao que o resto da fabrica le: ele viaja no cartao do kanban e na
-- linha do painel, e e por ele que o PCP sabe, antes de abrir qualquer tela,
-- que aquele pedido chegou incompleto.
--
-- A CONCLUSAO NAO EXIGE QUE TUDO TENHA SAIDO. Exigir isso pararia a fabrica no
-- dia em que faltasse meio quilo de malha: o pedido ficaria presa na separacao
-- e ninguem decidiria nada. Quem decide se o pedido desce assim e o PCP, e
-- para decidir ele precisa que o pedido CHEGUE la com a falta escrita.
create or replace function public.concluir_a_separacao(p_pedido uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  ped     public.pedido;
  faltam  int;
  abertas int;
  saiu    int;
  total   int;
begin
  if public.meu_papel() not in ('admin','gerente','producao','estoquista') then
    raise exception 'Seu acesso não permite concluir a separação.' using errcode = '42501';
  end if;

  select * into ped from public.pedido where id = p_pedido for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  if ped.estado not in ('aprovado', 'separacao') then
    raise exception 'Este pedido não está na separação.' using errcode = '23514';
  end if;

  select count(*),
         count(*) filter (where baixada),
         count(*) filter (where not baixada),
         count(*) filter (where sem_consumo and not baixada)
    into total, saiu, faltam, abertas
    from public.reserva where pedido_id = p_pedido;

  /* Falta TAMBEM a linha que saiu com menos do que a conta pedia. Sem isto, um
     material separado pela metade passaria por completo. */
  select faltam + count(*) into faltam
    from public.reserva
   where pedido_id = p_pedido and baixada
     and not sem_consumo and coalesce(separado, 0) < quantidade;

  /* O pedido passa por `separacao` mesmo quando a separacao acontece toda de
     uma vez: pular o estado faria a trava da passagem (022) recusar o salto de
     `aprovado` direto para `pcp`, e o historico perderia o degrau. */
  if ped.estado = 'aprovado' then
    update public.pedido set estado = 'separacao' where id = p_pedido;
  end if;

  /* O aviso escrito a mao por uma pessoa nao e apagado aqui: so o que esta
     funcao mesma poe e que ela tira. */
  update public.pedido
     set estado = 'pcp',
         aviso = case
           when faltam > 0 then 'falta-material'
           when aviso = 'falta-material' then ''
           else aviso
         end
   where id = p_pedido;

  return case
    when total = 0 then 'Nenhum material cadastrado para este pedido. Ele seguiu para o PCP.'
    when faltam = 0 then 'Separação concluída: ' || saiu || ' de ' || total ||
                         ' materiais. O pedido seguiu para o PCP.'
    else 'Separação concluída com falta: ' || faltam || ' de ' || total ||
         ' materiais incompletos' ||
         case when abertas > 0 then ', ' || abertas || ' sem consumo cadastrado' else '' end ||
         '. O PCP decide se o pedido desce assim.'
  end;
end $$;

grant execute on function public.concluir_a_separacao(uuid) to authenticated;


-- ---------- a fila --------------------------------------------------------
-- Quem espera separacao, com a conta pronta. Ela existe para a tela nao ter
-- que trazer a reserva inteira de trinta pedidos so para escrever "3 de 7".
create view public.pedido_na_separacao
with (security_invoker = true) as
select p.id,
       p.numero,
       p.cliente_id,
       coalesce(c.nome, '')      as cliente,
       p.estado,
       p.aviso,
       p.pecas,
       /* a coluna se chama data_de_envio na tabela e entrega_em em toda view
          que a fabrica le. O apelido mora aqui, e nao na tela. */
       p.data_de_envio as entrega_em,
       p.departamento,
       p.criado_em,
       coalesce(r.linhas, 0)      as materiais,
       coalesce(r.separadas, 0)   as separados,
       coalesce(r.em_aberto, 0)   as sem_consumo,
       coalesce(r.descoberto, 0)  as nao_cobre,
       (coalesce(r.linhas, 0) > 0 and coalesce(r.separadas, 0) = coalesce(r.linhas, 0))
         as tudo_separado
  from public.pedido p
  left join public.cliente c on c.id = p.cliente_id
  left join lateral (
    select count(*)                                          as linhas,
           count(*) filter (where x.baixada)                  as separadas,
           count(*) filter (where x.sem_consumo and not x.baixada) as em_aberto,
           count(*) filter (where not x.baixada and not x.sem_consumo
                              and m.saldo < x.quantidade)     as descoberto
      from public.reserva x
      join public.material m on m.id = x.material_id
     where x.pedido_id = p.id
  ) r on true
 where p.estado in ('aprovado', 'separacao');

grant select on public.pedido_na_separacao to authenticated;
