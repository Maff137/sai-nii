import { LearnerLanguage, detectLearnerLanguage } from './language';
import { Guidance, GuidancePlan, GuidanceProgress, parseGuidance, repeatsExplanation, repeatsQuestion } from './pedagogy';
import { architectureIntent } from './architecture';
import { requestsImplementation } from './routing';

/** Pure, testable orchestration. The model may propose a hint; the app decides whether it can be shown. */
type Message = { role: 'system' | 'user' | 'assistant'; content: string };
type Generate = (messages: Message[]) => Promise<string>;

export type GuidanceOutcome = { guide: Guidance; recovered: boolean; origin: 'model' | 'retry' | 'fallback'; rejectionReason?: string; rejections?: Array<{ attempt: number; reason: string }>; questionNarrowed?: boolean };

type Inputs = {
  messages: Message[];
  generate: Generate;
  plan: GuidancePlan;
  previous?: GuidanceProgress;
  sourceContext: string;
  learnerText: string;
  topicContext: string;
  observationLimit?: number;
  language?: LearnerLanguage;
};

/** Preserve the first useful question if a model placed multiple questions in a
 * single JSON field. Everything retained still passes the normal safety parser;
 * unsafe observations and code cannot be made acceptable by this transform.
 */
function narrowQuestions(raw: string, requireHint: boolean, observationLimit: number): Guidance | undefined {
  const text = raw.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return undefined; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
  const record = parsed as Record<string, unknown>;
  if (typeof record.question !== 'string') return undefined;
  const first = record.question.indexOf('?');
  if (first < 1 || first === record.question.trimEnd().length - 1) return undefined;
  const shortened = { ...record, question: record.question.slice(0, first + 1).trim() };
  return parseGuidance(JSON.stringify(shortened), requireHint, observationLimit) ?? undefined;
}

function rejectionReason(raw: string, plan: GuidancePlan, previous?: GuidanceProgress, observationLimit = 230, language?: LearnerLanguage): { guide?: Guidance; reason?: string; questionNarrowed?: boolean } {
  const strict = parseGuidance(raw, plan.needsHelp, observationLimit);
  const guide = strict ?? narrowQuestions(raw, plan.needsHelp, observationLimit);
  if (!guide) return { reason: 'formato inválido, conteúdo inseguro ou pista ausente' };
  // Source code identifiers are excluded by the language detector when in
  // backticks; an undecidable short answer is left alone rather than rejected.
  const detected = detectLearnerLanguage([guide.observation, guide.hint ?? '', guide.question].join(' '));
  if (language && detected && detected !== language) return { reason: 'idioma da resposta não corresponde ao pedido' };
  if (plan.needsHelp && (repeatsExplanation(previous?.observation, guide.hint ?? '') ||
      repeatsExplanation(guide.observation, guide.hint ?? ''))) {
    return { reason: 'pista semelhante à explicação anterior' };
  }
  if (repeatsQuestion(previous?.question, guide.question)) {
    // In hint mode, a NEW useful hint is enough. Repeating the accompanying
    // question should not discard the hint and cause an unrelated fallback.
    if (plan.needsHelp && guide.hint) {
      return { guide: { ...guide, question: '' }, questionNarrowed: true };
    }
    return { reason: 'pergunta semelhante à anterior' };
  }
  return { guide, questionNarrowed: !strict };
}

