# banco/

Os arquivos .sql desta pasta sao a historia do banco no Supabase, na ordem em
que foram rodados. Cada um roda uma vez so, no SQL Editor do projeto.

Nunca edite um arquivo que ja rodou. Mudanca vira arquivo novo, com o numero
seguinte. O banco nao desfaz o que ja aconteceu, e um arquivo editado depois de
rodado mente sobre o que esta la dentro.

Projeto: fourtime-os, regiao South America (Sao Paulo).

## Antes de dar uma migracao por pronta

Rode `CONFERIR.sql` no SQL Editor. Ele acha objeto que existe mas que ninguem
consegue ler.

Isso nao e zelo exagerado: em 13/09/2026 um `drop view` levou junto o grant da
`meu_perfil`, o login passou a derrubar a pessoa meio segundo depois de
aceitar a senha, e a mensagem na tela falava de cadastro. Foram vinte minutos
com o dono trancado para fora do proprio sistema, procurando a senha que estava
certa. A conferencia leva tres segundos.

**Grant mora no objeto, nao na view.** Todo drop leva os grants junto, entao o
grant vai no mesmo arquivo do create, logo embaixo dele.
