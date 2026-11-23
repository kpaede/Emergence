import {hasContent} from './content';
import {asElement, type LawSection, type RenderedEntry} from './parse';

export interface SectionEntries {
	core?: RenderedEntry;
	glosses: RenderedEntry[];
	restore(): void;
}

/** Only the source-less DOM adapter needs to infer entries. Production rendering
 * supplies the shared source model's exact indices and Markdown boundaries. */
export function sectionEntries(source?: LawSection): SectionEntries {
	if (source?.glossEntries !== undefined) return {core: source.coreEntry, glosses: source.glossEntries, restore() {}};
	let index = 0;
	let core: RenderedEntry | undefined;
	const glosses: RenderedEntry[] = [];
	const restore: (() => void)[] = [];
	for (const node of source?.nodes ?? []) {
		if (!hasContent(node)) continue;
		if (node === source?.core) {core = {index: index++, nodes: [node]}; continue;}
		const element = asElement(node);
		if (element && (element.tagName === 'UL' || element.tagName === 'OL')) {
			const items = Array.from(element.children).filter(item => item.tagName === 'LI');
			if (items.length) {
				const children = Array.from(element.childNodes);
				restore.push(() => element.replaceChildren(...children));
				const reversed = element.hasAttribute('reversed');
				let ordinal = Number(element.getAttribute('start') ?? (reversed ? items.length : 1));
				for (const item of items) {
					const wrapper = element.cloneNode(false) as HTMLElement;
					wrapper.removeAttribute('id');
					if (element.tagName === 'OL') {
						if (item.hasAttribute('value')) ordinal = Number(item.getAttribute('value'));
						wrapper.setAttribute('start', String(ordinal));
						ordinal += reversed ? -1 : 1;
					}
					wrapper.append(item);
					glosses.push({index: index++, nodes: [wrapper]});
				}
				continue;
			}
		}
		glosses.push({index: index++, nodes: [node]});
	}
	return {core, glosses, restore() {for (const reset of restore) reset();}};
}
