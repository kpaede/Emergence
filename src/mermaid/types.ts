/** Structural subset of the host's Pele models. No renderer is bundled. */
export interface FlowNode {
 id: string; text?: string; type?: string; labelType: string; styles: string[]; classes: string[];
 props?: Record<string, string>; link?: string; linkTarget?: string;
}
export interface FlowEdge {
 start: string; end: string; id?: string; text: string; type?: string; stroke?: string;
 length?: number; classes: string[]; style?: string[]; isUserDefinedId: boolean; labelType: string;
}
export interface FlowGroup {id: string; title: string; nodes: string[]; dir?: string; labelType: string; classes: string[]}
export interface FlowModel {type: 'flowchart'; nodes: Map<string, FlowNode>; edges: FlowEdge[]; subgraphs: FlowGroup[]}
export interface MindNode {id: number; nodeId: string; level: number; descr: string; type: number; children: MindNode[]; isRoot: boolean; section?: number; class?: string; icon?: string}
export interface MindModel {type: 'mindmap'; nodes: MindNode[]}
export interface OtherModel {type: string}
export type DiagramModel = FlowModel | MindModel | OtherModel;
export function isFlow(model: DiagramModel): model is FlowModel {return model.type === 'flowchart' && 'subgraphs' in model;}
export function isMind(model: DiagramModel): model is MindModel {return model.type === 'mindmap' && 'nodes' in model;}
export interface RenderResult {svg: string; type: string; width: number; height: number}
export interface MountedDiagram {update(source: string): void; refresh(): void; destroy(): void; error?: unknown}
export interface Pele {
 parse(source: string): DiagramModel;
 render(source: string): RenderResult;
 mount(host: HTMLElement, source: string, options?: {onRender?: () => void; onError?: (error: unknown) => void; sanitize?: (svg: string) => Node}): MountedDiagram;
}
export interface SourceRange {from: number; to: number}
export const FLOW_START = 'flowchart TD\n  A[Start] --> B{Entscheidung}\n  B -->|Ja| C[Ergebnis]\n  B -->|Nein| D[Alternative]\n';
export const MIND_START = 'mindmap\n  root((Thema))\n    idee[Idee]\n      aspekt[Aspekt]\n    frage[Frage]\n';
