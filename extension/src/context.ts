import * as vscode from 'vscode';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { bounded } from './pedagogy';
import { focusedSource } from './focus';

const execFileAsync = promisify(execFile);
const FOLDER_EXCLUDE = new Set(['.git', '.ssh', '.aws', '.azure', '.gnupg', 'node_modules', '.venv', 'venv', 'dist', 'build', 'coverage', '.next', '__pycache__']);

export function allowedRelativePath(name: string): boolean {
  const p = name.replaceAll('\\', '/');
  const parts = p.split('/');
  if (parts.some(part => FOLDER_EXCLUDE.has(part))) return false;
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

export type Snapshot = { project: string; file: string; content: string };

/** Read-only, bounded editor snapshot. Never reads .env/keys or generated directories. */
export async function snapshot(learnerContext = ''): Promise<Snapshot | null> {
  if (!vscode.workspace.isTrusted) return null;
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.uri.scheme !== 'file') return null;
  const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
  if (!folder || folder.uri.scheme !== 'file') return null;
  const rel = path.relative(folder.uri.fsPath, editor.document.uri.fsPath).replaceAll('\\', '/');
  if (!allowedRelativePath(rel)) return null;
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
  const nearby = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, '**/*'),
    '{**/.git/**,**/node_modules/**,**/.venv/**,**/dist/**,**/build/**,**/coverage/**}', 70);
  const paths = nearby.map(u => path.relative(folder.uri.fsPath, u.fsPath).replaceAll('\\', '/'))
    .filter(allowedRelativePath).slice(0, 55);
  const body = [
    `Projeto: ${folder.name}`,
    `Arquivo: ${rel} | Linguagem VS Code: ${editor.document.languageId}`,
    `Trecho selecionado (se houver):\n${selection || '(nenhum)'}`,
    `Trecho prioritário do editor (com números de linha, inclui alterações não salvas):\n${fileText}`,
    `Diagnósticos atuais:\n${diagnostics.join('\n') || '(nenhum)'}`,
    `Caminhos de arquivos do workspace:\n${paths.join('\n') || '(não disponível)'}`,
    `Git status (somente nomes filtrados):\n${gitStatus || '(limpo/indisponível)'}`,
    `Git diff do arquivo aberto:\n${bounded(activeDiff, 1500) || '(nenhum)'}`,
    `Últimos commits locais:\n${bounded(recentCommits, 500) || '(indisponível)'}`
  ].join('\n\n');
  return { project: folder.name, file: rel, content: body };
}
