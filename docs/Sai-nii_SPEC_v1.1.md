# Sai-nii — Especificação de Produto v1.1

**Status:** requisitos funcionais aprovados; nome oficial definido; implementação ainda não iniciada  
**Data:** 12 de outubro de 2026 (Cuiabá/MT)  
**Papel do proprietário do produto:** definir experiência e regras de ensino.  
**Papel do responsável técnico:** arquitetura, código, testes, documentação, empacotamento e evolução.

## 1. Visão do produto

**Nome oficial do produto e da IA:** Sai-nii. **Identificador técnico proposto:** `sai-nii` (nomes de pacote e identificadores de extensão serão validados quanto à disponibilidade). **Nome anterior de trabalho:** CodeMentor Local, descontinuado para novas entregas.

O Sai-nii é um professor de programação integrado ao VS Code que analisa, sob demanda, o código e o histórico Git **locais** do projeto em que o usuário está trabalhando. Sua prioridade é formar raciocínio e autonomia, e não gerar a implementação para o aluno. Funciona sem internet depois de instalados os executáveis e um modelo de IA; não exige conta nem sincronização entre computadores.

### Objetivos verificáveis

1. O usuário abre qualquer projeto local no VS Code e solicita ajuda sem copiar estrutura, arquivos ou Git para a conversa.
2. O professor conduz a resolução com perguntas e pistas breves, adaptando-se às tentativas do usuário.
3. O programa não realiza modificações em arquivos do projeto e não executa testes ou comandos sem autorização.
4. A memória de dificuldades e progressos sobrevive a reinicializações, é consultável e pode ser eliminada.
5. O projeto pode ser instalado no macOS, Windows e Ubuntu, com modelo local selecionável ou importável.

## 2. Contrato pedagógico

**Iniciativa:** somente responde ou analisa quando acionado pelo usuário. Pode atualizar a memória da interação sem abrir alertas; anotações no editor só são geradas após pedido de análise e podem ser dispensadas.

**Estilo:** paciente, didático e rigoroso. Resposta-padrão com até ~120 palavras, preferindo **uma pergunta relevante por turno**; ampliação apenas se o usuário pedir ou a precisão técnica exigir. Evita elogios automáticos, explicações longas e perguntas vazias.

**Roteiro por interação:** identificar a intenção; coletar contexto suficiente; diagnosticar premissas; oferecer pergunta ou pista mínima; observar nova tentativa; ajustar o nível da ajuda. Conceitos podem ser explicados diretamente quando o pedido não corresponde à solução integral de uma tarefa em andamento.

**Níveis de ajuda (internos; não são provas nem notas):**

- H0: pergunta diagnóstica.
- H1: pista sobre o objetivo ou a premissa equivocada.
- H2: indicação de conceito e pequeno exemplo diferente do código atual.
- H3: sequência lógica ou pseudocódigo não copiável diretamente como solução da tarefa.
- H4: orientação localizada em um trecho específico, sem implementar a funcionalidade completa.
- H5: solução completa excepcional, conforme liberação.

**Política de liberação H5:** somente se coexistirem (a) pedido explícito, (b) evidência de uma tentativa genuína no código ou no raciocínio e (c) explicação do bloqueio e do que foi tentado. O professor pode confirmar brevemente o bloqueio e propor uma pista final; não pode criar uma recusa infinita depois de atendidas as condições. Toda liberação é registrada localmente e acompanha explicação das decisões.

**Imposição da política:** máquina de estados no aplicativo, com saídas estruturadas do modelo, verificação das permissões e testes automatizados que tentam obter soluções indevidas. Uma checagem textual/semântica não consegue garantir que toda resposta aparentemente socrática seja isenta de spoilers; essa limitação será testada e documentada.

**Sem ensino imposto:** não oferece aulas, provas, notas, desafios ou currículos autônomos. Trabalha somente com dúvidas e tarefas dos projetos reais; poderá sugerir um conceito a revisar **dentro da resposta solicitada**, sem impor atividade.

## 3. Funcionalidade do editor

**Interface:** aba lateral do VS Code com conversa, botão "Analisar este código", opção "Estou travado", controle de nível de pista, fonte/modelo ativo, indicador "Offline" e tela de memória. Marcações discretas no editor apenas no contexto de uma análise solicitada, com opção de remover.

**Contexto automático e limitado:** seleção atual; arquivo aberto, inclusive alterações ainda não salvas; símbolos e imports relacionados; erros/avisos expostos pelos analisadores do VS Code; arquivos pertinentes do workspace; status/diff/commits do Git local. Respeita limites de tamanho e exclui diretórios gerados, arquivos binários e segredos conhecidos. A recuperação de contexto será progressiva, evitando enviar o projeto inteiro ao modelo.

