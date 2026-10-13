import * as vscode from 'vscode';

const MEMORY_KEY = 'sainii.learnerNotes.v1';
export type LearnerNote = { project: string; topic: string; time: string; type: 'question' | 'solution' };

export class LearnerMemory {
  constructor(private readonly store: vscode.Memento) {}

  read(): LearnerNote[] {
    return this.store.get<LearnerNote[]>(MEMORY_KEY, []);
  }

  async remember(project: string, topic: string, type: LearnerNote['type']): Promise<void> {
    const next = [...this.read(), { project: project.slice(0, 100), topic: topic.slice(0, 180), type,
      time: new Date().toISOString() }].slice(-40);
    await this.store.update(MEMORY_KEY, next);
  }

  async clear(): Promise<void> {
    await this.store.update(MEMORY_KEY, []);
  }
}
