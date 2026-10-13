/** Pure, language-independent prioritization of source text for a local-model context window. */
export function focusedSource(source: string, learnerContext: string, cursorOffset: number, maxChars = 4600): string {
  const tokens = (learnerContext.match(/[A-Za-z_$][A-Za-z0-9_$]{2,}/g) ?? [])
    .filter(word => /[A-Z_$]/.test(word) || /[0-9]/.test(word))
    .sort((a, b) => b.length - a.length);
  let anchor = Math.max(0, Math.min(cursorOffset, source.length));
  for (const term of new Set(tokens)) {
    const index = source.indexOf(term);
    if (index >= 0) { anchor = index; break; }
  }
  // Favor the lines *after* a symbol, where its body/arguments usually appear.
  const before = Math.min(550, Math.floor(maxChars / 4));
  const startGuess = Math.max(0, anchor - before);
  const lineStart = source.lastIndexOf('\n', startGuess);
  const start = lineStart < 0 ? 0 : lineStart + 1;
  const endGuess = Math.min(source.length, start + maxChars);
  const lineEnd = endGuess === source.length ? source.length : source.lastIndexOf('\n', endGuess);
  const end = lineEnd > start ? lineEnd : endGuess;
  const initialLine = source.slice(0, start).split('\n').length;
  return source.slice(start, end).split('\n').map((line, i) => `${initialLine + i}: ${line}`).join('\n');
}
