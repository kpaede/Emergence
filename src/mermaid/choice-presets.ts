import {t as tr} from '../i18n';

export interface DiagramChoice {value: string; label: string; source: string}
const flowShapes = () => [['rect', tr("labels.rectangle")], ['rounded', tr("labels.rounded")], ['stadium', tr("mermaid.start_end")], ['diam', tr("labels.diamond")], ['circle', tr("argdown.circle")], ['dbl-circ', tr("labels.double_circle")], ['hex', tr("labels.hexagon")], ['cyl', tr("labels.database")], ['subproc', tr("labels.subprocess")], ['cloud', tr("labels.cloud")], ['lean-r', tr("labels.parallelogram")], ['trap-b', tr("labels.trapezoid")]];
const mindShapes = () => [['0', tr("mermaid.no_border"), 'Aa'], ['1', tr("labels.rounded"), 'n(Aa)'], ['2', tr("labels.rectangle"), 'n[Aa]'], ['3', tr("argdown.circle"), 'n((Aa))'], ['4', tr("labels.cloud"), 'n)Aa('], ['5', tr("labels.bang"), 'n))Aa(('], ['6', tr("labels.hexagon"), 'n{{Aa}}']];
export function shapeChoices(mindmap: boolean): DiagramChoice[] {
 return mindmap ? mindShapes().map(([value, label, node]) => ({value: value!, label: label!, source: value === '0' ? 'flowchart LR\n n@{ shape: text, label: "Aa" }' : 'mindmap\n ' + node})) : flowShapes().map(([value, label]) => ({value: value!, label: label!, source: 'flowchart LR\n n@{ shape: ' + value + ', label: "Aa" }'}));
}
export function edgeChoices(): DiagramChoice[] {
 return [['arrow_point', tr("mermaid.arrow"), '-->'], ['arrow_open', tr("mermaid.line"), '---'], ['double_arrow_point', tr("labels.both_directions"), '<-->'], ['arrow_circle', tr("labels.circle_end"), '--o'], ['arrow_cross', tr("labels.cross_end"), '--x'], ['dotted', tr("labels.dotted"), '-.->'], ['thick', tr("labels.thick"), '==>']].map(([value, label, edge]) => ({value: value!, label: label!, source: `flowchart LR\n A@{shape: text, label: " "} ${edge} B@{shape: text, label: " "}`}));
}
