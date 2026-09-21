/* ==========================================================================
   A conferencia da virada de semana.

   Esta e a regra que quebrou no editor v3.375, e ela quebra sempre pelo mesmo
   motivo: e aritmetica de data, e aritmetica de data parece obvia ate o
   domingo, o fim de mes, o ano novo e o horario de verao. Por isso ela tem
   teste desde a primeira linha, com o relogio CONGELADO: o teste passa a
   dizer "no dia 21 de setembro, este pedido aparece aqui", e nao "hoje da
   certo".

   Rode com: npm run semana
   ========================================================================== */

import {
  colocar,
  encaixarNaSemana,
  indiceNaSemana,
  montarSemana,
  segundaDe,
  semanaTerminou,
} from './compilado-semana/src/dominio/producao/semana.js'

let erros = 0
let contas = 0

function confere(nome, achou, esperado) {
  contas++
  const a = JSON.stringify(achou)
  const e = JSON.stringify(esperado)
  if (a !== e) {
    erros++
    console.error('  x ' + nome + '\n      esperava ' + e + '\n      achou    ' + a)
  }
}

/* --- o pedido de mentira -------------------------------------------------
   So os campos que a regra le. Se um dia a regra precisar de mais um campo,
   este objeto cresce, e isso e bom: ele documenta a superficie da funcao. */
function pedido(campos) {
  return {
    id: campos.id ?? 'p',
    numero: campos.numero ?? 'PD0001',
    pecas: campos.pecas ?? 100,
    planejadoEm: campos.planejadoEm ?? '',
    fechadoEm: campos.fechadoEm ?? '',
  }
}

/* ==========================================================================
   1. A aritmetica da semana
   ========================================================================== */
console.log('\n1. A semana e de segunda a sabado')

/* setembro de 2026: dia 21 e uma segunda-feira. */
confere('segunda de uma segunda e ela mesma', segundaDe('2026-09-21'), '2026-09-21')
confere('segunda de uma quarta', segundaDe('2026-09-23'), '2026-09-21')
confere('segunda de um sabado', segundaDe('2026-09-26'), '2026-09-21')

/* O DOMINGO E O CASO QUE DERRUBA. Ele nao comeca a semana seguinte: ele
   termina a que passou. Se esta linha inverter, todo pedido de domingo pula
   uma semana inteira e a virada acontece um dia cedo demais. */
confere('domingo fecha a semana que passou', segundaDe('2026-09-27'), '2026-09-21')
confere('a segunda seguinte comeca ali', segundaDe('2026-09-28'), '2026-09-28')

confere('indice da segunda', indiceNaSemana('2026-09-21'), 0)
confere('indice do sabado', indiceNaSemana('2026-09-26'), 5)
confere('indice do domingo', indiceNaSemana('2026-09-27'), 6)

/* O painel tem seis colunas. Um domingo nao tem coluna, e sem este encaixe o
   pedido sumiria da tela sem erro nenhum. */
confere('domingo encosta no sabado da mesma semana', encaixarNaSemana('2026-09-27'), '2026-09-26')
confere('sabado fica onde esta', encaixarNaSemana('2026-09-26'), '2026-09-26')

/* A virada do mes e do ano, que e onde conta de dia costuma errar. */
confere('fim de mes', segundaDe('2026-10-01'), '2026-09-28')
confere('ano novo: 1 de janeiro de 2027 e uma sexta', segundaDe('2027-01-01'), '2026-12-28')

confere('semana anterior ja terminou', semanaTerminou('2026-09-18', '2026-09-21'), true)
confere('mesma semana nao terminou', semanaTerminou('2026-09-21', '2026-09-23'), false)
confere('no domingo a semana ainda nao terminou', semanaTerminou('2026-09-23', '2026-09-27'), false)
confere('na segunda seguinte terminou', semanaTerminou('2026-09-23', '2026-09-28'), true)

/* ==========================================================================
   2. A regra do pedido nao finalizado
   ========================================================================== */
console.log('2. O pedido que nao finalizou')

const SEG = '2026-09-21' // segunda desta semana
const QUA = '2026-09-23'
const SEX_PASSADA = '2026-09-18'

confere(
  'planejado na sexta passada, sem finalizar, cai na segunda desta semana',
  colocar(pedido({ planejadoEm: SEX_PASSADA }), SEG),
  { dia: SEG, origem: 'arrastado' },
)

