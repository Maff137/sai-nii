import * as vscode from 'vscode';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/** Only local loopback is reachable; no arbitrary URL/API key can be configured. */
export async function complete(messages: ChatMessage[], unlocked = false, requireHint = false): Promise<string> {
  const config = vscode.workspace.getConfiguration('sainii');
  const port = config.get<number>('serverPort', 8080);
  const model = config.get<string>('model', 'local');
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('Porta local inválida.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: unlocked ? 900 : 380,
        stream: false,
        ...(unlocked ? {} : {
          // llama.cpp's JSON grammar prevents plain-text replies from reaching the parser.
          response_format: {
            type: 'json_object',
            schema: {
              type: 'object',
              properties: {
                observation: { type: 'string', minLength: 1, maxLength: 230 },
                question: { type: 'string', minLength: 2, maxLength: 180 },
                hint: { type: 'string', maxLength: 230, ...(requireHint ? { minLength: 1 } : {}) }
              },
              required: ['observation', 'question', 'hint'],
              additionalProperties: false
            }
          }
        })
      })
    });
    if (!response.ok) throw new Error(`Servidor local respondeu HTTP ${response.status}.`);
    const data: unknown = await response.json();
    const choices = (data as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
    const content = choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('Modelo local não retornou texto.');
    return content;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Não foi possível falar com o modelo em 127.0.0.1:${port}. Confira o llama-server e o modelo GGUF. (${detail})`);
  } finally {
    clearTimeout(timer);
  }
}
