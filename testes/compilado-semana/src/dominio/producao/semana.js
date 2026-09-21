/* ==========================================================================
   A VIRADA DA SEMANA NO PAINEL DE ATIVIDADES
   ==========================================================================

   O problema que este arquivo existe para resolver: um pedido planejado para
   uma semana que acabou, e que ninguem marcou como finalizado, tem que
   reaparecer na segunda-feira da semana corrente, para o operador decidir em
   que dia ele cabe agora.

   A DECISAO QUE FAZ ISSO FUNCIONAR PARA SEMPRE: a colocacao e DERIVADA, e
   nunca escrita.

   O caminho obvio seria, ao abrir o painel, varrer os pedidos vencidos e
   gravar planejado_em = segunda que vem. Esse caminho tem quatro defeitos, e
   os quatro sao o motivo de uma tela assim quebrar na virada:

     1. Escreve durante a leitura. Abrir uma tela passa a mudar dados, e quem
        so queria olhar a semana passada muda a semana passada.
     2. Depende de alguem abrir. Se ninguem abriu na segunda, o pedido fica
        onde estava. Se dois abriram juntos, os dois gravam.
     3. Apaga o passado. Depois de reescrever planejado_em ninguem consegue
        mais responder "em que dia isto estava planejado quando atrasou".
     4. Nao e idempotente. Rodar duas vezes empurra duas vezes.

   Aqui nada disso acontece, porque nada e gravado. O banco guarda o que
   aconteceu (para que dia alguem planejou, e quando o pedido foi de fato
   finalizado) e esta funcao responde onde ele APARECE hoje. Amanha a mesma
   linha do banco responde outra coisa, sozinha, sem ninguem ter escrito nada.

   Gravar so acontece quando UMA PESSOA decide: arrastar para um dia, ou
   corrigir a data de finalizacao. Ai sim vira dado.
   ========================================================================== */
import { inicioDaSemana, iso, DIAS_UTEIS } from './tipos.js';
export function emMeioDia(dia) {
    const [a, m, d] = dia.split('-').map(Number);
    return new Date(a, m - 1, d, 12, 0, 0, 0);
}
/** A segunda-feira da semana a que este dia pertence, em ISO. */
export function segundaDe(dia) {
    return iso(inicioDaSemana(emMeioDia(dia)));
}
/** Quantos dias de distancia, de a para b. Negativo quer dizer que b e antes. */
function distancia(a, b) {
    return Math.round((emMeioDia(b).getTime() - emMeioDia(a).getTime()) / 86400000);
}
/** O indice do dia na semana do painel: 0 e segunda, 5 e sabado. */
export function indiceNaSemana(dia) {
    return distancia(segundaDe(dia), dia);
}
/* ---------- o domingo ----------------------------------------------------
   O painel tem seis colunas, de segunda a sabado, porque a fabrica nao
   produz no domingo. Mas o banco aceita domingo: alguem pode marcar como
   finalizado no domingo, ou digitar um planejamento no domingo.

   Um domingo cai no indice 6, que nao existe em nenhuma coluna. Sem esta
   funcao o pedido some da tela sem erro nenhum, que e o pior jeito de um
   pedido sumir. Domingo encosta no sabado da MESMA semana, porque pelo
   inicioDaSemana o domingo ja pertence a semana que terminou. */
export function encaixarNaSemana(dia) {
    const i = indiceNaSemana(dia);
    if (i < DIAS_UTEIS)
        return dia;
    const sabado = emMeioDia(segundaDe(dia));
    sabado.setDate(sabado.getDate() + DIAS_UTEIS - 1);
    return iso(sabado);
}
/** A semana daquele dia ja acabou, olhando de hoje? */
export function semanaTerminou(dia, hoje) {
    return segundaDe(dia) < segundaDe(hoje);
}
/* AS QUATRO REGRAS, NESTA ORDEM. A ordem importa: finalizado ganha de tudo,
   senao um pedido pronto na semana passada voltaria para esta semana e a
   semana passada mudaria sozinha depois de fechada. */
