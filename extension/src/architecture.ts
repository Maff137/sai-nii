/** Deterministic, language-neutral outline of a local workspace.
 * No filesystem reads or inference about what the architecture *means* happen here.
 */

function unaccented(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Distinguish "one source file" from "one directory". Both are architecture questions,
 * but require different explanations. No language or framework assumptions. */
export function singleFileIntent(question: string): boolean {
  const q = unaccented(question);
  const oneFile = /(?:um|num|no|em|so|apenas|unico|mesmo|one|single|same)\s+(?:(?:so|apenas|unico|mesmo|grande|gigante|big|giant)\s+)?(?:arquivo|file)\b|\b(?:arquivo|file)\s+(?:unico|so|gigante|single|grande)\b/.test(q);
  const code = /\b(?:codigo|code|funcoes?|functions?|classes?|metodos?|methods?|logica|logic|modulos?|modules?)\b/.test(q);
  const scope = /\b(?:todo|tudo|todos|all|entire|whole|inteiro|everything|por que|porque|why|divid\w*|separ\w*|split)\b/.test(q);
  const splitting = /\b(?:divid\w*|separ\w*|split|varios|multiplos|multiple|different)\b/.test(q) &&
    /\b(?:arquivos?|files?|modulos?|modules?)\b/.test(q) && code;
  return (oneFile && code && scope) || splitting;
}

export function architectureIntent(question: string): boolean {
  const q = unaccented(question);
  if (singleFileIntent(question)) return true;
  return /arquitetur|architecture|architectural|estrutura\s+(?:d[aoe]s?\s+)?(?:projeto|codigo|pastas?|diretorios?|repositorio)|(?:arquivos?|pastas?|diretorios?|codigo|projeto).{0,55}(?:organizad|organiza[cç]|separad|dividid|distribuid)|(?:organizac|organizad|separad|dividid).{0,55}(?:arquivos?|pastas?|diretorios?|codigo|projeto)|(?:mapa|visao geral|overview).{0,45}(?:projeto|repositorio|codigo|pastas?)|(?:como|porque|por que).{0,40}(?:estrutura|camadas|pastas?|diretorios?)|folder structure|project structure/.test(q);
}

function displaySafe(input: string): string {
  return input.replace(/[\r\n\t<>]/g, '_').replaceAll('\\', '/');
}

// Prefer human-written code and conventional layout roots over assets/config noise.
function priority(name: string, directory: boolean): number {
  const n = name.toLowerCase();
  if (directory) {
    if (/^(src|app|lib|cmd|internal|pkg|server|client|backend|frontend|api|core|domain|services|controllers|models|tests?|spec|docs?)$/.test(n)) return 0;
    return 2;
  }
  if (/^(readme(?:\.md)?|architecture\.md|package\.json|pyproject\.toml|cargo\.toml|go\.mod|pom\.xml|build\.gradle(?:\.kts)?|cmakelists\.txt|makefile|composer\.json|pubspec\.yaml|gemfile|mix\.exs|project\.toml|build\.zig|package\.swift)$/i.test(n)) return -1;
  if (/^(main|app|index|program|server|lib)\./i.test(n)) return 1;
  return 3;
}

type TreeNode = { name: string; directory: boolean; children: Map<string, TreeNode> };

/** Bounded tree drawn from the workspace file listing, not guessed folder conventions. */
export function architectureOutline(paths: string[], maxChars = 3600): string {
  const root: TreeNode = { name: '', directory: true, children: new Map() };
  for (const raw of paths.slice(0, 1200)) {
    const candidate = displaySafe(raw);
    if (!candidate || candidate.startsWith('/') || candidate.includes('..') || candidate.includes('\0')) continue;
    const parts = candidate.split('/').filter(Boolean);
    if (parts.length > 9 || parts.some(x => x.startsWith('.') && /^(\.git|\.env)/i.test(x))) continue;
    let current = root;
    parts.forEach((name, i) => {
      const directory = i < parts.length - 1;
      let child = current.children.get(name);
      if (!child) {
        child = { name, directory, children: new Map() };
        current.children.set(name, child);
      }
      current = child;
    });
  }
  const lines: string[] = [];
  let used = 0;
  let stopped = false;
  function walk(node: TreeNode, depth: number): void {
    if (stopped || depth > 6) return;
    const sorted = [...node.children.values()].sort((a, b) =>
      priority(a.name, a.directory) - priority(b.name, b.directory) ||
      Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name));
    for (const [index, child] of sorted.entries()) {
      if (index >= 32) {
        const note = `${'  '.repeat(depth)}… (${sorted.length - index} caminhos adicionais)`;
        if (used + note.length + 1 < maxChars) { lines.push(note); used += note.length + 1; }
        break;
      }
      if (stopped) break;
      const line = `${'  '.repeat(depth)}${child.name}${child.directory ? '/' : ''}`;
      if (used + line.length + 1 > maxChars) { stopped = true; break; }
      lines.push(line);
      used += line.length + 1;
      if (child.directory) walk(child, depth + 1);
    }
  }
  walk(root, 0);
  if (stopped && used + 40 < maxChars) lines.push('… (demais caminhos omitidos por limite)');
  return lines.join('\n') || '(nenhum arquivo encontrado)';
}

