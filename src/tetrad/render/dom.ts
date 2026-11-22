export function createElement<K extends keyof HTMLElementTagNameMap>(
	document: Document,
	tag: K,
	className: string,
	text?: string,
): HTMLElementTagNameMap[K] {
	const element = (document.win as Window & {createEl: typeof createEl}).createEl(tag);
	element.className = className;
	if (text !== undefined) element.textContent = text;
	return element;
}
