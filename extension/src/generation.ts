/** An explicitly incomplete local-model response must not reach the learner. */
export const INCOMPLETE_GENERATION = '\u241ESAII_NII_INCOMPLETE_GENERATION\u241E';

/** OpenAI-compatible llama.cpp replies report finish_reason='length' on token-budget cutoff. */
export function markIncompleteGeneration(content: string, finishReason: unknown): string {
  return finishReason === 'length' ? content + INCOMPLETE_GENERATION : content;
}

export function isIncompleteGeneration(content: string): boolean {
  return content.endsWith(INCOMPLETE_GENERATION);
}
