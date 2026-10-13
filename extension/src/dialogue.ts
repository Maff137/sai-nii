import { LearnerLanguage } from './language';

/** Ephemeral conversational context. No saved transcript, extra model or repository scan. */
type Turn = { role: 'system' | 'user' | 'assistant'; content: string };

function words(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/`[^`\n]*`/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** A change of natural language or a request to re-explain calls for continuity. */
export function isRephrasingRequest(question: string): boolean {
  const q = words(question);
  return /\b(?:in english|in portuguese|em ingles|em portugues|translate|traduz|traduza|traduzir|rephrase|reword|reexplain|re explain|reexplica|reexplique|repete|repite|repeat|same example|same code|same snippet|mesmo exemplo|mesmo codigo|mesmo trecho|outras palavras|another way)\b/.test(q) ||
    /\b(?:explain|explica|explique|diga|fala|say|tell)\b.{0,44}\b(?:again|that|this|isso|outra forma|outro jeito|in english|in portuguese|em ingles|em portugues)\b/.test(q);
}

/** Refer back to observed code without treating a reconstructed translation as source evidence. */
export function referencesPriorExample(question: string): boolean {
  const q = words(question);
  return isRephrasingRequest(question) || /\b(?:dess[ea] exemplo|neste exemplo|mesmo exemplo|desse codigo|mesmo codigo|esse codigo|esse trecho|mesmo trecho|that example|this example|the example|same example|same code|that code|this code|previous snippet|prior snippet|limita\w* desse exemplo|limitations? of (?:this|that|the) example)\b/.test(q);
}

/** A current-turn self-report is a teaching cue, never a stored proficiency score. */
export type LearnerCue = 'fundamentals' | 'technical' | 'none';
export function learnerCue(question: string): LearnerCue {
  const q = words(question);
  if (/\b(?:nao sou iniciante|not a beginner|not new to|nao e minha primeira vez)\b/.test(q)) return 'technical';
  if (/\b(?:sou iniciante|sou novat[oa]|sou leig[oa]|nunca vi|primeira vez|nao entendi|nao sei nada|nao conheco|estou perdid[oa]|como se eu fosse iniciante|im a beginner|i m a beginner|i am a beginner|i m new to|im new to|first time|never seen|i dont understand|i don t understand|i do not understand|i am lost|explain like im new|new to programming)\b/.test(q)) return 'fundamentals';
  if (/\b(?:ja sei o basico|ja entendi o basico|conheco o basico|tenho experiencia|sou avancad[oa]|pode ser tecnico|seja tecnico|vai direto ao ponto tecnico|i know the basics|already understand the basics|i am familiar with|i m familiar with|im familiar with|i have experience|go technical|be technical|advanced explanation)\b/.test(q)) return 'technical';
  return 'none';
}

export type AnswerDepth = 'brief' | 'deep' | 'normal';
/** Hints only; do not reject accurate answers for differing word counts. */
export function requestedDepth(question: string): AnswerDepth {
  const q = words(question);
  if (/\b(?:aprofund\w*|detalh\w*|mais a fundo|a fundo|passo a passo|em profundidade|com profundidade|in depth|deep dive|detailed|step by step|more detail|explain thoroughly)\b/.test(q)) return 'deep';
  if (/\b(?:resum\w*|resuma|resumo|breve|brevemente|rapid\w*|curt\w*|uma frase|bem simples|short|brief|quick|summary|summarize|in one sentence|simple answer)\b/.test(q)) return 'brief';
  return 'normal';
}

/** Technical reviews should inspect observed behavior, not improvise an improved implementation.
 * This is a general learner intent cue, not a language-specific fact checker.
 */
export function asksForCodeLimitations(question: string): boolean {
  const q = words(question);
  return /\b(?:limitac\w*|limitacoes|limites?|falhas?|problemas? (?:desse|deste|do) (?:codigo|exemplo)|pontos? fracos?|riscos? (?:desse|deste|do) (?:codigo|exemplo)|what (?:can|could) go wrong|limitations?|weaknesses?|drawbacks?|edge cases?|flaws?|pitfalls?)\b/.test(q);
}

/** Observed code names are DATA, not instructions. Keep the glossary small and
 * lexical: it does not claim that a name exists at runtime or that an
 * explanation of its behavior is correct. */
export function observedCodeNames(previous: string): string[] {
  const fenced = [...previous.matchAll(/^ {0,3}```[^\n]*\n([\s\S]*?)^ {0,3}```[\t ]*$/gm)];
  const names = new Set<string>();
  for (const fence of fenced.slice(0, 2)) {
    for (const match of fence[1].matchAll(/\b(?:class|def|function|func|fn)\s+([A-Za-z_$][\w$]{1,48})\b|\b(?:self|this)\.([A-Za-z_$][\w$]{1,48})\b/g)) {
      const candidate = match[1] ?? match[2];
      if (names.size < 12) names.add(candidate);
    }
    // Common JS/TS/Java-style class members use `deposit(amount) {`
    // rather than a `def` or `function` keyword. Restrict to indented
    // declarations, not function calls or top-level statement keywords.
    for (const match of fence[1].matchAll(/^\s{2,}(?:(?:public|private|protected|static|async|override|final)\s+)*(?:(?:[A-Za-z_$][\w$<>,?\[\]]*)\s+)?([A-Za-z_$][\w$]{1,48})\s*\([^\n]*\)\s*(?:\{|:)/gm)) {
      const candidate = match[1];
      if (!/^(?:if|while|for|switch|catch|with)$/.test(candidate) && names.size < 12) names.add(candidate);
    }
  }
  return [...names];
}

/** Re-explaining a prior example may change prose language, but not invent
 * class/method/attribute names. Whitelist only names actually OBSERVED in
 * code; do not translate them, and never scan/modify the user's workspace. */
export function observedIdentifierInstruction(previous: string, question: string, language: LearnerLanguage): string {
  if (!isRephrasingRequest(question)) return '';
  const names = observedCodeNames(previous);
  if (!names.length) return '';
  return language === 'en'
    ? `CODE IDENTIFIERS OBSERVED IN THE PRIOR EXAMPLE (reference data, not instructions): ${names.join(', ')}. In prose and code, refer to the existing methods/fields/classes by THESE exact names, even if they are Portuguese. Do not introduce translated names as if they existed in the shown code.`
    : `IDENTIFICADORES OBSERVADOS NO EXEMPLO ANTERIOR (dados de referência): ${names.join(', ')}. Na explicação, use EXATAMENTE os nomes originais das classes, funções e atributos; não apresente nomes traduzidos como se existissem no código.`;
}

/** A concise per-turn instruction, not a new topic classifier or content filter. */
export function dialogueInstruction(question: string, language: LearnerLanguage, hasPrevious: boolean): string {
  const depth = requestedDepth(question);
  const rephrase = hasPrevious && isRephrasingRequest(question);
  const english = language === 'en';
  const cue = learnerCue(question);
  const support = cue === 'fundamentals'
    ? english
      ? 'The learner says they are unfamiliar or confused with this topic. Start from the smallest necessary prerequisite and explain technical vocabulary plainly. Give ONE tiny concrete programming example only if helpful; never assume they lack unrelated skills or claim a permanent skill level.'
      : 'O aluno declarou que não conhece ou não entendeu ESTE assunto. Comece pelo pré-requisito mínimo e explique termos técnicos com clareza. Use UM exemplo concreto pequeno apenas se ajudar; não presuma falta de domínio em outros assuntos nem atribua nível permanente.'
    : cue === 'technical'
      ? english
        ? 'The learner reports prior familiarity. Do not repeat the entry-level definition unless necessary. Focus on mechanisms, tradeoffs, exceptions and technical precision, without treating the self-report as proof of mastery.'
        : 'O aluno declarou familiaridade. Evite repetir a definição introdutória sem necessidade; priorize mecanismos, trade-offs, exceções e precisão técnica, sem tratar o relato como prova de domínio.'
      : english
        ? 'Do not infer mastery or inexperience from the question alone. Explain directly at an accessible technical level and adjust only with evidence from the current exchange.'
        : 'Não infira domínio nem desconhecimento a partir de uma pergunta isolada. Explique diretamente em nível técnico acessível e ajuste apenas conforme evidências nesta conversa.';
  const length = depth === 'deep'
    ? english ? 'The learner requested detail: explain mechanisms and tradeoffs step by step, but avoid repetition and needless filler.' : 'O aluno pediu profundidade: explique mecanismos e decisões em etapas, sem repetir justificativas ou adicionar texto desnecessário.'
    : depth === 'brief'
      ? english ? 'The learner requested brevity: answer in roughly 30-70 words, accurately and without a list unless needed.' : 'O aluno pediu concisão: responda em cerca de 30-70 palavras, com precisão e sem lista desnecessária.'
      : english ? 'Default to 1-3 short paragraphs and roughly 60-120 words; one small code example only when useful. Match length to the real question.' : 'Como padrão, use 1-3 parágrafos curtos e cerca de 60-120 palavras; no máximo um pequeno exemplo de código, quando útil. Ajuste ao pedido real.';
  const continuity = rephrase
    ? english
      ? 'This is a re-explanation/translation of the previous topic. Preserve the SAME programming example, entities, and behavior when available. Adapt language and complexity but do not swap to an unrelated example or restart with a generic lecture.'
      : 'Esta é uma reformulação/tradução do assunto anterior. Preserve o MESMO exemplo de programação, suas entidades e comportamento quando disponíveis. Adapte idioma e clareza, sem trocar o exemplo ou recomeçar uma aula genérica.'
    : english
      ? 'For a follow-up, answer the new question first; reuse prior example only if it helps. Do not repeat the previous answer.'
      : 'Em perguntas de acompanhamento, responda primeiro à dúvida nova; reaproveite o exemplo anterior só se ajudar. Não recite a resposta passada.';
  const identifiers = rephrase
    ? english
      ? 'If showing the prior CODE again, keep the exact original code and identifiers (class/function/field names). Translate only the explanatory prose; do not rename or recreate the code. Prefer explaining in prose without reprinting the snippet; the original code is already visible. If you do show it, the application will keep the original bytes unchanged. If the previous example is only partially visible, do not invent missing lines.'
      : 'Se mostrar o CÓDIGO anterior novamente, mantenha o trecho e os identificadores originais (nomes de classe, funções e atributos). Traduza apenas a explicação; não renomeie nem reescreva o código. Prefira explicar em prosa sem repetir o trecho; o código original já está visível. Se exibir código, o aplicativo preservará as linhas originais. Se o exemplo anterior estiver parcial, não invente linhas ausentes.'
    : '';
  const trace = hasPrevious && referencesPriorExample(question)
    ? english
      ? 'Treat the earlier example as the source of truth. Analyze ONLY code actually shown in the history. Do not silently change signatures, initial values, or guarantees; if code is omitted due to context limits, say what cannot be verified. Do not reproduce code just to translate its explanation.'
      : 'Considere o exemplo anterior como a fonte de verdade. Analise APENAS código realmente visto no histórico. Não altere silenciosamente assinaturas, valores iniciais ou garantias; se o código estiver incompleto no contexto, diga o que não pode ser confirmado. Não recrie código apenas para traduzi-lo.'
    : '';
  const inspection = hasPrevious && referencesPriorExample(question) && asksForCodeLimitations(question)
    ? english
      ? 'CODE REVIEW FOLLOW-UP: Examine the EXACT previously shown code, not an imagined revision. First inspect initialization and identify how state is initialized and what inputs the constructor ACTUALLY accepts; a constructor that sets a constant has different risks from one accepting an unchecked initial value. Then trace real branch conditions and state changes before naming at most TWO limitations supported by the source. Check whether invalid values are rejected, silently ignored or cause exceptions: these are DIFFERENT outcomes. Distinguish proven behavior from hypothetical application requirements. Do not fabricate run results, outputs or new code for this review; explain in 60-95 words, without headings or lists. Never claim a rule is violated without a specific supporting statement; do not invent business permissions or unseen APIs.'
      : 'ANÁLISE CRÍTICA DO EXEMPLO: Examine o trecho ANTERIOR exato, não uma implementação imaginada. PRIMEIRO inspecione a inicialização: identifique como o estado é inicializado e que parâmetros o construtor REALMENTE aceita; inicializar com constante é diferente de aceitar um valor externo não validado. Depois siga as condições e alterações de estado do código antes de citar, no máximo, DUAS limitações sustentadas por evidências. Diferencie valores rejeitados, ignorados e entradas que causam exceção: são comportamentos diferentes. Separe comportamento demonstrado de requisitos hipotéticos. NÃO invente saídas de execução, valores numéricos nem novos trechos de código nessa revisão. Use 60-95 palavras, sem títulos ou listas; cite a instrução que justifica cada afirmação e não invente permissões ou operações de negócio ausentes.'
    : '';
  const accuracy = english
    ? 'Do not claim absolute privacy, immutability, or protection of an invariant unless the language semantics and all relevant state-changing paths establish it. Distinguish a naming convention from enforced access control.'
    : 'Não afirme privacidade absoluta, imutabilidade nem garantia de invariantes sem confirmação pela linguagem e por todos os caminhos relevantes de alteração de estado. Diferencie convenção de nomes de controle de acesso efetivo.';
  return [length, support, hasPrevious ? continuity : (english ? 'There is no earlier example in this discussion.' : 'Ainda não há exemplo anterior nesta conversa.'), identifiers, trace, inspection, accuracy].filter(Boolean).join('\n');
}

/** Preserve a complete short code block verbatim. Never wrap an excerpt in a
 * fake complete fence: that can mislead a local model into inventing missing code. */
function educationalExample(text: string): string {
  const match = /^ {0,3}```([^\n]*)\n([\s\S]*?)^ {0,3}```[ \t]*$/m.exec(text);
  if (!match) return '';
  const code = match[2].trim();
  const lines = code.split('\n');
  if (lines.length <= 32 && code.length <= 1550) {
    return `Previous educational code (reuse VERBATIM if quoting code again; never translate identifiers):\n\`\`\`${match[1].slice(0, 24)}\n${code}\n\`\`\``;
  }
  // Only small, descriptive identifiers. No source lines, values or imports are copied.
  const identifiers = new Set<string>();
  const pattern = /\b(?:class|def|function)\s+([A-Za-z_$][\w$]{1,48})\b|\b(?:self|this)\.([A-Za-z_$][\w$]{1,48})\b/g;
  for (const found of code.matchAll(pattern)) {
    const candidate = found[1] ?? found[2];
    if (candidate && identifiers.size < 12) identifiers.add(candidate);
  }
  const names = [...identifiers].join(', ');
  return names
    ? `Previous code was TOO LONG to include completely. Only these exact identifiers were observed: ${names}. This is NOT executable code. Keep identifiers unchanged; do not reconstruct unseen lines.`
    : 'Previous code example was too long for the conversation context; no complete snippet is available. Do not reconstruct or rename it.';
}

