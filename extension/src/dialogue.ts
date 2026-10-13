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
  return /\b(?:in english|in portuguese|em ingles|em portugues|translate|traduz|traduza|traduzir|rephrase|reword|reexplain|re explain|reexplica|reexplique|repete|repite|repeat|same example|mesmo exemplo|outras palavras|another way)\b/.test(q) ||
    /\b(?:explain|explica|explique|diga|fala|say|tell)\b.{0,44}\b(?:again|that|this|isso|outra forma|outro jeito|in english|in portuguese|em ingles|em portugues)\b/.test(q);
}

export type AnswerDepth = 'brief' | 'deep' | 'normal';
/** Hints only; do not reject accurate answers for differing word counts. */
export function requestedDepth(question: string): AnswerDepth {
  const q = words(question);
  if (/\b(?:aprofund\w*|detalh\w*|mais a fundo|a fundo|passo a passo|em profundidade|com profundidade|in depth|deep dive|detailed|step by step|more detail|explain thoroughly)\b/.test(q)) return 'deep';
  if (/\b(?:resum\w*|resuma|resumo|breve|brevemente|rapid\w*|curt\w*|uma frase|bem simples|short|brief|quick|summary|summarize|in one sentence|simple answer)\b/.test(q)) return 'brief';
  return 'normal';
}

/** A concise per-turn instruction, not a new topic classifier or content filter. */
export function dialogueInstruction(question: string, language: LearnerLanguage, hasPrevious: boolean): string {
  const depth = requestedDepth(question);
  const rephrase = hasPrevious && isRephrasingRequest(question);
  const english = language === 'en';
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
  return `${length}\n${hasPrevious ? continuity : (english ? 'There is no earlier example in this discussion.' : 'Ainda não há exemplo anterior nesta conversa.')}`;
}

function firstCompleteFence(text: string): string {
  const match = /^ {0,3}```([^\n]*)\n([\s\S]*?)^ {0,3}```[ \t]*$/m.exec(text);
  if (!match) return '';
  const lines = match[2].trim().split('\n');
  const chosen = lines.slice(0, 16).join('\n').slice(0, 900);
  return `\`\`\`${match[1].slice(0, 24)}\n${chosen}\n\`\`\``;
}

function assistantExcerpt(text: string, preserveExample: boolean): string {
  if (!preserveExample || text.length <= 1150) return text.slice(0, 1150);
  const fence = firstCompleteFence(text);
  const beginning = text.replace(/^ {0,3}```[^\n]*\n[\s\S]*?^ {0,3}```[ \t]*$/gm, '').trim().slice(0, fence ? 480 : 1050);
  const end = fence ? '' : text.slice(-250);
  const excerpt = [beginning, fence ? `Previous educational example:\n${fence}` : end].filter(Boolean).join('\n\n');
  return excerpt.slice(0, 1750);
}

/** Give the model enough of the previous example without sending huge prior answers. */
export function compactDiscussionHistory(history: readonly Turn[], question: string): Turn[] {
  const recent = history.slice(-4);
  const latestAssistant = recent.map(turn => turn.role).lastIndexOf('assistant');
  const preserve = isRephrasingRequest(question);
  return recent.map((turn, index) => ({
    role: turn.role,
    content: turn.role === 'user' ? turn.content.slice(0, 450)
      : turn.role === 'assistant' ? assistantExcerpt(turn.content, preserve && index === latestAssistant)
      : turn.content.slice(0, 1000)
  }));
}
