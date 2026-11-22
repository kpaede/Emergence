import {t} from '../../i18n';
import { createElement } from './dom';
import { hasContent } from './content';
import type { LawId } from './laws';
import type { LawSection } from './parse';

export interface Wing {
	law: LawId;
	element: HTMLElement;
	missingLabel?: HTMLElement;
	destroy(): void;
}

export function createWing(document: Document, law: LawId, source?: LawSection): Wing {
	const element = createElement(document, 'section', `tetrader-law tetrader-${law}`);
	const core = createElement(document, 'div', 'tetrader-core');
	const originalClass = source?.heading.getAttribute('class');
	if (source) {
		source.heading.classList.add('tetrader-source-heading');
		core.append(source.heading);
	}
	const statement = createElement(document, 'div', 'tetrader-statement');
	let missingLabel: HTMLElement | undefined;
	if (source?.core && hasContent(source.core)) {
		statement.append(source.core);
	} else {
		missingLabel = createElement(document, 'span', 'tetrader-missing-label');
		core.append(missingLabel);
		statement.append(createElement(document, 'p', 'tetrader-placeholder', t('tetrad.notWritten')));
	}
	core.append(statement);
	element.append(core);
	appendGlosses(document, element, source, law === 'enhances' || law === 'reverses');
	return {
		law, element, missingLabel,
		destroy() {
			if (!source) return;
			source.heading.classList.remove('tetrader-source-heading');
			if (originalClass === null && !source.heading.className) source.heading.removeAttribute('class');
		},
	};
}

function appendGlosses(document: Document, section: HTMLElement, source: LawSection | undefined, upper: boolean): void {
	const glosses = createElement(document, 'div', 'tetrader-glosses');
	const nodes = (source?.nodes ?? []).filter(node => node !== source?.core && hasContent(node));
	for (const [index, node] of nodes.entries()) {
		const gloss = createElement(document, 'div', 'tetrader-gloss');
		// Source order always runs from the core outward in every quadrant.
		const distance = index;
		gloss.dataset.tetraderDistance = String(distance);
		gloss.style.setProperty('--tetrader-outward', String(distance / Math.max(nodes.length - 1, 1)));
		gloss.append(node);
		// Above the core, later (farther) blocks go above earlier (nearer) ones.
		if (upper) glosses.prepend(gloss);
		else glosses.append(gloss);
	}
	if (glosses.childNodes.length > 0) section.append(glosses);
}
