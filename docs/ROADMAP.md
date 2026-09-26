# Planejamento do produto

## Visão

O corretor envia fotos, revisa os ambientes identificados, escolhe enquadramentos e movimentos e exporta um vídeo. O mesmo roteiro poderá misturar fotos animadas e cenas geradas por IA.

## Entrega 1 — editor criativo em arquivos

Implementação inicial nesta branch. Validar em navegador antes de publicar:
- importação de fotos, foto inválida e excesso de tamanho;
- quatro recortes por foto; reenquadramento vertical e aviso de resolução;
- edição de cenas e reordenação;
- reprodução com trilha;
- exportação e inspeção do vídeo real com e sem áudio;
- abrir/salvar projeto sem perder fotos e configurações;
- estados vazios, erros, teclado e telas pequenas.

## Entrega 2 — projetos persistentes

- autenticação e autorização por proprietário em todos os endpoints;
- banco de projetos, fotos, cenas, jobs e custos;
- armazenamento de arquivos separado dos registros;
- URLs privadas e uploads limitados;
- salvamento automático versionado, conflitos e recuperação;
- exclusão do projeto e dos arquivos associados;
- migração dos projetos .ecimob.json da primeira entrega.

Entidades: users, projects, assets, scenes, generation_jobs, exports e credit_ledger.
Todo registro e arquivo deve carregar o proprietário. Nenhuma chave de provedor deve ir ao navegador ou ao repositório.

## Entrega 3 — análise de imagens

- classificação de ambientes, indicando incerteza;
- sugestões de objetos e regiões normalizadas para recortes;
- checagem da resolução disponível no formato final;
- agrupamento de fotos do mesmo ambiente como sugestão revisável;
- roteiro, textos e sequência sem inferir preço, metragem ou fatos não informados.

Identificar “quarto” não prova que duas imagens sejam do mesmo quarto. Enquadramentos devem ser limitados aos pixels realmente disponíveis.

## Entrega 4 — foto para vídeo com IA

- adaptador de provedor no servidor;
- orçamento explícito antes de cada geração;
- reserva de créditos e registro de custo idempotente;
- geração assíncrona com retomada e cancelamento quando o provedor permitir;
- callbacks assinados ou polling com backoff;
- estados queued, running, succeeded, failed e cancelled;
- revisão do corretor para conferir mudanças no imóvel;
- regenerar apenas a cena escolhida;
- nunca apresentar animação de foto como se fosse vídeo generativo.

A escolha do provedor e o custo por cena estão pendentes. Não ativar compras nem cobranças automaticamente.

## Entrega 5 — montagem final e operação

- renderização de MP4 no servidor, independente do navegador;
- mistura de fotos, clipes gerados, música e narração;
- identidade visual com logotipo, legendas e templates;
- geração em fila, acompanhamento e recuperação de falhas;
- armazenamento das exportações e links com expiração;
- observabilidade, limites e planos comerciais.

## Infraestrutura e validação pendentes

A tentativa inicial de preparação local foi interrompida por indisponibilidade do ambiente. O projeto Sites encontrado durante a recuperação possui ID `appgprj_6ab7def9446c8191a7e8de2efa2278f5`; não assumir que sua versão publicada contém o código desta branch. Conferir a origem e retomar a preparação antes de qualquer nova publicação. O repositório GitHub é a fonte de revisão desta entrega.
