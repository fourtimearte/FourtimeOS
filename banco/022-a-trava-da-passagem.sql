-- ============================================================
-- Fourtime OS - 022 a trava da passagem
-- ============================================================
-- Roda DEPOIS do 021, noutra rodada. O 021 criou os dois valores novos do
-- enum; aqui eles passam a valer alguma coisa.
--
-- O QUE ESTE ARQUIVO RESOLVE. Ate ontem a policy de update do pedido dizia
-- "quem foi aprovado anda com o pedido", o que quer dizer: qualquer pessoa
-- aprovada podia escrever qualquer estado em qualquer pedido. Enquanto o
-- caminho era aprovado -> producao -> pronto isso incomodava pouco. Com
-- separacao e PCP no meio, e com o PCP sendo o portao da fabrica, uma trava
-- que mora so no botao da tela e uma trava que nao existe: basta um PATCH.
--
-- ENTAO A TRAVA MORA NO GATILHO, e nao na tela nem numa funcao que a tela
-- resolve chamar. Assim ela vale para o botao, para o arrastar do kanban,
-- para o ensaio e para qualquer PATCH direto no PostgREST, que sao quatro
-- caminhos diferentes ate a mesma linha.
--
-- E ELA MORA NO MESMO GATILHO QUE JA EXISTIA, e nao num segundo ao lado. Dois
-- gatilhos BEFORE na mesma tabela disparam em ordem alfabetica de nome, e o
-- segundo veria o estado que o primeiro ja mexeu: a validacao acabaria
-- julgando uma mudanca que o proprio banco fez. Um gatilho so, que primeiro
-- confere o que o humano pediu e depois aplica o que o sistema decide.


-- ---------- quem pode fazer cada passagem ---------------------------------
-- A tabela de passagens como FUNCAO, e nao como uma sequencia de ifs dentro do
-- gatilho: assim a tela pode perguntar "posso?" antes de desenhar o botao, sem
-- reescrever a regra do lado de la e sem as duas versoes divergirem.
--
-- Devolver NULL quer dizer que a passagem nao existe, que e diferente de
-- existir e a pessoa nao poder. As duas dao erro, mas com mensagens
-- diferentes, e quem esta na tela precisa saber qual das duas e.
create or replace function public.quem_pode_a_passagem(
  de   public.estado_do_pedido,
  para public.estado_do_pedido
) returns text[]
language sql
immutable
as $$
  select case
    /* o caminho para a frente */
    when de = 'aprovado'  and para = 'separacao' then array['admin','gerente','producao','estoquista']
    when de = 'separacao' and para = 'pcp'       then array['admin','gerente','producao','estoquista']
    /* O PORTAO. O estoquista separa e aponta o que faltou, mas quem decide que
       o pedido desce para a fabrica com o que faltou e o PCP. */
    when de = 'pcp'       and para = 'producao'  then array['admin','gerente','producao']
    when de = 'producao'  and para = 'pronto'    then array['admin','gerente','producao']
    when de = 'pronto'    and para = 'enviado'   then array['admin','gerente','vendedor']
    when de = 'enviado'   and para = 'entregue'  then array['admin','gerente','vendedor']

    /* voltar UM passo e coisa de quem manda. Voltar dois nao existe: quem
       precisa disso esta consertando um erro, e consertar erro passa pelo
       caminho inteiro de novo, senao o historico do pedido vira ficcao. */
    when de = 'separacao' and para = 'aprovado'  then array['admin','gerente']
    when de = 'pcp'       and para = 'separacao' then array['admin','gerente']
    when de = 'producao'  and para = 'pcp'       then array['admin','gerente']
    when de = 'pronto'    and para = 'producao'  then array['admin','gerente']
    when de = 'enviado'   and para = 'pronto'    then array['admin','gerente']
    when de = 'entregue'  and para = 'enviado'   then array['admin','gerente']

    /* cancelar de qualquer lugar, e ressuscitar so o admin */
    when para = 'cancelado'                      then array['admin','gerente']
    when de   = 'cancelado'                      then array['admin']
    else null
  end
