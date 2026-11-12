import {t as tr} from '../i18n';
import type {Settings, ModelMetrics} from '../types';
import {assert} from '../util';
import {validateSettings} from '../config';
import {nativeRequest, requestResponse, type UrlTransport} from './request';
import type {RequestUrlResponse} from 'obsidian';

export interface Message {role: 'system' | 'user' | 'assistant'; content: string}
export interface Capabilities {models: string[]; thinking: boolean; metadata: Record<string, unknown>; version: string}
export interface ChatOptions {
 messages: Message[]; temperature: number; maxTokens: number; format?: object;
 signal: AbortSignal;
 onMetrics?: (metrics: ModelMetrics) => void;
}
export interface LLMProvider {
 health(signal?: AbortSignal): Promise<Capabilities>;
 chat(options: ChatOptions): Promise<string>;
 cancel(): void;
}
class RequestInterruptedError extends Error {}
export class OllamaProvider implements LLMProvider {
 private controllers = new Set<AbortController>();
 private active = 0;
 private capabilities?: Capabilities;
 private capabilitiesModel = '';
 private capabilitiesEndpoint = '';
 private pending = new Map<string, Set<Promise<RequestUrlResponse>>>();
 private generation = 0;
 constructor(private settings: () => Settings, private transport: UrlTransport = nativeRequest) {}
 cancel(): void {this.generation++;for (const c of this.controllers) c.abort();}
 private configuration(): Settings {
  const settings={...this.settings()};validateSettings(settings);
  settings.endpoint=new URL(settings.endpoint).origin;return settings;
 }
 private hasPending(endpoint:string):boolean{return (this.pending.get(endpoint)?.size??0)>0;}
 private sameIdentity(settings:Settings):boolean{const current=this.configuration();return current.endpoint===settings.endpoint&&current.model===settings.model;}
 private async request(s:Settings,path: string, body?: object, signal?: AbortSignal): Promise<Record<string, unknown>> {
  assert(!this.hasPending(s.endpoint), tr("fieldIdeas.the_previous_local_http_request_to_this_endpoint_is_still_running"));
  const controller = new AbortController(); this.controllers.add(controller);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, {once: true});
  if (signal?.aborted) controller.abort();
  const timer = window.setTimeout(() => controller.abort('timeout'), s.timeoutMs);
  try {
   const response = await requestResponse(request => {
    const pending = this.transport(request),requests=this.pending.get(s.endpoint)??new Set<Promise<RequestUrlResponse>>();requests.add(pending);this.pending.set(s.endpoint,requests);
    const settled = () => {requests.delete(pending);if(!requests.size)this.pending.delete(s.endpoint);};void pending.then(settled, settled);
    return pending;
   }, {url: s.endpoint + path,
    method: body ? 'POST' : 'GET', headers: {'Content-Type': 'application/json'},
    body: body ? JSON.stringify(body) : undefined, throw: false,
   }, controller.signal);
   assert(response.status >= 200 && response.status < 300, tr("fieldIdeas.ollama_http_check_the_model_and_local_server", {value1: response.status}));
   assert(response.arrayBuffer.byteLength <= 2_000_000, tr("fieldIdeas.the_ollama_response_exceeds_the_limit_2_mb"));
   const data: unknown = JSON.parse(response.text);
   assert(data !== null && typeof data === 'object' && !Array.isArray(data), tr("fieldIdeas.invalid_ollama_response"));
   const object = data as Record<string, unknown>;
   assert(!object.error, `Ollama: ${String(object.error)}`);
   return object;
  } catch (error) {
   if (controller.signal.aborted) throw new RequestInterruptedError(signal?.aborted ? tr("labels.request_cancelled") : tr("fieldIdeas.the_ollama_request_was_cancelled_or_timed_out"));
   throw error;
  } finally {window.clearTimeout(timer); this.controllers.delete(controller); signal?.removeEventListener('abort', abort);}
 }
 async health(signal?: AbortSignal): Promise<Capabilities> {
  return this.inspect(this.configuration(),signal);
 }
 private async inspect(s:Settings,signal?:AbortSignal):Promise<Capabilities>{
  const generation=this.generation;
  const current=()=>{assert(generation===this.generation&&!signal?.aborted,tr("labels.request_cancelled"));assert(this.sameIdentity(s),tr("fieldIdeas.the_model_settings_changed_during_the_request_check_again"));};
  const tags = await this.request(s,'/api/tags', undefined, signal);current();
  const models = Array.isArray(tags.models) ? tags.models.flatMap((m: unknown) => m && typeof m === 'object' && 'name' in m && typeof m.name === 'string' ? [m.name] : []) : [];
  const model = s.model;
  assert(models.includes(model), tr("fieldIdeas.model_is_not_available_locally_installed_no_automatic_download", {value1: model, value2: models.join(', ') || 'keine'}));
  const metadata = await this.request(s,'/api/show', {model}, signal);current();
  assert(!metadata.remote_host && !metadata.remote_model, tr("fieldIdeas.remote_or_cloud_models_will_not_be_used"));
  let version = 'unbekannt';
  try {const v = await this.request(s,'/api/version', undefined, signal); if (typeof v.version === 'string') version = v.version;}
  catch(error) {if(error instanceof RequestInterruptedError||this.hasPending(s.endpoint))throw error; /* Older servers may omit this endpoint. */}
  current();
  this.capabilitiesModel = model;this.capabilitiesEndpoint=s.endpoint;
  return this.capabilities = {models, thinking: Array.isArray(metadata.capabilities) && metadata.capabilities.includes('thinking'), metadata, version};
 }
 async chat(options: ChatOptions): Promise<string> {
  const s = this.configuration();
  const generation=this.generation;
  assert(!options.signal.aborted, tr("labels.request_cancelled"));
  assert(!this.hasPending(s.endpoint), tr("fieldIdeas.the_previous_local_http_request_to_this_endpoint_is_still_running"));
  assert(this.active < s.maxConcurrent, tr("fieldIdeas.a_local_request_is_already_running_cancel_it_or_wait_for"));
  this.active++;
  try {
   if (!this.capabilities || this.capabilitiesModel !== s.model || this.capabilitiesEndpoint!==s.endpoint) await this.inspect(s,options.signal);
   assert(generation===this.generation&&!options.signal.aborted, tr("labels.request_cancelled"));
   assert(this.sameIdentity(s),tr("fieldIdeas.the_model_settings_changed_during_the_request_check_again"));
   assert(!s.think || this.capabilities?.thinking, tr("fieldIdeas.this_model_does_not_report_thinking_support"));
   const result = await this.request(s,'/api/chat', {model: s.model, messages: options.messages,
    stream: false, ...(options.format ? {format: options.format} : {}),
    ...(this.capabilities?.thinking ? {think: s.think} : {}), keep_alive: s.releaseModel ? 0 : '5m',
    options: {num_ctx: s.numCtx, num_predict: options.maxTokens, temperature: options.temperature,
     ...(options.format ? {presence_penalty: 0, frequency_penalty: 0, repeat_penalty: 1} : {})},
   }, options.signal);
   assert(generation===this.generation&&!options.signal.aborted, tr("labels.request_cancelled"));
   assert(this.sameIdentity(s),tr("fieldIdeas.the_model_settings_changed_during_the_request_check_again"));
   assert(result.done === true && result.done_reason !== 'length', tr("fieldIdeas.the_model_response_is_incomplete_no_analysis_is_available_for_approval"));
   const m = result.message;
   assert(m && typeof m === 'object' && 'content' in m && typeof m.content === 'string', tr("fieldIdeas.the_model_response_contains_no_text"));
   assert(m.content.trim(), tr("fieldIdeas.the_model_response_contains_no_text"));
   const metric = (key: string, divisor = 1): number | undefined => typeof result[key] === 'number' && Number.isFinite(result[key]) && result[key] >= 0 ? result[key] / divisor : undefined;
   options.onMetrics?.({loadMs: metric('load_duration', 1e6), promptMs: metric('prompt_eval_duration', 1e6), generationMs: metric('eval_duration', 1e6), inputTokens: metric('prompt_eval_count'), outputTokens: metric('eval_count')});
   return m.content;
  } finally {this.active--;}
 }
}
