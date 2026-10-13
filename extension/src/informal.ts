/** A small, conservative aid for colloquial Portuguese.
 * The original learner question is never overwritten or persisted in this form.
 * This is not an intent classifier and never translates code identifiers.
 */
const common: Readonly<Record<string, string>> = {
  oq: 'o que', pq: 'por que', q: 'que', vc: 'você', vcs: 'vocês',
  tb: 'também', tbm: 'também', tmb: 'também', nao: 'não',
  blz: 'beleza', dps: 'depois', mto: 'muito', mt: 'muito',
  pfv: 'por favor', obg: 'obrigado'
};

/** Expand only isolated chat abbreviations in prose, not backticks or code-like input. */
export function expandInformalPortuguese(text: string): string {
  if (!text || /```/.test(text) || /(?:=>|[{};]|\b(?:const|let|var|def|class|return)\s+\w+\s*[=(])/m.test(text)) return text;
  return text.split(/(`[^`\n]*`)/g).map(part => {
    if (part.startsWith('`') && part.endsWith('`')) return part;
    const withNegation = part.replace(/\bn(?=\s+(?:sei|entendi|consigo|quero|tem|preciso|acho)\b)/gi, 'não');
    return withNegation.replace(/\b(oq|pq|q|vc|vcs|tb|tbm|tmb|nao|blz|dps|mto|mt|pfv|obg)\b/gi, word => {
      const normalized = common[word.toLowerCase()];
      return /^[A-Z]+$/.test(word) ? normalized.toUpperCase() : normalized;
    });
  }).join('');
}

export function informalInterpretation(text: string): string {
  const interpreted = expandInformalPortuguese(text);
  if (interpreted === text) return '';
  return `Leitura auxiliar de abreviações do pedido (não muda a pergunta original; confirme o sentido pelo contexto): ${interpreted.slice(0, 1700)}`;
}
