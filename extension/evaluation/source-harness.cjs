'use strict';
/** Live-equivalent guided-tutoring harness for fixed, fictional source snippets.
 * No reading, executing, editing or persisting the source, project, or dialogue.
 * The same planGuidance/resolveGuidance/guidanceText used by the VS Code extension
 * run here. Rubrics never enter the model prompt.
 */
const { performance } = require('node:perf_hooks');
const { GUIDANCE_SYSTEM, GUIDANCE_SYSTEM_EN, guidanceText, planGuidance } = require('../dist/pedagogy.js');
const { resolveGuidance } = require('../dist/recovery.js');
const { chooseLearnerLanguage, localizedSystem } = require('../dist/language.js');
const { routeTurn, requestsImplementation } = require('../dist/routing.js');
const { technicalReview, rubricFor } = require('./technical-review.cjs');
const { indicators } = require('./harness.cjs');

function syntheticContext(fixture) {
  if (!fixture || typeof fixture.code !== 'string' || !fixture.code.trim() || typeof fixture.file !== 'string' || !fixture.file.trim()) {
    throw new Error('Source benchmark requires a fixed, synthetic file fixture.');
  }
  if (fixture.code.length > 3800 || fixture.file.length > 100) throw new Error('Synthetic source fixture is too large.');
  return `Arquivo fictício: ${fixture.file}; linguagem: ${fixture.language}.\n` +
    fixture.code.split('\n').map((line, index) => `${index + 1}: ${line}`).join('\n');
}

async function evaluateSourceScenario(scenario, generate, options = {}) {
  if (scenario.mode !== 'source' || !scenario.activeEditor) throw new Error('Source benchmark requires source mode and a simulated editor.');
  const sourceContext = syntheticContext(scenario.fixture);
  const turns = [], history = [];
  let language = scenario.language ?? 'pt';
  let previousMode, previousProgress;
  for (const [index, turn] of scenario.turns.entries()) {
    const decision = routeTurn(turn.prompt, { editorOpen: true, previousMode });
    if (decision.mode !== 'guidance' || (turn.expectedMode && decision.mode !== turn.expectedMode)) {
      throw new Error(`Scenario ${scenario.id} turn ${index + 1}: expected guidance, got ${decision.mode}.`);
    }
    language = chooseLearnerLanguage(turn.prompt, language);
    const plan = planGuidance(turn.prompt, previousProgress, language);
    const previousAnswers = history.slice(-4).map(entry => entry.content).join(' ');
    const messages = [
      {role: 'system', content: localizedSystem(language === 'en' ? GUIDANCE_SYSTEM_EN : GUIDANCE_SYSTEM, language)},
      ...history.slice(-6),
      {role: 'user', content: [
        'Histórico pedagógico local, resumido (não contém código nem notas escolares):\n(sem histórico)',
        `<contexto_nao_confiavel>\n${sourceContext}\n</contexto_nao_confiavel>`,
        `PEDIDO ATUAL DO ALUNO (PRIORIDADE): ${turn.prompt}`,
        plan.instruction
      ].join('\n\n')}
    ];
    const generatedAttempts = [];
    const wrappedGenerate = async requestedMessages => {
      const result = await generate(requestedMessages, { mode: 'guidance', requireHint: plan.needsHelp });
      if (options.includeRejected) generatedAttempts.push(result);
      return result;
    };
    const start = performance.now();
    const outcome = await resolveGuidance({
      messages, generate: wrappedGenerate, plan, previous: previousProgress,
      sourceContext, learnerText: turn.prompt, topicContext: previousAnswers,
      language, observationLimit: 230
    });
    const elapsedMs = Math.round(performance.now() - start);
    const answer = guidanceText(outcome.guide, plan.needsHelp);
    // All generated guidance is parsed/validated by the product's existing
    // orchestration; no unrestricted generated code is displayed here.
    const rejected = outcome.rejections ?? [];
    const evidence = indicators(answer, turn, language);
    turns.push({
      turn: index + 1, routing_mode: decision.mode, simulated_editor: true,
      requested_language: language, origin: outcome.origin, code_reused: false,
      question_narrowed: outcome.questionNarrowed === true,
      help_level: plan.helpLevel, needs_help: plan.needsHelp,
      implementation_request_in_guidance: requestsImplementation(turn.prompt),
      elapsed_ms: elapsedMs, rejected,
      ...evidence,
      technical_review_flags: technicalReview(answer, turn),
      ...(options.includeRubric ? {human_review_rubric: rubricFor(turn)} : {}),
      ...(options.includeAnswers ? {answer} : {}),
      ...(options.includeRejected ? {rejected_answers: outcome.origin === 'model' ? [] :
        generatedAttempts.slice(0, outcome.origin === 'retry' ? 1 : 2).map((text, index) => ({
          attempt: index + 1, reason: rejected[index]?.reason ?? 'guidance_invalid_output', text: text.slice(0, 2200)
        }))} : {})
    });
    previousProgress = {question: outcome.guide.question, observation: plan.needsHelp ? (outcome.guide.hint ?? outcome.guide.observation) : outcome.guide.observation, helpLevel: plan.helpLevel};
    history.push({role:'user',content:turn.prompt},{role:'assistant',content:answer});
    history.splice(0, Math.max(0, history.length-12));
    previousMode = decision.mode;
  }
  return {id: scenario.id, label: scenario.label, experimental: true, turns};
}
module.exports = { evaluateSourceScenario, syntheticContext };
