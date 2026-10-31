import type {GraphSnapshot} from '../src/types';
import {unknownRule} from '../src/config';
/** Synthetic illustration only; never written to the user's vault. */
export function synopsisFixture():GraphSnapshot{
 const fields=['Überbau','Unterbau','Ähnlichkeit','Reibung','Beispiel','Literatur'];
 const graph:GraphSnapshot={version:700,builtAt:0,nodes:[],edges:[],fields,groups:[],rules:Object.fromEntries(fields.map(f=>[f,unknownRule(f)])),partial:false,diagnostics:[],unresolved:[],breadcrumbsVersion:'synthetische Prüfdaten',
  inferenceRules:[{chain:['Ähnlichkeit'],field:'Ähnlichkeit',reversed:true,rounds:10},{chain:['Reibung'],field:'Reibung',reversed:true,rounds:10}]};
 const missing=new Set(['Geisteswissenschaften','Texttheorie','Theorie']);
 const note=(title:string)=>{const id=title+'.md';if(!graph.nodes.some(n=>n.id===id))graph.nodes.push({id,title,aliases:[],tags:[],type:'md',exists:!missing.has(title),mtime:0,size:0});return id;};
 const add=(source:string,target:string,field:string,layer:'breadcrumbs'|'obsidian'|'zotlit'='breadcrumbs')=>{const a=note(source),b=note(target);graph.edges.push({id:JSON.stringify([a,b,field]),source:a,target:b,field,layer,explicit:true,provenance:'synthetic test only',occurrences:[]});};
 note('Dekonstruktion');
 for(const parent of ['Ästhetik','Sprachphilosophie','Literaturtheorie','Texttheorie'])add('Dekonstruktion',parent,'Überbau');
 for(const [a,b]of [['Ästhetik','Philosophie'],['Sprachphilosophie','Philosophie'],['Literaturtheorie','Literaturwissenschaft'],['Texttheorie','Kulturwissenschaften'],['Philosophie','Wissenschaft'],['Literaturwissenschaft','Geisteswissenschaften'],['Kulturwissenschaften','Wissenschaft'],['Wissenschaft','Theorie']])add(a!,b!,'Überbau');
 const children=['Différance','Logozentrismuskritik','Präsenzkritik','Spur','Supplement','Iterabilität','Aporie','Dekonstruktive Lektüre','Schriftkritik','Parergon','Dissemination','Kontextkritik'];
 for(const child of children)add('Dekonstruktion',child,'Unterbau');
 for(const title of ['Strukturalismus','Poststrukturalismus','Intertextualität','Semiotik','Diskursanalyse','Genealogie','Sprachkritik','Kritische Lektüre'])add('Dekonstruktion',title,'Ähnlichkeit');
 for(const title of ['Hermeneutik','Intentionalismus','Essentialismus','Präsenzmetaphysik','Autorintention','Letztbegründung'])add('Dekonstruktion',title,'Reibung');
 for(const title of ['Duchamp – Fountain','Levine – After Walker Evans','Magritte – La trahison des images','Kruger – Untitled'])add('Dekonstruktion',title,'Beispiel');
 const literature=['Derrida – De la grammatologie','Culler – On Deconstruction','Gasché – The Tain of the Mirror','Derrida – Die Schrift und die Differenz'];
 for(let i=0;i<48;i++)add('Dekonstruktion',literature[i]??`Literaturnotiz ${String(i+1).padStart(2,'0')} – sehr langer Titel zur philosophischen Begriffsarbeit`,'zitiert','zotlit');
 const links=['Zeichen','Schrift','Kontext','Autorschaft','Textualität','Notiz mit Unicode: ἀλήθεια, 漢字, 👩🏽‍🔬 und außergewöhnlich langem, umbrechendem Namen'];
 for(let i=0;i<74;i++)add('Dekonstruktion',links[i]??`Freier Verweis ${String(i+1).padStart(2,'0')} zur Erkenntnis- und Sprachphilosophie`,'','obsidian');
 add('Différance','Aufschub','Unterbau');add('Strukturalismus','Strukturalistische Linguistik','Ähnlichkeit');add('Hermeneutik','Auslegung','Reibung');add('Duchamp – Fountain','Readymade','Beispiel');add(literature[0]!,'Weiterführende Literatur','zitiert','zotlit');add('Zeichen','Signifikant','','obsidian');
 return graph;
}
