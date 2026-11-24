# Fotos

Galeria de fotos para o iPhone no estilo do app **Fotos** do iOS (modo escuro): Fototeca, Coleções, visualizador,
painel de informações, seleção, pesquisa — com um extra: **você pode editar a data e a hora de cada foto**.

É um PWA (app web instalável). Sem build, sem dependências: HTML + CSS + JavaScript puro.

## Instalar no iPhone

1. Publique o site (veja abaixo) e abra o endereço no **Safari**.
2. Toque em **Compartilhar → Adicionar à Tela de Início**.
3. Abra pelo ícone da roseta colorida: o app abre em tela cheia, sem barra do Safari, e funciona offline.

### Publicar com o GitHub Pages

1. No repositório: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Faça o merge desta branch na `master` (ou `main`). O workflow `.github/workflows/pages.yml` publica o site em
   `https://<usuario>.github.io/<repositorio>/`.

Para testar no computador: `python3 -m http.server 8000` na raiz do projeto e abra `http://localhost:8000`.

## Como usar

* **Importar**: botão de filtros (círculo no canto superior) → *Importar Fotos e Vídeos…*. No iPhone abre a sua
  Fototeca para você escolher. (Também dá para arrastar arquivos para a janela no computador.)
* **Ajustar a data e a hora**
  * Abra a foto, toque em **ⓘ** (ou deslize para cima) e toque em **Ajustes** ao lado da data; ou
  * toque em **•••** → *Ajustar Data e Hora*; ou
  * em **Selecionar**, marque várias fotos → **•••** → *Ajustar Data e Hora* (o item mais antigo recebe a nova
    data e os demais mantêm o mesmo intervalo entre si).
  * *Reverter ao Original* volta para a data que a foto tinha ao ser importada.
* **Levar a foto com a nova data para o app Fotos do iPhone**: abra a foto → **Compartilhar** → **Salvar Imagem**
  (ou *Salvar Vídeo*). O arquivo exportado leva a data editada gravada dentro dele (EXIF `DateTimeOriginal` nas
  fotos; `mvhd`/`creationdate` nos vídeos), e é essa data que o app Fotos usa.
* Outros recursos: favoritar, legenda, local, palavras-chave, duplicar, Apagados Recentemente (30 dias),
  álbuns automáticos (Favoritos, Vídeos, Datas Ajustadas), pesquisa por nome/data/legenda, pinça e toque duplo
  para ampliar, arrastar para baixo para fechar.

## Limites (do iOS, não do app)

* Um app web **não consegue alterar a data de uma foto que já está na Fototeca do iPhone**. Por isso o fluxo é
  importar → ajustar → salvar uma cópia com a data nova (e apagar a original depois, se quiser).
* Os dados ficam no armazenamento do próprio app (IndexedDB), só neste aparelho. Nada é enviado para a internet.
  Limpar os dados do Safari/site apaga a galeria do app.
* Fotos HEIC escolhidas pelo seletor do iOS costumam chegar já convertidas em JPEG; o app lê o EXIF (data,
  câmera, lente, ISO, abertura, exposição) quando existir.
* A UI é uma réplica feita à mão com as medidas do iOS; o ícone é uma recriação da roseta (não é o arquivo original da Apple).

## Estrutura

```
index.html            estrutura das telas
css/app.css           visual (medidas em pt do iPhone)
js/app.js             Fototeca, Coleções, álbum, pesquisa, seleção, importação
js/viewer.js          visualizador, gestos, painel de informações
js/ui.js              menus, folhas, action sheet, "Ajustar Data e Hora"
js/actions.js         favoritar, apagar, ajustar data, compartilhar…
js/exif.js            leitura/escrita de EXIF (JPEG/HEIC)
js/mp4.js             data de criação em vídeos MP4/MOV
js/media.js           importação (miniaturas) e exportação com a data nova
js/db.js, state.js    IndexedDB e estado
sw.js, manifest.webmanifest   offline + instalação
tools/make-icons.js   gera os PNGs do ícone (precisa do Playwright)
```
