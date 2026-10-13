'use strict';
const { resolveDiscussion, DISCUSSION_SYSTEM } = require('../dist/discussion.js');
const { informalInterpretation } = require('../dist/informal.js');
const { performance } = require('node:perf_hooks');

/** A small set of observable indicators. None proves semantic correctness or teaching quality. */
function roughLanguage(answer, expected) {
  // Only flag conspicuous wrong-language answers; mixed technical vocabulary is normal.
  const a = ` ${answer.toLowerCase().replace(/[^a-záàâãéêíóôõúçñ\s]/g, ' ')} `;
  const pt = (a.match(/\b(?:que|para|uma|você|isso|porque|também|quando|não|então|exemplo|dados)\b/g) || []).length;
  const en = (a.match(/\b(?:the|this|that|with|because|when|which|your|it|you|they|example)\b/g) || []).length;
  if (expected === 'en' && pt >= 3 && pt > en * 1.7) return 'possible_portuguese';
  if (expected === 'pt' && en >= 3 && en > pt * 1.7) return 'possible_english';
  return 'unverified';
}

function normalizeForSignalCheck(text) {
  // The benchmark is not a language grader. Orthographic accents must not
  // change whether the expected *concept* was mentioned (módulo vs modulo).
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function signalPresent(regex, answer, unaccented) {
  // Avoid stateful lastIndex when a future fixture uses a global/sticky regex.
  const stable = new RegExp(regex.source, regex.flags.replace(/[gy]/g, ''));
  return stable.test(answer) || stable.test(unaccented);
}

function indicators(answer, turn, language) {
  const unaccented = normalizeForSignalCheck(answer);
  const coverage = turn.signals.length === 0 ? null : turn.signals.filter(re => signalPresent(re, answer, unaccented)).length;
  return {
    signal_groups_matched: coverage,
    signal_groups_total: turn.signals.length,
    language_note: roughLanguage(answer, language),
    // A human can review answers deliberately; raw text is not printed or stored by default.
    review_recommended: coverage !== null && coverage < turn.signals.length
  };
}

async function evaluateScenario(scenario, generate, options = {}) {
  const history = [];
  const turns = [];
  for (let index = 0; index < scenario.turns.length; index++) {
    const turn = scenario.turns[index];
    const auxiliary = informalInterpretation(turn.prompt);
    const current = [`PEDIDO ATUAL DO ALUNO (PRIORIDADE): ${turn.prompt}`, auxiliary].filter(Boolean).join('\n\n');
    const messages = [{ role: 'system', content: DISCUSSION_SYSTEM }, ...history.slice(-4), { role: 'user', content: current }];
    const rejectionReasons = [];
    const start = performance.now();
    const previousAnswer = [...history].reverse().find(m => m.role === 'assistant')?.content;
    const outcome = await resolveDiscussion({
      messages, learnerText: turn.prompt, previousAnswer,
      structuralQuestion: false, observedPaths: [],
      generate, onDiagnostic: (attempt, reason) => rejectionReasons.push({ attempt, reason })
    });
    const elapsedMs = Math.round(performance.now() - start);
    const evaluation = indicators(outcome.text, turn, scenario.language);
    turns.push({ turn: index + 1, origin: outcome.origin, elapsed_ms: elapsedMs, rejected: rejectionReasons, ...evaluation, ...(options.includeAnswers ? { answer: outcome.text } : {}) });
    if (outcome.origin !== 'fallback') {
      history.push({ role: 'user', content: turn.prompt }, { role: 'assistant', content: outcome.text });
    }
  }
  return { id: scenario.id, label: scenario.label, experimental: Boolean(scenario.experimental), turns };
}

function summarizeReport(results) {
  const turns = results.flatMap(result => result.turns);
  return {
    scenarios: results.length,
    turns: turns.length,
    model_first_attempt: turns.filter(t => t.origin === 'model').length,
    model_retry: turns.filter(t => t.origin === 'retry').length,
    fallbacks: turns.filter(t => t.origin === 'fallback').length,
    potential_relevance_gaps: turns.filter(t => t.review_recommended).length,
    potential_language_mismatches: turns.filter(t => t.language_note.startsWith('possible_')).length,
    total_elapsed_seconds: Math.round(turns.reduce((acc, turn) => acc + turn.elapsed_ms, 0) / 1000)
  };
}

module.exports = { evaluateScenario, summarizeReport, indicators, roughLanguage };
