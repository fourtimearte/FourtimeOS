#!/bin/sh
# Baixa o site publicado para uma pasta e serve na porta 8919.
#
# Existe por causa do contentor onde este codigo e escrito: la o navegador do
# teste visual nao atravessa o proxy de saida, entao ele nunca alcancaria o
# site publicado. Espelhado em 127.0.0.1, alcanca. Na maquina de quem tem o
# projeto instalado, nada disto e preciso: `npm run dev` e melhor.
#
#   sh testes/espelho.sh            espelha e sobe o servidor
#   node testes/visual.mjs http://127.0.0.1:8919
set -e
raiz="$(dirname "$0")/.."
site="${2:-https://fourtimeos.arte-adc.workers.dev}"
pasta="${1:-$raiz/testes/espelho}"
rm -rf "$pasta"
mkdir -p "$pasta/assets"
curl -s "$site/?t=$(date +%s%N)" -o "$pasta/index.html"
for a in $(grep -o 'assets/[A-Za-z0-9_.-]*' "$pasta/index.html" | sort -u); do
  curl -s "$site/$a" -o "$pasta/$a"
done
cat > "$pasta/servir.py" <<'PY'
import http.server, socketserver, os, posixpath
RAIZ = os.path.dirname(os.path.abspath(__file__))
class SPA(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=RAIZ, **k)
    def translate_path(self, path):
        p = super().translate_path(path)
        # rota do react-router: o que nao e arquivo vira o index
        if not os.path.exists(p) and not posixpath.splitext(path.split('?')[0])[1]:
            return os.path.join(RAIZ, 'index.html')
        return p
    def log_message(self, *a):
        pass
with socketserver.TCPServer(('127.0.0.1', 8919), SPA) as s:
    s.serve_forever()
PY
echo "espelhado em $pasta"
echo "subindo em http://127.0.0.1:8919 (ctrl+c para parar)"
python3 "$pasta/servir.py"
