import {defaults, unknownRule} from '../src/config';
import {graph} from './fixtures';
import {musicalConceptFixture} from './assignment-fixture';
import type {AnalysisResult, Concept} from '../src/types';

const node = (title: string): Concept => ({id: title + '.md', title, aliases: [], tags: [], type: 'md', exists: true, mtime: 1, size: 1});
export function comparisonCases() {
 const cases = [];
 for (const exists of [true, false]) {
  const f = musicalConceptFixture(); f.g.edges = []; f.g.groups = []; f.g.inferenceRules = [];
  f.g.nodes = [node('Ontologie'), node('Sprachwissenschaft'), ...(exists ? [node('Philosophie')] : [])];
  f.content = '---\nÜberbau:\n---\n# Ontologie\nOntologie ist eine philosophische Disziplin, die das Sein, die Existenz und die grundlegenden Kategorien des Seienden untersucht.';
  f.options.fields = ['Überbau']; f.options.targetProperties = []; f.p.instructions = '';
  cases.push({id: exists ? 'ontology-existing' : 'ontology-new', source: 'Ontologie.md', fixture: f,
   required: (s: AnalysisResult['suggestions'][number]) => s.field === 'Überbau' && s.target === 'Philosophie.md',
   forbidden: (s: AnalysisResult['suggestions'][number]) => s.target === 'Sprachwissenschaft.md'});
 }
 for (const grounded of [false, true]) {
  const f = musicalConceptFixture();
  if (grounded) f.content = f.content.replace('Parola scenica bezeichnet', 'In der Oper bezeichnet Parola scenica');
  cases.push({id: grounded ? 'musical-grounded' : 'musical-sparse', source: 'Parola scenica.md', fixture: f,
   required: (s: AnalysisResult['suggestions'][number]) => s.field === 'Überbau' && /^(Oper|Musiktheater|Verismo|Romantische Oper)\.md$/u.test(s.target),
   forbidden: (s: AnalysisResult['suggestions'][number]) => /Tetrade|Verdi|Prima la musica|Das kurze Leben/u.test(s.target) || (s.field === 'Unterbau' && /Recitativo|Belcanto|Oper/u.test(s.target))});
 }
 {
  const f = musicalConceptFixture(); f.p.outputs[0]!.allowedEdgeTypes = []; f.g.edges = []; f.g.nodes = [node('Rigoletto'), {...node('Verdi, Giuseppe'), aliases: ['Giuseppe Verdi']}, node('Philosophie')];
  f.content = '---\nKomponist_in:\n---\n# Rigoletto\nRigoletto ist eine Oper von Giuseppe Verdi.';
  f.options.targetProperties = []; f.p.instructions = '';
  cases.push({id: 'work-all-eleven-fields', source: 'Rigoletto.md', fixture: f,
   required: (s: AnalysisResult['suggestions'][number]) => s.field === 'Komponist_in' && s.target === 'Verdi, Giuseppe.md',
   forbidden: (s: AnalysisResult['suggestions'][number]) => s.target === 'Philosophie.md' || (s.target === 'Verdi, Giuseppe.md' && s.field !== 'Komponist_in')});
 }
 {
  const f = musicalConceptFixture(); f.g = graph(); f.g.fields = ['gehört_zu', 'umfasst']; f.g.groups = []; f.g.edges = [];
  f.g.rules = Object.fromEntries(f.g.fields.map(field => [field, {...unknownRule(field), description: field === 'gehört_zu' ? 'Das Fachgebiet, zu dem die Ausgangsnotiz gehört. Das Ziel ist der weitere Rahmen.' : 'Ein im Text genannter Teilbereich der Ausgangsnotiz. Das Ziel ist enger.', writable: true, provenance: 'user' as const, targetProperty: field}]));
  f.g.nodes = [node('Photosynthese'), node('Pflanzenphysiologie'), node('Oper')];
  f.content = '---\ngehört_zu:\numfasst:\n---\n# Photosynthese\nPhotosynthese ist ein Forschungsgegenstand der Pflanzenphysiologie. Der Text benennt keine Teilbereiche.';
  f.options.fields = [...f.g.fields]; f.options.targetProperties = []; f.p.outputs[0]!.allowedEdgeTypes = []; f.p.instructions = '';
  cases.push({id: 'custom-field-names', source: 'Photosynthese.md', fixture: f,
   required: (s: AnalysisResult['suggestions'][number]) => s.field === 'gehört_zu' && s.target === 'Pflanzenphysiologie.md',
   forbidden: (s: AnalysisResult['suggestions'][number]) => s.field === 'umfasst' || s.target === 'Oper.md'});
 }
 return cases;
}

