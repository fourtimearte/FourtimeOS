#!/usr/bin/env python3
# ==========================================================================
# GERA AS CORES DO WHATSAPP DENTRO DO FOURTIME OS (extensao/whatsapp.css).
#
# O WhatsApp Web tem dois temas, cada um com 184 variaveis --WDS-* presas no
# html por uma classe gerada (hoje .xfmqtgv no claro e .x1umy8rd no escuro).
# Trocar so as variaveis que o Fourtime OS recolore deixava o resto no tema do
# WhatsApp: com o WhatsApp do vendedor em escuro e o Fourtime OS em Gelo, o
# fundo ficava claro e textos e marcas ficavam claros por cima (12/10/2026:
# o texto do campo de escrever saiu branco no branco).
#
# Por isso o tema de dentro e INTEIRO: todas as variaveis do tema do WhatsApp
# que corresponde ao do Fourtime OS (claro no Gelo, escuro no Grafite), com as
# cores do Fourtime OS por cima (CORES abaixo). Assim o tema do proprio
# WhatsApp deixa de importar.
#
# Uso: python3 extensao/gerar-cores.py <css do WhatsApp>  > extensao/whatsapp.css
# O css do WhatsApp sai de uma visita ao web.whatsapp.com (todas as folhas
# juntas; ver testes/extensao-real.mjs para o caminho pela rede).
# ==========================================================================
import re
import sys

# As cores do Fourtime OS por cima das do WhatsApp (Design System V7).
CORES = {
    'claro': {
        'accent': '#C6161B', 'accent-deemphasized': '#FDECEC', 'accent-emphasized': '#AE1217',
        'content-action-emphasized': '#B3121A', 'content-external-link': '#B3121A',
        'content-default': '#1A1D23', 'content-action-default': '#1A1D23', 'content-deemphasized': '#5C6470',
        'surface-default': '#FFFFFF', 'surface-emphasized': '#F1F3F6',
        'surface-elevated-default': '#FFFFFF', 'surface-elevated-emphasized': '#F1F3F6',
        'background-wash-plain': '#FFFFFF', 'background-wash-inset': '#F1F3F6',
        'background-elevated-wash-plain': '#FFFFFF', 'background-elevated-wash-inset': '#F1F3F6',
        'app-wash': '#EBEDF1', 'components-surface-nav-bar': '#F1F3F6',
        'components-filter-surface-selected': '#E4E7EC',
        'lines-divider': '#D8DCE3', 'lines-outline-deemphasized': '#D8DCE3', 'lines-outline-default': '#C2C8D1',
        'systems-bubble-surface-outgoing': '#E4E7EC', 'systems-bubble-surface-incoming': '#FFFFFF',
        'systems-chat-background-wallpaper': '#EBEDF1', 'systems-chat-foreground-wallpaper': '#E0E3E9',
        'systems-chat-surface-composer': '#FFFFFF', 'systems-chat-surface-tray': '#F1F3F6',
        'secondary-positive': '#1F8A50', 'persistent-always-branded': '#C6161B',
        'content-on-accent': '#FFFFFF',
    },
    'escuro': {
        'accent': '#E0262E', 'accent-deemphasized': '#3B1B1D', 'accent-emphasized': '#F03B43',
        'content-action-emphasized': '#FF6B70', 'content-external-link': '#FF6B70',
        'content-default': '#EDEEF0', 'content-action-default': '#EDEEF0', 'content-deemphasized': '#A2A8B1',
        'surface-default': '#1C1E21', 'surface-emphasized': '#25282C',
        'surface-elevated-default': '#25282C', 'surface-elevated-emphasized': '#2E3237',
        'background-wash-plain': '#1C1E21', 'background-wash-inset': '#25282C',
        'background-elevated-wash-plain': '#25282C', 'background-elevated-wash-inset': '#2E3237',
        'app-wash': '#131416', 'components-surface-nav-bar': '#1C1E21',
        'components-filter-surface-selected': '#3B4048',
        'lines-divider': '#2B2F35', 'lines-outline-deemphasized': '#2B2F35', 'lines-outline-default': '#3B4048',
        'systems-bubble-surface-outgoing': '#2E3237', 'systems-bubble-surface-incoming': '#25282C',
        'systems-chat-background-wallpaper': '#131416', 'systems-chat-foreground-wallpaper': '#1C1E21',
        'systems-chat-surface-composer': '#25282C', 'systems-chat-surface-tray': '#1C1E21',
        'secondary-positive': '#1F8A50', 'persistent-always-branded': '#E0262E',
        'content-on-accent': '#FFFFFF',
    },
}


