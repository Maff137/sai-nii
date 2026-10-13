/** Restricted Markdown tokenizer for the Webview. Never emits HTML, URLs or executable markup. */
export type InlinePart = { kind: 'text' | 'strong' | 'em' | 'code'; text: string };
export type MarkdownBlock = {
  kind: 'paragraph' | 'heading' | 'list' | 'code' | 'quote';
  level?: number;
  ordered?: boolean;
  items?: InlinePart[][];
  spans?: InlinePart[];
  code?: string;
};

export function parseInline(raw: string): InlinePart[] {
  const result: InlinePart[] = [];
  const push = (kind: InlinePart['kind'], text: string) => {
    if (!text) return;
    if (kind === 'text' && result.at(-1)?.kind === 'text') result[result.length - 1].text += text;
    else result.push({kind, text});
  };
  // Nonrecursive: untrusted model output cannot create deep nested markup.
  let i = 0;
  while (i < raw.length) {
    const kind: InlinePart['kind'] | null = raw.startsWith('**', i) || raw.startsWith('__', i) ? 'strong'
      : raw[i] === '`' ? 'code'
      : raw[i] === '*' || raw[i] === '_' ? 'em' : null;
    const marker = kind === 'strong' ? raw.slice(i, i + 2) : raw[i];
    const end = kind && raw.indexOf(marker, i + marker.length);
    if (kind && typeof end === 'number' && end > i + marker.length) {
      push(kind, raw.slice(i + marker.length, end));
      i = end + marker.length;
    } else {
      push('text', raw[i]); i++;
    }
  }
  return result;
}

/** Parse a deliberately small Markdown subset with bounded input and no raw HTML interpretation. */
export function parseMarkdown(input: string): MarkdownBlock[] {
  const lines = String(input).slice(0, 12000).replace(/\r\n?/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let i = 0;
  while (i < lines.length && blocks.length < 100) {
    if (!lines[i].trim()) {i++; continue;}
    if (/^\s*```/.test(lines[i])) {
      i++; const content: string[] = [];
      while (i < lines.length && !/^\s*```/.test(lines[i])) content.push(lines[i++]);
      if (i < lines.length) i++;
      blocks.push({kind:'code', code:content.join('\n')}); continue;
    }
    const heading = lines[i].match(/^\s*(#{1,4})\s+(.+)$/);
    if (heading) { blocks.push({kind:'heading', level:heading[1].length, spans:parseInline(heading[2])}); i++; continue; }
    const itemMatch = (line: string) => line.match(/^\s{0,3}([-*+]\s+|\d+[.)]\s+)(.*)$/);
    const listItem = itemMatch(lines[i]);
    if (listItem) {
      const ordered = /^\d/.test(listItem[1]); const items: InlinePart[][] = [];
      while (i < lines.length) {
        const item = itemMatch(lines[i]);
        if (!item || /^\d/.test(item[1]) !== ordered) break;
        items.push(parseInline(item[2])); i++;
      }
      blocks.push({kind:'list', ordered, items}); continue;
    }
    if (/^\s*>\s?/.test(lines[i])) {
      const parts: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) parts.push(lines[i++].replace(/^\s*>\s?/,''));
      blocks.push({kind:'quote', spans:parseInline(parts.join(' '))}); continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s*(?:```|#{1,4}\s|>\s|[-*+]\s|\d+[.)]\s)/.test(lines[i])) paragraph.push(lines[i++].trim());
    if (!paragraph.length) {paragraph.push(lines[i++].trim());}
    blocks.push({kind:'paragraph', spans:parseInline(paragraph.join(' '))});
  }
  return blocks;
}
