import {t as tr} from '../i18n';
import {requestUrl, type RequestUrlParam, type RequestUrlResponse} from 'obsidian';
import {errorMessage} from '../util';

export type UrlTransport = (request: RequestUrlParam) => Promise<RequestUrlResponse>;
export const nativeRequest: UrlTransport = request => requestUrl(request);

/** requestUrl has no AbortSignal. Stop waiting and discard late responses; the host owns the connection. */
export function requestResponse(transport: UrlTransport, request: RequestUrlParam, signal: AbortSignal): Promise<RequestUrlResponse> {
 if (signal.aborted) return Promise.reject(new Error(tr("labels.request_cancelled")));
 return new Promise((resolve, reject) => {
  const cleanup = () => signal.removeEventListener('abort', abort);
  const abort = () => {cleanup(); reject(new Error(tr("labels.request_cancelled")));};
  signal.addEventListener('abort', abort, {once: true});
  let pending: Promise<RequestUrlResponse>;
  try {pending = transport(request);} catch (error) {cleanup(); reject(error instanceof Error ? error : new Error(errorMessage(error))); return;}
  void pending.then(response => {
   cleanup();
   if (signal.aborted) reject(new Error(tr("labels.request_cancelled"))); else resolve(response);
  }, (error:unknown) => {cleanup(); reject(error instanceof Error ? error : new Error(errorMessage(error)));});
 });
}
