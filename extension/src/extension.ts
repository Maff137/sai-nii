import * as vscode from 'vscode';
import { snapshot } from './context';
import { complete, ChatMessage } from './model';
import { createHtml } from './webview';
import { LearnerMemory, projectIdentity } from './memory';
import { learningKind } from './learning';
import { GUIDANCE_SYSTEM, SOLUTION_SYSTEM, guidanceText, releaseAllowed, SolutionRequest, planGuidance, GuidanceProgress } from './pedagogy';
import { resolveGuidance } from './recovery';

class SaiNiiView implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private working = false;
  // Chat context is isolated by file and project. Never mix two repositories.
  private history = new Map<string, ChatMessage[]>();
  private progress = new Map<string, GuidanceProgress>();
  private memory: LearnerMemory;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.memory = new LearnerMemory(context.globalState);
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
      const editorKey = vscode.window.activeTextEditor?.document.uri.toString() ?? '';
      const relevantHistory = this.history.get(editorKey) ?? [];
      const recentFocus = relevantHistory.slice(-4).map(item => item.content).join(' ');
      const current = await snapshot(`${text} ${recentFocus}`);
      if (!current) {
        this.send('error', { text: 'Abra um arquivo de código dentro de uma pasta de projeto confiável. Arquivos de segredos e pastas geradas não são lidos.' });
        return;
      }
      const system = unlock ? SOLUTION_SYSTEM : GUIDANCE_SYSTEM;
      const progressKey = `${current.projectId}::${current.file}`;
      const previous = this.progress.get(progressKey);
      const plan = unlock ? null : planGuidance(text, previous);
      const memorySummary = this.memory.modelContext(current.projectId, current.project);
      const contextualPrompt = [
        `Histórico pedagógico local, resumido (não contém código nem notas escolares):\n${memorySummary}`,
        `<contexto_nao_confiavel>\n${current.content}\n</contexto_nao_confiavel>`,
        evidence ? `Tentativa relatada: ${evidence.attempt.slice(0, 1200)}\nBloqueio relatado: ${evidence.blocker.slice(0, 1200)}` : '',
        `PEDIDO ATUAL DO ALUNO (PRIORIDADE): ${text.slice(0, 1800)}`,
        plan?.instruction ?? ''
      ].filter(Boolean).join('\n\n');
      const messages: ChatMessage[] = [{ role: 'system', content: system }, ...relevantHistory.slice(-6), { role: 'user', content: contextualPrompt }];
      let answer: string;
      let origin: 'model' | 'retry' | 'fallback' | 'solution' = 'solution';
      if (unlock) {
        answer = (await complete(messages, true)).trim().slice(0, 7000);
      } else {
        const outcome = await resolveGuidance({
          messages,
          generate: requestMessages => complete(requestMessages, false, Boolean(plan!.needsHelp)),
          plan: plan!, previous, sourceContext: current.content,
          learnerText: text, topicContext: recentFocus
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
      this.history.set(editorKey, nextHistory.slice(-12));
      this.send('assistant', { text: answer });
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
      const folder = vscode.workspace.workspaceFolders?.find(f =>
        f.uri.scheme === 'file' && projectIdentity(f.uri.fsPath) === workspace.id);
      if (folder && key.startsWith(`${folder.uri.toString()}/`)) this.history.delete(key);
    }
    this.send('memory', { text: `Memória do projeto ${workspace.name} apagada.` });
  }

  private async clearMemory(): Promise<void> {
    const confirmation = await vscode.window.showWarningMessage(
      'Apagar todos os registros pedagógicos locais neste computador?', { modal: true }, 'Apagar tudo');
    if (confirmation !== 'Apagar tudo') return;
    await this.memory.clear();
    this.history.clear();
    this.progress.clear();
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
