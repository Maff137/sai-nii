import * as vscode from 'vscode';
import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { bounded } from './pedagogy';
import { focusedSource } from './focus';
import { projectIdentity } from './memory';
import { rankRelatedFiles, likelyTextFile, withinRoot } from './related';
import { architectureIntent, architectureOutline, architectureEvidence } from './architecture';
import { projectStructureQuestion } from './discussion';

const execFileAsync = promisify(execFile);
const FOLDER_EXCLUDE = new Set(['.git', '.ssh', '.aws', '.azure', '.gnupg', 'node_modules', '.venv', 'venv', 'dist', 'build', 'coverage', '.next', '__pycache__', '.idea', '.vscode-test']);

export function allowedRelativePath(name: string): boolean {
  const p = name.replaceAll('\\', '/');
  const parts = p.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || /[\0\r\n]/.test(part) || FOLDER_EXCLUDE.has(part.toLowerCase()) || /^\.env(?:\..*)?$/i.test(part) || /^(?:secrets?|credentials?)$/i.test(part))) return false;
  const leaf = parts.at(-1)?.toLowerCase() ?? '';
  if (/^\.env(?:\..+)?$/.test(leaf) || /\.((?:key|pem|p12|pfx|crt|cert))$/.test(leaf)) return false;
  if (/(?:secrets?|credentials?|id_rsa|id_ed25519|tokens?)(?:[._-]|$)/.test(leaf)) return false;
  return !p.startsWith('../') && !path.isAbsolute(p);
}

async function git(root: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['-c', 'core.fsmonitor=false', '-C', root, '--no-pager', ...args], {
      timeout: 3000,
      maxBuffer: 90_000,
      encoding: 'utf8',
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' }
    });
    return stdout;
  } catch {
    return '';
  }
}

export type Snapshot = { project: string; projectId: string; file: string; language: string; content: string; architecturePaths?: string[] };

/**
 * A trusted project folder alone is sufficient for architecture questions.
 * The active editor is optional; nothing is scanned until the learner asks.
 */
export async function snapshot(learnerContext = '', currentQuestion = learnerContext): Promise<Snapshot | null> {
  if (!vscode.workspace.isTrusted) return null;
  const candidate = vscode.window.activeTextEditor;
  const selectedFolder = candidate ? vscode.workspace.getWorkspaceFolder(candidate.document.uri) : undefined;
  const folder = selectedFolder ?? vscode.workspace.workspaceFolders?.[0];
  if (!folder || folder.uri.scheme !== 'file') return null;
  const rawFile = candidate?.document.uri.scheme === 'file' && selectedFolder?.uri.toString() === folder.uri.toString()
    ? candidate : undefined;
  const relative = rawFile
    ? path.relative(folder.uri.fsPath, rawFile.document.uri.fsPath).replaceAll('\\', '/')
    : '';
  const editor = relative && allowedRelativePath(relative) ? rawFile : undefined;
  // A restricted editor is never read, even when the learner asks about the workspace.
  if (rawFile && !editor && !architectureIntent(currentQuestion)) return null;
  const archMode = architectureIntent(currentQuestion) || !editor;
  const structureAsked = projectStructureQuestion(currentQuestion);

  // A general programming question does not need a repository scan or hundreds
  // of file paths. The model gets this limited context only when relevant.
  if (archMode && !structureAsked) {
    return {
      project: folder.name, projectId: projectIdentity(folder.uri.fsPath),
      file: '(raiz)', language: 'multilanguage', architecturePaths: [],
      content: `Projeto aberto: ${folder.name}. Dúvida conceitual: use somente o pedido e a conversa anterior; não presuma que o aluno perguntou sobre a árvore de diretórios.`
    };
  }

  const nearby = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, '**/*'),
    '{**/.git/**,**/node_modules/**,**/.venv/**,**/venv/**,**/dist/**,**/build/**,**/coverage/**,**/.idea/**,**/.vscode-test/**,**/.next/**,**/__pycache__/**}', 750);
  const paths = nearby.map(u => path.relative(folder.uri.fsPath, u.fsPath).replaceAll('\\', '/'))
    .filter(allowedRelativePath);

  if (archMode) {
    const outline = architectureOutline(paths, structureAsked ? 2400 : 850);
    const evidence = structureAsked ? await readArchitectureEvidence(folder.uri.fsPath, paths) : '';
    const body = [
      `Projeto: ${folder.name}`,
      structureAsked ? `Escopo: arquitetura da pasta raiz do projeto (sem exigir arquivo selecionado).` : `Contexto auxiliar do projeto: responda prioritariamente à pergunta conceitual atual; não retome a listagem das pastas sem necessidade.`,
      `Árvore de caminhos realmente encontrados (parcial, limitada a 750 arquivos):\n${outline}`,
      structureAsked ? `Amostras seguras de documentação, configuração e entradas (não são o projeto inteiro):\n${evidence || '(não disponíveis)'}` : '',
      editor ? `Arquivo aberto opcional: ${relative} | Linguagem: ${editor.document.languageId}` : '',
      'Distinguir SEMPRE o que os nomes e os trechos confirmam das convenções prováveis; não alegar que uma arquitetura foi escolhida por determinado motivo sem evidência.'
    ].filter(Boolean).join('\n\n');
    return { project: folder.name, projectId: projectIdentity(folder.uri.fsPath),
      file: '(raiz)', language: 'multilanguage', content: body, architecturePaths: paths };
  }

  if (!editor) return null;
  const rel = relative;
  const selection = editor.selection.isEmpty ? '' : bounded(editor.document.getText(editor.selection), 6000);
  const fullText = editor.document.getText();
  const fileText = focusedSource(fullText, learnerContext, editor.document.offsetAt(editor.selection.active));
  const diagnostics = vscode.languages.getDiagnostics(editor.document.uri).slice(0, 12).map(d =>
    `L${d.range.start.line + 1}: ${bounded(d.message.replace(/\s+/g, ' '), 210)}`
  );
  const gitStatus = (await git(folder.uri.fsPath, ['status', '--porcelain=v1', '--untracked-files=no']))
    .split('\n').filter(row => row.length > 3 && allowedRelativePath(row.slice(3))).slice(0, 35).join('\n');
  const activeDiff = await git(folder.uri.fsPath, ['diff', '--no-ext-diff', '--no-textconv', '--', rel]);
  const recentCommits = await git(folder.uri.fsPath, ['log', '-3', '--pretty=format:%h %s']);
  const related = await readRelatedFiles(folder.uri.fsPath, paths, rel, fullText, learnerContext);
  const body = [
    `Projeto: ${folder.name}`,
    `Arquivo: ${rel} | Linguagem VS Code: ${editor.document.languageId}`,
    `Trecho selecionado (se houver):\n${selection || '(nenhum)'}`,
    `Trecho prioritário do editor (com números de linha, inclui alterações não salvas):\n${fileText}`,
    `Diagnósticos atuais:\n${diagnostics.join('\n') || '(nenhum)'}`,
    `Caminhos de arquivos do workspace:\n${paths.slice(0, 55).join('\n') || '(não disponível)'}`,
    `Arquivos relacionados selecionados por imports ou menções explícitas (leitura limitada):\n${related || '(nenhum identificado)'}`,
    `Git status (somente nomes filtrados):\n${gitStatus || '(limpo/indisponível)'}`,
    `Git diff do arquivo aberto:\n${bounded(activeDiff, 1500) || '(nenhum)'}`,
    `Últimos commits locais:\n${bounded(recentCommits, 500) || '(indisponível)'}`
  ].join('\n\n');
  return { project: folder.name, projectId: projectIdentity(folder.uri.fsPath), file: rel, language: editor.document.languageId, content: body };
}

