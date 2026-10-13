import * as vscode from 'vscode';
import * as path from 'node:path';
import { snapshot } from './context';
import { complete, ChatMessage } from './model';
import { createHtml, assistantBlocks } from './webview';
import { LearnerMemory, projectIdentity } from './memory';
import { learningKind } from './learning';
import { GUIDANCE_SYSTEM, GUIDANCE_SYSTEM_EN, SOLUTION_SYSTEM, SOLUTION_SYSTEM_EN, guidanceText, releaseAllowed, SolutionRequest, planGuidance, GuidanceProgress } from './pedagogy';
import { DISCUSSION_SYSTEM, DISCUSSION_SYSTEM_EN, projectStructureQuestion, resolveDiscussion } from './discussion';
import { informalInterpretation } from './informal';
import { resolveGuidance } from './recovery';
import { LearnerLanguage, chooseLearnerLanguage, localizedSystem } from './language';
import { routeTurn, TeachingMode, RoutingDecision } from './routing';
import { compactDiscussionHistory, dialogueInstruction, observedIdentifierInstruction } from './dialogue';

class SaiNiiView implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private working = false;
  // Chat context is isolated by file and project. Never mix two repositories.
  private history = new Map<string, ChatMessage[]>();
  private progress = new Map<string, GuidanceProgress>();
  private replyLanguages = new Map<string, LearnerLanguage>();
  private lastProjectModes = new Map<string, TeachingMode>();
  private lastProjectLanguages = new Map<string, LearnerLanguage>();
  private memory: LearnerMemory;
  private readonly diagnosticOutput = vscode.window.createOutputChannel('Sai-nii: diagnóstico');

  constructor(private readonly context: vscode.ExtensionContext) {
    this.memory = new LearnerMemory(context.globalState);
    context.subscriptions.push(this.diagnosticOutput);
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.html = createHtml(view.webview);
    view.webview.onDidReceiveMessage(async (msg: unknown) => {
      if (!msg || typeof msg !== 'object') return;
      const message = msg as Record<string, unknown>;
      switch (message.type) {
        case 'ask':
          if (typeof message.text === 'string') await this.ask(message.text, false);
          break;
        case 'analyze':
          await this.ask('Quero entender o trecho selecionado ou arquivo aberto.', false);
          break;
        case 'architecture':
          await this.ask('Explique a arquitetura e a organização das pastas e arquivos deste projeto, as responsabilidades e a relação entre as partes.', false);
          break;
        case 'requestSolution':
          if (typeof message.attempt === 'string' && typeof message.blocker === 'string') {
            await this.requestSolution({ attempt: message.attempt, blocker: message.blocker, explicit: message.explicit === true });
          }
          break;
        case 'viewMemory':
          await this.showMemory();
          break;
        case 'clearProjectMemory':
          await this.clearProjectMemory();
          break;
        case 'clearMemory':
          await this.clearMemory();
          break;
      }
    });
  }

  private send(type: string, other: Record<string, unknown>): void {
    void this.view?.webview.postMessage({ type, ...other });
  }

  private currentWorkspace(): { id: string; name: string } | null {
    const editorUri = vscode.window.activeTextEditor?.document.uri;
    const selected = editorUri ? vscode.workspace.getWorkspaceFolder(editorUri) : undefined;
    const folder = selected ?? vscode.workspace.workspaceFolders?.[0];
    if (!folder || folder.uri.scheme !== 'file') return null;
    return { id: projectIdentity(folder.uri.fsPath), name: folder.name };
  }

  private async ask(text: string, unlock: boolean, evidence?: SolutionRequest): Promise<void> {
    if (this.working) return;
    if (!vscode.workspace.isTrusted) {
      this.send('error', { text: 'Abra um projeto confiável do VS Code para permitir leitura contextual.' });
      return;
    }
    this.working = true;
    this.send('busy', { value: true });
    try {
      await this.memory.initialize();
      const workspace = this.currentWorkspace();
      const currentEditor = vscode.window.activeTextEditor;
      const projectMode = workspace ? this.lastProjectModes.get(workspace.id) : undefined;
      // Explicitly unlocked solutions retain editor evidence regardless of earlier conversation mode.
      const decision: RoutingDecision = unlock
        ? { mode: 'guidance', context: 'editor', reason: 'source' }
        : routeTurn(text, {
          editorOpen: Boolean(currentEditor), selectionActive: Boolean(currentEditor && !currentEditor.selection.isEmpty), previousMode: projectMode
        });
      if (decision.mode === 'guidance' && !currentEditor) {
        this.send('error', { text: 'Abra um arquivo do projeto no editor para analisar código ou pedir pistas sobre uma tarefa. Dúvidas conceituais podem ser feitas sem arquivo aberto.' });
        return;
      }
      const guessedRelative = decision.context === 'editor' && workspace && currentEditor
        ? path.relative(vscode.workspace.getWorkspaceFolder(currentEditor.document.uri)?.uri.fsPath ?? '', currentEditor.document.uri.fsPath).replaceAll('\\', '/')
        : '(raiz)';
      const guessedKey = `${workspace?.id ?? ''}::${guessedRelative}`;
      const historical = this.history.get(guessedKey) ?? [];
      const recentFocus = historical.slice(-4).map(item => item.content).join(' ');
      const current = await snapshot(`${text} ${recentFocus}`, text, decision.context);
      if (!current) {
        this.send('error', { text: 'Abra uma pasta de projeto confiável no VS Code. Arquivos sensíveis ou gerados não serão lidos.' });
        return;
      }
      const historyKey = `${current.projectId}::${current.file}`;
      const relevantHistory = this.history.get(historyKey) ?? historical;
      const isDiscussion = decision.mode === 'discussion';
      const previousLanguage = this.replyLanguages.get(historyKey) ?? this.replyLanguages.get(guessedKey) ?? this.lastProjectLanguages.get(current.projectId) ?? 'pt';
      const answerLanguage = unlock ? previousLanguage : chooseLearnerLanguage(text, previousLanguage);
      const system = answerLanguage === 'en'
        ? (unlock ? SOLUTION_SYSTEM_EN : isDiscussion ? DISCUSSION_SYSTEM_EN : GUIDANCE_SYSTEM_EN)
        : (unlock ? SOLUTION_SYSTEM : isDiscussion ? DISCUSSION_SYSTEM : GUIDANCE_SYSTEM);
      const progressKey = `${current.projectId}::${current.file}`;
      const previous = this.progress.get(progressKey);
      const plan = unlock || isDiscussion ? null : planGuidance(text, previous, answerLanguage);
      const memorySummary = this.memory.modelContext(current.projectId, current.project);
      const contextualPrompt = [
        `Histórico pedagógico local, resumido (não contém código nem notas escolares):\n${memorySummary}`,
        `<contexto_nao_confiavel>\n${current.content}\n</contexto_nao_confiavel>`,
        evidence ? `Tentativa relatada: ${evidence.attempt.slice(0, 1200)}\nBloqueio relatado: ${evidence.blocker.slice(0, 1200)}` : '',
        `PEDIDO ATUAL DO ALUNO (PRIORIDADE): ${text.slice(0, 1800)}`,
        isDiscussion ? informalInterpretation(text) : '',
        isDiscussion ? dialogueInstruction(text, answerLanguage, relevantHistory.some(item => item.role === 'assistant')) : '',
        isDiscussion ? observedIdentifierInstruction([...relevantHistory].reverse().find(item => item.role === 'assistant')?.content ?? '', text, answerLanguage) : '',
        plan?.instruction ?? ''
      ].filter(Boolean).join('\n\n');
      const priorTurns: ChatMessage[] = isDiscussion
        ? compactDiscussionHistory(relevantHistory, text)
        : relevantHistory.slice(-6);
      const messages: ChatMessage[] = [{ role: 'system', content: localizedSystem(system, answerLanguage) }, ...priorTurns, { role: 'user', content: contextualPrompt }];
      let answer: string;
      let origin: 'model' | 'retry' | 'fallback' | 'solution' = 'solution';
      if (unlock) {
        answer = (await complete(messages, true)).trim().slice(0, 7000);
      } else if (isDiscussion) {
        const outcome = await resolveDiscussion({
          generate: requestMessages => complete(requestMessages, false, false, true),
          messages, observedPaths: current.architecturePaths ?? [], learnerText: text, language: answerLanguage,
          structuralQuestion: projectStructureQuestion(text),
          onDiagnostic: (attempt, reason) => this.diagnosticOutput.appendLine(`Resposta conceitual rejeitada: tentativa ${attempt}; motivo=${reason}`),
          previousAnswer: [...relevantHistory].reverse().find(item => item.role === 'assistant')?.content
        });
        answer = outcome.text;
        origin = outcome.origin;
        if (outcome.codeReused) this.diagnosticOutput.appendLine('Exemplo didático anterior reutilizado sem alterações de código.');
        this.diagnosticOutput.appendLine(`Conversa conceitual: origem=${origin}; pergunta_de_estrutura=${projectStructureQuestion(text)}`);
      } else {
        const outcome = await resolveGuidance({
          messages,
          generate: requestMessages => complete(requestMessages, false, Boolean(plan!.needsHelp), false),
          plan: plan!, previous, sourceContext: current.content,
          learnerText: text, topicContext: recentFocus, language: answerLanguage, observationLimit: 230
        });
        origin = outcome.origin;
        const guidance = outcome.guide;
        answer = guidanceText(guidance, plan!.needsHelp);
        this.progress.set(progressKey, {
          question: guidance.question,
          observation: plan!.needsHelp ? (guidance.hint ?? guidance.observation) : guidance.observation,
          helpLevel: plan!.helpLevel
        });
      }
      // Keep the array contextually typed as ChatMessage[] before slicing it.
      // Calling .slice() on the literal first widens role values to string.
      const nextHistory: ChatMessage[] = [
        ...relevantHistory,
        { role: 'user', content: text.slice(0, 1800) },
        { role: 'assistant', content: answer }
      ];
      // Do not teach the local model to imitate a generic recovery/error text.
      // The webview retains the user's visible turn; the model history excludes it.
      if (origin !== 'fallback' || !isDiscussion) this.history.set(historyKey, nextHistory.slice(-12));
      this.replyLanguages.set(historyKey, answerLanguage);
      this.lastProjectModes.set(current.projectId, decision.mode);
      this.lastProjectLanguages.set(current.projectId, answerLanguage);
      this.diagnosticOutput.appendLine(`Roteamento pedagógico: modo=${decision.mode}; contexto=${decision.context}; motivo=${decision.reason}`);
      this.send('assistant', { text: answer, blocks: assistantBlocks(answer) });
      // A storage error must not replace an otherwise successful pedagogical answer.
      try {
        await this.memory.record({
          projectId: current.projectId, projectName: current.project, language: current.language,
          question: text, kind: learningKind(text, unlock, plan?.needsHelp), origin
        });
      } catch {
        this.send('notice', { text: 'Resposta exibida, mas não foi possível salvar o histórico local.' });
      }
    } catch (error) {
      this.send('error', { text: error instanceof Error ? error.message : String(error) });
    } finally {
      this.working = false;
      this.send('busy', { value: false });
    }
  }

  private async requestSolution(request: SolutionRequest): Promise<void> {
    if (!releaseAllowed(request)) {
      this.send('assistant', { text: 'Para liberar uma solução, descreva uma tentativa concreta, onde ficou bloqueado e por que as pistas não bastaram. Não precisa escrever código aqui.' });
      return;
    }
    await this.ask('Solicito explicitamente uma solução explicada, pois não consegui avançar com minhas tentativas.', true, request);
  }

  private async showMemory(): Promise<void> {
    await this.memory.initialize();
    const workspace = this.currentWorkspace();
    this.send('memory', { text: workspace ?
      `Memória do projeto ${workspace.name}:\n${this.memory.userView(workspace.id, workspace.name)}` :
      'Abra uma pasta de projeto para consultar seu histórico pedagógico.' });
  }

  private async clearProjectMemory(): Promise<void> {
    const workspace = this.currentWorkspace();
    if (!workspace) {
      this.send('error', { text: 'Abra a pasta do projeto cuja memória deseja apagar.' });
      return;
    }
    const answer = await vscode.window.showWarningMessage(
      `Apagar os registros pedagógicos locais do projeto "${workspace.name}"?`, { modal: true }, 'Apagar projeto');
    if (answer !== 'Apagar projeto') return;
    await this.memory.initialize();
    await this.memory.clearProject(workspace.id, workspace.name);
    // Active session state belongs to project files. Clear it together with the project history.
    this.progress.forEach((_value, key) => { if (key.startsWith(`${workspace.id}::`)) this.progress.delete(key); });
    for (const key of this.history.keys()) {
      if (key.startsWith(`${workspace.id}::`)) this.history.delete(key);
    }
    for (const key of this.replyLanguages.keys()) {
      if (key.startsWith(`${workspace.id}::`)) this.replyLanguages.delete(key);
    }
    this.lastProjectModes.delete(workspace.id);
    this.lastProjectLanguages.delete(workspace.id);
    this.send('memory', { text: `Memória do projeto ${workspace.name} apagada.` });
  }

  private async clearMemory(): Promise<void> {
    const confirmation = await vscode.window.showWarningMessage(
      'Apagar todos os registros pedagógicos locais neste computador?', { modal: true }, 'Apagar tudo');
    if (confirmation !== 'Apagar tudo') return;
    await this.memory.clear();
    this.history.clear();
    this.progress.clear();
    this.replyLanguages.clear();
    this.lastProjectModes.clear();
    this.lastProjectLanguages.clear();
    this.send('memory', { text: 'Memória local apagada.' });
  }

  async focusAsk(analyze = false): Promise<void> {
    await vscode.commands.executeCommand('sainii.sidebar.focus');
    if (analyze) await this.ask('Quero entender o trecho selecionado do arquivo aberto.', false);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new SaiNiiView(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('sainii.sidebar', provider, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand('sainii.ask', () => provider.focusAsk()),
    vscode.commands.registerCommand('sainii.analyzeSelection', () => provider.focusAsk(true)),
    vscode.commands.registerCommand('sainii.clearMemory', async () => {
      await provider.focusAsk();
      void vscode.window.showInformationMessage('Na aba Sai-nii, clique em “Apagar toda memória” para confirmar.');
    })
  );
}

export function deactivate(): void { /* No autonomous/background services. */ }