// Every judgement is grounded in explicit synthetic text; no obscure factual recall is required.
export const pairCases = [
 {id: 'P1', source: 'Ontologie', text: 'Ontologie ist ein Teilgebiet der Philosophie.', target: 'Philosophie', field: 'Überbau', meaning: 'Übergeordneter Begriff oder das Fachgebiet, zu dem die Quelle gehört.', expected: true},
 {id: 'P2', source: 'Ontologie', text: 'Ontologie ist ein Teilgebiet der Philosophie.', target: 'Philosophie', field: 'Unterbau', meaning: 'Ein Unterbegriff oder Teilgebiet der Quelle. Das Ziel muss enger sein als die Quelle.', expected: false},
 {id: 'P3', source: 'Parola scenica', text: 'Parola scenica ist eine Ausdruckstechnik der Oper. Verdi verwendete sie.', target: 'Oper', field: 'Überbau', meaning: 'Das übergeordnete Fachgebiet oder die Gattung, in der der Begriff verwendet wird.', expected: true},
 {id: 'P4', source: 'Parola scenica', text: 'Parola scenica ist eine Ausdruckstechnik der Oper. Verdi verwendete sie.', target: 'Oper', field: 'Unterbau', meaning: 'Eine spezielle Ausprägung des Ausgangsbegriffs. Das Ziel muss enger sein.', expected: false},
 {id: 'P5', source: 'Parola scenica', text: 'Parola scenica ist eine Ausdruckstechnik der Oper. Verdi verwendete sie.', target: 'Verdi, Giuseppe', field: 'Komponist_in', meaning: 'Nur bei musikalischen Werken: Person, die das Werk komponiert hat. Nicht bei einem Begriff.', expected: false},
 {id: 'P6', source: 'Rigoletto', text: 'Rigoletto ist eine Oper von Giuseppe Verdi.', target: 'Verdi, Giuseppe', field: 'Komponist_in', meaning: 'Nur bei musikalischen Werken: Person, die das Werk komponiert hat. Nicht bei einem Begriff.', expected: true},
 {id: 'P7', source: 'Parola scenica', text: 'Parola scenica bezeichnet eine dramatische Wendung in der Oper.\n## [[Tetrade]]\n- ENHANCES ➜', target: 'Tetrade', field: 'Konzept', meaning: 'Fachlicher Begriff, der den Inhalt eines Werks oder Beispiels erklärt. Ein alleinstehender Link ist kein Beleg.', expected: false},
 {id: 'P8', source: 'Photosynthese', text: 'Photosynthese ist ein Forschungsgegenstand der Pflanzenphysiologie.', target: 'Pflanzenphysiologie', field: 'gehört_zu', meaning: 'Das weitere Fachgebiet, zu dem die Quelle gehört.', expected: true},
 {id: 'P9', source: 'Photosynthese', text: 'Photosynthese ist ein Forschungsgegenstand der Pflanzenphysiologie.', target: 'Pflanzenphysiologie', field: 'umfasst', meaning: 'Ein Teilbereich der Quelle; das Ziel muss enger sein.', expected: false},
 {id: 'P10', source: 'Parola scenica', text: 'Der Sprachstil entwickelte sich historisch im Umfeld des Belcanto. Der Text formuliert keine Gegenposition.', target: 'Belcanto', field: 'Reibung', meaning: 'Eine Position, die einer konkreten Aussage der Quelle widerspricht. Ein historischer Bezug ist kein Widerspruch.', expected: false},
];

export function scoreAssignments(result: AnalysisResult, test: ReturnType<typeof comparisonCases>[number]) {
 const requiredFound = result.suggestions.some(test.required);
 const accepted = (s: AnalysisResult['suggestions'][number]) => {
  if (test.required(s)) return true;
  if (test.id.startsWith('musical-')) return s.field === 'Überbau' && /^(Oper|Musiktheater|Verismo|Romantische Oper|Drama|Dramaturgie|Musikdramaturgie|Musikwissenschaft|Musiktheorie)\.md$/u.test(s.target);
  if (test.id === 'work-all-eleven-fields') return s.field === 'Überbau' && /^(Oper|Musiktheater)\.md$/u.test(s.target);
  if (test.id === 'custom-field-names') return s.field === 'gehört_zu' && /^(Botanik|Biologie|Biochemie)\.md$/u.test(s.target);
  return false;
 };
 const knownWrong = (s: AnalysisResult['suggestions'][number]) => test.forbidden(s) || (test.id.startsWith('musical-') && ['Unterbau', 'Reibung', 'Beispiel', 'Komponist_in'].includes(s.field));
 const forbidden = result.suggestions.filter(knownWrong).map(s => ({field: s.field, target: s.target}));
 const additionalUnscored = result.suggestions.filter(s => !accepted(s) && !knownWrong(s)).map(s => ({field: s.field, target: s.target}));
 // Unknown extra claims never count as evidence that an end-to-end case is correct.
 return {passed: result.status === 'complete' && requiredFound && !forbidden.length && !additionalUnscored.length, requiredFound, forbidden, additionalUnscored};
}
export const comparisonSettings = defaults;