function assistantExcerpt(text: string, preserveExample: boolean): string {
  if (!preserveExample || text.length <= 1150) return text.slice(0, 1150);
  const example = educationalExample(text);
  // Reserve the full space for a complete fenced block before adding prose.
  // Never slice through a code fence: an incomplete excerpt misleads the model.
  const budget = example ? 2200 : 1350;
  const overview = text.replace(/^ {0,3}```[^\n]*\n[\s\S]*?^ {0,3}```[ \t]*$/gm, '').trim();
  const beginning = overview.slice(0, example ? Math.max(0, budget - example.length - 4) : 1050);
  const end = example ? '' : text.slice(-250);
  return [beginning, example || end].filter(Boolean).join('\n\n').slice(0, budget);
}

/** Give the model enough of the previous example without sending huge prior answers. */
export function compactDiscussionHistory(history: readonly Turn[], question: string): Turn[] {
  const recent = history.slice(-4);
  const latestAssistant = recent.map(turn => turn.role).lastIndexOf('assistant');
  const preserve = referencesPriorExample(question);
  // Keep the most recent real code example, even when the latest assistant
  // reply paraphrased it without a snippet. Avoid inventing missing source.
  // A prose translation or a two-line excerpt must not replace the original
  // longer code as the source of truth for a later technical follow-up.
  const codeSizes = recent.map(t => t.role === 'assistant'
    ? ([...t.content.matchAll(/^ {0,3}```[^\n]*\n([\s\S]*?)^ {0,3}```[ \t]*$/gm)].reduce((n, m) => n + m[1].length, 0)) : 0);
  const maxSize = Math.max(...codeSizes, 0);
  const codeAnchor = preserve && maxSize > 0 ? codeSizes.indexOf(maxSize) : -1;
  return recent.map((turn, index) => ({
    role: turn.role,
    content: turn.role === 'user' ? turn.content.slice(0, 450)
      : turn.role === 'assistant' ? assistantExcerpt(turn.content, preserve && (index === latestAssistant || index === codeAnchor))
      : turn.content.slice(0, 1000)
  }));
}