/* TRES SEMANAS DE ATRASO EM UMA PASSAGEM SO. "A segunda seguinte aquela"
   tambem ja passou: se a regra empurrasse uma semana por vez, o pedido
   continuaria num passado e precisaria de tres viradas para chegar aqui. */
confere(
  'atrasado ha tres semanas chega direto nesta',
  colocar(pedido({ planejadoEm: '2026-08-31' }), SEG),
  { dia: SEG, origem: 'arrastado' },
)

confere(
  'sem planejamento nenhum tambem cai na segunda',
  colocar(pedido({ planejadoEm: '' }), SEG),
  { dia: SEG, origem: 'novo' },
)

/* Dentro da semana corrente ele NAO e empurrado: a semana ainda corre, e
   mexer no meio dela bagunçaria a conta do dia de quem esta olhando. */
confere(
  'terca que ficou para tras numa quinta continua na terca',
  colocar(pedido({ planejadoEm: '2026-09-22' }), '2026-09-24'),
  { dia: '2026-09-22', origem: 'planejado' },
)

confere(
  'planejado para a semana que vem fica la',
  colocar(pedido({ planejadoEm: '2026-09-30' }), SEG),
  { dia: '2026-09-30', origem: 'planejado' },
)

/* ==========================================================================
   3. O finalizado ancora, e o passado para de mudar
   ========================================================================== */
console.log('3. O finalizado ancora')

const pronto = pedido({ planejadoEm: SEX_PASSADA, fechadoEm: SEX_PASSADA })

confere('finalizado fica no dia em que ficou pronto', colocar(pronto, SEG), {
  dia: SEX_PASSADA,
  origem: 'finalizado',
})

/* A PROPRIEDADE QUE FECHA A SEMANA: para um pedido finalizado, a colocacao
   nao depende de que dia e hoje. Rode hoje, daqui a um mes ou daqui a um
   ano, da o mesmo dia. E isso que impede uma semana ja fechada de mudar
   sozinha depois. */
for (const hoje of ['2026-09-19', SEG, '2026-10-15', '2027-03-02']) {
  confere('finalizado nao anda, olhando de ' + hoje, colocar(pronto, hoje).dia, SEX_PASSADA)
}

/* O planejamento perde para a finalizacao, de proposito: o que conta na
   conta da fabrica e quando a peca ficou pronta, e nao para quando alguem
   torceu que ficasse. */
confere(
  'finalizado numa quarta, planejado na segunda: vale a quarta',
  colocar(pedido({ planejadoEm: '2026-09-14', fechadoEm: '2026-09-16' }), SEG).dia,
  '2026-09-16',
)

confere(
  'finalizado num domingo encosta no sabado',
  colocar(pedido({ fechadoEm: '2026-09-20' }), SEG),
  { dia: '2026-09-19', origem: 'finalizado' },
)

/* ==========================================================================
   4. A correcao manual do operador
   ========================================================================== */
console.log('4. A correcao manual')

/* O caso que o Henrique descreveu: ficou pronto na sexta, ninguem apontou, a
   semana virou e ele apareceu na segunda. */
const esquecido = pedido({ planejadoEm: SEX_PASSADA })
confere('antes da correcao, ele esta nesta semana', colocar(esquecido, SEG).dia, SEG)

/* O operador marca finalizado NA SEXTA PASSADA, e nao hoje. */
const corrigido = pedido({ planejadoEm: SEX_PASSADA, fechadoEm: SEX_PASSADA })
confere('depois da correcao, ele volta para a semana dele', colocar(corrigido, SEG).dia, SEX_PASSADA)

/* E se alguem reabrir (tirar de finalizado), ele volta a ser pendencia desta
   semana. O gatilho do banco zera fechado_em; aqui basta nao ter data. */
const reaberto = pedido({ planejadoEm: SEX_PASSADA, fechadoEm: '' })
confere('reaberto volta a cair nesta semana', colocar(reaberto, SEG), {
  dia: SEG,
  origem: 'arrastado',
})

/* ==========================================================================
   5. A invariante: nenhum pedido pode sumir
   ========================================================================== */
console.log('5. Ninguem some')

/* Para QUALQUER pedido nao finalizado e QUALQUER dia de hoje, o dia em que
   ele aparece nunca pode estar numa semana ja encerrada. Se esta conta
   falhar, existe um pedido vivo que nao esta em nenhuma tela, e tela que
   perde linha nao da erro: ela so fica errada. */