$$;

grant execute on function public.quem_pode_a_passagem(
  public.estado_do_pedido, public.estado_do_pedido) to authenticated;


-- ---------- o gatilho, agora com a trava junto ----------------------------
create or replace function public.acertar_etapa_do_pedido()
returns trigger
language plpgsql
as $$
declare
  /* O ESTADO QUE O CHAMADOR PEDIU, guardado antes de qualquer linha deste
     gatilho encostar nele. Sem esta copia nao da para separar "o humano
     escreveu producao" de "o gatilho escreveu producao", e a validacao
     acabaria barrando o proprio banco. */
  pedido_do_chamador public.estado_do_pedido := new.estado;
  permitidos text[];
  meu text;
begin
  if tg_op = 'UPDATE' then

    /* 1. a passagem de estado que veio de fora */
    if pedido_do_chamador is distinct from old.estado then
      permitidos := public.quem_pode_a_passagem(old.estado, pedido_do_chamador);
      if permitidos is null then
        raise exception 'O pedido não vai de % para %.', old.estado, pedido_do_chamador
          using errcode = '23514';
      end if;
      meu := public.meu_papel();
      if meu is null or not (meu = any (permitidos)) then
        raise exception 'Seu acesso não permite mover o pedido de % para %.',
          old.estado, pedido_do_chamador using errcode = '42501';
      end if;
    end if;

    /* 2. a etapa so anda depois que o PCP libera.
       A TRAVA ALCANCA separacao e pcp, e NAO aprovado, de proposito. Um pedido
       aprovado continua andando pela fabrica como andava ontem, senao esta
       migracao quebraria o kanban e o painel de hoje, que estao cheios de
       pedido aprovado. Quando a tela de Separacao existir (passo 8), o pedido
       passa a atravessar separacao e pcp, e ai a trava encosta nele. */
    if new.etapa is distinct from old.etapa
       and old.estado in ('separacao', 'pcp') then
      raise exception 'Este pedido ainda está no %, e a fábrica só recebe depois que o PCP libera.',
        old.estado using errcode = '42501';
    end if;

    if new.etapa is distinct from old.etapa then
      new.etapa_em := now();
    end if;
  end if;

  /* 3. o que o sistema decide sozinho, depois de validado o que veio de fora */
  if new.etapa = 'finalizado' then
    if new.fechado_em is null then new.fechado_em := now(); end if;
    /* enviado e entregue vem DEPOIS de pronto, e nao voltam para tras so
       porque a etapa continua marcada como finalizada */
    if new.estado in ('aprovado', 'producao') then new.estado := 'pronto'; end if;
  else
    new.fechado_em := null;
    if new.estado = 'pronto' then new.estado := 'producao'; end if;

    /* O pedido entra em producao no instante em que a fabrica ENCOSTA nele, e
       nao no instante em que o cliente diz sim. Continua valendo para o pedido
       que nasceu aprovado e nunca passou pelo caminho novo. */
    if tg_op = 'UPDATE' and new.etapa is distinct from old.etapa
       and new.estado = 'aprovado' then
      new.estado := 'producao';
    end if;
  end if;

  return new;
end $$;


-- ---------- a mesma regra, com nome, para a tela chamar -------------------
-- O gatilho ja trava. Esta funcao existe porque a tela precisa de um verbo:
-- "separar este pedido", "mandar para o PCP", "liberar". Chamar um PATCH de
-- uma coluna so para dizer isso funciona e nao se le.
--
-- Ela nao repete a regra: quem valida continua sendo o gatilho, e o que chega
-- aqui e so o jeito de pedir.
create or replace function public.mover_pedido(
  p_pedido uuid,
  p_para   public.estado_do_pedido
) returns public.pedido
language plpgsql
security invoker
set search_path = public
as $$
declare
  fim public.pedido;