export function colocar(p, hoje) {
    /* 1. FINALIZADO ANCORA NO DIA EM QUE FICOU PRONTO.
          E isto que faz uma semana fechada parar de mudar: a colocacao de um
          pedido pronto nao depende mais de que dia e hoje. Rode esta funcao
          hoje, daqui a um mes ou daqui a um ano: da o mesmo dia. */
    if (p.fechadoEm)
        return { dia: encaixarNaSemana(p.fechadoEm), origem: 'finalizado' };
    const segundaDeHoje = segundaDe(hoje);
    /* 2. SEM PLANEJAMENTO cai na segunda desta semana. E o pedido que acabou de
          entrar no sistema: ele precisa aparecer na frente de alguem, e o lugar
          de decidir e o comeco da semana corrente. */
    if (!p.planejadoEm)
        return { dia: segundaDeHoje, origem: 'novo' };
    /* 3. A SEMANA DELE ACABOU E ELE NAO FINALIZOU: segunda desta semana.
          Repare que e a segunda de HOJE, e nao "a segunda seguinte a que ele
          estava". Se tres semanas passaram, a segunda seguinte aquela tambem ja
          passou, e o pedido cairia de novo num passado. Pulando direto para a
          semana corrente, uma passagem resolve qualquer atraso, de uma semana
          ou de seis meses. */
    if (semanaTerminou(p.planejadoEm, hoje))
        return { dia: segundaDeHoje, origem: 'arrastado' };
    /* 4. NO DIA EM QUE ALGUEM PLANEJOU.
          Inclusive quando esse dia ja passou dentro da semana corrente: terca
          que ficou para tras numa quinta-feira continua na terca. A semana
          ainda esta correndo, e empurrar no meio dela bagunçaria a conta do dia
          de quem esta olhando. */
    return { dia: encaixarNaSemana(p.planejadoEm), origem: 'planejado' };
}
/* Monta uma semana inteira a partir da lista completa de pedidos.

   ELA NAO FILTRA E DEPOIS COLOCA: ela coloca todos e depois fica com os que
   cairam nesta semana. A diferenca importa. Filtrar por planejado_em antes
   de colocar e exatamente o bug da virada: o pedido atrasado tem planejado_em
   na semana passada, entao o filtro o joga fora ANTES de a regra ter chance
   de o trazer para esta. Ele nao aparece em lugar nenhum e ninguem percebe,
   porque tela que perde linha nao da erro. */
export function montarSemana(todos, segunda, hoje) {
    const onde = new Map();
    const dias = [];
    for (let i = 0; i < DIAS_UTEIS; i++) {
        const d = emMeioDia(segunda);
        d.setDate(d.getDate() + i);
        dias.push({ dia: iso(d), indice: i, pedidos: [], arrastados: 0, pecas: 0 });
    }
    const porDia = new Map(dias.map((d) => [d.dia, d]));
    for (const p of todos) {
        const c = colocar(p, hoje);
        onde.set(p.id, c);
        const coluna = porDia.get(c.dia);
        if (!coluna)
            continue;
        coluna.pedidos.push(p);
        coluna.pecas += p.pecas;
        if (c.origem === 'arrastado' || c.origem === 'novo')
            coluna.arrastados++;
    }
    const pedidos = dias.flatMap((d) => d.pedidos);
    const pendencia = pedidos.filter((p) => {
        const o = onde.get(p.id)?.origem;
        return o === 'arrastado' || o === 'novo';
    });
    return { segunda, dias, pedidos, pendencia, onde };
}
/* ==========================================================================
   O RELOGIO
   ==========================================================================

   O painel fica aberto num tablet do galpao a semana inteira. Se "hoje" for
   lido uma vez na montagem, o painel atravessa a virada da semana mostrando
   segunda-feira o que ja e da semana passada, e e exatamente ai que uma tela
   assim mente sem avisar.

   Isto agenda um aviso para o instante da proxima meia-noite. Ele se
   reagenda sozinho, entao serve tanto para a virada do dia quanto para a da
   semana, que e uma virada de dia como qualquer outra. */
export function aoVirarODia(quando) {
    let id;
    function agendar() {
        const agora = new Date();
        const meiaNoite = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1, 0, 0, 30, // trinta segundos depois, para nenhum arredondamento cair em 23:59:59
        0);
        id = setTimeout(() => {
            quando(iso(new Date()));
            agendar();
        }, meiaNoite.getTime() - agora.getTime());
    }
    agendar();
    return () => clearTimeout(id);
}
/** O dia de hoje em ISO, que e a unica forma de "agora" que esta regra usa. */
export function hojeISO() {
    return iso(new Date());
}
