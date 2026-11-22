/** Obsidian can emit <br> followed by a newline for a single source line break.
 * With pre-line whitespace, remove only that redundant newline and restore it
 * on cleanup. Bare soft breaks and manually written <br> elements remain intact.
 */
export function preserveLineBreaks(content: HTMLElement): () => void {
	const walker = content.ownerDocument.createTreeWalker(content, 4);
	const changed: { node: Text; before: string; after: string }[] = [];
	let node: Node | null;
	while ((node = walker.nextNode())) {
		const text = node as Text;
		if (text.previousSibling?.nodeName !== 'BR' || !/^\r?\n/.test(text.data)) continue;
		const before = text.data;
		const after = before.replace(/^\r?\n/, '');
		changed.push({ node: text, before, after });
		text.data = after;
	}
	return () => {
		for (const { node, before, after } of changed) {
			if (node.data === after) node.data = before;
		}
	};
}
