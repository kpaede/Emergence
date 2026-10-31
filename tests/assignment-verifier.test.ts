import {describe, expect, it} from 'vitest';
import {verificationContext, parseVerification} from '../src/llm/assignment-verifier';
import {graph} from './fixtures';

describe('independent relation judgement', () => {
 it('asks about the field direction and whole definition, without accepting a bare template link as evidence', () => {
  const context = verificationContext('Quelle', 'Eine Erklärung.\n## [[Tetrade]]\n- ENHANCES ➜', graph().rules, [{id: 'P1', field: 'Überbau', target: 'Fachgebiet'}]);
  expect(context.messages[1]!.content).toContain('Eine Erklärung.');
  expect(context.messages[1]!.content).not.toContain('Tetrade');
  expect(context.messages[1]!.content).toContain('Oberbegriff');
  expect(context.messages[0]!.content).toContain('Quelle -> Feld -> Ziel');
  expect([...parseVerification('{"P1":true}', context.format)]).toEqual(['P1']);
  expect([...parseVerification('{"P1":false}', context.format)]).toEqual([]);
 });
 it('rejects omitted decisions, extra text, unknown IDs and string truth values', () => {
  const {format} = verificationContext('Quelle', 'Text.', graph().rules, [{id: 'P1', field: 'Überbau', target: 'Ziel'}, {id: 'P2', field: 'Überbau', target: 'Alt'}]);
  for (const text of ['{}', '{"P1":true}', '{"P1":"true","P2":false}', '{"P1":true,"P2":false,"P3":true}', '{"P1":true,"P2":false,"reason":"passt"}']) expect(() => parseVerification(text, format)).toThrow();
 });
 it('requires independently described roles and unique local IDs', () => {
  expect(() => verificationContext('Quelle', '', graph().rules, [{id: 'P1', field: 'Reibung', target: 'Ziel'}])).toThrow('Feldbeschreibung');
  expect(() => verificationContext('Quelle', '', graph().rules, [{id: 'P1', field: 'Überbau', target: 'Ziel'}, {id: 'P1', field: 'Überbau', target: 'Alt'}])).toThrow('Prüf-IDs');
 });
});
