import { createElement } from './dom';
import { LAWS } from './laws';
import { DEFAULT_SETTINGS, type TetraderSettings } from '../settings-model';
import {t} from '../../i18n';

export function createLegend(document: Document, lawText = DEFAULT_SETTINGS.lawText): HTMLElement {
	const legend = createElement(document, 'div', 'tetrader-legend');
	legend.setAttribute('role', 'img');
	// Follow the slightly flattened, uneven outline in the supplied print reference.
	const ownerWindow = document.win as Window & {createSvg: typeof createSvg};
	const outline = ownerWindow.createSvg('svg');
	outline.setAttribute('class', 'tetrader-legend-outline');
	outline.setAttribute('viewBox', '0 0 200 174');
	outline.setAttribute('aria-hidden', 'true');
	outline.setAttribute('focusable', 'false');
	const contour = ownerWindow.createSvg('path');
	contour.setAttribute('d', [
		'M 83 5 L 97 4 L 110 5',
		'C 128 5 142 12 155 21 L 164 29',
		'C 181 43 191 59 195 78 L 195 96',
		'C 193 115 182 133 167 146 L 154 155',
		'C 138 164 124 168 110 169 L 84 169',
		'C 65 166 48 158 34 147 L 25 136',
		'C 14 123 7 109 5 92 L 5 78',
		'C 6 60 16 43 30 30 L 40 22',
		'C 53 12 68 7 83 5 Z',
	].join(' '));
	outline.append(contour);
	legend.append(outline);
	for (const law of LAWS) {
		const entry = createElement(document, 'abbr', '');
		entry.dataset.law = law.id;
		legend.append(entry);
	}
	updateLegend(legend, lawText);
	return legend;
}

export function updateLegend(legend: HTMLElement, lawText: TetraderSettings['lawText']): void {
	const positions = LAWS.map(law => t('tetrad.labelAtPosition', {
		label: lawText[law.id].label,
		position: t(`tetrad.${law.id}`),
	})).join('; ');
	legend.removeAttribute('aria-label');legend.setAttribute('aria-description',t('tetrad.legendAria',{positions}));const names:string[]=[];
	for (const law of LAWS) {
		const entry = legend.querySelector<HTMLElement>(`abbr[data-law="${law.id}"]`);
		if (!entry) continue;
		if(!entry.id)entry.id='em-law-'+crypto.randomUUID();names.push(entry.id);entry.textContent = lawText[law.id].abbreviation;
		entry.title = lawText[law.id].label;
	}
	legend.setAttribute('aria-labelledby',names.join(' '));
	legend.classList.toggle('tetrader-legend-wide', LAWS.some(law => lawText[law.id].abbreviation.length > 3));
}