let sumidos = 0
const hojes = ['2026-09-21', '2026-09-24', '2026-09-26', '2026-09-27', '2026-12-31', '2027-01-04']
const planejados = ['', '2026-01-05', '2026-08-31', '2026-09-18', '2026-09-20', '2026-09-22', '2027-06-01']
for (const hoje of hojes) {
  for (const pl of planejados) {
    const c = colocar(pedido({ planejadoEm: pl }), hoje)
    if (segundaDe(c.dia) < segundaDe(hoje)) sumidos++
    if (indiceNaSemana(c.dia) >= 6) sumidos++
  }
}
confere('nenhum pedido vivo cai numa semana encerrada nem fora das colunas', sumidos, 0)

/* ==========================================================================
   6. A semana montada
   ========================================================================== */
console.log('6. A semana montada')

const lista = [
  pedido({ id: 'a', planejadoEm: '2026-09-22', pecas: 100 }), // terca desta semana
  pedido({ id: 'b', planejadoEm: SEX_PASSADA, pecas: 200 }), // atrasado, vem para segunda
  pedido({ id: 'c', planejadoEm: '', pecas: 50 }), // novo, vem para segunda
  pedido({ id: 'd', planejadoEm: '2026-09-14', fechadoEm: SEX_PASSADA, pecas: 400 }), // pronto semana passada
  pedido({ id: 'e', planejadoEm: '2026-09-30', pecas: 900 }), // semana que vem
]

const esta = montarSemana(lista, SEG, SEG)
confere('a semana corrente pega os tres certos', esta.pedidos.map((p) => p.id), ['b', 'c', 'a'])
confere('a segunda soma o atrasado e o novo', esta.dias[0].pecas, 250)
confere('a terca fica so com o planejado', esta.dias[1].pecas, 100)
confere('a pendencia e o atrasado mais o novo', esta.pendencia.map((p) => p.id), ['b', 'c'])
confere('a segunda conta dois arrastados', esta.dias[0].arrastados, 2)

/* A SEMANA PASSADA AINDA MOSTRA O QUE FOI FEITO NELA. Este e o teste que
   prova que nada foi reescrito: o pedido 'd' continua na sexta passada
   mesmo depois de a semana virar. Se a virada gravasse por cima, esta linha
   viria vazia. */
const passada = montarSemana(lista, '2026-09-14', SEG)
confere('a semana passada guarda o que ficou pronto nela', passada.pedidos.map((p) => p.id), ['d'])
confere('e nao mostra o atrasado, que ja foi embora', passada.pendencia.length, 0)

const proxima = montarSemana(lista, '2026-09-28', SEG)
confere('a semana que vem mostra so o que ja esta marcado', proxima.pedidos.map((p) => p.id), ['e'])

/* ==========================================================================
   7. A virada, vista dos dois lados
   ========================================================================== */
console.log('7. A virada')

/* O MESMO DADO, DOIS DIAS SEGUIDOS. No sabado o pedido esta na sexta; no
   domingo continua, porque domingo ainda e daquela semana; na segunda ele
   aparece na segunda. Nenhuma gravacao aconteceu entre uma leitura e outra. */
const virando = pedido({ planejadoEm: '2026-09-25' }) // sexta
confere('na sexta ele esta na sexta', colocar(virando, '2026-09-25').dia, '2026-09-25')
confere('no sabado ainda esta na sexta', colocar(virando, '2026-09-26').dia, '2026-09-25')
confere('no domingo ainda esta na sexta', colocar(virando, '2026-09-27').dia, '2026-09-25')
confere('na segunda ele pula para a segunda', colocar(virando, '2026-09-28').dia, '2026-09-28')

/* Idempotencia: perguntar duas vezes no mesmo dia da a mesma resposta. Parece
   obvio porque a funcao e pura, e e justamente por ser pura que e obvio. A
   versao que gravava nao tinha essa propriedade. */
confere(
  'perguntar de novo nao muda nada',
  colocar(virando, '2026-09-28'),
  colocar(virando, '2026-09-28'),
)

console.log('')
if (erros) {
  console.error(erros + ' de ' + contas + ' contas erradas')
  process.exit(1)
}
console.log(contas + ' contas conferidas, todas certas')
