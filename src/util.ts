export const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export function assert(condition: unknown, message: string): asserts condition {
 if (!condition) throw new Error(message);
}
export async function hash(text: string): Promise<string> {
 const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
 return Array.from(new Uint8Array(buffer), n => n.toString(16).padStart(2, '0')).join('');
}
export function download(name: string, content: string): void {
 const url = URL.createObjectURL(new Blob([content], {type: 'text/plain;charset=utf-8'}));
 const a = createEl('a'); a.href = url; a.download = name; a.click();
 window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function safeProperty(key: string): boolean {
 return key.length > 0 && key.length <= 120 && !/[\n\r\0:[\]{}]/u.test(key)
  && !['__proto__', 'prototype', 'constructor'].includes(key);
}
