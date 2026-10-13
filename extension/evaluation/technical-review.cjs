'use strict';
/** Evidence-based review QUEUE for a small set of synthetic scenarios.
 * No language model judges another model; alerts are NOT automatic fact checks.
 * Only scenario-authored patterns are evaluated, never user files or private chats.
 */
function matches(pattern, answer) {
  const stable = new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ''));
  return stable.test(answer) || stable.test(answer.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
}

function technicalReview(answer, turn) {
  const review = turn.technicalReview;
  if (!review) return [];
  const alerts = [];
  for (const watch of review.watch ?? []) {
    if (matches(watch.pattern, answer)) alerts.push(watch.id);
  }
  // A negative premise is an opportunity for the tutor to challenge it,
  // but a simple phrase search cannot establish that the correction is valid.
  if (review.challenge && !review.challenge.signals.some(re => matches(re, answer))) {
    alerts.push('premise_challenge_not_observed');
  }
  return alerts;
}

function rubricFor(turn) {
  // Human-facing reference: NEVER put this in the model's prompt.
  return turn.technicalReview?.rubric ?? [];
}
module.exports = { technicalReview, rubricFor };
