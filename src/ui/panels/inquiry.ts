import {renderIdeaContext} from './field-ideas';
import {renderResearchExamples} from './research-examples';
import {synopsisFields} from '../../graph/synopsis';
import {renderWebSearchOption,renderWebSearchContext,webSearchRequest} from '../web-search';
import type {ResearchKind} from '../../llm/research-examples';
import {button, input, select} from '../helpers';
import {emptyState, title, inquiryStateForNote, type PanelContext} from '../panel';
import {renderWikipediaOption, renderWikipediaContext, wikipediaRequest} from '../wikipedia';
export const inquiryModes: Record<string, string> = {none: 'Ohne Notizkontext', selection: 'Nur Markierung', note: 'Aktuelle Notiz', relations: 'Notiz und Beziehungen', notes: 'Ausgewählte Notizen', subgraph: 'Ausgewählter Teilgraph'};
export function renderInquiry(ctx: PanelContext): void {
 const {host, controller:c}=ctx,s=inquiryStateForNote(ctx.state,c.activePath);
 title(host, 'Recherche');
 s.kind??='examples';if(s.kind!=='free')renderIdeaContext(host,c.activePath);s.field??=synopsisFields(c.graph.snapshot,c.settings()).examples[0]??'';
 const form = host.createDiv({cls: 'em-inquiry-form'});
 select(form, 'Vorlage', {'': 'Eigene Frage', ...Object.fromEntries(c.settings().inquiryTemplates.map((t, i) => [String(i), t.name]))}, s.template, id => {
  s.template = id; const t = c.settings().inquiryTemplates[Number(id)]; if (id !== '' && t) {s.kind=t.name==='Kunstwerke'?'artworks':t.name==='Beispiele'?'examples':'free';s.webGoal=s.kind==='artworks'?'artworks':s.kind==='examples'?'examples':'general';s.prompt = t.prompt; textarea.value = s.prompt; send.disabled = !!c.abort || c.applyingIdea || !s.prompt.trim();ctx.repaint();}
 });
 select(form,'Ergebnis',{examples:'Konkrete Beispiele',artworks:'Kunstwerke – alle Gattungen',free:'Freie Textantwort'},s.kind,value=>{s.kind=value as ResearchKind;s.webGoal=s.kind==='free'?'general':s.kind;ctx.repaint();});
 if(s.kind!=='free')select(form,'Frontmatter-Feld',{'':'Feld auswählen',...Object.fromEntries(c.graph.snapshot.fields.map(f=>[f,f]))},s.field??'',field=>{s.field=field;});
 const textarea = input(form, 'Deine Frage', s.prompt, value => {s.prompt = value; send.disabled = !!c.abort || c.applyingIdea || !value.trim();}, true) as HTMLTextAreaElement;
 textarea.rows = 3; textarea.placeholder = 'Was möchtest du zu deiner Notiz herausfinden?';
 const context = form.createDiv();
 select(context, 'Kontext für diese Anfrage', inquiryModes, s.mode, value => {s.mode = value; renderContext();});
 const contextDetails = context.createDiv();
 const renderContext = () => {
  contextDetails.empty();
  if (s.mode === 'notes' || s.mode === 'subgraph') input(contextDetails, 'Weitere Notizen (ein Vaultpfad pro Zeile)', s.extra, value => {s.extra = value;}, true);
  contextDetails.createDiv({cls: 'em-muted em-caption', text: s.mode === 'none' ? s.kind==='free'?'Kein zusätzlicher Notizkontext.':'Begriffstitel ohne zusätzlichen Notiztext.' : s.mode === 'selection' ? 'Die Markierung in der Hauptnotiz wird beim Senden gelesen.' : s.mode === 'notes' ? 'Nur die hier ausgewählten Notizen werden verwendet.' : `Bezug: ${c.activePath || 'Bitte zuerst eine Notiz öffnen.'}`});
 }; renderContext();
 renderWebSearchOption(form,s,c.activePath,!!c.abort,()=>ctx.repaint());
 renderWikipediaOption(form,s,c.activePath,!!c.abort,()=>ctx.repaint());
 const actions = form.createDiv({cls: 'em-actions'});
 const submit = () => {void ctx.run(() => c.inquire(s.prompt, s.mode, s.extra.split('\n').map(v => v.trim()).filter(Boolean),wikipediaRequest(s,c.activePath),false,{kind:s.kind,field:s.field,webSearch:webSearchRequest(s,c.activePath)}));};
 const send = button(actions, c.abort ? 'Recherche läuft …' : 'Frage senden', submit, !!c.abort || c.applyingIdea || !s.prompt.trim()); send.addClass('mod-cta'); send.title = 'Strg/⌘ + Enter';
 if (c.abort) button(actions, 'Abbrechen', () => c.cancel());
 textarea.onkeydown = event => {if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !send.disabled) {event.preventDefault(); submit();}};
 if(c.abort)host.createDiv({text:c.status,cls:'em-muted em-caption',attr:{role:'status','aria-live':'polite'}});
 host.createDiv({text: `Lokal · ${c.settings().model}${s.wikipedia?' · mit Wikipedia-Abfrage':' · ohne neue Wikipedia-Abfrage'}`, cls: 'em-muted em-caption'});
 const entry=c.currentResearch;
 if(!entry){if(!c.abort)emptyState(host,'messages-square','Deine Recherche','Ein neues Ergebnis ersetzt das bisherige Ergebnis dieser Notiz.');return;}
 title(host,'Ergebnis');const answer=host.createDiv({cls:'em-inquiry-result'});answer.createDiv({text:entry.prompt,cls:'em-muted em-caption'});
 const index=c.inquiryHistory.indexOf(entry);
 if(entry.examples)renderResearchExamples(answer,index,ctx);else answer.createDiv({text:entry.answer,cls:'em-answer'});
 if(entry.truncated){answer.createDiv({text:'Ausgabelimit erreicht.',cls:'em-muted em-caption',attr:{role:'status'}});button(answer,'Antwort fortsetzen',()=>{void ctx.run(()=>c.continueInquiry(index));},!!c.abort);}
 renderWebSearchContext(answer,entry.webSearch,'inquiry-web-current');renderWikipediaContext(answer,entry.wikipedia,'inquiry-wikipedia-current');
}
