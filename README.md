# EditCapImob

Edição criativa de vídeos de imóveis a partir de fotos.

## Primeira entrega: editor de fotos e movimentos

Esta é uma **versão alfa baseada em arquivos**, sem dependências externas de execução.
Não é ainda o serviço completo com contas, armazenamento em nuvem e geração de cenas por IA.

Implementado:
- envio de JPG, PNG e WebP, até 24 fotos de 10 MB;
- biblioteca de fotos e sequência editável, com reordenação e exclusão de cenas;
- classificação **manual** dos ambientes;
- quatro sugestões geométricas de enquadramento por foto, com foco e aproximação ajustáveis;
- movimento de aproximação, afastamento e deslocamento;
- textos por cena, nome da marca, contato e trilha de áudio enviada pelo usuário;
- formatos 16:9, 9:16 e 1:1, com prévia e exportação a 720p;
- download de enquadramento como JPEG;
- exportação por MediaRecorder: MP4 quando suportado; WebM com extensão correta como alternativa;
- abrir/salvar arquivo `.ecimob.json` contendo fotos, áudio e roteiro.

As sugestões de recortes **não usam reconhecimento de objetos**. Não inventam ângulos nem partes ocultas do imóvel. O modo “Cena com IA” informa que a integração ainda não está ativada; não há geração nem cobrança simulada.

## Executar

Requer Node.js 22 ou superior. Não há etapa de instalação ou build.

```sh
npm run dev
```

Abra http://localhost:3000. Para testar:

```sh
npm run check
npm test
```

O servidor local atende somente a interface e seus recursos. Para hospedagem estática, publique `index.html`, `src/` e `public/`.

## Como usar

1. Envie fotos ou carregue o exemplo.
2. Selecione uma cena na sequência.
3. Classifique o ambiente e explore os quatro enquadramentos.
4. Ajuste foco, texto, duração e movimento.
5. Adicione sua assinatura e uma música autorizada, se desejar.
6. Salve o projeto em arquivo antes de fechar a página.
7. Exporte o vídeo mantendo a aba visível.

As fotos são processadas na memória do navegador. **Não há salvamento automático nem nuvem nesta etapa.** Fechar a página sem baixar o projeto perde as alterações. A foto de demonstração é baixada do Pexels somente ao clicar no exemplo.

A exportação ocorre em tempo real e depende do suporte e dos recursos do navegador. Ao colocar a aba em segundo plano, a exportação é cancelada para evitar um vídeo incompleto. O download não confirma que o usuário guardou o arquivo.

## Estado da validação

A implementação inicial foi salva diretamente via GitHub após a perda da conexão com o ambiente de desenvolvimento. Verifique o resultado do workflow “Verificar editor” nesta branch. Validação visual em navegador e teste do arquivo de vídeo final ainda são necessários; não considerar esta versão pronta para produção.

## Próximas entregas

Veja [docs/ROADMAP.md](docs/ROADMAP.md). Prioridade: validar o editor com fotos reais, adicionar contas e armazenamento persistente e integrar os provedores de análise e vídeo com controle de custo.

## Foto de demonstração

“Sofa in Modern Living Room”, Bruna Finelli / Pexels:
https://www.pexels.com/photo/sofa-in-modern-living-room-16274689/

Licença: https://www.pexels.com/license/

A foto é apenas um exemplo, não representa um imóvel do usuário.

## Referências técnicas

- MediaRecorder e negociação de formatos: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
- Suporte a MIME: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static