/** Explicitly sample conventional project overview files only, with realpath checks. */
async function readArchitectureEvidence(root: string, paths: string[]): Promise<string> {
  const candidates = architectureEvidence(paths, 3);
  const realRoot = await fs.realpath(root).catch(() => '');
  if (!realRoot) return '';
  const result: string[] = [];
  for (const relative of candidates) {
    if (!allowedRelativePath(relative) || !likelyTextFile(relative)) continue;
    const absolute = path.resolve(root, relative);
    if (!withinRoot(root, absolute)) continue;
    try {
      const realFile = await fs.realpath(absolute);
      if (!withinRoot(realRoot, realFile)) continue;
      const stat = await fs.stat(realFile);
      if (!stat.isFile() || stat.size > 100_000) continue;
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(absolute));
      const value = document.getText();
      if (value.length > 120_000 || value.includes('\0')) continue;
      // No bulk index, credentials, or raw project dump. A separate local-model request
      // is performed only after user invocation. This is not a secret-content scanner.
      const lines = value.slice(0, 650).split('\n').slice(0, 28).join('\n');
      result.push(`Arquivo: ${relative}\n${lines}`);
    } catch { /* Missing or unreadable evidence must not block the architecture view. */ }
  }
  return result.join('\n\n').slice(0, 2200);
}

/** Read up to two explicitly linked text files. Symlink targets outside the workspace are rejected. */
async function readRelatedFiles(root: string, paths: string[], active: string, source: string, question: string): Promise<string> {
  const chosen = rankRelatedFiles(paths, active, source, question, 2);
  if (!chosen.length) return '';
  const realRoot = await fs.realpath(root).catch(() => '');
  if (!realRoot) return '';
  const results: string[] = [];
  for (const relative of chosen) {
    if (!allowedRelativePath(relative) || !likelyTextFile(relative)) continue;
    const absolute = path.resolve(root, relative);
    if (!withinRoot(root, absolute)) continue;
    try {
      const realFile = await fs.realpath(absolute);
      if (!withinRoot(realRoot, realFile)) continue;
      const stat = await fs.stat(realFile);
      if (!stat.isFile() || stat.size > 128_000) continue;
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(absolute));
      const content = doc.getText();
      if (content.length > 160_000 || content.includes('\0')) continue;
      // Source is bounded even when both related files are selected.
      const snippet = focusedSource(content, question, 0, 1200);
      results.push(`Arquivo relacionado: ${relative}\n${snippet}`);
    } catch {
      // A missing or unreadable file must not prevent tutoring.
    }
  }
  return results.join('\n\n').slice(0, 3200);
}
