'use strict';
/** Offline model benchmark. Requests ONLY to 127.0.0.1; no account, telemetry or file scanning. */
const { scenarios } = require('./scenarios.cjs');
const { markIncompleteGeneration } = require('../dist/generation.js');
const { evaluateScenario, summarizeReport } = require('./harness.cjs');
const { evaluateSourceScenario } = require('./source-harness.cjs');
const { parseArgs } = require('node:util');

function parseOptions(argv) {
  const { values } = parseArgs({ args: argv, options: {
    limit: { type: 'string' }, case: { type: 'string' }, port: { type: 'string' }, model: { type: 'string' },
    suite: { type: 'string' }, 'list-cases': { type: 'boolean' },
    'show-answers': { type: 'boolean' }, 'show-rubric': { type: 'boolean' }, 'show-rejected': { type: 'boolean' }, help: { type: 'boolean' }
  }, strict: true });
  if (values.help) return { help: true };
  if (values['list-cases']) return { listCases: true };
  if (values.case && values.suite) throw new Error('Use --case OU --suite, não ambos.');
  if (values.suite && !['source', 'discussion'].includes(values.suite)) throw new Error('--suite deve ser source ou discussion.');
  const port = values.port === undefined ? 8080 : Number(values.port);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('A porta deve ser um número de 1 a 65535.');
  const limit = values.limit === undefined ? undefined : Number(values.limit);
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1 || limit > scenarios.length)) throw new Error(`--limit deve estar entre 1 e ${scenarios.length}.`);
  if (values.model !== undefined && (!/^[\w./:-]{1,120}$/.test(values.model))) throw new Error('Identificador de modelo inválido.');
  const candidates = values.case ? scenarios.filter(x => x.id === values.case) : values.suite === 'source'
    ? scenarios.filter(x => x.mode === 'source') : values.suite === 'discussion'
      ? scenarios.filter(x => x.mode !== 'source') : (limit === undefined ? scenarios.slice(0, 3) : scenarios);
  const selected = limit === undefined ? candidates : candidates.slice(0, limit);
  if (!selected.length) throw new Error(`Caso inexistente. Disponíveis: ${scenarios.map(s => s.id).join(', ')}`);
  return { port, model: values.model ?? 'local', selected, includeAnswers: Boolean(values['show-answers']), includeRubric: Boolean(values['show-rubric']), includeRejected: Boolean(values['show-rejected']) };
}

function localGenerator(port, model) {
  return async (messages, request = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
        method: 'POST', signal: controller.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model, messages, temperature: 0.2, max_tokens: request.mode === 'guidance' ? 380 : 600, stream: false,
          ...(request.mode === 'guidance' ? { response_format: { type: 'json_object', schema: {
            type: 'object', properties: {
              observation: { type: 'string', minLength: 1, maxLength: 230 },
              question: { type: 'string', maxLength: 180 },
              hint: { type: 'string', maxLength: 230, ...(request.requireHint ? {minLength: 1} : {}) }
            }, required: ['observation', 'question', 'hint'], additionalProperties: false
          } } } : {})
        })
      });
      if (!response.ok) throw new Error(`Servidor local retornou HTTP ${response.status}`);
      const body = await response.json();
      const value = body?.choices?.[0]?.message?.content;
      if (typeof value !== 'string' || !value.trim()) throw new Error('Servidor local não retornou conteúdo textual.');
      return request.mode === 'guidance' ? value : markIncompleteGeneration(value, body?.choices?.[0]?.finish_reason);
    } finally {
      clearTimeout(timer);
    }
  };
}

async function main(argv) {
  const options = parseOptions(argv);
  if (options.help) {
    console.log('Uso: npm run evaluate:local -- [--case source-python | --suite source | --suite discussion] [--limit N] [--list-cases] [--port 8080] [--model local] [--show-answers] [--show-rubric] [--show-rejected]');
    console.log('Padrão: 3 cenários conceituais. --suite source testa todos os 5 cenários com código SINTÉTICO. --list-cases não precisa de servidor.');
    return;
  }
  if (options.listCases) {
    console.log('Casos sintéticos disponíveis:');
    scenarios.forEach(s => console.log(`  ${s.id} [${s.mode === 'source' ? 'source' : 'discussion'}] — ${s.label}`));
    return;
  }
  const generate = localGenerator(options.port, options.model);
  const reports = [];
  console.log(`Sai-nii: avaliação offline (${options.selected.length} cenários sintéticos). Nenhuma pergunta real do usuário é lida.`);
  for (const scenario of options.selected) {
    console.log(`\n[${scenario.id}] ${scenario.label}${scenario.experimental ? ' — EXPERIMENTAL' : ''}`);
    const report = scenario.mode === 'source'
      ? await evaluateSourceScenario(scenario, generate, options)
      : await evaluateScenario(scenario, generate, options);
    reports.push(report);
    for (const turn of report.turns) {
      console.log(`  Etapa ${turn.turn}: ${turn.routing_mode ? `roteamento=${turn.routing_mode} (editor simulado); ` : ''}origem=${turn.origin}; codigo_preservado=${turn.code_reused ? 'sim' : 'não'}; idioma=${turn.requested_language}; ${turn.needs_help !== undefined ? `pista=${turn.needs_help ? 'sim' : 'não'}(nível ${turn.help_level}); ` : ''}${turn.question_narrowed !== undefined ? `pergunta_ajustada=${turn.question_narrowed ? 'sim' : 'não'}; ` : ''}tempo=${(turn.elapsed_ms / 1000).toFixed(1)}s; cobertura=${turn.signal_groups_matched ?? 'n/a'}/${turn.signal_groups_total}; sinal_idioma=${turn.language_note}; alertas=${turn.rejected.map(r => r.reason).join(',') || 'nenhum'}; revisao_tecnica=${turn.technical_review_flags.join(',') || 'nenhuma'}`);
      if (turn.human_review_rubric?.length) console.log(`  CRITÉRIOS PARA REVISÃO HUMANA (não avaliados automaticamente):\n${turn.human_review_rubric.map(t => `    - ${t}`).join('\n')}`);
      if (turn.rejected_answers?.length) for (const rejected of turn.rejected_answers) {
        console.log(`  TENTATIVA REJEITADA ${rejected.attempt} (${rejected.reason}; apenas cenário sintético):\n${rejected.text}\n`);
      }
      if (turn.answer !== undefined) console.log(`  RESPOSTA (exibição explicitamente solicitada):\n${turn.answer}\n`);
    }
  }
  console.log('\nResumo dos indicadores (NÃO medem veracidade ou qualidade pedagógica):');
  console.log(JSON.stringify(summarizeReport(reports), null, 2));
  console.log('Alertas técnicos são apenas marcadores de revisão, não provas de erro. --show-rubric exibe critérios humanos sem imprimir respostas.');
  console.log('Use --show-rejected apenas para analisar respostas do benchmark sintético; essa opção exibe saídas anteriormente rejeitadas no Terminal.');
  console.log('Source suite usa trechos FICTÍCIOS em memória e a mesma validação JSON/pistas da extensão; NÃO executa código nem verifica fatos automaticamente.');
  console.log('Revisão humana é necessária para verificar exatidão técnica, clareza e adequação ao aluno.');
}

if (require.main === module) main(process.argv.slice(2)).catch(error => {
  console.error(`Avaliação interrompida: ${error.message}`);
  if (/fetch failed|ECONNREFUSED|servidor local|llama-server|HTTP 5\d\d/i.test(error.message)) {
    console.error('Verifique se o llama-server está em execução na porta configurada.');
  }
  process.exitCode = 1;
});

module.exports = { parseOptions, localGenerator };
