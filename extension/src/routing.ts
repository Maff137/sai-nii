import { architectureIntent } from './architecture';
import { isRephrasingRequest } from './dialogue';

/** Routing is based on the learner's intent, never only on whether an editor is open.
 * A conservative source/task request never enters the freer conceptual generator.
 * This lexical decision is NOT proof that a generated example is safe or correct.
 */
export type TeachingMode = 'discussion' | 'guidance';
export type RoutingDecision = { mode: TeachingMode; context: 'workspace' | 'editor'; reason: 'architecture' | 'source' | 'concept' | 'followup' | 'default' };
export type RoutingState = { editorOpen: boolean; selectionActive?: boolean; previousMode?: TeachingMode };

function normalized(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ')
    .replace(/[^a-z0-9_\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Implementation commands override architectural/conceptual wording. Never use
 * this marker to authorize release: only the app's explicit gate may do that. */
export function requestsImplementation(input: string): boolean {
  const q = normalized(input);
  return /\b(?:implementar|implemente|implement|corrija|corrigir|fix|debug|consertar|refatorar|refatore|refactor|edite|editar|edit|escreve|escrever|escreva|write|modifique|modificar|modify|construa|build|desenvolva|develop|resolve|resolva|solve|gere|generate|crie|create|complete|completar)\b/.test(q)
    || /\b(?:como faco|como crio|como implemento|como escrevo|como conserto|how can i build|how can i implement|how do i implement|how do i build|how do i write|how do i create|can you build|can you write|can you create)\b/.test(q)
    || /\b(?:faz|faca|fazer|make|do)\b.{0,40}\b(?:pra mim|para mim|for me|codigo|code|script|funcao|function|api|programa|program)\b|\b(?:me da o codigo|give me the code|write me a function|codigo pronto|ready made solution)\b/.test(q);
}

/** A concrete task or a question about the currently opened source needs guidance. */
export function refersToConcreteTask(input: string): boolean {
  const q=normalized(input);
  const source = /\b(?:meu|minha|neste|nessa|nesse|deste|dessa|desse|este|esta|essa|esse|aqui|aberto|selecionado|atual|our|my|this|these|selected|open|current)\b.{0,42}\b(?:codigo|code|arquivo|file|funcao|function|classe|class|metodo|method|trecho|snippet|script|erro|error|bug|projeto|project)\b|\b(?:codigo|code|arquivo|file|funcao|function|classe|class|metodo|method|trecho|snippet|script|erro|error|bug)\b.{0,38}\b(?:meu|minha|neste|nesse|deste|desse|aqui|aberto|selecionado|my|this|selected|current)\b/.test(q);
  const explicitSource = /\b(?:trecho selecionado|arquivo aberto|este trecho|nesse arquivo|no meu codigo|no meu projeto|this code|this file|my code|my project|the selected code|current file|selected snippet|minha implementacao|my implementation|meu erro|my error)\b/.test(q);
  const task = requestsImplementation(input);
  const repair = /\b(?:nao funciona|nao roda|nao compila|falhando|erro de execucao|not working|doesnt work|won t run|wont run|crashing|stack trace|traceback|failed tests)\b/.test(q);
  // Requests for a conceptual example ("mostra um exemplo") remain pedagogical;
  // requests to create, change, or fix an implementation do not.
  return source || explicitSource || task || repair;
}

export function routesToConcept(input: string): boolean {
  const q=normalized(input);
  return /\b(?:o que e|oq e|que significa|significado|conceito|definicao|para que serve|por que usar|porque usamos|por que|porque|quando usar|como funciona|qual a diferenca|diferenca entre|me explica|me explique|me ensina|fala sobre|explica pra mim|exemplo de|exemplo simples|um exemplo|what is|what are|what does|what means|meaning of|concept of|why use|why|when to use|how does|how do|difference between|explain|teach me|tell me about|how is|could you explain|can you explain)\b/.test(q);
}

export function routeTurn(question: string, state: RoutingState): RoutingDecision {
  if (requestsImplementation(question)) return { mode: 'guidance', context: 'editor', reason: 'source' };
  if (architectureIntent(question)) return { mode: 'discussion', context: 'workspace', reason: 'architecture' };
  if (refersToConcreteTask(question)) return { mode: 'guidance', context: 'editor', reason: 'source' };
  if (state.previousMode && /^(?:e )?(?:por que|pq|why|como|how|e por que|e pq|and why|e como)\??$/.test(normalized(question))) {
    return { mode: state.previousMode, context: state.previousMode === 'discussion' ? 'workspace' : 'editor', reason: 'followup' };
  }
  if (routesToConcept(question)) return { mode: 'discussion', context: 'workspace', reason: 'concept' };
  if (state.previousMode && (isRephrasingRequest(question) || /^(?:e |mas |and |but |entao |so |why |por que |pq\b|how about |e se )/.test(normalized(question)))) {
    return { mode: state.previousMode, context: state.previousMode === 'discussion' ? 'workspace' : 'editor', reason: 'followup' };
  }
  // A selection makes an otherwise underspecified question a request to inspect
  // the selection; without one, keep the previous conceptual dialogue if any.
  if (state.selectionActive) return { mode: 'guidance', context: 'editor', reason: 'default' };
  if (state.previousMode === 'discussion') return { mode: 'discussion', context: 'workspace', reason: 'followup' };
  return state.editorOpen
    ? { mode: 'guidance', context: 'editor', reason: 'default' }
    : { mode: 'discussion', context: 'workspace', reason: 'default' };
}