**Linguagens:** uso do identificador de linguagem e mecanismos de diagnóstico do VS Code. Toda linguagem textual reconhecida poderá ser consultada; qualidade de análise semântica e teste varia conforme linguagem, extensão instalada e modelo escolhido. Não prometer análise profunda universal.

**Permissões:** somente leitura dos arquivos do projeto; nunca escreve, faz commit/push ou altera arquivos. Para executar testes, exige botão ou aprovação explícita por execução; o comando e os possíveis efeitos serão exibidos. Execução não ocorrerá no marco M1. A execução futura precisará de um modelo de isolamento e confiança, porque códigos de teste podem acessar arquivos ou rede.

## 4. Memória

Memória automática e **local por computador**, com observações relativas a projeto, linguagem, conceito, erro recorrente e modo de ajuda que funcionou. O professor não deve inferir domínio sólido apenas com base em uma resposta; registra a evidência e a incerteza. Não exibir percentuais, notas ou painéis competitivos. O usuário pode inspecionar, corrigir, excluir registros específicos e apagar todo o perfil.

No projeto, o contexto Git usado será o repositório local `.git`, sem necessidade de GitHub. Os dados não são sincronizados entre equipamentos.

## 5. Arquitetura definida (ADR-001)

### Interface e orquestração

**Extensão própria pequena em TypeScript usando APIs oficiais do VS Code**, com componentes de UI e política pedagógica verificável. Não fazer fork integral do twinny ou Socratic: ambos incluem funcionalidades fora do escopo, e o primeiro possui comandos que editam código; retirar recursos seria tão delicado quanto manter uma integração pequena e auditável. Podem ser reutilizados padrões/trechos sob MIT com atribuição apropriada. A infraestrutura padrão do VS Code cobre interface, editor, diagnósticos e Git.

### IA local

**llama.cpp** executado como processo local (`llama-server`) com acesso somente por loopback `127.0.0.1`, iniciado/encerrado pelo Sai-nii. Modelos em arquivos GGUF; escolha manual e recomendação automática segundo memória/VRAM, consumo estimado e benchmark local. A arquitetura define uma interface de provedor que permite, futuramente, escolher um Ollama já instalado sem depender dele.

**Mac de referência:** MacBook Air M5, 16 GB de memória unificada, SSD 1 TB, CPU 10 núcleos. Iniciar ensaios com Qwen3.5-4B quantizado Q4 e comparar com Qwen3.5-9B Q4; escolher a configuração padrão conforme velocidade, qualidade pedagógica e pressão de memória medidas, não só pelo tamanho do modelo. Não assumir que o tamanho do arquivo GGUF é igual ao total de RAM utilizada.

### Memória e componentes reaproveitados

**Tutor MCP**, sob licença MIT, será avaliado e integrado como *sidecar* local para histórico pedagógico (protocolo MCP `stdio`, com SQLite). O adaptador exporá apenas funções que atendem ao produto; mecanismos de provas, progressão curricular e alertas não serão utilizados. A aceitação desta dependência exige comprovação de que a gravação/remoção de memória funciona sem currículos/exames impostos. Se essa integração se revelar incompatível no M1, usar persistência local mínima isolada por interface de armazenamento e adiar Tutor MCP — sem comprometer as funcionalidades aceitas.

### Distribuição

**VSIX específico por plataforma** com os binários auxiliares compatíveis empacotados; entrega pela página de releases, e pelo marketplace se viável. Inicialmente: macOS Apple Silicon (darwin-arm64), Windows x64 (win32-x64) e Ubuntu x64 (linux-x64). Não exigir que o usuário instale Python, Docker, Go ou compiladores. Primeira abertura oferece **baixar pela internet uma única vez** ou **importar de arquivo GGUF local**; modo offline disponível após instalação de todos os componentes. Modelo não deve integrar o VSIX por padrão devido ao tamanho.

**Atualizações:** opcionais. Sem conta, telemetria, sincronização, API comercial nem chamadas a serviços online durante o uso offline. Verificar licença dos modelos individuais antes de distribuí-los ou recomendar espelhos.

### Segurança e privacidade

- Inicia apenas em workspace confiável (integração com Workspace Trust), exclui `.env`, chaves, certificados, pastas de dependências e arquivos não textuais por padrão.
- Usa arquivos de projeto como **dados**, não como instruções capazes de alterar a política pedagógica (mitigação de prompt injection).
- Isola o subprocesso local de modelos, utiliza apenas loopback, não inclui ferramentas de rede no assistente; modo estrito offline será verificado com testes de rede.
- Não executa comandos de shell sem aprovação. Sem escrita no projeto, ainda que solicitada pelo modelo.
- Memória pertence ao usuário: consulta, exclusão, exportação local e limpeza integral, inclusive caches.
- Armazena somente os trechos necessários à memória pedagógica e não duplica integralmente o código-fonte do repositório.

