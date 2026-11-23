import { createElement } from './dom';
import { hasContent } from './content';
import type { LawId } from './laws';
import type { LawSection } from './parse';
import {sectionEntries} from './entries';
import type {RenderedEntry} from './parse';

export interface Wing {
	law: LawId;
	element: HTMLElement;
	missingLabel?: HTMLElement;
	destroy(): void;
}

export function createWing(document: Document, law: LawId, source?: LawSection): Wing {
	const element = createElement(document, 'section', `tetrader-law tetrader-${law}`);
	const core = createElement(document, 'div', 'tetrader-core');
	core.dataset.emCore = 'true';
	const entries = sectionEntries(source);
	if (entries.core) core.dataset.emEntryIndex = String(entries.core.index);
	const originalClass = source?.heading?.getAttribute('class');
	if (source?.heading) {
		source.heading.classList.add('tetrader-source-heading');
		core.append(source.heading);
	}
	const statement = createElement(document, 'div', 'tetrader-statement');
	let missingLabel: HTMLElement | undefined;
	if (entries.core?.nodes.some(hasContent)) {
		statement.append(...entries.core.nodes);
	} else {
		missingLabel = createElement(document, 'p', 'tetrader-missing-label tetrader-placeholder');
		statement.append(missingLabel);
	}
	core.append(statement);
	element.append(core);
	appendGlosses(document, element, entries.glosses, law === 'enhances' || law === 'reverses');
	return {
		law, element, missingLabel,
		destroy() {
			entries.restore();
			if (!source?.heading) return;
			source.heading.classList.remove('tetrader-source-heading');
			if (originalClass === null && !source.heading.className) source.heading.removeAttribute('class');
		},
	};
}

function appendGlosses(document: Document, section: HTMLElement, entries: readonly RenderedEntry[], upper: boolean): void {
	const glosses = createElement(document, 'div', 'tetrader-glosses');
	for (const [index, entry] of entries.entries()) {
		const gloss = createElement(document, 'div', 'tetrader-gloss');
		gloss.dataset.emEntryIndex = String(entry.index);
		// Source order always runs from the core outward in every quadrant.
		const distance = index;
		gloss.dataset.tetraderDistance = String(distance);
		gloss.style.setProperty('--tetrader-outward', String(distance / Math.max(entries.length - 1, 1)));
		gloss.append(...entry.nodes);
		// Above the core, later (farther) blocks go above earlier (nearer) ones.
		if (upper) glosses.prepend(gloss);
		else glosses.append(gloss);
	}
	section.append(glosses);
}
