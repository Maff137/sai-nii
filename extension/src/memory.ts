import { createHash } from 'node:crypto';
import { GuidanceOrigin, LearningEvent, LearningKind, inferConcept, summarizeForModel, summarizeForUser } from './learning';

const MEMORY_KEY = 'sainii.learning.v2';
const LEGACY_KEY = 'sainii.learnerNotes.v1';
const MAX_EVENTS = 300;

// This interface permits pure tests without loading the VS Code extension host.
type Memento = {
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: unknown): PromiseLike<void>;
};
type LegacyNote = { project: string; topic: string; time: string; type: 'question' | 'solution' };

/** Hashes a local workspace location so that physical paths need not persist in learning history. */
export function projectIdentity(workspacePath: string): string {
  return createHash('sha256').update(workspacePath).digest('hex').slice(0, 24);
}

export class LearnerMemory {
  constructor(private readonly store: Memento) {}
  private initialization?: Promise<void>;

  read(): LearningEvent[] {
    const value = this.store.get<unknown>(MEMORY_KEY, []);
    if (!Array.isArray(value)) return [];
    return value.filter((e): e is LearningEvent => e !== null && typeof e === 'object' &&
      typeof e.projectId === 'string' && typeof e.projectName === 'string' &&
      typeof e.concept === 'string' && typeof e.language === 'string' &&
      typeof e.kind === 'string' && typeof e.origin === 'string' && typeof e.time === 'string');
  }

  /** Sanitizes legacy raw-question notes and erases them after upgrading. */
  initialize(): Promise<void> {
    if (!this.initialization) this.initialization = this.migrateLegacy().catch(error => {
      this.initialization = undefined;
      throw error;
    });
    return this.initialization;
  }

  private async migrateLegacy(): Promise<void> {
    const old = this.store.get<LegacyNote[]>(LEGACY_KEY, []);
    if (!Array.isArray(old) || !old.length) return;
    const converted: LearningEvent[] = old.filter(n => n && typeof n.project === 'string' && typeof n.topic === 'string')
      .map(n => ({
        projectId: `legacy:${projectIdentity(n.project)}`, projectName: n.project.slice(0, 80),
        concept: inferConcept(n.topic), language: 'desconhecida',
        kind: n.type === 'solution' ? 'solution' as const : 'question' as const,
        origin: n.type === 'solution' ? 'solution' as const : 'model' as const,
        time: typeof n.time === 'string' ? n.time : new Date(0).toISOString()
      }));
    await this.store.update(MEMORY_KEY, [...converted, ...this.read()].slice(-MAX_EVENTS));
    await this.store.update(LEGACY_KEY, []);
  }

  forProject(projectId: string, projectName: string): LearningEvent[] {
    return this.read().filter(e => e.projectId === projectId ||
      (e.projectId === `legacy:${projectIdentity(projectName)}` && e.projectName === projectName));
  }

  async record(input: {
    projectId: string; projectName: string; language: string; question: string;
    kind: LearningKind; origin: GuidanceOrigin;
  }): Promise<void> {
    const event: LearningEvent = {
      projectId: input.projectId, projectName: input.projectName.slice(0, 80),
      language: input.language.slice(0, 40), concept: inferConcept(input.question),
      kind: input.kind, origin: input.origin, time: new Date().toISOString()
    };
    await this.store.update(MEMORY_KEY, [...this.read(), event].slice(-MAX_EVENTS));
  }

  modelContext(projectId: string, projectName: string): string {
    return summarizeForModel(this.forProject(projectId, projectName));
  }

  userView(projectId: string, projectName: string): string {
    return summarizeForUser(this.forProject(projectId, projectName));
  }

  async clearProject(projectId: string, projectName: string): Promise<void> {
    const legacyId = `legacy:${projectIdentity(projectName)}`;
    const filtered = this.read().filter(e => e.projectId !== projectId && e.projectId !== legacyId);
    await this.store.update(MEMORY_KEY, filtered);
  }

  async clear(): Promise<void> {
    await this.store.update(MEMORY_KEY, []);
    await this.store.update(LEGACY_KEY, []);
  }
}
