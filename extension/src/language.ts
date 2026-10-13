/** Conservative response-language choice from the learner's turn, never the codebase.
 * The result is session-only, and no prompt or source path is persisted.
 */
export type LearnerLanguage = 'pt' | 'en';

function proseOnly(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/(?:https?:\/\/|www\.)\S+/gi, ' ')
    .replace(/\b(?:[\w.-]+\.(?:ts|js|py|rs|go|java|cpp|cs|swift|json|md))\b/gi, ' ');
}

const ptWords = new Set([
  'que', 'porque', 'por', 'qual', 'quais', 'como', 'pra', 'para', 'uma', 'umas', 'um', 'uns',
  'isso', 'essa', 'esse', 'dessa', 'desse', 'entao', 'voce', 'voces', 'quero', 'queria', 'poderia',
  'explicar', 'explique', 'explica', 'entender', 'diferença', 'diferenca', 'sobre', 'funciona',
  'funcionam', 'seria', 'precisa', 'preciso', 'mais', 'menos', 'mesmo', 'tambem', 'nao', 'sei',
  'agora', 'assim', 'quando', 'onde', 'pq', 'oq', 'vc', 'tbm', 'tmb', 'eh', 'ta', 'sao', 'só', 'so', 'meu', 'minha',
  'e', 'em', 'eu', 'ele', 'ela', 'do', 'da', 'de', 'os', 'as', 'no', 'na', 'ou', 'aqui',
  'me', 'ajuda', 'ajudar', 'entendi', 'desculpa', 'consegue', 'faz', 'fazer'
]);
const enWords = new Set([
  'what', 'why', 'how', 'when', 'where', 'which', 'who', 'explain', 'please', 'could',
  'would', 'should', 'does', 'do', 'did', 'can', 'cannot', 'cant', 'is', 'are', 'was', 'were',
  'the', 'this', 'that', 'these', 'those', 'about', 'into', 'with', 'without', 'between',
  'different', 'difference', 'work', 'works', 'working', 'mean', 'means', 'tell', 'me',
  'you', 'your', 'need', 'understand', 'same', 'again', 'instead', 'and', 'or', 'but',
  'still', 'so', 'then', 'another', 'more', 'less', 'thanks', 'thank'
]);

export function detectLearnerLanguage(text: string): LearnerLanguage | undefined {
  const prose = proseOnly(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Explicit requests take priority even if the rest of the message uses another language.
  if (/^(?:(?:agora|por favor|please|now|s[oó])\s*,?\s*)?(?:em ingles|in english)\b/.test(prose)) return 'en';
  if (/^(?:(?:agora|por favor|please|now|s[oó])\s*,?\s*)?(?:em portugues|in portuguese|in brazilian portuguese)\b/.test(prose)) return 'pt';
  if (/(?:\b(?:responda|responde|responder|explique|explica|explicar|fala|fale|escreva)\b.{0,50}\b(?:em ingles|in english)\b|\b(?:answer|reply|respond|explain|write|speak)\b.{0,50}\bin (?:english|portuguese|brazilian portuguese)\b)/i.test(prose)) {
    return /\bin (?:portuguese|brazilian portuguese)\b/.test(prose) ? 'pt' : 'en';
  }
  if (/^(?:(?:agora|por favor|please|now|s[oó])\s*,?\s*)?(?:em ingles|in english)\b/.test(prose)) return 'en';
  if (/^(?:(?:agora|por favor|please|now|s[oó])\s*,?\s*)?(?:em portugues|in portuguese|in brazilian portuguese)\b/.test(prose)) return 'pt';
  if (/(?:\b(?:responda|responde|responder|explique|explica|explicar|fala|fale|escreva)\b.{0,50}\bem portugues\b)/.test(prose)) return 'pt';
  const words = prose.match(/[a-z]+/g) ?? [];
  let pt = 0, en = 0;
  for (const word of words) {
    if (ptWords.has(word)) pt++;
    if (enWords.has(word)) en++;
  }
  // Single-word language cues ("why?", "pq?") are useful, but technical
  // identifiers such as `return` or `class` do not decide the language.
  if (pt === 0 && en === 0) return undefined;
  if (pt > en) return 'pt';
  if (en > pt) return 'en';
  return undefined;
}

/** Short ambiguous follow-ups inherit this project's conversational language. */
export function chooseLearnerLanguage(question: string, previous: LearnerLanguage = 'pt'): LearnerLanguage {
  return detectLearnerLanguage(question) ?? previous;
}

export function languageInstruction(language: LearnerLanguage): string {
  if (language === 'en') return 'RESPONSE LANGUAGE FOR THIS TURN: English. Explain and ask any useful question in natural English. The learner may switch language on any future turn. Preserve exact source-code identifiers, file paths and technical terms. The programming language of the project does not determine the spoken language. Never translate source code or identifiers. If the learner explicitly requests another language later, follow that request.';
  return 'IDIOMA DESTA RESPOSTA: português brasileiro. Explique e faça eventuais perguntas em português natural. O aluno pode alternar o idioma a cada mensagem. Preserve identificadores, caminhos e termos técnicos do código. A linguagem de programação não determina o idioma da explicação. Não traduza código nem identificadores.';
}

/** Reusable by the live extension and the offline evaluator. */
export function localizedSystem(base: string, language: LearnerLanguage): string {
  return `${base}\n\n${languageInstruction(language)}`;
}
