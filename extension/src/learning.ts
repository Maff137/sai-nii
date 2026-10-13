/** Evidence of learning activity, never a grade or a claim of mastery. Pure and offline. */
export type LearningKind = 'question' | 'difficulty' | 'solution';
export type GuidanceOrigin = 'model' | 'retry' | 'fallback' | 'solution';
export type LearningEvent = {
  projectId: string;
  projectName: string;
  concept: string;
  language: string;
  kind: LearningKind;
  origin: GuidanceOrigin;
  time: string;
};

/** No prompt, source code, symbol name or file path is saved. */
const CONCEPTS: Array<[string, RegExp]> = [
  ['temporizadores', /\b(?:setinterval|settimeout|timer|intervalo|temporizador|agendamento)\b/i],
  ['assincronismo', /\b(?:async|await|promise|promessa|assincron|callback|evento|event\s+loop)\b/i],
  ['funções', /\b(?:funç(?:ão|ões)|funcao|funcoes|function|def\b|argumento|parâmetro|parametro|retorno)\b/i],
  ['fluxo de controle', /\b(?:if|else|while|for|loop|laço|laco|condiç(?:ão|ões)|condicao|comparação|comparacao)\b/i],
  ['estruturas de dados', /\b(?:array|lista|list|map|set|dict|dicion[aá]rio|objeto|object|iterador)\b/i],
  ['classes e objetos', /\b(?:class|classe|herança|heranca|método|metodo|instância|instancia|oop)\b/i],
  ['bancos de dados', /\b(?:sql|sqlite|postgres|consulta|query|database|tabela|transaç(?:ão|ões)|transacao)\b/i],
  ['APIs e HTTP', /\b(?:http|api|endpoint|requisiç(?:ão|ões)|request|response|fastapi|rest)\b/i],
  ['Git', /\b(?:git|commit|branch|merge|rebase|pull|push)\b/i],
  ['testes e depuração', /\b(?:test|teste|debug|erro|bug|exception|exceção|excecao|traceback)\b/i],
  ['tipos e variáveis', /\b(?:tipo|type|typing|vari[aá]vel|variable|const|let\b|var\b)\b/i]
];
export function inferConcept(question: string): string {
  for (const [concept, pattern] of CONCEPTS) if (pattern.test(question)) return concept;
  return 'leitura de código';
}

export function learningKind(text: string, unlocked = false, needsHelp = false): LearningKind {
  if (unlocked) return 'solution';
  return needsHelp ? 'difficulty' : 'question';
}

export type LearningSummary = {
  interactions: number;
  difficulties: number;
  solutions: number;
  fallbacks: number;
  frequent: Array<{ concept: string; count: number; difficulties: number }>;
};
export function summarize(events: LearningEvent[]): LearningSummary {
  const concepts = new Map<string, { concept: string; count: number; difficulties: number }>();
  for (const event of events) {
    const state = concepts.get(event.concept) ?? { concept: event.concept, count: 0, difficulties: 0 };
    state.count += 1;
    if (event.kind === 'difficulty') state.difficulties += 1;
    concepts.set(event.concept, state);
  }
  const frequent = [...concepts.values()].sort((a,b) => b.difficulties - a.difficulties || b.count - a.count).slice(0, 5);
  return {
    interactions: events.length,
    difficulties: events.filter(e => e.kind === 'difficulty').length,
    solutions: events.filter(e => e.kind === 'solution').length,
    fallbacks: events.filter(e => e.origin === 'fallback').length,
    frequent
  };
}

/** Summaries are factual. Never infer proficiency from the number of interactions. */
export function summarizeForModel(events: LearningEvent[]): string {
  const stats = summarize(events);
  if (!stats.interactions) return '(sem histórico)';
  const categories = stats.frequent.map(s => `${s.concept}: ${s.difficulties} pedidos de ajuda em ${s.count} interações`).join('; ');
  return `Histórico observável, SEM notas e SEM inferir domínio: ${stats.interactions} interações, ` +
    `${stats.difficulties} pedidos de ajuda, ${stats.solutions} soluções explicitamente liberadas. ` +
    `Assuntos: ${categories}. Se o aluno já travou em um assunto, ofereça uma explicação mais simples e não repita a mesma pista.`;
}

export function summarizeForUser(events: LearningEvent[]): string {
  const stats = summarize(events);
  if (!stats.interactions) return 'Nenhum registro pedagógico para este projeto.';
  const lines = [
    `Interações registradas: ${stats.interactions}`,
    `Pedidos de ajuda: ${stats.difficulties}`,
    `Soluções liberadas: ${stats.solutions}`,
    `Recuperações automáticas: ${stats.fallbacks}`,
    'Assuntos observados (não são notas nem avaliação de domínio):',
    ...stats.frequent.map(s => `• ${s.concept}: ${s.count} interações; ${s.difficulties} pedidos de ajuda`)
  ];
  return lines.join('\n');
}