def rgb(h):
    h = h.lstrip('#')
    return ', '.join(str(int(h[i:i + 2], 16)) for i in (0, 2, 4))


def temas(css):
    """Os dois blocos de 184 variaveis --WDS-* do WhatsApp: claro e escuro."""
    achados = []
    for sel, corpo in re.findall(r'([^{}]+)\{([^{}]*)\}', css):
        m = re.match(r'\s*\.(x\w+)\.\1\s*,', sel)
        if not m or corpo.count('--WDS-') < 100:
            continue
        v = dict((k, x.strip()) for k, x in re.findall(r'(--WDS-[\w-]+)\s*:\s*([^;]+)', corpo))
        achados.append(v)
    claro = [v for v in achados if v.get('--WDS-content-default', '').upper() in ('#0A0A0A', 'RGB(10, 10, 10)')]
    escuro = [v for v in achados if v.get('--WDS-content-default', '').upper() in ('#FFFFFF', '#FAFAFA', '#F7F8FA')]
    if not claro or not escuro:
        sys.exit('nao achei os dois temas do WhatsApp neste css')
    return claro[0], escuro[0]


def bloco(nome, base, cores):
    final = dict(base)
    for k, h in cores.items():
        final['--WDS-' + k] = h
        final['--WDS-' + k + '-RGB'] = rgb(h)
    linhas = ['  %s: %s !important;' % (k, final[k]) for k in sorted(final)]
    return 'html.fourtime-dentro.fourtime-%s {\n%s\n}\n' % (nome, '\n'.join(linhas))


CABECA = '''/* ==========================================================================
   A cara do Fourtime OS no WhatsApp Web. GERADO por extensao/gerar-cores.py:
   mudar a cor la e gerar de novo, nao aqui.

   Em qualquer aba onde a extensao roda: a letra Urbanist. Na aba comum do
   WhatsApp, tambem a faixa vermelha no topo; dentro do Fourtime OS ela sai
   (pedido do Henrique, 12/10/2026: a pagina ja tem a cara do sistema).

   DENTRO DO FOURTIME OS (html.fourtime-dentro) o tema inteiro do WhatsApp
   segue o do Fourtime OS (Gelo ou Grafite; a pagina conta pelo quadro): as
   184 variaveis --WDS-* do tema certo, com as cores do V7 por cima. O
   whatsapp.js tambem tira ou poe a classe "dark" do body, que e por onde o
   WhatsApp troca as variaveis antigas dele (o texto do campo de escrever).

   Se o WhatsApp renomear as variaveis, as cores voltam a ser as dele, sem
   quebrar nada: nao ha regra presa a classe gerada (x1abc...).
   ========================================================================== */
html.fourtime-os body,
html.fourtime-os body * {
  font-family: 'Urbanist', system-ui, sans-serif !important;
}
html.fourtime-os:not(.fourtime-dentro) body::before {
  content: '';
  position: fixed;
  inset: 0 0 auto 0;
  height: 3px;
  background: #c6161b;
  z-index: 2147483647;
  pointer-events: none;
}

/* O QUE SE ESCREVE (12/10/2026): o campo de escrever da conversa e as
   buscas pegam a cor do texto do tema PELO ATRIBUTO (contenteditable, input),
   e nao por variavel do WhatsApp. Com o body ja seguindo o tema, o texto
   continuava claro no Gelo e nao dava para ler o que se escrevia. */
html.fourtime-dentro.fourtime-claro [contenteditable='true'],
html.fourtime-dentro.fourtime-claro [contenteditable='true'] *,
html.fourtime-dentro.fourtime-claro input,
html.fourtime-dentro.fourtime-claro textarea {
  color: #1A1D23 !important;
  -webkit-text-fill-color: #1A1D23 !important;
  caret-color: #1A1D23 !important;
}
html.fourtime-dentro.fourtime-escuro [contenteditable='true'],
html.fourtime-dentro.fourtime-escuro [contenteditable='true'] *,
html.fourtime-dentro.fourtime-escuro input,
html.fourtime-dentro.fourtime-escuro textarea {
  color: #EDEEF0 !important;
  -webkit-text-fill-color: #EDEEF0 !important;
  caret-color: #EDEEF0 !important;
}

'''

if __name__ == '__main__':
    claro, escuro = temas(open(sys.argv[1], encoding='utf-8').read())
    sys.stdout.write(CABECA + '/* Gelo */\n' + bloco('claro', claro, CORES['claro'])
                     + '\n/* Grafite */\n' + bloco('escuro', escuro, CORES['escuro']))
