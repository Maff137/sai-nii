'use strict';
const { resolveDiscussion, DISCUSSION_SYSTEM, DISCUSSION_SYSTEM_EN } = require('../dist/discussion.js');
const { informalInterpretation } = require('../dist/informal.js');
const { performance } = require('node:perf_hooks');
const { chooseLearnerLanguage, localizedSystem } = require('../dist/language.js');
const { technicalReview, rubricFor } = require('./technical-review.cjs');
const { INCOMPLETE_GENERATION } = require('../dist/generation.js');
const { compactDiscussionHistory, dialogueInstruction, observedIdentifierInstruction } = require('../dist/dialogue.js');
const { routeTurn } = require('../dist/routing.js');

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
  let previousLanguage = scenario.language ?? 'pt';
  let previousMode;
  for (let index = 0; index < scenario.turns.length; index++) {
    const turn = scenario.turns[index];
    const language = chooseLearnerLanguage(turn.prompt, previousLanguage);
    const routed = scenario.activeEditor ? routeTurn(turn.prompt, { editorOpen: true, previousMode }) : null;
    if (routed && routed.mode !== 'discussion') throw new Error(`Scenario ${scenario.id}: conceptual evaluator cannot impersonate code-guidance mode (${routed.mode})`);
    if (routed && turn.expectedMode && routed.mode !== turn.expectedMode) throw new Error(`Scenario ${scenario.id}: expected ${turn.expectedMode}, got ${routed.mode}`);
    const auxiliary = informalInterpretation(turn.prompt);
    const previousAnswer = [...history].reverse().find(m => m.role === 'assistant')?.content;
    const current = [`PEDIDO ATUAL DO ALUNO (PRIORIDADE): ${turn.prompt}`, auxiliary, dialogueInstruction(turn.prompt, language, history.some(item => item.role === 'assistant')), observedIdentifierInstruction(previousAnswer ?? '', turn.prompt, language)].filter(Boolean).join('\n\n');
    const messages = [{ role: 'system', content: localizedSystem(language === 'en' ? DISCUSSION_SYSTEM_EN : DISCUSSION_SYSTEM, language) }, ...compactDiscussionHistory(history, turn.prompt), { role: 'user', content: current }];
    const rejectionReasons = [];
    // The evaluator uses fixed, synthetic prompts. Raw rejected generations are
    // visible only on explicit opt-in, held in memory for this run, never logged
    // by the VS Code extension or written to a report on disk.
    const rejectedAnswers = [];
    let latestGeneration = '';
    const observedGenerator = options.includeRejected
      ? async messages => { latestGeneration = await generate(messages); return latestGeneration; }
      : generate;
    const start = performance.now();
    const outcome = await resolveDiscussion({
      messages, learnerText: turn.prompt, previousAnswer, language,
      structuralQuestion: false, observedPaths: [],
      generate: observedGenerator, onDiagnostic: (attempt, reason) => {
        rejectionReasons.push({ attempt, reason });
        if (options.includeRejected) rejectedAnswers.push({ attempt, reason, text: latestGeneration.replace(INCOMPLETE_GENERATION, '').slice(0, 2200) });
      }
    });
    const elapsedMs = Math.round(performance.now() - start);
    const evaluation = indicators(outcome.text, turn, language);
    const technicalAlerts = technicalReview(outcome.text, turn);
    turns.push({ turn: index + 1, ...(routed ? { routing_mode: routed.mode, simulated_editor: true } : {}), requested_language: language, origin: outcome.origin, code_reused: outcome.codeReused === true, elapsed_ms: elapsedMs, rejected: rejectionReasons, ...evaluation,
      technical_review_flags: technicalAlerts,
      ...(options.includeRubric ? { human_review_rubric: rubricFor(turn) } : {}),
      ...(options.includeAnswers ? { answer: outcome.text } : {}),
      ...(options.includeRejected ? { rejected_answers: rejectedAnswers } : {}) });
    previousLanguage = language;
    if (routed) previousMode = routed.mode;
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
    immutable_code_reuses: turns.filter(t => t.code_reused).length,
    fallbacks: turns.filter(t => t.origin === 'fallback').length,
    potential_relevance_gaps: turns.filter(t => t.review_recommended).length,
    potential_language_mismatches: turns.filter(t => t.language_note.startsWith('possible_')).length,
    technical_review_flags: turns.reduce((acc, turn) => acc + turn.technical_review_flags.length, 0),
    turns_for_technical_review: turns.filter(turn => turn.technical_review_flags.length > 0).length,
    total_elapsed_seconds: Math.round(turns.reduce((acc, turn) => acc + turn.elapsed_ms, 0) / 1000)
  };
}

module.exports = { evaluateScenario, summarizeReport, indicators, roughLanguage };
