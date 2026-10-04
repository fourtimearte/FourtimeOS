/* Os meses do sistema, como a pessoa le e como o endereco guarda. Tudo puro.

   A chave do mes e "2026-10". O mes e sempre o de quem esta olhando, e nao o
   do servidor: quem pede o intervalo ao banco usa os limites em hora local. */

export const MES_LONGO = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export const chaveDoMes = (ano: number, mes: number) => `${ano}-${String(mes + 1).padStart(2, '0')}`

/** "2026-10" vira { ano: 2026, mes: 9 }. */
export function lerMes(chave: string): { ano: number; mes: number } {
  const [a, m] = chave.split('-').map(Number)
  return { ano: a, mes: m - 1 }
}

/** "Outubro de 2026". */
export function nomeDoMes(chave: string): string {
  const { ano, mes } = lerMes(chave)
  return `${MES_LONGO[mes][0].toUpperCase()}${MES_LONGO[mes].slice(1)} de ${ano}`
}

/** Os últimos meses, do atual para trás. */
export function ultimosMeses(hoje = new Date(), quantos = 6): string[] {
  const lista: string[] = []
  let ano = hoje.getFullYear()
  let mes = hoje.getMonth()
  for (let i = 0; i < quantos; i++) {
    lista.push(chaveDoMes(ano, mes))
    if (mes === 0) {
      ano -= 1
      mes = 11
    } else mes -= 1
  }
  return lista
}

/* O primeiro instante de um mês e o primeiro do mês seguinte, NA HORA DE QUEM
   ESTÁ OLHANDO. O banco guarda em UTC, e a venda das dez da noite do dia 31 em
   Goiânia já é dia 1º lá. */
export function limitesDoMes(chave: string): { de: string; ate: string } {
  const { ano, mes } = lerMes(chave)
  return { de: new Date(ano, mes, 1).toISOString(), ate: new Date(ano, mes + 1, 1).toISOString() }
}

/** O dia de hoje de quem está olhando, como AAAA-MM-DD. */
export function hojeEmData(hoje = new Date()): string {
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
}

/** "hoje às 14:10", "ontem às 09:30", "21/10 às 16:02". */
export function quandoFoi(iso: string, hoje = new Date()): string {
  const d = new Date(iso)
  const meio = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dias = Math.round((meio(hoje) - meio(d)) / 86400000)
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  /* o ano só aparece quando não é o de hoje: "12/03" de dois anos atrás engana */
  const ano = d.getFullYear() === hoje.getFullYear() ? '' : `/${d.getFullYear()}`
  const dia = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}${ano}`
  const quando = dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : dia
  return `${quando} às ${hora}`
}
