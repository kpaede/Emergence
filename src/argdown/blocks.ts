import {locale,t as tr} from '../i18n';
import {ARGDOWN_GUIDE_EXAMPLE} from './guide-example';
import {mermaidBlocks, fencedSource} from '../mermaid/blocks';
export const ARGDOWN_LANGUAGE = /^argdown(?:-map)?\s*$/iu;
export const argdownBlocks = (text: string) => mermaidBlocks(text, ARGDOWN_LANGUAGE);
export const argdownFence = (source: string): string => fencedSource(source, 'argdown');
export const ARGDOWN_START = '[These]: Was wollen wir begründen?\n  + <Pro>: Ein unterstützendes Argument.\n  - <Contra>: Ein Einwand.';
export const argdownStart = (): string => locale() === 'de' ? ARGDOWN_START : '[Thesis]: What do we want to justify?\n  + <Pro>: A supporting argument.\n  - <Con>: An objection.';
export const ARGDOWN_EXAMPLES = [
 {id: 'argdown-debate', get name() {return tr("argdown.pro_and_con");}, get source() {return argdownStart();}},
 {id: 'argdown-reconstruction', get name() {return tr("argdown.premises_and_conclusion");}, get source() {return locale()==='en' ? '<Inference>: A reconstructed argument.\n\n(1) [Premise 1]: All humans are mortal.\n(2) [Premise 2]: Socrates is human.\n----\n(3) [Conclusion]: Socrates is mortal.' : '<Schluss>: Ein rekonstruiertes Argument.\n\n(1) [Prämisse 1]: Alle Menschen sind sterblich.\n(2) [Prämisse 2]: Sokrates ist ein Mensch.\n----\n(3) [Schlussfolgerung]: Sokrates ist sterblich.';}},
 {id: 'argdown-sections', get name() {return tr("argdown.nested_groups");}, get source() {return locale()==='en' ? '# Issue\n\n[Thesis]: Our shared thesis.\n\n## Reasons\n\n<Pro>: A good reason.\n  +> [Thesis]\n\n## Objections\n\n<Con>: An objection.\n  -> [Thesis]' : '# Streitfrage\n\n[These]: Unsere gemeinsame These.\n\n## Gründe\n\n<Pro>: Ein guter Grund.\n  +> [These]\n\n## Einwände\n\n<Contra>: Ein Einwand.\n  -> [These]';}},
 {id: 'argdown-guide-debate', get name() {return tr("argdown.guide_linked_arguments_and_inferences");}, source: ARGDOWN_GUIDE_EXAMPLE},
];
