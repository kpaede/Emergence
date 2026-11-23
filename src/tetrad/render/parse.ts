import { identifyLaw, type LawId } from './laws';
import {patternLaw, type TetradPattern} from '../patterns';

export interface RenderedEntry {
	/** Index in the shared source-entry snapshot, including the core entry. */
	index: number;
	nodes: Node[];
}

export interface LawSection {
	/** Present only when adapting already rendered Markdown without source. */
	heading?: HTMLElement;
	nodes: Node[];
	core?: HTMLElement;
	/** Explicit source-entry boundaries take precedence over DOM inspection. */
	coreEntry?: RenderedEntry;
	glossEntries?: RenderedEntry[];
}

export interface ParsedTetrad {
	sections: Map<LawId, LawSection>;
	preamble: Node[];
	duplicates: Set<LawId>;
}

export function asElement(node: Node): HTMLElement | undefined {
	return node.nodeType === 1 ? node as HTMLElement : undefined;
}

/** Inspect direct children only: headings in nested quotes or code are content. */
export function parseTetradContent(content: HTMLElement, pattern?: TetradPattern): ParsedTetrad {
	const sections = new Map<LawId, LawSection>();
	const duplicates = new Set<LawId>();
	const preamble: Node[] = [];
	let current: LawSection | undefined;

	for (const node of Array.from(content.childNodes)) {
		const element = asElement(node);
		const law = element && /^H[1-6]$/.test(element.tagName)
			? (pattern ? patternLaw(pattern, element.textContent ?? '') : identifyLaw(element.textContent ?? '')) : undefined;
		if (law && element) {
			if (sections.has(law)) duplicates.add(law);
			current = { heading: element, nodes: [] };
			sections.set(law, current);
		} else if (current) {
			current.nodes.push(node);
			if (!current.core && element?.tagName === 'P') current.core = element;
		} else {
			preamble.push(node);
		}
	}
	return { sections, preamble, duplicates };
}
