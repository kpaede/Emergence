import {t} from '../../i18n';
import type { CenterDisplay, TetraderSettings } from '../settings-model';
import { createElement } from './dom';
import { LAWS } from './laws';
import { createLegend, updateLegend } from './legend';

export function createCenter(document: Document): {
	element: HTMLElement;
	update(settings: TetraderSettings, empty: boolean): CenterDisplay;
} {
	const element = createElement(document, 'div', 'tetrader-center');
	const labels = createElement(document, 'div', 'tetrader-label-cross');
	labels.setAttribute('role', 'group');
	labels.setAttribute('aria-label', t('tetrad.labels'));
	const entries = LAWS.map(law => {
		const entry = createElement(document, 'span', 'tetrader-center-label');
		entry.dataset.law = law.id;
		labels.append(entry);
		return { law: law.id, entry };
	});
	const legend = createLegend(document);
	legend.classList.add('tetrader-center-legend');
	element.append(labels, legend);
	return {
		element,
		update(settings, empty) {
			const mode = empty && settings.centerDisplay === 'none' ? 'labels' : settings.centerDisplay;
			element.hidden = mode === 'none';
			labels.hidden = mode !== 'labels';
			legend.hidden = mode !== 'legend';
			for (const { law, entry } of entries) entry.textContent = settings.lawText[law].label;
			updateLegend(legend, settings.lawText);
			return mode;
		},
	};
}
