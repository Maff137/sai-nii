import * as vscode from 'vscode';
import { snapshot } from './context';
import { complete, ChatMessage } from './model';
import { createHtml } from './webview';
import { LearnerMemory } from './memory';
import { GUIDANCE_SYSTEM, SOLUTION_SYSTEM, guidanceText, releaseAllowed, SolutionRequest, planGuidance, GuidanceProgress } from './pedagogy';
import { resolveGuidance } from './recovery';

class SaiNiiView implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private working = false;
  private history: ChatMessage[] = [];
  private memory: LearnerMemory;
  /** Short-lived per-file conversation progress; never grants solution permissions. */
  private progress = new Map<string, GuidanceProgress>();
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
          await this.ask('Ajude-me a identificar a próxima pergunta relevante sobre esta seleção ou arquivo.', false);
          break;
        case 'requestSolution':
          if (typeof message.attempt === 'string' && typeof message.blocker === 'string') {
            await this.requestSolution({ attempt: message.attempt, blocker: message.blocker, explicit: message.explicit === true });
          }
          break;
        case 'viewMemory':
          this.send('memory', { text: this.memoryText() });
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

  private async ask(text: string, unlock: boolean, evidence?: SolutionRequest): Promise<void> {
    if (this.working) return;
    if (!vscode.workspace.isTrusted) {
      this.send('error', { text: 'Abra o projeto em uma janela confiável do VS Code para permitir a leitura contextual.' });
      return;
    }
    this.working = true;
    this.send('busy', { value: true });
    try {
      const recentFocus = this.history.slice(-4).map(item => item.content).join(' ');
      const current = await snapshot(`${text} ${recentFocus}`);
      if (!current) {
        this.send('error', { text: 'Abra um arquivo de texto permitido dentro de um projeto local. Arquivos de segredo e pastas geradas são bloqueados.' });
        return;
      }
      const system = unlock ? SOLUTION_SYSTEM : GUIDANCE_SYSTEM;
      const progressKey = `${current.project}::${current.file}`;
      const previous = this.progress.get(progressKey);
      const plan = unlock ? null : planGuidance(text, previous);
      const notes = this.memory.read().filter(n => n.project === current.project).slice(-6);
      const memorySummary = notes.map(n => `- ${n.type}: ${n.topic}`).join('\n');
      // The CURRENT request goes last, after potentially long source context, to avoid burying it.
      const contextualPrompt = [
        `Notas pedagógicas locais (não são notas de prova):\n${memorySummary || '(nenhuma)'}`,
        `<contexto_nao_confiavel>\n${current.content}\n</contexto_nao_confiavel>`,
        evidence ? `Tentativa relatada: ${evidence.attempt.slice(0, 1200)}\nBloqueio relatado: ${evidence.blocker.slice(0, 1200)}` : '',
        `PEDIDO ATUAL DO ALUNO (PRIORIDADE): ${text.slice(0, 1800)}`,
        plan?.instruction ?? ''
      ].filter(Boolean).join('\n\n');
      const messages: ChatMessage[] = [{ role: 'system', content: system }, ...this.history.slice(-6), { role: 'user', content: contextualPrompt }];
      // A model can produce malformed/repetitive output even with JSON mode. Never
      // make the learner responsible for retrying an identical question.
      let answer: string;
      if (unlock) {
        answer = (await complete(messages, true)).trim().slice(0, 7000);
      } else {
        const outcome = await resolveGuidance({
          messages,
          generate: requestMessages => complete(requestMessages, false, Boolean(plan!.needsHelp)),
          plan: plan!,
          previous,
          sourceContext: current.content,
          learnerText: text,
          topicContext: recentFocus
        });
        const guidance = outcome.guide;
        answer = guidanceText(guidance, plan!.needsHelp);
        this.progress.set(progressKey, {
          question: guidance.question,
          observation: plan!.needsHelp ? (guidance.hint ?? guidance.observation) : guidance.observation,
          helpLevel: plan!.helpLevel
        });
      }
      this.history.push({ role: 'user', content: text.slice(0, 1800) }, { role: 'assistant', content: answer });
      this.history = this.history.slice(-12);
      await this.memory.remember(current.project, text.replace(/\s+/g, ' ').slice(0, 180), unlock ? 'solution' : 'question');
      this.send('assistant', { text: answer });
    } catch (error) {
      this.send('error', { text: error instanceof Error ? error.message : String(error) });
    } finally {
      this.working = false;
      this.send('busy', { value: false });
    }
  }

  private async requestSolution(request: SolutionRequest): Promise<void> {
    if (!releaseAllowed(request)) {
      this.send('assistant', { text: 'Antes de liberar a implementação, preciso entender sua tentativa e onde ela falhou. Descreva concretamente o que testou e por que não consegue avançar. Não precisa escrever código aqui.' });
      return;
    }
    await this.ask('Solicito explicitamente uma possível solução comentada para a dúvida anterior, pois não consigo prosseguir com minhas tentativas.', true, request);
  }

  private memoryText(): string {
    const notes = this.memory.read();
    if (!notes.length) return 'Sua memória pedagógica local está vazia.';
    return 'Registros locais recentes (sem cópia de arquivos do projeto):\n' + notes.slice(-15).map(n =>
      `${n.time.slice(0, 10)} · ${n.project} · ${n.type === 'solution' ? 'solução liberada' : 'dúvida'}: ${n.topic}`
    ).join('\n');
  }

  private async clearMemory(): Promise<void> {
    const confirmation = await vscode.window.showWarningMessage('Apagar todos os registros pedagógicos deste computador?', { modal: true }, 'Apagar');
    if (confirmation !== 'Apagar') return;
    await this.memory.clear();
    this.history = [];
    this.progress.clear();
    this.send('memory', { text: 'Memória local apagada.' });
  }

  async focusAsk(analyze = false): Promise<void> {
    await vscode.commands.executeCommand('sainii.sidebar.focus');
    if (analyze) await this.ask('Ajude-me a raciocinar sobre o trecho selecionado, sem revelar a solução.', false);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new SaiNiiView(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('sainii.sidebar', provider, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand('sainii.ask', () => provider.focusAsk()),
    vscode.commands.registerCommand('sainii.analyzeSelection', () => provider.focusAsk(true)),
    vscode.commands.registerCommand('sainii.clearMemory', async () => {
      // Expose the same confirmed action through the webview so no command can bypass confirmation.
      await provider.focusAsk();
      void vscode.window.showInformationMessage('Abra a aba Sai-nii e clique em “Apagar memória” para confirmar.');
    })
  );
}

export function deactivate(): void { /* No persistent background services in this foundation. */ }
