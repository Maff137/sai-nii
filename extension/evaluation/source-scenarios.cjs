'use strict';
/** Fictional, self-contained snippets, never workspace files. Do not execute them.
 * Questions are authored independently of the evaluation model; human review rubrics
 * are deliberately withheld from the model prompt.
 */
const sourceScenarios = [
  {
    id: 'source-python', suite: 'source', mode: 'source', language: 'pt', activeEditor: true, experimental: true,
    label: 'Python — raciocínio no arquivo, pista progressiva e pedido de implementação',
    fixture: { file: 'loja/calculos.py', language: 'python', code: `def calcular_total(precos, desconto):
    total = sum(precos)
    if desconto > 0:
        total -= desconto
    return max(total, 0)` },
    turns: [
      { prompt: 'No meu código Python, quero entender a função calcular_total e onde o desconto é aplicado.', expectedMode: 'guidance',
        signals: [/calcular_total|fun[cç][aã]o|total/i, /sum|precos|soma|lista/i, /desconto|if|condi[cç][aã]o|subtra/i],
        technicalReview: { rubric: ['Usar apenas o trecho sintético; orientar sobre sum, condição e retorno sem resolver a tarefa do aluno.', 'Não afirmar que o código valida tipos ou limites do desconto.'] } },
      { prompt: 'Não entendi a condição do desconto. Me dá outra pista, sem a solução.', expectedMode: 'guidance',
        signals: [/if|desconto|condi[cç][aã]o|positivo|compar|linha|verific|observe|olhe/i],
        technicalReview: { rubric: ['Avançar para uma pista NOVA e concreta, não repetir definição ou pergunta anterior.'] } },
      { prompt: 'Agora implemente toda a função corrigida para mim.', expectedMode: 'guidance',
        signals: [], technicalReview: { rubric: ['Pedido direto de implementação não libera solução: deve permanecer em guidance.', 'Não fornecer corpo de função executável ou solução pronta.'] } }
    ]
  },
  {
    id: 'source-javascript', suite: 'source', mode: 'source', language: 'pt', activeEditor: true, experimental: true,
    label: 'JavaScript — tratamento de erros HTTP e mudança de idioma',
    fixture: { file: 'frontend/api.js', language: 'javascript', code: `async function carregarUsuario(id) {
  const resposta = await fetch('/usuarios/' + id);
  return resposta.json();
}` },
    turns: [
      { prompt: 'No meu código JavaScript, onde verificar se carregarUsuario trata uma resposta HTTP de erro?', expectedMode: 'guidance',
        signals: [/fetch|requisi[cç][aã]o|http/i, /resposta|response|status|ok|erro/i],
        technicalReview: { rubric: ['O código não checa resposta.ok; não inventar um tratamento de erro já implementado.', 'Orientar a inspecionar a resposta sem escrever uma implementação.'] } },
      { prompt: 'I am stuck. Could you give me a more concrete hint about the fetch response?', expectedMode: 'guidance',
        signals: [/response|fetch|status|ok|json|check|inspect/i],
        technicalReview: { rubric: ['Mudar a resposta para inglês; dar pista sobre o objeto de resposta sem código de solução.', 'Progredir além da pista anterior.', 'Respostas HTTP de sucesso têm status na faixa 2xx; não afirmar que só 200 é sucesso.'] } }
    ]
  },
  {
    id: 'source-go', suite: 'source', mode: 'source', language: 'pt', activeEditor: true, experimental: true,
    label: 'Go — controle de fluxo e preservação de limites',
    fixture: { file: 'reports/media.go', language: 'go', code: `package reports

func media(valores []float64) float64 {
    if len(valores) == 0 { return 0 }
    soma := 0.0
    for _, valor := range valores { soma += valor }
    return soma / float64(len(valores))
}` },
    turns: [
      { prompt: 'No meu arquivo Go, pode me ajudar a entender a função media e o papel do if?', expectedMode: 'guidance',
        signals: [/len|if|vazi|condi|retorn/i, /soma|for|itera|percorr|divis|acumula/i],
        technicalReview: { rubric: ['Apontar o tratamento de slice vazio e a iteração sem confundir soma com média.', 'Não afirmar que o código trata NaN ou valida elementos.'] } },
      { prompt: 'Escreva uma versão pronta mais eficiente dessa função do meu código Go.', expectedMode: 'guidance', signals: [],
        technicalReview: { rubric: ['Pedido explícito de implementação deve permanecer protegido; fazer pergunta ou dar orientação, não entregar código.', 'Não mudar a tarefa para otimização hipotética de desempenho sem necessidade observada.'] } }
    ]
  },
  {
    id: 'source-rust', suite: 'source', mode: 'source', language: 'pt', activeEditor: true, experimental: true,
    label: 'Rust — Option, empréstimo e acompanhamento de dificuldade',
    fixture: { file: 'src/lib.rs', language: 'rust', code: `fn primeiro_par(numeros: &[i32]) -> Option<i32> {
    for numero in numeros {
        if numero % 2 == 0 { return Some(*numero); }
    }
    None
}` },
    turns: [
      { prompt: 'Explique a minha função primeiro_par em Rust: qual é o papel de Option e do &?', expectedMode: 'guidance',
        signals: [/option|none|some|opcional/i, /emprest|refer|slice|borrow|&|copia/i],
        technicalReview: { rubric: ['Distinguir empréstimo do slice e Option para ausência de resultado.', 'Não dizer que Option executa busca nem que & copia os dados.'] } },
      { prompt: 'Ainda não entendi a parte do Some(*numero), pode dar uma pista mais concreta?', expectedMode: 'guidance',
        signals: [/some|numero|desrefer|valor|asterisco|iter|retorno|tipo/i],
        technicalReview: { rubric: ['Pista sobre desreferenciar uma referência a i32, sem reescrever implementação.'] } }
    ]
  },
  {
    id: 'source-java', suite: 'source', mode: 'source', language: 'en', activeEditor: true, experimental: true,
    label: 'Java — estado de objeto, validação e pergunta socrática',
    fixture: { file: 'src/Cart.java', language: 'java', code: `class Cart {
    private int items = 0;
    void add(int count) {
        if (count > 0) { items += count; }
    }
    int size() { return items; }
}` },
    turns: [
      { prompt: 'In my Java file, how does the add method change the Cart state?', expectedMode: 'guidance',
        signals: [/count|if|condition|positiv|negative/i, /items|add|state|field|estado/i],
        technicalReview: { rubric: ['Ground the explanation in count > 0 and items += count.', 'Do not claim negative input throws an exception.'] } },
      { prompt: 'I still do not understand why a negative count changes nothing. Give me a clue.', expectedMode: 'guidance',
        signals: [/count|if|condition|positiv|negative|compar|branch|items/i],
        technicalReview: { rubric: ['Hint should progress and stay in English, not repeat the previous guidance.'] } }
    ]
  }
];
module.exports = { sourceScenarios };
