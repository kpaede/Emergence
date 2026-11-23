# Emergence

**English** · [Deutsch](README.de.md)

Explore how your notes connect, develop ideas and build diagrams in Obsidian. Emergence brings these tasks together in a sidebar, so you can keep working in your note.

It grew out of philosophical concept work in a personal research vault. The relationship fields and layout are configurable; other research workflows have been less extensively tested.

## What you can do

| Your task | Where to start |
| --- | --- |
| Collect thoughts and excerpts by chapter | [**Companion Document**](#companion-document) follows your main note’s outline and offers Hierarchical Outline, EOME or Lineage for editing. |
| Understand and organize relationships between notes | [**Graph**](#explore-and-organize-your-notes) shows the current note in context, using your Breadcrumbs fields and existing links. |
| Find new connections | [**Field ideas**](#develop-new-connections) uses a local language model to suggest concepts. You choose which relationships to keep. |
| Draw a process, mind map or argument | [**Mermaid** and **Argdown**](#edit-diagrams-alongside-their-source) combine graphical editing with an always-visible source editor. |
| Compare four perspectives | [**Tetrader**](#tetrader) edits tetrads graphically using bold titles or Markdown headings at the same level. |
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

### Tetrader

The **Tetrader** tab edits tetrads using the original butterfly diagram. Open a tetrad using the pencil at the diagram edge or **Edit tetrad at cursor**. Click the title, a core text or a paragraph to edit it directly with native Obsidian link completion. Enter inserts a line break; Ctrl/Cmd+Enter or leaving the field applies; Escape cancels. Titles remain single-line. Text editing needs no dialogs or individual edit buttons.

The editor starts with replaceable “Enhances”, “Reverses into”, “Retrieves” and “Obsolesces” core texts and a “Gloss” in every wing. All fields are editable independently from the start. **New tetrad** and **Insert into note** remain separate actions. Starting another uninserted diagram keeps the previous content available through Undo. **Insert into note** inserts it at the cursor in the open Markdown note; subsequent edits save there automatically. The **Create a new tetrad in the editor** command opens this entry point directly. Before insertion, the header identifies the target note and says **not inserted yet**.

Click an insertion line to add a paragraph; its full width is clickable with a hit area at least 24 pixels high. Use **+** at the outer end to add the next paragraph. Empty new input closes without an error; clearing an existing gloss removes it. Clearing a core restores its basic law text without promoting a gloss. Upper wings grow upward; lower wings grow downward. Entries appear without list markers in the diagram. Existing paragraphs stay directly editable. Hover between existing paragraphs to insert another paragraph, or drag complete entries by the handles following the hovered text line on its left and right, including between wings. Click a handle or Ctrl/Cmd+click to select paragraphs; Shift+click selects a range. **Delete** or the delete button removes the selection. As in the original Tetrader, line breaks stay within the same paragraph; a blank line starts another gloss. Upper wings reverse whole paragraphs while preserving their internal line order. Visible lines wrap automatically and progress diagonally outward in each quadrant, even when a paragraph occupies one source line. Additional paragraphs receive paragraph spacing. Shaping and automatic wrapping never rewrite the saved text. Insertion handles add no vertical spacing. Existing Markdown list items retain their descendants as one movable unit. Undo, redo, appearance and full screen are available in the toolbar.

Drag handles remain reachable while editing. Their hit areas meet the text edge, and pressing a handle locks its position. After **Escape**, arrow keys navigate between text entries: left/right crosses to the corresponding entry, while up/down follows the visible order. Quadrants are not focus targets. Focus and selection are indicated on the text instead of rectangular block areas.

When moving an entry, a single line marks its insertion position. Both adjacent paragraph halves and their gap resolve to the same position. An active text edit is accepted before the move, while its drag handle remains mounted.

In **Settings → Emergence → Tetrader → Format of new tetrads**, choose bold section titles or headings with one to six `#`. This preference applies to new diagrams in the editor and the insert command. Existing diagrams keep their format in the file. All four section titles within a diagram must use the same format and heading level. The sections remain Enhances, Reverses into, Retrieves and Obsolesces. English aliases and German equivalents Verstärkt, Kehrt um in, Holt zurück and Verdrängt are recognized. Appearance settings provide the same visible labels in the diagram and editor.

In **Settings → Emergence → Tetrader**, **Legend position** places the legend below the diagram on the left or right, or hides it. The default is bottom right, as in the original Tetrader. **Center display** independently offers no center content, labels or a legend. The toolbar's appearance button changes these same global settings for the editor and rendered notes.

Example with bold section titles:

```markdown
> [!tetrad] Internet
>
> **Enhances**
>
> Communication with [[Media theory]].
>
> **Reverses into**
>
> Permanent availability.
>
> **Retrieves**
>
> Community across distances.
>
> **Obsolesces**
>
> Some location-bound forms of communication.
```

The first paragraph is the core statement; further paragraphs are glosses from the center outward. The original arrangement is retained. Both formats remain ordinary Markdown within a callout: Obsidian recognizes their links and embeds. Section changes are validated before acceptance and, when bound to a note, saved before the normal diagram view returns. Write conflicts protect external changes; reopen the current tetrad from its note. No recovery or draft copies are created. Previously saved custom callout identifiers remain readable; the old pattern-management interface is no longer offered.

The standalone Tetrader plugin is not required. Rendering is based on Tetrader 0.2.3, commit `77a502800ccc924ece5b6c027ca1b99794205b45`; its license is in `third-party/Tetrader-LICENSE.txt`. No network requests are added.

### Companion Document

The **Companion Document** tab collects entries alongside a main document’s headings. The feature never adds IDs, frontmatter or automatically changed headings to the main document. Open the main note and select **Create companion document** in the tab or command palette.

You can create several independent companions for the same main document and switch between them. With a companion open, use **Create another companion document** and **Select another companion document** in the document menu. These actions have no duplicate header icons. The picker lists companions with connection metadata; ordinary Markdown notes are not converted automatically. Deleted, missing or malformed files offer creation, selection and another check after restoration. Missing section files are never automatically replaced with empty files. If the main document is missing, entries stay readable and a replacement main document can be selected. Unsaved edits to a missing companion are rejected; no recovered copies are created.

Choose **File layout for a new companion** directly in the start view: **All chapters in one companion file** or **One file per chapter**. This choice stays editable in the creation dialog when general storage defaults are selected. Existing companions display their saved layout beside the **Entry view** selector; the new-document choice does not convert existing files. Frontmatter stores the layout in `emergence-storage.mode` (`document` or `sections`), with `emergence-companion-role` identifying shared files (`document`), chapter overviews (`index`) and chapter files (`section`). Chapter files link to their overview through `emergence-parent-companion-id`. Unambiguous older files without an explicit role remain readable; conflicting metadata stops reconciliation.

In **Settings → Emergence → Companion Document**, choose creation defaults: one shared companion file or one file per heading, stored beside the original, in a fixed vault folder, or in a named subfolder beside the original (default: `Companions`). When creating a pair, choose **Use general defaults** or **Customize for this document**. The resulting location is saved per pair; later default changes apply to new pairs. Missing folders are created. With section files, an extra Markdown index stores the outline, file links and assignment metadata; entries live only in the section files. Heading renames keep file names stable. Relative storage follows source-folder moves; a fixed folder stays in place.

The chapter navigation uses Obsidian’s heading metadata and live editor syntax tree, with native Outline theme classes. It follows the writing cursor; the crosshair toggles this behavior. Entries stay separate from the chapter tree. The **Entry view** selector sits directly after the outline in the editing area and offers the installed **Excerpt Outline Mindmap Editor** and **Lineage** in the same panel. **Hierarchical Outline** needs no other plugin. It shows complete sibling texts between short parent and child previews, with arrow-key navigation, Enter to edit, Markdown editing, task checkboxes and subtree moves. Ctrl/Cmd+←/→ adds siblings and Ctrl/Cmd+↓ adds a child, as in EOME. ↑/↓ selects the previous/next entry at the same level; ← selects its parent and → its first child. New entries are edited directly at their insertion position. Drop entries onto the free area below the list to append them at that level, retaining their complete subtrees. A marker identifies the target; undo restores the original structure. The editor starts at one line and grows with the text, with confirm and cancel icons in the same row. Escape also cancels when either action has focus; an open link suggestion closes first. **Hide checked** hides completed branches while keeping checked ancestors that connect open descendants. In the editor, Enter saves outside lists; Shift+Enter inserts a line break. Link completion comes directly from Obsidian. Escape cancels. Entries use plain indented Markdown; only chapter headings carry stored identifiers. Failed reader edits are rejected and the current file is shown; no recovery document is created. All three views use the same companion files. **Hierarchical Outline** is the default and appears first. Change it under **Settings → Emergence → Companion Document → Default view**. Explicit choices saved for an individual companion remain in effect. Disabled plugins have an activation button. The main tabs remain in one horizontally scrollable row; each editor provides its own search and editing controls below the chapter navigation.

In **Hierarchical Outline**, hover between entries or at either end of the list to reveal a full-width insertion line. Clicking it adds an entry at the same level. Drag and drop uses the same boundary from either neighboring entry. Completed entries also have a strikethrough; necessary ancestors remain available when completed entries are hidden.

In **One file per chapter** mode, the outline shows **File missing** or **Check file** beside affected chapters. Each file button opens that chapter’s Markdown in an Obsidian tab and reuses an existing tab. The button is disabled for missing files. Missing or unreadable chapters do not block the rest of the outline or editing available chapters. Heading changes continue to reconcile; unavailable files are never treated as empty or automatically recreated. Restored files are read again. For a missing file, the view offers **Select existing file** or **Create new empty chapter file** using the stored location and naming pattern.

Both original views use the installed plugins’ registered components, including their original text editors, keyboard navigation, subtree operations and undo controls. EOME’s checkbox controls are enabled on hover by default and remain configurable in its settings. No working copy or additional workspace leaf is created. Native view options are kept locally per section. The main document is never given to either editor for writing.

New companion sections use EOME’s version-2 Markdown convention: structural tabs identify entries, and two extra spaces identify continuation lines. Paragraphs, internal lists, quotations, headings and code belong to a single entry unless an actual child node is created. Existing legacy sections are projected according to their old hierarchy and receive the new format when a changed section is saved. Unsupported legacy prose stops that conversion for review. Unedited sections retain their original text. The file-boundary grammar is adapted from EOME (MIT; `third-party/companion-outline-LICENSE.txt`).

Inside Emergence, the Lineage adapter transfers complete contents through its native node model and serializes that model without trimming card text. This preserves leading/trailing whitespace and code containing section-comment examples. This adaptation applies to the embedded view; standalone Lineage retains its own format limitations. Conflicting writes are rejected and the actual saved contents are reloaded. Switching views waits for EOME’s active edit to finish.

EOME and Lineage remain separately installed original plugins. Emergence does not require a locally modified build. The shared companion format follows EOME’s multiline Markdown format; Lineage is connected through its native node model. Required editor capabilities are checked when loading. If a plugin version is incompatible, the companion file remains accessible as Markdown.

Display difference: Lineage 0.8.5 can collapse entered paragraphs outside edit mode in the tested configuration. Stored text remains intact. Emergence retains the original text rendering; entry hierarchy and Markdown storage are independent of this display behavior.

Both entry views follow the Obsidian theme, including text editors and new entries. Shared initial typography, compact cards and 100 percent starting zoom are applied once as local native options; later explicit changes are retained. Drag the outline divider or use its arrow keys to resize it. Wide views place the outline beside the editor. The [presentation contract and integration boundary](docs/companion-presentation.md) describe ownership and the remaining version-specific interfaces.

A reverse index rebuilt from companion YAML and Obsidian’s metadata cache finds companions when the main document is opened, even after restarting. It does not depend on the backlinks pane or add metadata to the main document.

The main-document link is stored in companion YAML as `emergence-main-document`. Stored section IDs appear only in companion files. Individual entries have no stored identifiers; their working references exist only for the current session. Synchronization uses editor/file events, coalesces heading changes and performs no polling while idle. Ordinary paragraph typing does not write companion files. Ambiguous or missing sections retain their entries under **Review assignment**; assign them to a current section or keep them without one. Removed or duplicated section IDs stop automatic reconciliation until the assignment is corrected.

Concurrent edits protect the external version. An outdated change is rejected with an error and the actual saved version is displayed. No view drafts or export copies are created. Multi-file operations use a local recovery journal. **Try recovery** rolls back completed steps only when it can protect newer external changes. When recovery conflicts, the dialog shows the previous and planned file contents. After reviewing them, you can explicitly keep the current state without overwriting files. This is not a cross-device filesystem lock; cloud conflict copies still require review.

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
git clone --branch 0.0.5 https://github.com/kpaede/Emergence.git
cd Emergence
npm ci
npm run build
```

Copy `main.js`, `manifest.json` and `styles.css` to the plugin folder described above. For development, use `npm run dev`; run `npm test` and `npm run lint` to check changes. Native UI checks additionally require a running Obsidian development vault with its CLI enabled.

</details>

License: [Zero-Clause BSD](LICENSE). Component licenses and notices are included in [third-party](third-party/).