begin
  update public.pedido set estado = p_para where id = p_pedido returning * into fim;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  return fim;
end $$;

grant execute on function public.mover_pedido(uuid, public.estado_do_pedido) to authenticated;


-- ---------- os dois paineis novos -----------------------------------------
-- A lista mora na tabela porque a aprovacao grava estes nomes no banco. Ate
-- hoje o PCP tomava emprestado o acesso da ficha, o que amarrava duas paginas
-- diferentes na mesma chave: guardar a ficha guardava o PCP junto.
insert into public.painel (chave, nome, grupo, ordem) values
  ('separacao', 'Separação de materiais', 'Produção', 50),
  ('pcp',       'PCP',                    'Produção', 60)
on conflict (chave) do nothing;

/* A ordem vira multipla de dez. Nao e capricho: e o que faz caber uma pagina
   nova no meio sem renumerar a tabela inteira, que foi o que esta migracao
   acabou de ter que fazer. */
update public.painel set ordem = case chave
  when 'inicio'     then 10
  when 'funil'      then 20
  when 'clientes'   then 30
  when 'cotacao'    then 40
  when 'separacao'  then 50
  when 'pcp'        then 60
  when 'ficha'      then 70
  when 'kanban'     then 80
  when 'produtos'   then 90
  when 'estoque'    then 100
  when 'atividades' then 110
  when 'relatorio'  then 120
  when 'banco'      then 130
  when 'config'     then 140
  when 'kit'        then 150
  else ordem end;


-- ---------- o padrao de cada papel ----------------------------------------
-- Separacao vai para quem mexe com material, inclusive o estoquista. PCP nao:
-- o portao e de quem responde pela producao.
create or replace function public.paineis_do_papel(p public.papel)
returns text[]
language sql
immutable
as $$
  select case p
    when 'admin' then array[
      'inicio','funil','clientes','cotacao','separacao','pcp','ficha','kanban',
      'produtos','estoque','atividades','relatorio','banco','config','kit']
    when 'gerente' then array[
      'inicio','funil','clientes','cotacao','separacao','pcp','ficha','kanban',
      'produtos','estoque','atividades','relatorio','banco']
    when 'vendedor' then array[
      'inicio','funil','clientes','cotacao','atividades']
    when 'producao' then array[
      'inicio','separacao','pcp','ficha','kanban','produtos','atividades','banco']
    when 'estoquista' then array[
      'inicio','separacao','estoque','produtos','banco']
    when 'analista' then array[
      'inicio','atividades','relatorio']
  end
$$;

-- Quem tem lista propria nao herda o padrao: a lista da pessoa manda mais. Os
-- dois paineis novos entram na mao para quem ja anda pela producao, senao um
-- admin com lista propria abriria o sistema amanha sem o PCP e acharia que a
-- migracao falhou.
update public.pessoa set paineis = paineis || array['separacao']
 where paineis is not null
   and not ('separacao' = any (paineis))
   and papel in ('admin','gerente','producao','estoquista');

update public.pessoa set paineis = paineis || array['pcp']
 where paineis is not null
   and not ('pcp' = any (paineis))
   and papel in ('admin','gerente','producao');


-- ---------- o que a fabrica le --------------------------------------------
-- A view ja devolve o estado, entao ela nao muda de forma. O que muda e o
-- filtro de quem lista a semana, e ele mora no aplicativo: hoje o painel de
-- atividades pede estado in (aprovado, producao, pronto), e e isso que deve
-- continuar ate o botao Liberar existir (passo 9). Depois dele, aprovado sai
-- da lista e quem entra no painel e quem o PCP liberou.
--
-- Escrito aqui de proposito: e a unica linha desta migracao que NAO esta no
-- banco, e por isso e a que some se ninguem anotar.