## 6. Componentes e limites

**Incluído no produto:** chat lateral, contexto do workspace, Git local, ensino socrático, liberação controlada, memória local, escolha de modelos GGUF, instalação multiplataforma.

**Fora do produto v1:** geração automática de código, autocomplete por IA, agente autônomo, terminal autônomo, edição automática, GitHub remoto, sincronização em nuvem, contas, exames, pontuações, currículos impostos, voz, aplicativos móveis, suporte a editores além do VS Code.

## 7. Primeiro marco: M1 — Professor offline conversando com um projeto real

**Objetivo:** obter o primeiro ciclo completo no MacBook de referência, respeitando a política de ajuda. Produto funcional para validação, não lançamento estável.

**Escopo técnico fechado:**

1. Criar repositório com licença MIT, documentação, CI e estrutura `extension/`, `pedagogy/`, `inference/`, `context/`, `memory/`, `tests/`.
2. Criar extensão VS Code com WebviewView lateral e comandos "Perguntar", "Analisar seleção" e "Limpar marcações".
3. Implementar extrator controlado de arquivo/seleção/diagnósticos/estrutura resumida e Git local; sem rede e sem escrita.
4. Implementar adaptador para `llama-server` local, importação GGUF e estado de inicialização/erro legível; selecionar modelos Q4 4B/9B conforme benchmark.
5. Implementar política H0–H5 e liberação da solução com estado persistente de tentativas; respostas concisas e até uma pergunta orientadora por turno.
6. Persistir histórico da sessão, erros e conceitos observados entre reinicializações e permitir apagar a memória; preferir Tutor MCP se a integração pequena estiver validada.
7. Empacotar `.vsix` para macOS arm64 e preparar CI de compilação para Windows x64 e Linux x64; executar smoke tests onde houver runners.
8. Criar testes automatizados de privacidade, permissões, política de ajuda, liberação H5 e contexto de projeto; testar uma sessão com a rede desligada.

**Critérios de aceite M1:**

- Abrir `OrderFlow` no VS Code e solicitar ajuda sobre uma função sem colar código.
- A resposta mencionar corretamente o contexto recebido e formular pergunta relevante, em vez de reescrever a função.
- Nenhum arquivo ou repositório ser modificado; nenhuma execução de teste ocorrer sem ação explícita.
- Após reiniciar o VS Code, uma dificuldade antes registrada ser lembrada corretamente, com opção de apagar.
- Pedidos prematuros de solução completa serem recusados com uma pista; uma solicitação válida após tentativa e justificativa permitir solução comentada.
- Depois de importado o modelo, a conversa funcionar com a rede desligada; teste negativo comprovar inexistência de requisito de API externa.
- Instalação no Mac sem Python/Docker/Go instalados pelo usuário; artefatos de compilação para Windows/Linux gerados na CI, sem declarar suporte validado até smoke tests práticos.

**Critério de saída:** demonstração registrada de todas as verificações acima e aprovação dos testes; caso um item falhe, M1 continua aberto.

## 8. Próximos marcos após M1

- **M2 — Memória e contexto robustos:** refinamento do índice local, controles de dados, memória por conceito/projeto, avaliação de escapes pedagógicos em várias linguagens.
- **M3 — Distribuição:** smoke tests reais e instalação simples no Windows e Ubuntu, autodetecção de hardware, escolha/importação/troca de modelos; assinaturas/notarização quando aplicável.
- **M4 — Testes sob autorização:** escolha/validação de executores por linguagem, aprovação explícita, controle de efeitos e análise de resultados.

## 9. Responsabilidades e registro de decisões

Responsável pelo produto: aprova mudanças de comportamento, ensino e experiência. Responsável técnico: decide detalhes de implementação, estrutura, dependências, testes e compilação. Novas perguntas ao proprietário só serão feitas quando uma decisão alterar requisitos de produto aprovados.

**Não iniciado:** nenhuma extensão compilada, modelo instalado ou M1 executado é alegado por este documento. Este documento é a especificação e o plano de aceite para iniciar a implementação.

### Projetos e documentação consultados

- twinny — https://github.com/twinnydotdev/twinny (MIT)
- Socratic — https://github.com/GitExcited/Socratic (MIT)
- Tutor MCP — https://github.com/ArnaudGuiovanna/tutor-mcp (MIT)
- llama.cpp — https://github.com/ggml-org/llama.cpp
- Documentação de extensões específicas por plataforma — https://code.visualstudio.com/api/working-with-extensions/publishing-extension

### Alterações v1.1

- Nome oficial do aplicativo, IA e projeto definido pelo proprietário: **Sai-nii**.
- Nenhuma regra funcional ou requisito técnico da v1.0 foi alterado.
