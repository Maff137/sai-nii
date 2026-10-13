import { Guidance, GuidancePlan, GuidanceProgress, parseGuidance, repeatsExplanation, repeatsQuestion } from './pedagogy';

/** Pure, testable orchestration. The model may propose a hint; the app decides whether it can be shown. */
type Message = { role: 'system' | 'user' | 'assistant'; content: string };
type Generate = (messages: Message[]) => Promise<string>;

export type GuidanceOutcome = { guide: Guidance; recovered: boolean; rejectionReason?: string };

type Inputs = {
  messages: Message[];
  generate: Generate;
  plan: GuidancePlan;
  previous?: GuidanceProgress;
  sourceContext: string;
  learnerText: string;
  topicContext: string;
};

function rejectionReason(raw: string, plan: GuidancePlan, previous?: GuidanceProgress): { guide?: Guidance; reason?: string } {
  const guide = parseGuidance(raw, plan.needsHelp);
  if (!guide) return { reason: 'formato inválido, conteúdo inseguro ou pista ausente' };
  if (repeatsQuestion(previous?.question, guide.question)) return { reason: 'pergunta semelhante à anterior' };
  if (plan.needsHelp && repeatsExplanation(previous?.observation, guide.hint ?? '')) {
    return { reason: 'pista semelhante à explicação anterior' };
  }
  return { guide };
}

function presentIdentifier(name: string, sourceContext: string): boolean {
  if (!/^[A-Za-z_$][A-Za-z\d_$]{2,48}$/.test(name)) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\s*\\(`).test(sourceContext);
}

function selectedIdentifier(sourceContext: string, topicContext: string): string | undefined {
  const candidates = topicContext.match(/[A-Za-z_$][A-Za-z\d_$]{2,48}/g) ?? [];
  // Prefer names actually invoked in the source, not programming vocabulary from the user.
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
  previous?: GuidanceProgress
): Guidance {
  const symbol = selectedIdentifier(sourceContext, topicContext);
  const level = plan.needsHelp ? Math.max(1, plan.helpLevel) : 0;
  const stages: Guidance[] = symbol === 'setInterval' ? [
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
  let checked = rejectionReason(response, input.plan, input.previous);
  if (checked.guide) return { guide: checked.guide, recovered: false };
  const firstReason = checked.reason;
  const correction: Message[] = [
    ...input.messages,
    { role: 'assistant', content: response.slice(0, 1200) },
    { role: 'user', content: `Sua última saída foi rejeitada (${firstReason}). Gere SOMENTE JSON com observation, hint e question. ` +
        `O aluno quer raciocinar sobre seu código, não receber a resposta pronta. ` +
        `Se estiver bloqueado, hint deve apresentar uma pista concreta NOVA; question deve conter apenas uma pergunta com ?. ` +
        `Não repita: ${JSON.stringify(input.previous?.question ?? '')}.` }
  ];
  response = await input.generate(correction);
  checked = rejectionReason(response, input.plan, input.previous);
  if (checked.guide) return { guide: checked.guide, recovered: false };
  return {
    guide: rescueGuidance(input.sourceContext, `${input.learnerText} ${input.topicContext}`, input.plan, input.previous),
    recovered: true,
    rejectionReason: checked.reason ?? firstReason
  };
}