type EvidenceKind = 'docs' | 'manifest' | 'entry';
function evidenceKind(file: string): EvidenceKind | null {
  const lower = file.toLowerCase();
  const base = lower.split('/').at(-1) ?? '';
  if (/^(?:readme(?:\.md|\.rst|\.txt)?|architecture\.md)$/.test(base) && lower.split('/').length <= 3) return 'docs';
  if (/^(?:package\.json|pyproject\.toml|requirements\.txt|cargo\.toml|go\.mod|pom\.xml|build\.gradle(?:\.kts)?|cmakelists\.txt|makefile|composer\.json|pubspec\.yaml|gemfile|mix\.exs|project\.toml|build\.zig|package\.swift|build\.sbt|deno\.json|tsconfig\.json|meson\.build|setup\.py|setup\.cfg)$/.test(base) && lower.split('/').length <= 3) return 'manifest';
  if (/^(?:main|app|index|program|server|lib|application)\.(?:[\w-]+)$/.test(base) && lower.split('/').length <= 5) return 'entry';
  return null;
}

/** Choose documents/configuration/entry points; never sample random source files. */
export function architectureEvidence(paths: string[], limit = 4): string[] {
  const picked: string[] = [];
  const entries = paths.filter(x => !/[\r\n\0]/.test(x))
    .map(file => ({ file, kind: evidenceKind(file) }))
    .filter((x): x is { file: string; kind: EvidenceKind } => x.kind !== null);
  const weight = (file: string): number => {
    const base = file.toLowerCase().split('/').at(-1) ?? '';
    const depth = file.split('/').length;
    return (base.startsWith('readme') ? -10 : base === 'architecture.md' ? -8 :
      base === 'package.json' || base === 'pyproject.toml' || base === 'cargo.toml' || base === 'go.mod' ? -6 : 0) + depth * 3;
  };
  for (const kind of ['docs', 'manifest', 'entry'] as EvidenceKind[]) {
    const matches = entries.filter(x => x.kind === kind).sort((a,b) => weight(a.file) - weight(b.file) || a.file.localeCompare(b.file));
    const desired = kind === 'entry' ? 2 : 1;
    for (const {file} of matches.slice(0, desired)) {
      if (picked.length < Math.min(limit, 6)) picked.push(file);
    }
  }
  return picked;
}


/** A grounded, educational overview built from observed relative paths alone.
 * It explains conventional tradeoffs, but never claims to know historical design intent.
 */
