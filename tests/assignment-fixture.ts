import {defaults, unknownRule} from '../src/config';
import {graph, profile} from './fixtures';
import type {Concept} from '../src/types';
import type {AssignmentOptions} from '../src/llm/assignment-context';

// Synthetic concept corpus. No user note content or titles are loaded by these tests.
export function musicalConceptFixture() {
 const descriptions: Record<string, string> = {
  Überbau: 'Übergeordneter Begriff, Fachgebiet oder fachlicher Bezugsrahmen. Ontologie → Philosophie. Bloß erwähnte Namen genügen nicht.',
  Unterbau: 'Unterbegriff, Teilgebiet oder spezifische Ausprägung. Gegenrichtung zu Überbau: Das Ziel ist enger, nicht übergeordnet.',
  Reibung: 'Belegte Gegenposition zu einer konkreten Aussage der Ausgangsnotiz. Ein anderes Thema genügt nicht.',
  Ähnlichkeit: 'Anderer Begriff mit vergleichbarer Bedeutung, Funktion oder Struktur. Gemeinsame Wörter allein genügen nicht.',
  Beispiel: 'Konkreter, belegter Anwendungsfall oder ein Werk, das den Begriff veranschaulicht. Keine erfundenen Fälle oder Szenen.',
  Konzept: 'Fachlicher Begriff, der den Inhalt eines Werks oder Beispiels erklärt. Ziel ist ein Konzept, keine Person und kein Werk.',
  Komponist_in: 'Nur bei musikalischen Werken: Person, die die Musik dieses Werks komponiert hat. Nicht für Konzepte oder erwähnte Komponisten.',
  Autor_in: 'Nur bei Texten oder literarischen Werken: deren tatsächliche Verfasserin oder Verfasser. Keine erwähnte Person.',
  Künstler_in: 'Nur bei Kunstwerken: Person, die das konkrete Werk geschaffen hat. Kein Urheberfeld für abstrakte Konzepte.',
  Regisseur_in: 'Nur bei Filmen oder konkreten Inszenierungen: Person, die dort Regie geführt hat. Nicht bei abstrakten Konzepten.',
  Werk: 'Konkretes zugehöriges Werk: bei Personen ein eigenes Werk; bei Konzepten nur ein belegter Anwendungsfall. Keine beliebigen thematisch ähnlichen Werke.',
 };
 const fields = ['Überbau', 'Unterbau', 'Reibung', 'Ähnlichkeit', 'Beispiel'];
 const g = graph(); g.fields = Object.keys(descriptions); g.edges = [];
 g.rules = Object.fromEntries(Object.entries(descriptions).map(([field, description]) => [field, {...unknownRule(field), description, provenance: 'user' as const, writable: true, targetProperty: field,
  ...(field === 'Überbau' ? {inverse: 'Unterbau'} : field === 'Unterbau' ? {inverse: 'Überbau'} : {})}]));
 g.groups = [{label: 'Hierarchie', fields: ['Überbau', 'Unterbau']}, {label: 'Bezug', fields: ['Reibung', 'Ähnlichkeit', 'Beispiel']}];
 g.inferenceRules = [{chain: ['Überbau'], field: 'Unterbau', reversed: true, rounds: 1}, {chain: ['Überbau', 'Überbau'], field: 'Überbau', reversed: false, rounds: 3}];
 const titles = ['Tetrade', 'Prima la musica e poi le parole', 'Das kurze Leben', 'Verdi, Giuseppe', 'Kontrapunkt', 'Motiv', 'Klangfarbe', 'Rhythmus', 'Sprechakt', 'Narration'];
 while (titles.length < 58) titles.push(`Testbegriff ${titles.length + 1}`);
 const node = (title: string): Concept => ({id: title + '.md', title, aliases: [], tags: [], type: 'md', exists: true, mtime: 1, size: 1, properties: fields});
 g.nodes = [node('Parola scenica'), ...titles.map(node)];
 const content = '---\n' + fields.map(field => field + ':').join('\n') + '\n---\n# Parola scenica\n\n' +
  'Parola scenica bezeichnet einen dramatischen Sprachstil: Eine kurze prägnante Wendung wird musikalisch so hervorgehoben, dass sie eine dramatische Situation auf den Punkt bringt. ' +
  'Das gesungene Wort steht dabei im Dienst des dramatischen Ausdrucks. Der Sprachgestus verbindet musikalische Form und szenische Wirkung. ' +
  'Die Entwicklung zielt auf einen neuen Realismus und verändert das Verhältnis von Text und belcantistischem Gesang.\n\n' +
  '## [[Tetrade]]\n- ENHANCES ➜\n- [ ]\n(gloss):\n';
 const settings = defaults(), p = profile(); p.maxTokens = 512; p.temperature = 0;
 p.instructions = 'Die Ausgangsnotiz ist ein fachlicher Begriff. Priorisiere die breiten Fachgebiete und Gattungen, in denen der Begriff verwendet wird. Mehrere Ziele im gleichen Feld sind möglich; liefere keine Pflichtantwort pro Feld. Beispiele und Gegenpositionen nur bei ausdrücklichem Textbeleg, nicht aus einem allgemeinen Themenbezug oder einer historischen Entwicklung. Neue etablierte Oberbegriffe sind erlaubt, wenn der Katalog keine geeigneten enthält.';
 p.outputs[0]!.allowedEdgeTypes = fields; p.outputs[0]!.maxSuggestions = 4;
 const options: AssignmentOptions = {fields: [...g.fields], folders: [], allowNew: true, maxSuggestions: 4, outputId: 'relations', targetProperties: fields};
 return {g, content, settings, p, options, fields};
}
