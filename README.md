# Emergence

**English** · [Deutsch](README.de.md)

Explore how your notes connect, develop ideas and build diagrams in Obsidian. Emergence brings these tasks together in a sidebar, so you can keep working in your note.

It grew out of philosophical concept work in a personal research vault. The relationship fields and layout are configurable; other research workflows have been less extensively tested.

## What you can do

| Your task | Where to start |
| --- | --- |
| Collect thoughts and excerpts by chapter | [**Companion Document**](#companion-document) follows your main note’s outline and offers EOME or Lineage for editing. |
| Understand and organize relationships between notes | [**Graph**](#explore-and-organize-your-notes) shows the current note in context, using your Breadcrumbs fields and existing links. |
| Find new connections | [**Field ideas**](#develop-new-connections) uses a local language model to suggest concepts. You choose which relationships to keep. |
| Draw a process, mind map or argument | [**Mermaid** and **Argdown**](#edit-diagrams-alongside-their-source) combine graphical editing with an always-visible source editor. |
| Compare four perspectives | [**Tetrader**](#tetrader-and-custom-markdown-patterns) combines a graphical editor with custom Markdown patterns. |
| Find notes and references | [**Search**](#find-notes-and-literature) searches note titles, aliases and tags, plus your Zotero library through ZotLit. |

The seven tabs appear in this order: **Companion Document → Graph → Field ideas → Mermaid → Argdown → Tetrader → Search**. Each can be disabled in settings.

## Get started

### Requirements

Emergence requires **Obsidian Desktop 1.15.0 or later**. Mobile is not supported.

Additional tools depend on what you want to use:

| For this feature | You need |
| --- | --- |
| Typed relationships in Graph and Field ideas | **Breadcrumbs v4**, with your relationship fields configured |
| Zotero search, references and literature actions | **ZotLit 2.2**, connected to your Zotero database |
| AI suggestions in Field ideas | **Ollama**, with an installed local model |

Mermaid, Argdown and Tetrader work without these optional integrations. Graph and Search do not require a language model; ordinary note links and note search work without ZotLit.

### Install

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest stable release](https://github.com/kpaede/Emergence/releases/latest).
2. Put all three files in `<Vault>/.obsidian/plugins/emergence/`.
3. Enable Emergence under **Settings → Community plugins**. Reload Obsidian if it was already running when you copied the files.

Installation is currently manual. Release downloads also include `SHA256SUMS.txt` for checking file integrity.

### Open your workspace

Open a note, then select the network icon in Obsidian’s ribbon or run **Emergence: Open workspace** from the command palette. Emergence opens in the right sidebar.

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

### Tetrader and custom Markdown patterns

The **Tetrader** tab integrates Tetrader locally, with Markdown source, butterfly preview, full screen and shared undo/redo. Edit a wing using its button or a double click in the embedded Obsidian Markdown editor. Open existing callouts using the note selector, **Edit in Tetrader** below a rendered callout, or **Edit tetrad at cursor**. Drafts stay separate until **Insert into note**; the editor then saves only that block automatically.

Use **+ → New pattern** to define a name, unique callout identifier, heading level and four headings. The built-in **McLuhan** pattern preserves `> [!tetrad]` with English headings and their aliases. A custom pattern can use `> [!four-perspectives]` with **Strengths**, **Risks**, **Opportunities**, and **Losses**. Positions stay fixed: top left, top right, bottom left, bottom right. The first paragraph is the core statement; further paragraphs are glosses written from the center outward. Upper gloss blocks are reversed visually. Markdown, links and line breaks are retained.

Patterns and appearance settings are stored locally in Emergence's plugin data. Saved pattern definitions remain stable so existing notes continue to work; create another pattern for a different structure. This supports configurable identifiers and headings, rather than arbitrary Markdown grammars. **Tetrad appearance** controls the center, legend, law names and abbreviations. If a bound block changes externally or becomes ambiguous, saving stops and retains the draft. **Copy as draft** detaches it for recovery; reopen the original block to work with its current source.

The standalone Tetrader plugin is not required. The renderer is adapted from Tetrader 0.2.3, commit `77a502800ccc924ece5b6c027ca1b99794205b45`, with its [license](third-party/Tetrader-LICENSE.txt). No runtime downloads or network requests are added.

### Companion Document

The **Companion Document** tab collects thoughts alongside a main document’s headings. The feature never adds IDs, frontmatter or automatically changed headings to the main document. Open the main note and select **Create companion document** in the tab or command palette.

You can create several independent companions for the same main document and switch between them. **Create companion document** and **Select existing companion document** remain available with an existing connection. The picker lists companions with connection metadata; ordinary Markdown notes are not converted automatically. Deleted, missing or malformed files offer creation, selection and another check after restoration. Missing section files are never replaced with empty files. If the main document is missing, thoughts stay readable and a replacement main document can be selected. Open edits are preserved as exportable view drafts when the companion disappears, including after switching to another file.

Choose **File layout for a new companion** directly in the start view: **All chapters in one companion file** or **One file per chapter**. This choice stays editable in the creation dialog when general storage defaults are selected. Existing companions display their saved layout beside the thought-view selector; the new-document choice does not convert existing files. Frontmatter stores the layout in `emergence-storage.mode` (`document` or `sections`), with `emergence-companion-role` identifying shared files (`document`), chapter overviews (`index`) and chapter files (`section`). Chapter files link to their overview through `emergence-parent-companion-id`. Unambiguous older files without an explicit role remain readable; conflicting metadata stops reconciliation. **Show missing chapter files** lists the affected chapters and their expected vault paths.

In **Settings → Emergence → Companion Document**, choose creation defaults: one shared companion file or one file per heading, stored beside the original, in a fixed vault folder, or in a named subfolder beside the original (default: `Companions`). When creating a pair, choose **Use general defaults** or **Customize for this document**. The resulting location is saved per pair; later default changes apply to new pairs. Missing folders are created. With section files, an extra Markdown index stores the outline, file links and assignment metadata; thoughts live only in the section files. Heading renames keep file names stable. Relative storage follows source-folder moves; a fixed folder stays in place.

The chapter navigation uses Obsidian’s heading metadata and live editor syntax tree, with native Outline theme classes. It follows the writing cursor; the crosshair toggles this behavior. Thoughts stay separate from the chapter tree. The **Thought view** selector offers the installed **Excerpt Outline Mindmap Editor** and **Lineage** in the same panel. EOME is the default. Disabled plugins have an activation button. The main tabs remain in one horizontally scrollable row; each editor provides its own search and editing controls below the chapter navigation.

In **One file per chapter** mode, the outline shows **File missing** or **Check file** beside affected chapters. Each file button opens that chapter’s Markdown in an Obsidian tab and reuses an existing tab. The button is disabled for missing files. Missing or unreadable chapters do not block the rest of the outline or editing available chapters. Heading changes continue to reconcile; unavailable files are never treated as empty or recreated. Restored files are read again.

Both views use the installed plugins’ registered components, including their original text editors, keyboard navigation, subtree operations and undo controls. EOME’s checkbox controls are enabled on hover by default and remain configurable in its settings. No working copy or additional workspace leaf is created. Native view options are kept locally per section. The main document is never given to either editor for writing.

New companion sections use EOME’s version-2 Markdown convention: structural tabs identify thoughts, and two extra spaces identify continuation lines. Paragraphs, internal lists, quotations, headings and code belong to a single thought unless an actual child node is created. Existing legacy sections are projected according to their old hierarchy and receive the new format when a changed section is saved. Unsupported legacy prose stops that conversion for review. Unedited sections retain their original text. The file-boundary grammar is adapted from EOME (MIT; `third-party/companion-outline-LICENSE.txt`).

Inside Emergence, the Lineage adapter transfers complete contents through its native node model and serializes that model without trimming card text. This preserves leading/trailing whitespace and code containing section-comment examples. This adaptation applies to the embedded view; standalone Lineage retains its own format limitations. Conflicting writes retain a recoverable Markdown draft. Switching views waits for EOME’s active edit to finish.

EOME and Lineage remain separately installed original plugins. Emergence does not require a locally modified build. The shared companion format follows EOME’s multiline Markdown format; Lineage is connected through its native node model. Required editor capabilities are checked when loading. If a plugin version is incompatible, the companion file remains accessible as Markdown.

Display difference: Lineage 0.8.5 can collapse entered paragraphs outside edit mode in the tested configuration. Stored text remains intact. Emergence retains the original text rendering; thought hierarchy and Markdown storage are independent of this display behavior.

Both thought views follow the Obsidian theme, including text editors and new thoughts. Shared initial typography, compact cards and 100 percent starting zoom are applied once as local native options; later explicit changes are retained. Drag the outline divider or use its arrow keys to resize it. Wide views place the outline beside the editor. The [presentation contract and integration boundary](docs/companion-presentation.md) describe ownership and the remaining version-specific interfaces.

A reverse index rebuilt from companion YAML and Obsidian’s metadata cache finds companions when the main document is opened, even after restarting. It does not depend on the backlinks pane or add metadata to the main document.

The main-document link is stored in companion YAML as `emergence-main-document`. Section and thought IDs appear only in companion files. Synchronization uses editor/file events, coalesces heading changes and performs no polling while idle. Ordinary paragraph typing does not write companion files. Ambiguous or missing sections retain their thoughts under **Review assignment**; assign them to a current section or keep them without one. Removed or duplicated IDs stop automatic editing until the source is corrected.

Concurrent edits preserve the external version and a recoverable native draft. **Save draft as Markdown** exports that draft for review. Multi-file operations use a local recovery journal. **Try recovery** rolls back completed steps only when it can protect newer external changes. When recovery conflicts, the dialog shows the previous and planned file contents. After reviewing them, you can explicitly keep the current state without overwriting files. This is not a cross-device filesystem lock; cloud conflict copies still require review.

The document’s **…** menu contains **Open companion file**, which opens the selected section file in section mode, and **Reconnect document**. Editing happens directly in the companion workspace. EOME and Lineage remain separate plugins; their installed views are optional. The adapters were verified with EOME 0.2.4 and Lineage 0.8.5; EOME 0.2.3 or later is required. Emergence adds no network access.

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
