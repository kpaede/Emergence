/** Empty paragraphs and comments should not turn an empty tetrad into an error. */
export function hasContent(node: Node): boolean {
	if (node.nodeType === 8) return false;
	if (node.textContent?.trim()) return true;
	if (node.nodeType !== 1) return false;
	const element = node as HTMLElement;
	const visible = 'img, svg, canvas, video, audio, iframe, object, embed, hr, input, table, pre, .internal-embed';
	return element.matches(visible) || Boolean(element.querySelector(visible));
}
