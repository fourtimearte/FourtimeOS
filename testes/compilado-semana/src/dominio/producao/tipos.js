/** nome e cor de cada posto, copiados do editor v3.375 */
export const POSTO = {
    corte: { nome: 'Corte', cor: 'var(--posto-corte)' },
    subli: { nome: 'Impressão sublimação', cor: 'var(--posto-subli)' },
    dtf: { nome: 'Impressão DTF', cor: 'var(--posto-dtf)' },
    prensa: { nome: 'Prensa DTF', cor: 'var(--posto-prensa)' },
    silk: { nome: 'Silk', cor: 'var(--posto-silk)' },
    bordado: { nome: 'Bordado', cor: 'var(--posto-bordado)' },
    calandra: { nome: 'Calandra', cor: 'var(--posto-calandra)' },
    futurize: { nome: 'Futurize', cor: 'var(--posto-futurize)' },
    conferencia: { nome: 'Conferência', cor: 'var(--posto-conferencia)' },
    'cd-costura': { nome: 'Cd costura', cor: 'var(--posto-cd-costura)' },
    costura: { nome: 'Costura', cor: 'var(--posto-costura)' },
    embalagem: { nome: 'Embalagem', cor: 'var(--posto-embalagem)' },
    finalizado: { nome: 'Finalizado', cor: 'var(--posto-finalizado)' },
};
export const AVISO = {
    'falta-tecido': { nome: 'Falta tecido', cor: 'var(--situacao-vencida)' },
};
export const AVISOS = Object.keys(AVISO);
/** A ordem em que os postos aparecem no menu e na lateral. */
export const ETAPAS = Object.keys(POSTO);
export const SITUACAO = {
    vencida: { nome: 'Entrega vencida', cor: 'var(--situacao-vencida)' },
    finalizado: { nome: 'Finalizados', cor: 'var(--situacao-finalizado)' },
    andamento: { nome: 'Em andamento', cor: 'var(--situacao-andamento)' },
};
/** quanto a fabrica da conta por semana, e o que o KPI da fila compara */
export const CAPACIDADE_DA_SEMANA = 1500;
/* A etapa fica velha depois de tres dias sem ninguem mexer nela. Nao e
   palpite: o pedido medio atravessa a fabrica em menos de duas semanas, entao
   tres dias parado no mesmo posto e ou um pedido travado ou um apontamento que
   ninguem fez. Nos dois casos quem planeja a semana precisa saber. */
const DIAS_ATE_ENVELHECER = 3;
export function etapaVelha(p, hoje = Date.now()) {
    if (!p.atualizadoEm)
        return true;
    return (hoje - new Date(p.atualizadoEm).getTime()) / 86400000 > DIAS_ATE_ENVELHECER;
}
/** Pedido misto: tem sublimacao E outra tecnica junto. O relatorio marca. */
export function misto(p) {
    return p.valorSubli > 0 && p.valorPersonalizado > 0;
}
export function valorDoPedido(p) {
    return p.valorSubli + p.valorPersonalizado;
}
/* ==========================================================================
   A semana do painel de atividades.

   Segunda a sabado, seis dias, porque e o que a fabrica trabalha. O domingo
   nao existe no painel de proposito: dia que nao produz nao ocupa coluna.
   ========================================================================== */
export const DIAS_DA_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const CAPACIDADE_DO_DIA = 325;
export const DIAS_UTEIS = 6;
/** A segunda-feira da semana de uma data. */
export function inicioDaSemana(d = new Date()) {
    const base = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dia = base.getDay();
    /* domingo (0) conta como fim da semana anterior, e nao comeco da proxima */
    const recuo = dia === 0 ? 6 : dia - 1;
    base.setDate(base.getDate() - recuo);
    return base;
}
export function diaDaSemana(i, de = new Date()) {
    const d = inicioDaSemana(de);
    d.setDate(d.getDate() + i);
    return d;
}
/** A semana do ano, que e como a fabrica fala de prazo. */
/** A segunda-feira da semana que esta a N semanas daqui. 0 e esta semana. */
export function semanaDeslocada(semanas, de = new Date()) {
    const d = inicioDaSemana(de);
    d.setDate(d.getDate() + semanas * 7);
    return d;
}
/** O dia i (0 a 5) da semana que comeca nesta segunda. */
export function diaDaSemanaDe(inicio, i) {
    const d = new Date(inicio);
    d.setDate(d.getDate() + i);
    return d;
}
/** A data em ISO curto, que e como o pedido guarda o planejamento. */
export function iso(d) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + dia;
}
/* O titulo que o editor escreve: "7 a 12 de setembro de 2026", e "7 de
   setembro a 3 de outubro" quando a semana atravessa o mes. */
const MESES_POR_EXTENSO = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
export function tituloDaSemana(inicio) {
    const fim = diaDaSemanaDe(inicio, DIAS_UTEIS - 1);
    const mesmoMes = inicio.getMonth() === fim.getMonth() && inicio.getFullYear() === fim.getFullYear();
    const mesDe = MESES_POR_EXTENSO[inicio.getMonth()];
    const mesAte = MESES_POR_EXTENSO[fim.getMonth()];
    if (mesmoMes)
        return inicio.getDate() + ' a ' + fim.getDate() + ' de ' + mesAte + ' de ' + fim.getFullYear();
    return (inicio.getDate() + ' de ' + mesDe + ' a ' + fim.getDate() + ' de ' + mesAte + ' de ' + fim.getFullYear());
}
export function semanaDoAno(d = new Date()) {
    const inicio = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d.getTime() - inicio.getTime()) / 86400000 + inicio.getDay() + 1) / 7);
}
export function ehHoje(d) {
    const hoje = new Date();
    return (d.getDate() === hoje.getDate() &&
        d.getMonth() === hoje.getMonth() &&
        d.getFullYear() === hoje.getFullYear());
}
export const diaEMes = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const DIA = 24 * 60 * 60 * 1000;
export function dataDaEntrega(p) {
    return new Date(p.entregaEm + 'T00:00:00');
}
/** Quantos dias faltam para a entrega. Negativo e atraso. */
export function diasAteAEntrega(p, hoje = new Date()) {
    const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    return Math.round((dataDaEntrega(p).getTime() - base.getTime()) / DIA);
}
export function naFabrica(p) {
    return p.etapa !== 'finalizado';
}
export function atrasado(p) {
    return naFabrica(p) && diasAteAEntrega(p) < 0;
}
/* No preparo: ainda nao encostou em maquina de estampa. No editor v3.375 a
   etapa de entrada e Corte; nao existe mais uma etapa "Arte" no painel, porque
   arte e trabalho de antes do pedido virar producao. */
export function noPreparo(p) {
    return p.etapa === 'corte';
}
export function saiEm7Dias(p) {
    const dias = diasAteAEntrega(p);
    return naFabrica(p) && dias >= 0 && dias <= 7;
}
/** O texto da direita na lista: o atraso grita, o resto so informa. */
export function prazoEmTexto(p) {
    if (!naFabrica(p))
        return { texto: 'Entregue', atrasado: false };
    const dias = diasAteAEntrega(p);
    if (dias < 0)
        return { texto: 'Atrasado ' + -dias + ' d', atrasado: true };
    if (dias === 0)
        return { texto: 'Entrega hoje', atrasado: false };
    if (dias <= 2)
        return { texto: 'Entrega em ' + dias + ' d', atrasado: false };
    return {
        texto: 'Entrega ' +
            dataDaEntrega(p).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        atrasado: false,
    };
}
