import {t as tr} from '../i18n';
import {ArgdownApplication, IArgument, IEquivalenceClass, ParserPlugin, DataPlugin, ModelPlugin, ExplodeArgumentsPlugin, RegroupPlugin, PreselectionPlugin, StatementSelectionPlugin, ArgumentSelectionPlugin, MapPlugin, GroupPlugin, ClosedGroupPlugin, ColorPlugin, SyncDotToSvgExportPlugin, type IArgdownRequest} from '@argdown/core';
import {Graphviz} from '@hpcc-js/wasm-graphviz';
import type {CodeToken} from '../mermaid/code-editor';

import {derivationPlugin, DerivationDotPlugin, derivationSelectionPlugin} from './derivation';
import {derivationBoundaries} from './derivation-map';
import {flatNodes, rulesOf, type ArgdownModel} from './model';
let graphviz: Promise<Graphviz> | undefined;
/** All parsing, inference interpretation, grouping and layout use the official processor. */
export class ArgdownEngine {
 private app = new ArgdownApplication(); private svgReady = false; private lastTokens?: {source: string; tokens: CodeToken[]};
 constructor() {
  this.app.addPlugin(new ParserPlugin(), 'tokens');
  this.app.addPlugin(new ParserPlugin(), 'parse');
  for (const plugin of [new DataPlugin(), new ModelPlugin()]) this.app.addPlugin(plugin, 'model');
  this.app.addPlugin(new ExplodeArgumentsPlugin(), 'explode'); this.app.addPlugin(new RegroupPlugin(), 'regroup');
  for (const plugin of [new PreselectionPlugin(), new StatementSelectionPlugin({excludeDisconnected: false}), new ArgumentSelectionPlugin({excludeDisconnected: false}), new MapPlugin(), new GroupPlugin()]) this.app.addPlugin(plugin, 'map');
  this.app.addPlugin(new PreselectionPlugin(), 'preselect'); this.app.addPlugin(derivationSelectionPlugin, 'project-selection');
  for (const plugin of [new StatementSelectionPlugin({excludeDisconnected: false}), new ArgumentSelectionPlugin({excludeDisconnected: false}), new MapPlugin(), new GroupPlugin()]) this.app.addPlugin(plugin, 'project-map');
  for (const plugin of [new StatementSelectionPlugin({excludeDisconnected: false}), new ArgumentSelectionPlugin({excludeDisconnected: false}), new MapPlugin()]) this.app.addPlugin(plugin, 'focus-map');
  this.app.addPlugin(derivationBoundaries, 'boundaries');
  this.app.addPlugin(new ClosedGroupPlugin(), 'closed'); this.app.addPlugin(new ColorPlugin(), 'color'); this.app.addPlugin(new DerivationDotPlugin({mapBgColor: 'transparent'}), 'dot');
 }
 parse(source: string, native = false): ArgdownModel {
  const request: IArgdownRequest = {input: source, process: ['parse', 'model', ...(native ? ['explode'] : []), 'regroup', 'map', 'closed', 'color', 'dot'], logLevel: 'error', throwExceptions: true}, response = this.app.run(request);
  const error = response.lexerErrors?.[0] ?? response.parserErrors?.[0];
  if (error) throw new Error('Argdown: ' + error.message);
  if (response.exceptions?.length) throw new Error(response.exceptions[0]?.message ?? tr("labels.argdown_processing_failed"));
  const canonical = new Map([...Object.entries(response.statements ?? {}).map(([title, value]) => ['s:' + title, IEquivalenceClass.getCanonicalMember(value)] as const), ...Object.entries(response.arguments ?? {}).map(([title, value]) => ['a:' + title, IArgument.getCanonicalMember(value)] as const)]);
  return {canonical, request, response, nodes: flatNodes(response.map?.nodes ?? []), edges: response.map?.edges ?? [], rules: rulesOf(response.ast), source};
 }
 project(source: string, focus?: string): ArgdownModel {
  const base = this.parse(source), plugin = derivationPlugin(base, focus); this.app.addPlugin(plugin, 'projection');
  try {
   const request: IArgdownRequest = {input: source, process: ['parse', 'model', 'preselect', 'projection', 'regroup', 'preselect', 'project-selection', focus ? 'focus-map' : 'project-map', 'closed', 'boundaries', 'color', 'dot'], logLevel: 'error', throwExceptions: true};
   const response = this.app.run(request);
   if (response.exceptions?.length) throw new Error(response.exceptions[0]?.message ?? tr("labels.argdown_processing_failed"));
   return {source, request, response, canonical: base.canonical, nodes: flatNodes(response.map?.nodes ?? []), edges: response.map?.edges ?? [], rules: base.rules};
  } finally {this.app.removePlugin(plugin, 'projection');}
 }
 async svg(model: ArgdownModel): Promise<string> {
  if (!this.svgReady) {graphviz ??= Graphviz.load().catch((error: unknown) => {graphviz = undefined; throw error;}); this.app.addPlugin(new SyncDotToSvgExportPlugin(await graphviz), 'svg'); this.svgReady = true;}
  const response = this.app.run({...model.request, process: ['svg'], logLevel: 'error', throwExceptions: true}, model.response);
  if (!response.svg) throw new Error(tr("labels.argdown_could_not_generate_a_diagram"));
  return response.svg;
 }
 tokens(source: string): CodeToken[] {
  if (this.lastTokens?.source === source) return this.lastTokens.tokens;
  // The parser's real token stream also recognizes multiline data, inferences and inline markup.
  const response = this.app.run({input: source, process: ['tokens'], logLevel: 'error'}), result: CodeToken[] = [];
  for (const token of response.tokens ?? []) {
   if (!token.image || token.endOffset === undefined) continue;
   const name = token.tokenType.name;
   const category = /Comment/u.test(name) ? 'comment' : /Definition|Reference|Mention/u.test(name) ? 'variable' : /Support|Attack|Undercut|Contradiction|Contradictory|Contrary/u.test(name) ? 'operator' : /Heading/u.test(name) ? 'keyword' : /Data|FrontMatter/u.test(name) ? 'string' : /Inference|StatementNumber/u.test(name) ? 'number' : /Bold/u.test(name) ? 'keyword' : /Italic/u.test(name) ? 'string' : /Link|Tag|Url/u.test(name) ? 'function' : undefined;
   if (category) result.push({from: token.startOffset, to: token.endOffset + 1, className: 'syn-' + category});
  }
  this.lastTokens = {source, tokens: result}; return result;
 }
}
