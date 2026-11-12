import {describe, expect, it} from 'vitest';
import {ArgdownEngine} from '../src/argdown/engine';
import {editNode, nodeColor} from '../src/argdown/actions';
import {nodeKey} from '../src/argdown/model';
import {readReconstruction, writeReconstruction} from '../src/argdown/reconstruction';
const engine = new ArgdownEngine();
const syntax = `===
title: Syntaxprüfung
model:
  mode: strict
map:
  statementLabelMode: text
===

# Hauptabschnitt #thema {isGroup: true}

[A]: **Starke** und _mehrzeilige_
Aussage mit [Quelle](https://example.com) und #tag #(freier Tag).
{custom: {rating: 3}, color: "#ff0000"}

[A]: Eine zweite Formulierung derselben Aussage.

[B]: Verweist auf @[A] und @<Grund>.
  +> [A]
  >< [C]: Gegenteilige Aussage.

<Grund>: Eine **Begründung** mit .~.p und :happy:.

(1) [P]: Erster Grund.
(2) [Q]: Zweiter Grund.
-- Modus ponens {uses: [1, 2], custom: 42} --
(3) [Zwischen]: Ein Zwischenergebnis.
(4) [P]
----
  <_ <Einwand>: Der Schluss überzeugt nicht.
(5) [A]

## Unterabschnitt #unterthema {isGroup: true}

* [L1]: Ein Listenpunkt.
* [L2]: Ein weiterer Listenpunkt.

1. [O1]: Geordnet.
2. [O2]: Auch geordnet.

// Ein Zeilenkommentar.
/* Ein Blockkommentar. */
<!-- Ein HTML-Kommentar. -->
`;
describe('Coverage of the official Argdown syntax families', () => {
 it('processes definitions, references, equivalence classes and inline mentions independently', () => {
  const model = engine.parse(syntax); expect(model.response.statements?.A?.members.filter(m => m.text).length).toBe(2);
  expect(model.response.statements?.B?.members[0]?.text).toContain('A'); expect(model.nodes.map(nodeKey)).toContain('a:Grund');
  expect((model.response.statements?.A?.members[0]?.data as {custom?: unknown} | undefined)?.custom).toEqual({rating: 3});
 });
 it('processes ordered and unordered statement lists as source structure', () => {
  const model = engine.parse(syntax); for (const title of ['L1', 'L2', 'O1', 'O2']) expect(model.response.statements?.[title]?.members[0]?.text).toBeTruthy();
 });
 it('round trips multi-stage inference rules, metadata, references and inference undercuts unchanged', () => {
  const model = engine.parse(syntax), reconstruction = readReconstruction(model, 'a:Grund');
  expect(reconstruction.steps).toHaveLength(5); expect(reconstruction.steps.filter(s => s.conclusion)).toHaveLength(2);
  expect(writeReconstruction(engine, model, 'a:Grund', reconstruction.steps)).toBe(syntax);
 });
 it('retains unrelated comments, formatting, links, tags, metadata and logic when editing a caption', () => {
  const model = engine.parse(syntax), changed = editNode(engine, model, 's:L1', 'Überarbeiteter Listenpunkt.'), next = engine.parse(changed);
  expect(changed).toBe(syntax.replace('Ein Listenpunkt.', 'Überarbeiteter Listenpunkt.'));
  expect(next.response.relations?.map(r => r.relationType)).toEqual(model.response.relations?.map(r => r.relationType));
 });
 it('retains custom YAML data when editing a color', () => {
  const changed = nodeColor(engine, engine.parse(syntax), 's:A', '#00ff00'); expect((engine.parse(changed).response.statements?.A?.members[0]?.data as {custom?: unknown} | undefined)?.custom).toEqual({rating: 3}); expect(changed).toContain('<!-- Ein HTML-Kommentar. -->');
 });
 it('uses native lexer tokens for references, operators, markup, metadata, headings and inferences', () => {
  const tokens = engine.tokens(syntax), classes = new Set(tokens.map(t => t.className));
  for (const cls of ['syn-variable', 'syn-operator', 'syn-keyword', 'syn-string', 'syn-number', 'syn-function']) expect(classes.has(cls)).toBe(true);
  expect(tokens.every(t => t.from >= 0 && t.to <= syntax.length && t.from < t.to)).toBe(true);
 });
});
