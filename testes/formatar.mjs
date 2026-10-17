/* ==========================================================================
   O NÚMERO E A DATA DO SISTEMA (auditoria de 17/10/2026).

   Duas regras que estavam escritas de jeitos diferentes em vários lugares e
   erravam em silêncio:
     lerNumero     "49.90" virava 4990 na grade da cotação, no preço do modo
                   Tabela e no valor do frete; "1.234,5" virava zero na pesagem.
     formatarData  a data pura ("2026-10-05") aparecia um dia antes no fuso
                   de Brasília, na ficha do cliente e no funil.
   Agora as duas moram em src/shared/formatar.ts, e esta conferência segura.

   Rodar:  TZ=America/Sao_Paulo node --experimental-strip-types testes/formatar.mjs
   ========================================================================== */
const { lerNumero, formatarData, diaEmBrasilia } = await import('../src/shared/formatar.ts')

let ruins = 0
const confere = (certo, texto) => {
  console.log((certo ? 'ok   ' : 'RUIM ') + texto)
  if (!certo) ruins++
}
const mesmo = (a, b) => (Number.isNaN(a) && Number.isNaN(b)) || a === b

for (const [t, e] of [
  ['49,90', 49.9], ['49.90', 49.9], ['1.234,50', 1234.5], ['1.234.567', 1234567], ['R$ 1.250,50', 1250.5],
  ['2,16', 2.16], ['2.16', 2.16], ['60', 60], ['', null], ['  ', null], ['abc', NaN], ['1,2,3', NaN],
]) confere(mesmo(lerNumero(t), e), `lerNumero(${JSON.stringify(t)}) = ${lerNumero(t)} (esperado ${e})`)

confere(formatarData('2026-10-05') === '05/10/2026', `a data pura não volta um dia: ${formatarData('2026-10-05')}`)
confere(formatarData('2026-10-05T15:00:00+00:00') === '05/10/2026', `o carimbo do meio do dia: ${formatarData('2026-10-05T15:00:00+00:00')}`)
confere(formatarData('2026-10-05T01:30:00+00:00') === '04/10/2026', `o carimbo de madrugada em Londres é a noite anterior em Brasília: ${formatarData('2026-10-05T01:30:00+00:00')}`)
confere(diaEmBrasilia('2026-10-05T01:30:00+00:00') === '2026-10-04', `o dia do pedido aprovado às 22h30 é o dia de Brasília: ${diaEmBrasilia('2026-10-05T01:30:00+00:00')}`)
confere(formatarData('') === '' && formatarData('lixo') === '', 'vazio e lixo viram vazio')

console.log(ruins ? `\nformatar: ${ruins} errados` : '\nformatar: tudo certo')
process.exit(ruins ? 1 : 0)
