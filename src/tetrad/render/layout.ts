import {t} from '../../i18n';
import type {TetradPattern} from '../patterns';
import type { TetraderSettings } from '../settings-model';
import { createCenter } from './center';
import { hasContent } from './content';
import { createElement } from './dom';
import { LAWS } from './laws';
import { createLegend, updateLegend } from './legend';
import { preserveLineBreaks } from './line-breaks';
import { parseTetradContent, type ParsedTetrad } from './parse';
import { createWing } from './wing';
import {nameByVisibleElement} from '../../ui/accessibility';
import {mountLineFlow} from './line-flow';

export interface TetradLayout {
	update(settings: TetraderSettings): void;
	destroy(): void;
}

export function mountTetrad(callout: HTMLElement, settings: TetraderSettings, pattern?: TetradPattern, structure?: ParsedTetrad): TetradLayout {
	const document = callout.ownerDocument;
	const existingContent = callout.querySelector<HTMLElement>(':scope > .callout-content');
	const content = existingContent ?? createElement(document, 'div', 'callout-content');
	if (!existingContent) callout.append(content);
	const original = Array.from(content.childNodes);
	const parsed = structure ?? parseTetradContent(content, pattern);
	const empty = !parsed.preamble.some(hasContent)
		&& !Array.from(parsed.sections.values()).some(section => section.nodes.some(hasContent));

	if (parsed.duplicates.size > 0 || (parsed.sections.size === 0 && !empty)) {
		const message = parsed.duplicates.size > 0
			? t('tetrad.duplicateSections')
			: t('tetrad.missingSections');
		const hint = createElement(document, 'p', 'tetrader-hint', message);
		content.append(hint);
		return { update: () => {}, destroy: () => hint.remove() };
	}

	const restoreLineBreaks = preserveLineBreaks(content);
	const grid = createElement(document, 'div', 'tetrader-grid');
	grid.setAttribute('role', 'group');
	const caption=callout.querySelector<HTMLElement>('.callout-title-inner')??callout.querySelector<HTMLElement>('.callout-title');
	const captionId=caption?.id;

	const wings = LAWS.map(law => createWing(document, law.id, parsed.sections.get(law.id)));
	for (const wing of wings) {
		wing.element.hidden = false;
		grid.append(wing.element);
	}
	const center = createCenter(document);
	grid.append(center.element);
	const legend = createLegend(document);
	legend.classList.add('tetrader-corner-legend');
	const preamble = createElement(document, 'div', 'tetrader-preamble');
	preamble.append(...parsed.preamble);
	content.replaceChildren();
	if (hasContent(preamble)) content.append(preamble);
	content.append(grid, legend);
	callout.classList.add('tetrader-tetrad');

	const flow=mountLineFlow(grid);
	let destroyed = false;
	const layout: TetradLayout = {
		update(next) {
			if (destroyed) return;
			const mode = center.update(next, empty);
			grid.dataset.center = mode;
			legend.hidden = next.legendPosition === 'none';
			legend.classList.toggle('tetrader-legend-left', next.legendPosition === 'bottom-left');
			updateLegend(legend, next.lawText);
			for (const wing of wings) {
				const label = next.lawText[wing.law].label;
				const name=center.element.querySelector('[data-law='+wing.law+']');if(name)nameByVisibleElement(wing.element,name);
				if (wing.missingLabel) {
					wing.missingLabel.textContent = label;
					wing.missingLabel.hidden = false;
				}
			}
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			flow.destroy();if(caption&&!captionId)caption.removeAttribute('id');
			restoreLineBreaks();
			for (const wing of wings) wing.destroy();
			content.replaceChildren(...original);
			if (!existingContent) content.remove();
			callout.classList.remove('tetrader-tetrad');
		},
	};
	layout.update(settings);
	if(caption)nameByVisibleElement(grid,caption);
	return layout;
}
