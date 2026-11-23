export const LAWS = [
	{ id: 'enhances', label: 'Enhances', short: 'Enh', aliases: ['enhance', 'enhances', 'enhancement', 'verstärkt', 'erweitert'] },
	{ id: 'reverses', label: 'Reverses into', short: 'Rev', aliases: ['reverse', 'reverses', 'reverse into', 'reverses into', 'reversal', 'kehrt um in', 'verkehrt sich in'] },
	{ id: 'retrieves', label: 'Retrieves', short: 'Ret', aliases: ['retrieve', 'retrieves', 'retrieval', 'holt zurück', 'bringt zurück'] },
	{ id: 'obsolesces', label: 'Obsolesces', short: 'Obs', aliases: ['obsolesce', 'obsolesces', 'obsolescence', 'verdrängt', 'macht überflüssig'] },
] as const;

export type LawId = typeof LAWS[number]['id'];

/** The Markdown renderer already removes heading markers and inline formatting. */
export function identifyLaw(text: string): LawId | undefined {
	const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*:\s*$/, '');
	return LAWS.find(law => (law.aliases as readonly string[]).includes(normalized))?.id;
}
