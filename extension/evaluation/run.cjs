'use strict';
/** Offline model benchmark. Requests ONLY to 127.0.0.1; no account, telemetry or file scanning. */
const { scenarios } = require('./scenarios.cjs');
const { evaluateScenario, summarizeReport } = require('./harness.cjs');
const { parseArgs } = require('node:util');

function parseOptions(argv) {
  const { values } = parseArgs({ args: argv, options: {
    limit: { type: 'string' }, case: { type: 'string' }, port: { type: 'string' }, model: { type: 'string' },
    'show-answers': { type: 'boolean' }, 'show-rubric': { type: 'boolean' }, help: { type: 'boolean' }
  }, strict: true });
  if (values.help) return { help: true };
  const port = values.port === undefined ? 8080 : Number(values.port);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('A porta deve ser um número de 1 a 65535.');
  const limit = values.limit === undefined ? 3 : Number(values.limit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > scenarios.length) throw new Error(`--limit deve estar entre 1 e ${scenarios.length}.`);
  if (values.model !== undefined && (!/^[\w./:-]{1,120}$/.test(values.model))) throw new Error('Identificador de modelo inválido.');
  const selected = values.case ? scenarios.filter(x => x.id === values.case) : scenarios.slice(0, limit);
  if (!selected.length) throw new Error(`Caso inexistente. Disponíveis: ${scenarios.map(s => s.id).join(', ')}`);
  return { port, model: values.model ?? 'local', selected, includeAnswers: Boolean(values['show-answers']), includeRubric: Boolean(values['show-rubric']) };
}

function localGenerator(port, model) {
  return async messages => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
        method: 'POST', signal: controller.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 600, stream: false })
      });
      if (!response.ok) throw new Error(`Servidor local retornou HTTP ${response.status}`);
      const body = await response.json();
      const value = body?.choices?.[0]?.message?.content;
      if (typeof value !== 'string' || !value.trim()) throw new Error('Servidor local não retornou conteúdo textual.');
      return value;
    } finally {
      clearTimeout(timer);
    }
  };
}

async function main(argv) {
  const options = parseOptions(argv);
  if (options.help) {
    console.log('Uso: npm run evaluate:local -- [--limit 3] [--case pt-git] [--port 8080] [--model local] [--show-answers] [--show-rubric]');
    console.log('Padrão: 3 cenários sintéticos. Execute --limit 9 para cenários adicionais, incluindo inglês experimental.');
    return;
  }
  const generate = localGenerator(options.port, options.model);
  const reports = [];
  console.log(`Sai-nii: avaliação offline (${options.selected.length} cenários sintéticos). Nenhuma pergunta real do usuário é lida.`);
  for (const scenario of options.selected) {
    console.log(`\n[${scenario.id}] ${scenario.label}${scenario.experimental ? ' — EXPERIMENTAL' : ''}`);
    const report = await evaluateScenario(scenario, generate, options);
    reports.push(report);
    for (const turn of report.turns) {
      console.log(`  Etapa ${turn.turn}: origem=${turn.origin}; tempo=${(turn.elapsed_ms / 1000).toFixed(1)}s; cobertura=${turn.signal_groups_matched ?? 'n/a'}/${turn.signal_groups_total}; sinal_idioma=${turn.language_note}; alertas=${turn.rejected.map(r => r.reason).join(',') || 'nenhum'}; revisao_tecnica=${turn.technical_review_flags.join(',') || 'nenhuma'}`);
      if (turn.human_review_rubric?.length) console.log(`  CRITÉRIOS PARA REVISÃO HUMANA (não avaliados automaticamente):\n${turn.human_review_rubric.map(t => `    - ${t}`).join('\n')}`);
      if (turn.answer !== undefined) console.log(`  RESPOSTA (exibição explicitamente solicitada):\n${turn.answer}\n`);
    }
  }
  console.log('\nResumo dos indicadores (NÃO medem veracidade ou qualidade pedagógica):');
  console.log(JSON.stringify(summarizeReport(reports), null, 2));
  console.log('Alertas técnicos são apenas marcadores de revisão, não provas de erro. --show-rubric exibe critérios humanos sem imprimir respostas.');
  console.log('Revisão humana é necessária para verificar exatidão técnica, clareza e adequação ao aluno.');
}

if (require.main === module) main(process.argv.slice(2)).catch(error => {
  console.error(`Avaliação interrompida: ${error.message}. Inicie o llama-server local e confirme a porta.`);
  process.exitCode = 1;
});

module.exports = { parseOptions, localGenerator };
