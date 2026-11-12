# Emergence

**English** · [Deutsch](README.de.md)

Explore how your notes connect, develop ideas and build diagrams in Obsidian. Emergence brings these tasks together in a sidebar, so you can keep working in your note.

It grew out of philosophical concept work in a personal research vault. The relationship fields and layout are configurable; other research workflows have been less extensively tested.

## What you can do

| Your task | Where to start |
| --- | --- |
| Understand and organize relationships between notes | [**Graph**](#explore-and-organize-your-notes) shows the current note in context, using your Breadcrumbs fields and existing links. |
| Find new connections | [**Field ideas**](#develop-new-connections) uses a local language model to suggest concepts. You choose which relationships to keep. |
| Draw a process, mind map or argument | [**Mermaid** and **Argdown**](#edit-diagrams-alongside-their-source) combine graphical editing with an always-visible source editor. |
| Find notes and references | [**Search**](#find-notes-and-literature) searches note titles, aliases and tags, plus your Zotero library through ZotLit. |

The five tabs appear in this order: **Graph → Field ideas → Mermaid → Argdown → Search**. Each can be disabled in settings.

## Get started

### Requirements

Emergence requires **Obsidian Desktop 1.15.0 or later**. Mobile is not supported.

Additional tools depend on what you want to use:

| For this feature | You need |
| --- | --- |
| Typed relationships in Graph and Field ideas | **Breadcrumbs v4**, with your relationship fields configured |
| Zotero search, references and literature actions | **ZotLit 2.2**, connected to your Zotero database |
| AI suggestions in Field ideas | **Ollama**, with an installed local model |

Mermaid and Argdown work without these optional integrations. Graph and Search do not require a language model; ordinary note links and note search work without ZotLit.

### Install

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest stable release](https://github.com/kpaede/Emergence/releases/latest).
2. Put all three files in `<Vault>/.obsidian/plugins/emergence/`.
3. Enable Emergence under **Settings → Community plugins**. Reload Obsidian if it was already running when you copied the files.

Installation is currently manual. Release downloads also include `SHA256SUMS.txt` for checking file integrity.

### Open your workspace

Open a note, then select the network icon in Obsidian’s ribbon or run **Emergence: Open knowledge graph and analysis** from the command palette. Emergence opens in the right sidebar.

Under **Settings → Emergence**, choose your language and enable the areas you need. The interface supports English and German, or follows Obsidian’s language. Changes take effect immediately.

## Working with Emergence

### Explore and organize your notes

**Graph** places the current note at the center of its relationships. The default arrangement shows broader concepts above, narrower concepts below, similar concepts to the left and contrasting concepts to the right. Examples, references and other links have their own areas.

Map your existing Breadcrumbs fields to these areas. In the settings preview, you can change headings, positions, order and how many relationship levels to show. Your field names stay your own.

Select a note to open it, or use exploration mode to follow connections without leaving the note you are writing. Add relationships at a group heading or drag an existing relationship to another field. These edits update the corresponding note properties. When available, the view selector also offers Breadcrumbs’ own matrix and tree, ZotLit’s bibliography and Obsidian’s local graph.

### Develop new connections

**Field ideas** is an association aid for the current note. Configure the meaning of your Breadcrumbs fields, choose the search scope for existing concepts and connect your local Ollama model. The default model setting is `qwen3.5:9b`; Emergence does not download models.

Suggestions arrive as unassigned concepts. Edit or discard them, then drag a useful concept onto the field where it belongs. You can also select its handle and then the field. Existing notes are reused; a missing concept becomes a link, without automatically creating a note. An accepted relationship can be undone.

You control the field descriptions, instructions and model settings. Suggestions can be wrong and need your judgment. Wikipedia excerpts and web search can be included explicitly as additional context.

### Edit diagrams alongside their source

**Mermaid** and **Argdown** show the diagram and syntax-highlighted source together. Selection is linked in both directions. Work in the sidebar or full screen, and undo or redo graphical and source edits together.

**Mermaid** is for flowcharts and mind maps. Drag to connect elements or create a connected node, double-click to edit labels, and use compact tools for shapes, colors and nested subgraphs. Rendering and automatic layout come entirely from Obsidian’s integrated Pele. Other Pele diagram types are available through examples and source editing; the graphical editing tools currently support flowcharts and mind maps.

**Argdown** is for statements, arguments and their relationships. Add supporting reasons, attacks or undercutters by dragging from an element. Organize the map into nested groups. To work on premises and conclusions, open an argument’s reconstruction in its own view with the matching source. Showing that reconstruction in the main map is a separate choice. Layout and presentation use Argdown and Graphviz.

<details>
<summary>Templates, saving and Markdown support</summary>

Both editors share a **New** menu with built-in examples, previews, favorites and reusable templates. Add your own templates, or choose a vault folder containing Markdown notes with diagram code blocks.

**Saving:** A new diagram is a draft until you select **Insert into note**. To edit an existing diagram, use the pencil beside its rendered code block or the editor command for the block at the cursor. Changes then save automatically to that particular block, even when the note contains several diagrams. Insert or save drafts as templates before unloading the plugin; uninserted drafts are held in memory.

**Markdown:** Label dialogs offer Obsidian’s Markdown preview. The diagram itself follows the formatting and link support of Pele or Argdown; it does not support every Obsidian Markdown extension. The source editor remains available for syntax without a graphical control.

</details>

### Find notes and literature

**Search** finds notes by title, alias and tag. With ZotLit, it also searches your available Zotero libraries, including group libraries. Results are separate from the candidate scope used for Field ideas.

Open a note directly or explore it in Graph. Literature results use ZotLit’s citation formatting and provide actions for the library entry, literature note, Zotero item, attachment, cited location and citekey. Some actions depend on available metadata. Formatting references not already cited in the current note may require Zotero to be running with its local API enabled.

## Privacy and storage

Graph, note search and diagram editing work locally. AI requests go to your configured local Ollama endpoint and include the note, field descriptions and relevant candidate titles or selected source excerpts. There is no telemetry or cloud-model fallback.

Wikipedia and DuckDuckGo are optional external sources. Enabling them sends the chosen search term to the respective service, not your note text. DuckDuckGo result pages are queried; linked websites are not automatically opened. Literature formatting can contact Zotero’s configured local API.

Accepted relationships and inserted diagrams live in your notes. Settings, template preferences and the relationship change journal are stored in the plugin’s `data.json`. Templates can also live as Markdown notes in your chosen vault folder. Search results, suggestions and uninserted diagram drafts are temporary.

## More detail

The detailed documentation below is currently in German:

- [Settings, Graph layout and template folders](docs/PREFERENCES.md)
- [Argdown editor: usage and supported features](docs/ARGDOWN_EDITOR.md)
- [Argdown guide coverage and remaining limitations](docs/ARGDOWN_GUIDE_AUDIT.md)
- [Validation and compatibility notes](docs/VALIDATION.md)

See the [changelog](CHANGELOG.md) for release history. Integrations with other plugins depend on their available interfaces; the validation notes describe the tested versions and known limits.

<details>
<summary>Build from source</summary>

Use Node.js 22.12+ in the supported 22.x or 24.x LTS lines and npm. To build the released version:

```sh
git clone --branch 0.0.4 https://github.com/kpaede/Emergence.git
cd Emergence
npm ci
npm run build
```

Copy `main.js`, `manifest.json` and `styles.css` to the plugin folder described above. For development, use `npm run dev`; run `npm test` and `npm run lint` to check changes. Native UI checks additionally require a running Obsidian development vault with its CLI enabled.

</details>

License: [Zero-Clause BSD](LICENSE). Component licenses and notices are included in [third-party](third-party/).
