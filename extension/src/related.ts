import * as path from 'node:path';

/** Lightweight, language-agnostic references. No filesystem access, no code execution. */
export function importReferences(source: string): string[] {
  const refs = new Set<string>();
  for (const line of source.slice(0, 65_000).split(/\r?\n/)) {
    if (!/\b(?:import|from|require|include|use|mod|load|source)\b|#include/i.test(line)) continue;
    const quoted = /["'`]([^"'`\s]+)["'`]/g;
    for (const match of line.matchAll(quoted)) {
      const ref = match[1].split(/[?#]/)[0];
      if (ref.length >= 2 && ref.length <= 160) refs.add(ref);
    }
    // Python imports, Rust crate imports and Go-style module names.
    const py = line.match(/^\s*(?:from|import|use|mod)\s+([\w.:-]+)/);
    if (py) refs.add(py[1].replace(/::/g, '/').replace(/\./g, '/'));
  }
  return [...refs].slice(0, 80);
}

function normalized(p: string): string {
  return p.replaceAll('\\', '/').replace(/^\.\//, '').toLowerCase();
}

function withoutExt(p: string): string {
  const ext = path.posix.extname(p);
  return ext ? p.slice(0, -ext.length) : p;
}

/** Rank referenced siblings. Never select unrelated files merely for being in the same directory. */
export function rankRelatedFiles(paths: string[], activePath: string, activeSource: string, query: string, limit = 2): string[] {
  const active = normalized(activePath);
  const dir = path.posix.dirname(active);
  const refs = importReferences(activeSource).map(ref => {
    const r = normalized(ref).replace(/^\/+/, '');
    return [r, normalized(path.posix.normalize(path.posix.join(dir, r)))];
  }).flat();
  const question = query.toLowerCase();
  const scored: Array<{ file: string; score: number }> = [];
  for (const original of paths) {
    const candidate = normalized(original);
    if (!candidate || candidate === active) continue;
    const stem = withoutExt(path.posix.basename(candidate));
    const candidateNoExt = withoutExt(candidate);
    let score = 0;
    for (const ref of refs) {
      const refNoExt = withoutExt(ref);
      if (!refNoExt || refNoExt.length < 2) continue;
      if (candidate === ref || candidateNoExt === refNoExt || candidateNoExt.endsWith('/' + refNoExt) || candidateNoExt.endsWith('/' + refNoExt + '/index')) {
        score = Math.max(score, 120);
      }
    }
    if (stem.length >= 4 && new RegExp(`(^|[^a-z0-9_])${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9_]|$)`, 'i').test(question)) score = Math.max(score, 110);
    if (stem.length >= 4 && activeSource.slice(0, 60_000).toLowerCase().includes(path.posix.basename(candidate))) score = Math.max(score, 80);
    if (!score) continue;
    if (path.posix.dirname(candidate) === dir) score += 12;
    if (path.posix.extname(candidate) === path.posix.extname(active)) score += 6;
    scored.push({ file: original, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file)).slice(0, Math.max(0, Math.min(limit, 3))).map(x => x.file);
}

/** Avoid binary formats. The allowlist is NOT tied to a programming language. */
export function likelyTextFile(file: string): boolean {
  return !/\.(?:png|jpe?g|gif|webp|ico|svgz|pdf|zip|gz|7z|tar|exe|dll|so|dylib|wasm|class|jar|pyc|pyo|db|sqlite\d*|mp[34]|mov|ttf|woff2?|otf|bin|lock)$/i.test(file);
}

/** Relative-path containment check, including traversal and absolute paths. */
export function withinRoot(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return !!rel && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
}