export function architectureSynopsis(observedPaths: string[], question = '', previousAnswer = ''): string {
  const safe = observedPaths.filter(p =>
    typeof p === 'string' && p.length < 180 && !/[\r\n\0<>]/.test(p) &&
    !p.startsWith('/') && !p.split('/').some(part => !part || part === '..' ||
      /^(?:\.git|\.env(?:\..+)?|node_modules|\.ssh|\.aws|\.gnupg|secrets?|credentials?)$/i.test(part))
  ).map(p => p.replaceAll('\\','/'));
  if (!safe.length) return 'Não encontrei arquivos suficientes para descrever a arquitetura desta pasta. Confirme se a pasta raiz correta está aberta no VS Code.';

  // A follow-up about putting ALL CODE in one file is not a question about
  // placing tests and docs in the same directory. Answer the current question.
  if (singleFileIntent(question)) {
    const sources = safe.filter(p => /\/(?:src|app|lib|internal|pkg|server|client)\/|^(?:src|app|lib)\//i.test(p) &&
      /\.[a-z0-9]{1,8}$/i.test(p) && !/\.(?:md|json|yaml|yml|toml|xml|txt)$/i.test(p));
    const examples = sources.slice(0, 2);
    const observed = examples.length >= 2
      ? `Neste projeto, por exemplo, \`${examples[0]}\` e \`${examples[1]}\` são arquivos distintos. A divisão está visível; as dependências entre eles só podem ser confirmadas lendo as referências do código.`
      : examples.length === 1
        ? `Encontrei \`${examples[0]}\` como exemplo de arquivo de implementação, mas a árvore, sozinha, não confirma como o código está distribuído.`
        : 'A listagem disponível não permite confirmar como as funções estão distribuídas neste projeto.';
    return [
      'Sim: é o mesmo princípio de separar responsabilidades, mas agora DENTRO do código. Ter vários arquivos permite agrupar funções, classes e módulos por assunto, tornando mais simples encontrar a parte certa, testá-la, reutilizá-la e alterar uma área sem precisar navegar por um arquivo enorme.',
      'Colocar tudo em um único arquivo não é necessariamente errado. Um programa pequeno pode ficar mais fácil assim. Conforme cresce, porém, misturar interface, regras de negócio e acesso a dados no mesmo arquivo aumenta a dificuldade de navegação, revisão e manutenção. Separar demais também cria complexidade: cada arquivo deve ter um motivo para existir.',
      observed,
      'A diferença é que pastas organizam grupos de arquivos; arquivos e módulos organizam partes da implementação. A estrutura não prova que os módulos sejam independentes ou bem desacoplados: isso exige examinar o código.'
    ].join('\n\n');
  }

  const pathSet = new Set(safe);
  const has = (dir: string) => safe.some(p => p.startsWith(`${dir}/`));
  const contains = (name: string) => pathSet.has(name);
  const topFolders = [...new Set(safe.filter(p => p.includes('/')).map(p => p.split('/')[0]))];
  const isExtension = has('extension/src') && contains('extension/package.json');
  const source = has('extension/src') ? 'extension/src/' : ['src', 'app', 'lib'].find(has);
  const sourceLabel = source ? source.endsWith('/') ? source : `${source}/` : '';
  const test = has('extension/test') ? 'extension/test/' : ['tests', 'test', 'spec'].find(has);
  const testLabel = test ? test.endsWith('/') ? test : `${test}/` : '';
  const docs = has('docs') ? 'docs/' : has('doc') ? 'doc/' : '';
  const manifest = ['extension/package.json', 'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'pom.xml', 'pubspec.yaml']
    .find(contains);
  const why = /por que|porque|motivo|vantag|problema|junt|mistur|decis|organiz|separ/i.test(
    question.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
  const followup = Boolean(previousAnswer);
  const lines: string[] = [];
  if (why || followup) {
    lines.push(followup ? 'Aprofundando a decisão arquitetural: não é só saber onde cada arquivo fica: dividir responsabilidades limita a quantidade de coisas diferentes que precisamos examinar ao fazer uma mudança. A estrutura sugere essa vantagem, mas não demonstra a intenção histórica de quem a criou.' : 'Por que separar essas partes? A ideia é dividir responsabilidades: cada tipo de arquivo pode mudar e ser consultado por motivos diferentes. Isso costuma tornar um projeto mais fácil de compreender e manter; não prova qual foi a intenção original dos autores.');
  } else {
    lines.push('Como a estrutura funciona e por que ela ajuda: os diretórios observados agrupam funções distintas. Essa divisão facilita localizar uma alteração e investigar seu efeito.');
  }

  if (sourceLabel && testLabel) {
    lines.push(`${sourceLabel} e ${testLabel}: o primeiro contém código de implementação; o segundo contém verificações do comportamento. Separá-los ajuda a encontrar testes sem confundi-los com o código executado e a identificar o que precisa ser verificado depois de uma mudança. A árvore não demonstra quais funções têm cobertura de testes.`);
  } else if (sourceLabel) {
    lines.push(`${sourceLabel}: concentra arquivos de implementação. Agrupá-los facilita localizar onde alterar o funcionamento, especialmente conforme o projeto cresce.`);
  } else if (testLabel) {
    lines.push(`${testLabel}: reúne arquivos que, pelo nome, parecem ser de teste. Mantê-los separados do restante reduz a confusão entre verificar e executar o sistema.`);
  }

  if (docs) lines.push(`${docs}: documentação pode registrar conceitos, regras de uso e decisões sem misturá-los ao código. Assim, alguém consegue entender o projeto antes de investigar cada função; documentos e implementação ainda precisam permanecer coerentes.`);
  if (manifest) lines.push(`${manifest}: concentra informações de configuração e dependências. Isso permite encontrar como o módulo é montado sem procurar configurações em todos os arquivos de implementação.`);
  if (contains('README.md')) lines.push('README.md: oferece uma porta de entrada para entender o projeto antes de ler todos os módulos; documentação não substitui a verificação do código.');
  if (isExtension) lines.push('Por que extension/ é um módulo separado? Aqui ela contém a implementação, os testes e a configuração da extensão do VS Code; isso distingue o software propriamente dito da documentação geral do repositório.');
  if (!sourceLabel && !testLabel && !docs && !manifest) {
    for (const folder of topFolders.slice(0, 4)) lines.push(`${folder}/: pasta encontrada. O nome, sozinho, não confirma seu papel; precisamos de mais evidências para explicar suas dependências.`);
  }

  if (followup && sourceLabel && testLabel) lines.push(`Na prática: ao alterar algo em ${sourceLabel}, você pode procurar verificações correspondentes em ${testLabel}. Essa proximidade conceitual facilita investigar regressões, embora só o conteúdo dos testes confirme o que cobrem.`);
  if (why || followup) {
    lines.push('E se tudo ficasse na mesma pasta? O programa poderia continuar funcionando. Em um projeto pequeno, isso até pode ser suficiente. Porém, ao crescer, arquivos de código, testes, documentação e configuração ficariam misturados: encontrar responsabilidades, revisar mudanças e navegar pelos arquivos tenderia a exigir mais esforço. A separação traz clareza, mas cria pastas e regras de organização que também precisam ser mantidas.');
  } else if (sourceLabel && (testLabel || docs)) {
    lines.push('A troca envolvida: dividir por responsabilidade adiciona diretórios, mas torna mais explícita a diferença entre implementar, testar e documentar. Em projetos pequenos, uma estrutura mais simples também pode ser adequada.');
  }
  lines.push('O que ainda não sabemos: a árvore sugere papéis e convenções; para confirmar chamadas entre funções, dependências reais e motivos históricos, é necessário examinar os arquivos e suas referências.');
  return lines.join('\n\n');
}
