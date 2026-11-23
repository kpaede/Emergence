import { LAWS, type LawId } from './render/laws';

export type CenterDisplay = 'none' | 'labels' | 'legend';
export type LegendPosition = 'none' | 'bottom-left' | 'bottom-right';

export interface LawText {
	label: string;
	abbreviation: string;
}

export interface TetraderSettings {
	centerDisplay: CenterDisplay;
	legendPosition: LegendPosition;
	lawText: Record<LawId, LawText>;
}

export const DEFAULT_SETTINGS: TetraderSettings = {
	centerDisplay: 'none',
	legendPosition: 'bottom-right',
	lawText: {
		enhances: { label: 'ENHANCES', abbreviation: 'ENH' },
		reverses: { label: 'REVERSES INTO', abbreviation: 'REV' },
		retrieves: { label: 'RETRIEVES', abbreviation: 'RET' },
		obsolesces: { label: 'OBSOLESCES', abbreviation: 'OBS' },
	},
};

function record(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value)
		? value as Record<string, unknown> : {};
}

export function displayText(value: unknown, fallback: string, maxLength: number): string {
	return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

/** Migrate the original toggles and validate persisted or partially written settings. */
export function loadSettings(data: unknown): TetraderSettings {
	const saved = record(data);
	const centerDisplay = saved.centerDisplay === 'none' || saved.centerDisplay === 'labels' || saved.centerDisplay === 'legend'
		? saved.centerDisplay : saved.showLawLabels === true ? 'labels' : DEFAULT_SETTINGS.centerDisplay;
	const legendPosition = saved.legendPosition === 'none' || saved.legendPosition === 'bottom-left' || saved.legendPosition === 'bottom-right'
		? saved.legendPosition : saved.showLegend === false ? 'none' : saved.showLegend === true ? 'bottom-right' : DEFAULT_SETTINGS.legendPosition;
	const texts = record(saved.lawText);
	const lawText = {} as Record<LawId, LawText>;
	for (const law of LAWS) {
		const entry = record(texts[law.id]);
		const defaults = DEFAULT_SETTINGS.lawText[law.id];
		lawText[law.id] = {
			label: displayText(entry.label, defaults.label, 80),
			abbreviation: displayText(entry.abbreviation, defaults.abbreviation, 4),
		};
	}
	return { centerDisplay, legendPosition, lawText };
}
