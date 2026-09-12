#!/usr/bin/env python3
"""Compara as fotos novas com as aprovadas e diz o que mudou.

    python3 testes/comparar.py            confere
    python3 testes/comparar.py --aprovar  adota as fotos novas como as boas

As fotos aprovadas ficam em testes/fotos. Quando uma secao muda de proposito,
roda com --aprovar e o commit mostra exatamente o que mudou de aparencia: o
diff do repositorio vira o registro visual da mudanca.

A diferenca e medida em porcentagem de pixels que mudaram acima de um limiar,
para o teste nao reprovar por causa de uma letra que caiu meio pixel diferente.
Quando reprova, escreve a imagem do estrago em testes/diferenca.
"""

import os
import shutil
import sys

from PIL import Image, ImageChops

AQUI = os.path.dirname(os.path.abspath(__file__))
ATUAL = os.path.join(AQUI, "atual")
FOTOS = os.path.join(AQUI, "fotos")
DIFF = os.path.join(AQUI, "diferenca")

# um pixel so conta como mudado se a diferenca passa disto, de 0 a 255
LIMIAR_PIXEL = 24
# a secao so reprova se mais que isto dos pixels mudou
LIMIAR_SECAO = 0.20  # por cento


def carregar(caminho):
    return Image.open(caminho).convert("RGB")


def comparar(a, b):
    """devolve (porcentagem de pixels mudados, imagem do estrago)"""
    if a.size != b.size:
        return 100.0, None
    dif = ImageChops.difference(a, b).convert("L")
    mascara = dif.point(lambda v: 255 if v > LIMIAR_PIXEL else 0)
    mudados = sum(mascara.histogram()[1:])
    total = a.size[0] * a.size[1]
    pct = 100.0 * mudados / total if total else 0.0
    if pct == 0:
        return 0.0, None
    # o estrago em vermelho por cima da foto aprovada, esmaecida
    fundo = Image.blend(a, Image.new("RGB", a.size, (255, 255, 255)), 0.65)
    vermelho = Image.new("RGB", a.size, (198, 22, 27))
    fundo.paste(vermelho, (0, 0), mascara)
    return pct, fundo


def main():
    aprovar = "--aprovar" in sys.argv

    if not os.path.isdir(ATUAL):
        print("nao ha fotos novas: rode antes o node testes/visual.mjs")
        return 1

    if aprovar:
        shutil.rmtree(FOTOS, ignore_errors=True)
        shutil.copytree(ATUAL, FOTOS)
        print("aprovadas " + str(len(os.listdir(FOTOS))) + " fotos em testes/fotos")
        return 0

    if not os.path.isdir(FOTOS):
        print("nao ha fotos aprovadas ainda: rode com --aprovar na primeira vez")
        return 1

    shutil.rmtree(DIFF, ignore_errors=True)
    os.makedirs(DIFF, exist_ok=True)

    novas = sorted(f for f in os.listdir(ATUAL) if f.endswith(".png"))
    boas = sorted(f for f in os.listdir(FOTOS) if f.endswith(".png"))

    problemas = []

    for f in boas:
        if f not in novas:
            problemas.append((f, "sumiu", 100.0))

    for f in novas:
        if f not in boas:
            problemas.append((f, "nova, ainda sem foto aprovada", 100.0))
            continue
        a = carregar(os.path.join(FOTOS, f))
        b = carregar(os.path.join(ATUAL, f))
        if a.size != b.size:
            problemas.append(
                (f, "mudou de tamanho, " + str(a.size) + " para " + str(b.size), 100.0)
            )
            continue
        pct, estrago = comparar(a, b)
        if pct > LIMIAR_SECAO:
            problemas.append((f, "mudou", pct))
            if estrago:
                estrago.save(os.path.join(DIFF, f))

    if not problemas:
        print("tudo igual: " + str(len(novas)) + " fotos conferidas")
        shutil.rmtree(DIFF, ignore_errors=True)
        return 0

    print("x " + str(len(problemas)) + " de " + str(len(novas)) + " fotos mudaram:")
    for f, motivo, pct in sorted(problemas, key=lambda x: -x[2]):
        nome = f[:-4]
        if motivo == "mudou":
            print("  " + nome.ljust(28) + str(round(pct, 2)).rjust(7) + " por cento dos pixels")
        else:
            print("  " + nome.ljust(28) + " " + motivo)
    print("")
    print("o estrago em vermelho esta em testes/diferenca")
    print("se a mudanca era de proposito: python3 testes/comparar.py --aprovar")
    return 1


if __name__ == "__main__":
    sys.exit(main())