function presentIdentifier(name: string, sourceContext: string): boolean {
  if (!/^[A-Za-z_$][A-Za-z\d_$]{2,48}$/.test(name)) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\s*\\(`).test(sourceContext);
}

function selectedIdentifier(sourceContext: string, topicContext: string): string | undefined {
  const candidates = topicContext.match(/[A-Za-z_$][A-Za-z\d_$]{2,48}/g) ?? [];
  // Prefer names that occur in source call-like syntax (calls or declarations).
  return candidates.find(name => presentIdentifier(name, sourceContext));
}

/**
 * Safe deterministic rescue for a small model that fails structured generation.
 * It never copies source values, creates runnable code, or pretends to have analyzed semantics.
 * The rescue is anchored to a call present in the trusted editor snapshot when possible.
 */
export function rescueGuidance(
  sourceContext: string,
  topicContext: string,
  plan: GuidancePlan,
  previous?: GuidanceProgress,
  learnerText = topicContext
): Guidance {
  if (architectureIntent(topicContext)) {
    return {
      observation: 'Consegui obter a árvore de pastas, mas o modelo local não formulou uma explicação confiável da arquitetura. Não vou inventar responsabilidades sem confirmação.',
      question: 'Quer começar pelo papel de uma pasta específica?'
    };
  }
  const symbol = selectedIdentifier(sourceContext, topicContext);
  // A definition is not a call: don't teach students to find call arguments
  // where only a function declaration exists in the inspected source.
  const definition = symbol && new RegExp(`\\b(?:def|function|fn|func)\\s+${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(`).test(sourceContext);
  const level = plan.needsHelp ? Math.max(1, plan.helpLevel) : 0;
  if (requestsImplementation(learnerText)) {
    return { observation: 'Posso orientar a alteração por etapas, sem escrever a função pronta.',
      question: previous?.question === 'Qual comportamento da função atual precisa mudar primeiro?'
        ? 'Em qual condição ou retorno do código atual você pretende começar?'
        : 'Qual comportamento da função atual precisa mudar primeiro?' };
  }
  const stages: Guidance[] = definition ? [
    { observation: `Vamos examinar a definição de \`${symbol}\` no arquivo, sem pressupor que ela foi chamada.`,
      question: 'Quais dados entram nessa função pelos parâmetros?' },
    { observation: 'Concentre-se nas primeiras linhas do corpo da função.',
      hint: `Na definição de \`${symbol}\`, identifique a primeira operação feita com os parâmetros, antes de analisar todo o retorno.`,
      question: 'Que operação aparece antes da condição?' },
    { observation: 'Agora siga apenas um caminho da condição.',
      hint: 'Observe o teste da condição e identifique qual operação só acontece quando ele é verdadeiro.',
      question: 'O que acontece quando a condição é falsa?' },
    { observation: 'Relacione a entrada ao retorno sem escrever uma implementação.',
      hint: 'Trace um único valor hipotético pelos ramos já existentes, até a expressão de retorno.',
      question: '' }
  ] : symbol === 'setInterval' ? [
    {
      observation: 'Vamos olhar a estrutura da chamada `setInterval` no arquivo, sem tentar entender todo o bloco ainda.',
      question: 'O que você identifica dentro dos parênteses dessa chamada?'
    },
    {
      observation: 'Uma pista: procure o final da função passada ao `setInterval` e observe o argumento que vem depois dela.',
      hint: 'Localize a separação entre a função que será repetida e o argumento usado para indicar a espera.',
      question: 'Qual trecho fica depois da função, ainda dentro da chamada?'
    },
    {
      observation: 'Vamos isolar uma parte menor da sintaxe.',
      hint: 'O `setInterval` normalmente recebe uma função e, em segundo lugar, o atraso em milissegundos. Ignore o corpo da função e observe o segundo argumento.',
      question: 'Você consegue localizar esse segundo argumento no código?'
    },
    {
      observation: 'Agora concentre-se só no final da chamada.',
      hint: 'Percorra os argumentos de `setInterval` até o último, depois do fechamento da função. Não é preciso entender as instruções internas.',
      question: 'O último argumento é um valor direto ou uma variável?'
    }
  ] : symbol ? [
    {
      observation: `Vamos começar pela chamada de \`${symbol}\` que aparece neste arquivo.`,
      question: 'O que você percebe dentro dos parênteses dessa chamada?'
    },
    {
      observation: 'Vamos examinar uma parte menor da chamada.',
      hint: `Localize \`${symbol}\` e observe o primeiro item dentro dos parênteses, sem tentar entender o restante.`,
      question: 'Qual é a primeira informação passada para essa chamada?'
    },
    {
      observation: 'Podemos separar as partes da chamada.',
      hint: `Observe os argumentos de \`${symbol}\` e como eles são separados dentro dos parênteses.`,
      question: 'Você consegue distinguir onde termina o primeiro argumento?'
    },
    {
      observation: 'Foque apenas na ligação entre entrada e comportamento.',
      hint: `Leia o argumento inicial de \`${symbol}\` e procure onde ele é utilizado nas linhas seguintes.`,
      question: 'Qual trecho parece utilizar esse argumento?'
    }
  ] : [
    {
      observation: 'Vamos escolher um trecho pequeno do arquivo aberto, em vez de tentar entender tudo de uma vez.',
      question: 'Qual função ou expressão desse arquivo você quer examinar primeiro?'
    },
    {
      observation: 'Não precisamos resolver o arquivo inteiro de uma vez.',
      hint: 'Observe a linha em que começa a função ou expressão que chamou sua atenção e identifique apenas sua entrada.',
      question: 'Qual é a primeira informação que chega a esse trecho?'
    },
    {
      observation: 'Vamos acompanhar um passo de cada vez.',
      hint: 'Depois de localizar a entrada do trecho, siga apenas a primeira operação executada.',
      question: 'Qual é a primeira transformação realizada nesse ponto?'
    },
    {
      observation: 'Podemos diminuir mais o escopo.',
      hint: 'Leia uma única linha e procure identificar se ela declara, compara ou chama alguma coisa.',
      question: 'Qual desses três papéis essa linha parece cumprir?'
    }
  ];
  // Progress even when the model fails: don't force the learner through the same question again.
  for (let offset = 0; offset < stages.length; offset++) {
    const candidate = stages[(level + offset) % stages.length];
    if (!repeatsQuestion(previous?.question, candidate.question) &&
        !(plan.needsHelp && repeatsExplanation(previous?.observation, candidate.hint ?? candidate.observation))) {
      return candidate;
    }
  }
  return stages[Math.min(level, stages.length - 1)];
}

/** Two attempts, then an immediately useful, grounded and safe hint instead of a dead-end error. */
export async function resolveGuidance(input: Inputs): Promise<GuidanceOutcome> {
  let response = await input.generate(input.messages);
  let checked = rejectionReason(response, input.plan, input.previous, input.observationLimit, input.language);
  if (checked.guide) return { guide: checked.guide, recovered: false, origin: 'model', questionNarrowed: checked.questionNarrowed };
  const firstReason = checked.reason;
  const rejections = [{ attempt: 1, reason: firstReason ?? 'resposta inválida' }];
  const correction: Message[] = [
    ...input.messages,
    { role: 'assistant', content: response.slice(0, 1200) },
    { role: 'user', content: input.language === 'en'
        ? `Previous reply was rejected (${firstReason}). Produce ONLY JSON with observation, hint and question IN ENGLISH. ` +
          `Help the learner reason about the actual code without a complete solution. Write the observation, hint, and question IN ENGLISH, not Portuguese. At most ONE question. If they are stuck, give ONE new concrete hint. ` +
          `Do not repeat this previous question: ${JSON.stringify(input.previous?.question ?? '')}.`
        : `Sua última saída foi rejeitada (${firstReason}). Gere SOMENTE JSON com observation, hint e question. ` +
          `O aluno quer raciocinar sobre seu código, não receber a resposta pronta. ` +
          `Se estiver bloqueado, hint deve apresentar uma pista concreta NOVA; question pode ser vazio ou conter UMA pergunta útil. ` +
          `Não repita: ${JSON.stringify(input.previous?.question ?? '')}.` }
  ];
  response = await input.generate(correction);
  checked = rejectionReason(response, input.plan, input.previous, input.observationLimit, input.language);
  if (checked.guide) return { guide: checked.guide, recovered: false, origin: 'retry', rejections, questionNarrowed: checked.questionNarrowed };
  rejections.push({ attempt: 2, reason: checked.reason ?? 'resposta inválida' });
  return {
    guide: input.language === 'en'
      ? rescueEnglishGuidance(input.sourceContext, input.topicContext, input.plan)
      : rescueGuidance(input.sourceContext, `${input.learnerText} ${input.topicContext}`, input.plan, input.previous, input.learnerText),
    recovered: true,
    origin: 'fallback',
    rejectionReason: checked.reason ?? firstReason, rejections
  };
}

/** Safe minimal English rescue if the local model fails twice. */
function rescueEnglishGuidance(sourceContext: string, topicContext: string, plan: GuidancePlan): Guidance {
  const symbol = selectedIdentifier(sourceContext, topicContext);
  if (plan.needsHelp) {
    return { observation: 'We can focus on one piece of the code.',
      hint: symbol ? `Find the call to "${symbol}" and inspect its arguments one by one. Focus on what the first argument represents.` : 'Select a single expression and trace only its inputs before looking at the rest of the function.',
      question: '' };
  }
  return { observation: symbol ? `I can see a call to "${symbol}" in the open file. We can examine what its arguments do.` : 'We can focus on a small part of the open file instead of the entire program.',
    question: symbol ? 'Which argument would you like to understand first?' : 'Which function or expression would you like to examine first?' };
}
