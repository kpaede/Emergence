import {writeFileSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {evaluate} from './obsidian-cli.mjs';

/** Render a separate synthetic graph. Every action is a recording callback, never a vault write. */
async function check(out) {
 const view = app.workspace.getLeavesOfType('emergence-workspace')[0]?.view, c = app.plugins.plugins.emergence.controller;
 if (!view?.graphPanel?.semantic || c.abort || c.applyingIdea) throw Error('Keine freie Graph-Testumgebung.');
 const settingsBefore = JSON.stringify(c.settings()), analysisBefore = JSON.stringify(c.review.analysis);
 const settings = JSON.parse(settingsBefore);
 settings.synopsis = {fields: {broader: ['Überbau'], narrower: ['Unterbau'], similar: ['Ähnlichkeit'], friction: ['Reibung'], examples: ['Beispiel']}, depths: {broader: 1, narrower: 1, similar: 1, friction: 1, examples: 1}};
 const titles = ['Quelle', 'Oberbegriff', 'Unterbegriff mit einem langen Titel', 'Verwandter Begriff mit vielen Wörtern', 'Kontrast'];
 const edge = (target, field) => ({id: target + field, source: 'Quelle.md', target: target + '.md', field, explicit: true, layer: 'breadcrumbs', provenance: 'synthetic', occurrences: []});
 const graph = {version: 1, builtAt: 1, nodes: titles.map(title => ({id: title + '.md', title, aliases: [], tags: [], type: 'md', exists: true, mtime: 1, size: 1})),
  edges: [edge(titles[1], 'Überbau'), edge(titles[2], 'Unterbau'), edge(titles[3], 'Ähnlichkeit'), edge(titles[4], 'Reibung')],
  fields: ['Überbau', 'Unterbau', 'Ähnlichkeit', 'Reibung', 'Beispiel', 'Konzept', 'Komponist_in', 'Autor_in', 'Künstler_in', 'Regisseur_in', 'Librettist_in', 'Werk'], rules: {}, groups: [], partial: false, diagnostics: [], unresolved: [], breadcrumbsVersion: 'synthetic'};
 const focused = document.activeElement;
 const root = document.body.createDiv({cls: 'em-workspace'}), moves = [], additions = [], report = {widths: [], notesWritten: 0, modelCalls: 0};
 root.style.cssText = 'position:fixed;left:10px;top:10px;width:280px;height:660px;z-index:100000;background:var(--background-primary);';
 const canvas = root.createDiv({cls: 'em-graph em-synopsis-canvas'}); canvas.style.cssText = 'position:relative;flex:1;min-height:0;';
 const host = canvas.createDiv(), Semantic = view.graphPanel.semantic.constructor;
 const synopsis = new Semantic(host, () => settings, () => {}, {activate: () => {}, inspect: () => {}}, (...args) => additions.push(args), () => {}, {ready: () => true, move: (...args) => moves.push(args)});
 const assert = (name, value) => {if (!value) throw Error(name);};
 const wait = () => new Promise(resolve => window.setTimeout(resolve, 80));
 try {
  synopsis.render(graph, 'Quelle.md'); await wait();
  for (const width of [280, 360, 480]) {
   root.style.width = width + 'px'; synopsis.refresh(); await wait(); synopsis.geometry.draw();
   assert('Kein horizontaler Überlauf bei ' + width + ': ' + JSON.stringify({client:host.clientWidth,scroll:host.scrollWidth,overflow:[...host.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().right>host.getBoundingClientRect().right+1).slice(0,12).map(el=>({cls:el.className,x:el.getBoundingClientRect().x,w:el.getBoundingClientRect().width,box:getComputedStyle(el).boxSizing}))}), host.scrollWidth <= host.clientWidth + 1);
   for (const label of host.querySelectorAll('.em-syn-term')) assert('Begriff passt in die Zeile bei ' + width, label.scrollWidth <= label.clientWidth + 1);
   const plus = host.querySelector('[data-syn-add=broader]'), title = plus.parentElement.querySelector('h3');
   assert('Plus direkt am Titel', plus.parentElement.classList.contains('em-syn-title') && plus.getBoundingClientRect().left - title.getBoundingClientRect().right <= 4);
   synopsis.geometry.draw();
   for (const kind of ['broader', 'narrower', 'similar', 'friction']) assert('SVG-Verbindung: ' + kind, synopsis.geometry.last.endpoints.some(e => e.kind === kind));
   report.widths.push({width, overflow: false});
  }
  const link = host.querySelector('.em-syn-similar a'), term = link.closest('.em-syn-term');
  assert('Keine Plus-Aktionen an einzelnen Begriffen', !host.querySelector('.em-syn-term-add'));
  host.querySelector('[data-syn-add=similar]').click(); assert('Plus ergänzt ausschließlich an der zentralen Notiz', additions[0]?.[0] === 'similar' && additions[0]?.[1] === 'Quelle.md');
  const handle = term.querySelector('.em-term-handle'), destination = host.querySelector('.em-syn-friction'), transfer = new DataTransfer();
  handle.dispatchEvent(new DragEvent('dragstart', {bubbles: true, cancelable: true, dataTransfer: transfer}));
  const over = new DragEvent('dragover', {bubbles: true, cancelable: true, dataTransfer: transfer}); destination.dispatchEvent(over);
  assert('Ablageziel nimmt Begriff an', over.defaultPrevented);
  destination.dispatchEvent(new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer: transfer}));
  handle.dispatchEvent(new DragEvent('dragend', {bubbles: true, dataTransfer: transfer}));
  assert('Verschieben nutzt das tatsächliche Zielfeld', moves.length === 1 && moves[0][4] === 'Reibung' && moves[0][2] === titles[3] + '.md');
  assert('Keine Werk-Felder bei einer Begriffsnotiz', !host.querySelector('[data-syn-field="Konzept"]'));
  assert('Keine leeren sonstigen Felder', !host.querySelector('[data-syn-field="Werk"]'));
  assert('Keine Tooltips an Begriffen und Griffen', !host.querySelector('a[title],a[aria-label],.em-term-handle[title],.em-term-handle[aria-label]'));
  const lines = host.querySelector('.em-syn-edges').innerHTML;
  handle.focus(); assert('Linie hinter sichtbarem Griff verdeckt', getComputedStyle(handle).opacity === '1' && getComputedStyle(handle).backgroundColor === getComputedStyle(host).backgroundColor);
  handle.dispatchEvent(new MouseEvent('mouseover', {bubbles: true})); await wait();
  assert('SVG-Linien beim Einblenden unverändert', lines === host.querySelector('.em-syn-edges').innerHTML);
  handle.blur(); assert('Griff ohne Hover unsichtbar', getComputedStyle(handle).opacity === '0');
  graph.nodes[0].tags = ['#Werk/Film']; graph.version++; synopsis.render(graph, 'Quelle.md'); await wait();
  for (const field of ['Konzept', 'Komponist_in', 'Autor_in', 'Künstler_in', 'Regisseur_in', 'Librettist_in']) assert('Werk-Feld verfügbar: ' + field, !!host.querySelector('[data-syn-field="' + field + '"].em-term-drop'));
  assert('Benutzereinstellungen unverändert', settingsBefore === JSON.stringify(c.settings()));
  assert('Benutzeranalyse unverändert', analysisBefore === JSON.stringify(c.review.analysis));
  root.style.width = '360px'; synopsis.refresh(); await wait();
  const w = require('@electron/remote').getCurrentWindow(), rect = root.getBoundingClientRect();
  const background = w.webContents.getBackgroundThrottling();
  try {
   w.webContents.setBackgroundThrottling(false); w.webContents.invalidate(); await wait();
   const shot = await w.capturePage({x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height)});
   require('fs').writeFileSync(out + '/graph.png', shot.toPNG());
  } finally {w.webContents.setBackgroundThrottling(background);}
  return {...report, dragAndDrop: true, centralNotePlus: true, workTagScope: true, handleMasksLine: true, noTermTooltips: true, screenshot: out + '/graph.png'};
 } finally {synopsis.destroy(); root.remove(); if(focused?.isConnected)focused.focus({preventScroll:true});}
}

const out = mkdtempSync(join(tmpdir(), 'emergence-term-ui-'));
evaluate(`(()=>{window.__emTermCheck={done:false};(${check.toString()})(${JSON.stringify(out)}).then(report=>window.__emTermCheck={done:true,report}).catch(e=>window.__emTermCheck={done:true,failure:e.stack});return true;})()`);
let result;
for (let i = 0; i < 100; i++) {result = evaluate('window.__emTermCheck'); if (result.done) break; await new Promise(resolve => setTimeout(resolve, 100));}
evaluate('delete window.__emTermCheck');
if (!result?.done || result.failure) throw Error(JSON.stringify(result));
writeFileSync(out + '/report.json', JSON.stringify(result.report, null, 2) + '\n');
console.log(JSON.stringify(result.report, null, 2));
