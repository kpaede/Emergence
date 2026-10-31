import type {Settings, ModelMetrics} from '../types';
import {assert} from '../util';
import {validateSettings} from '../config';

export interface Message {role: 'system' | 'user' | 'assistant'; content: string}
export interface Capabilities {models: string[]; thinking: boolean; metadata: Record<string, unknown>; version: string}
export interface ChatOptions {
 messages: Message[]; temperature: number; maxTokens: number; format?: object;
 signal: AbortSignal;
 onMetrics?: (metrics: ModelMetrics) => void;
 allowPartial?: boolean; onTruncated?: () => void;
}
export interface LLMProvider {
 health(signal?: AbortSignal): Promise<Capabilities>;
 chat(options: ChatOptions): Promise<string>;
 cancel(): void;
}
export class OllamaProvider implements LLMProvider {
 private controllers = new Set<AbortController>();
 private active = 0;
 private capabilities?: Capabilities;
 private capabilitiesModel = '';
 constructor(private settings: () => Settings, private transport: typeof fetch = (input, init) => fetch(input, init)) {}
 cancel(): void {for (const c of this.controllers) c.abort();}
 private async request(path: string, body?: object, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const s = this.settings(); validateSettings(s);
  const controller = new AbortController(); this.controllers.add(controller);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, {once: true});
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(() => controller.abort('timeout'), s.timeoutMs);
  try {
   const response = await this.transport(s.endpoint.replace(/\/$/u, '') + path, {
    method: body ? 'POST' : 'GET', headers: {'Content-Type': 'application/json'},
    body: body ? JSON.stringify(body) : undefined, signal: controller.signal, redirect: 'error', credentials: 'omit',
   });
   assert(response.ok, `Ollama HTTP ${response.status}. Modell und lokalen Server prüfen.`);
   assert(response.body, 'Ollama liefert keinen Antwortkörper.');
   const reader = response.body.getReader(), chunks: Uint8Array[] = []; let bytes = 0;
   try {
    for (;;) {
     const chunk = await reader.read(); if (chunk.done) break;
     bytes += chunk.value.byteLength;
     assert(bytes <= 2_000_000, 'Ollama-Antwort überschreitet das Limit (2 MB).');
     chunks.push(chunk.value);
    }
   } catch (error) {await reader.cancel(); throw error;} finally {reader.releaseLock();}
   const all = new Uint8Array(bytes); let offset = 0;
   for (const chunk of chunks) {all.set(chunk, offset); offset += chunk.length;}
   const data: unknown = JSON.parse(new TextDecoder().decode(all));
   assert(data !== null && typeof data === 'object' && !Array.isArray(data), 'Ungültige Ollama-Antwort.');
   const object = data as Record<string, unknown>;
   assert(!object.error, `Ollama: ${String(object.error)}`);
   return object;
  } catch (error) {
   if (controller.signal.aborted) throw new Error(signal?.aborted ? 'Anfrage abgebrochen.' : 'Ollama-Anfrage abgebrochen oder Zeitlimit erreicht.');
   throw error;
  } finally {clearTimeout(timer); this.controllers.delete(controller); signal?.removeEventListener('abort', abort);}
 }
 async health(signal?: AbortSignal): Promise<Capabilities> {
  const tags = await this.request('/api/tags', undefined, signal);
  const models = Array.isArray(tags.models) ? tags.models.flatMap((m: unknown) => m && typeof m === 'object' && 'name' in m && typeof m.name === 'string' ? [m.name] : []) : [];
  const model = this.settings().model;
  assert(models.includes(model), `Modell ${model} ist nicht lokal verfügbar. Installiert: ${models.join(', ') || 'keine'}. Kein automatischer Download.`);
  const metadata = await this.request('/api/show', {model}, signal);
  assert(!metadata.remote_host && !metadata.remote_model, 'Remote-/Cloud-Modell wird nicht verwendet.');
  let version = 'unbekannt';
  try {const v = await this.request('/api/version', undefined, signal); if (typeof v.version === 'string') version = v.version;} catch { /* Optional endpoint. */ }
  this.capabilitiesModel = model;
  return this.capabilities = {models, thinking: Array.isArray(metadata.capabilities) && metadata.capabilities.includes('thinking'), metadata, version};
 }
 async chat(options: ChatOptions): Promise<string> {
  const s = this.settings();
  assert(!options.signal.aborted, 'Anfrage abgebrochen.');
  assert(this.active < s.maxConcurrent, 'Lokale Anfrage läuft bereits. Bitte abbrechen oder deren Abschluss abwarten.');
  this.active++;
  try {
   if (!this.capabilities || this.capabilitiesModel !== s.model) await this.health(options.signal);
   assert(!s.think || this.capabilities?.thinking, 'Dieses Modell meldet keine Thinking-Unterstützung.');
   const result = await this.request('/api/chat', {model: s.model, messages: options.messages,
    stream: false, ...(options.format ? {format: options.format} : {}),
    ...(this.capabilities?.thinking ? {think: s.think} : {}), keep_alive: s.releaseModel ? 0 : '5m',
    options: {num_ctx: s.numCtx, num_predict: options.maxTokens, temperature: options.temperature,
     ...(options.format ? {presence_penalty: 0, frequency_penalty: 0, repeat_penalty: 1} : {})},
   }, options.signal);
   assert(!options.signal.aborted, 'Anfrage abgebrochen.');
   assert(result.done === true && (result.done_reason !== 'length' || options.allowPartial === true && !options.format), options.format ? 'Modellantwort unvollständig; keine freigabefähige Analyse.' : 'Modellantwort unvollständig.');
   const m = result.message;
   assert(m && typeof m === 'object' && 'content' in m && typeof m.content === 'string', 'Modellantwort enthält keinen Text.');
   assert(m.content.trim(), 'Modellantwort enthält keinen Text.');
   if (result.done_reason === 'length') options.onTruncated?.();
   const metric = (key: string, divisor = 1): number | undefined => typeof result[key] === 'number' && Number.isFinite(result[key]) && result[key] >= 0 ? result[key] / divisor : undefined;
   options.onMetrics?.({loadMs: metric('load_duration', 1e6), promptMs: metric('prompt_eval_duration', 1e6), generationMs: metric('eval_duration', 1e6), inputTokens: metric('prompt_eval_count'), outputTokens: metric('eval_count')});
   return m.content;
  } finally {this.active--;}
 }
}
