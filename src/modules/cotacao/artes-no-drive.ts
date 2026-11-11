/* AS ARTES DO ORÇAMENTO VÃO PARA O DRIVE (11/11/2026).

   A arte entra no layout como sempre entrou (colada, arrastada, escolhida),
   em data URL, e aparece na hora. Logo depois, sem a pessoa fazer nada, ela
   sobe para o Google Drive pela ponte da Cloudflare, e o layout passa a
   guardar só "drive:<id>". Salvar leva para o banco o texto curto.

   O mesmo vale para o orçamento antigo aberto no editor: as artes que ainda
   moram dentro dele sobem na primeira vez que ele é aberto, e salvar tira o
   peso do banco. A mesma arte não sobe duas vezes (o hash).

   Nada disso acontece:
     - com a ponte desligada (sem a chave do Google na Cloudflare): a arte
       continua dentro da cotação, como sempre foi;
     - na cotação aprovada: ela não se salva mais, então trocar por baixo
       deixaria a tela diferente do banco.
   A troca só vale se o layout ainda tem a MESMA arte quando o Drive responde:
   se a pessoa trocou de arte no meio do envio, a resposta velha é jogada fora. */

import { useEffect, useRef } from 'react'
import { pontePronta, subirArte } from '@shared/arte'
import type { Cotacao } from '@dominio/cotacao'

export function usarArtesNoDrive(
  c: Cotacao,
  trocar: (antiga: string, nova: string) => void,
  desligado: boolean,
): void {
  const enviando = useRef(new Set<string>())
  const recusadas = useRef(new Set<string>())
  useEffect(() => {
    if (desligado) return
    const pendentes = c.produtos
      .map(p => ({ img: p.bloco.imagem, nome: p.bloco.arte }))
      .filter(
        x =>
          x.img.startsWith('data:image/') &&
          !enviando.current.has(x.img) &&
          !recusadas.current.has(x.img),
      )
    if (!pendentes.length) return
    let vivo = true
    pontePronta().then(pronta => {
      if (!pronta || !vivo) return
      for (const { img, nome } of pendentes) {
        if (enviando.current.has(img)) continue
        enviando.current.add(img)
        subirArte(img, nome)
          .then(ref => trocar(img, ref))
          /* recusada (tipo estranho, sem login): fica dentro da cotação, e
             não tenta de novo nesta visita */
          .catch(() => recusadas.current.add(img))
          .finally(() => enviando.current.delete(img))
      }
    })
    return () => {
      vivo = false
    }
  }, [c.produtos, desligado, trocar])
}
