# Prüfstand: Feldideen, Graph und Literaturaktionen

Stand: 1. November 2026. Dieser Prüfstand gehört zum Quellstand für Release **0.0.2**. Der frühere Tag 0.0.1 bleibt unverändert.

## Umfang und erhaltene Funktionen

Es gibt genau drei Haupttabs: **Graph** (`network`), **Feldideen** (`text-search`) und **Suche** (`search`). Recherche, freie Fragen, Kunstwerkprüfung, Rechercheergebnisse, Fortsetzung, Vorlageneditor und deren eigene Modellpfade sind entfernt. Die alte Einstellung `inquiryTemplates` wird beim Laden einer vorhandenen Konfiguration verworfen; Modell, Profile, Feldbeschreibungen, Frontmatter und Rücknahmejournal werden dadurch nicht geändert. Hierfür gibt es zwei Migrationsregressionen.

Erhalten sind lokale Feldideen mit bis zu vier Vorschlägen je Breadcrumbs-Feld, bearbeitbare Prompts/Feldrollen, optionaler Wikipedia-/Webkontext für diese Feldideen, vollständige Vorbereitung langer Notiztexte, manuelle Ein-Klick-Freigabe, kurze Wikilinks, Wiederverwendung vorhandener Notizen und kontrolliertes Schreiben mit Rücknahmejournal. Fehlende Ziele erzeugen weiterhin nur Wikilinks. Die sieben Synopsengruppen, getrennte Sichttiefen, Mehrfachüberordnung, Gegenrichtungen und die Frontmatter-Reihenfolge bleiben erhalten. ZotLit-Suche, kanonisches CSL-Literaturverzeichnis, Citekey-Kopie und native Obsidian-Navigation sind unabhängig von der entfernten Recherche.

## Graphaktualisierung, Rückverweise und Literatur

Die bisherige Ansicht „Relationssynopse“ heißt in Auswahlliste, zugänglichen Beschriftungen, Hoverquelle und Meldungen jetzt **Kontext**. Interne IDs, bestehende Feldzuordnungen und gespeicherte Sichttiefen bleiben erhalten.

Notiz-/Ordnerumbenennungen führen aktive Auswahl und unabhängigen Erkundungsfokus auf den neuen Pfad; die Synopse wird unmittelbar mit dem neuen Dateinamen neu aufgebaut. Die verzögerte Breadcrumbs-Aktualisierung bleibt erhalten. Rückverweise unter „Freie Verweise“ werden ausschließlich aus Obsidians `metadataCache.resolvedLinks` abgeleitet, einschließlich Properties-Links, einmal pro Markdown-Quelle und ohne Selbstlinks. Es gibt dafür keine neue Relationssemantik oder Frontmatter-Schreiboperation.

Literaturangaben in Graph und Suche sind auswählbarer, unverändert durch ZotLit CSL-formatierter Text. Die sechs getrennten Aktionen lauten: ZotLit Library (registriertes ZotLit-Logo zuerst), Literaturnotiz (`file-text`), Zotero (`external-link`), Anhang (`paperclip`), Fundstelle (`chevron-right`), Citekey kopieren (`copy`). Der Schlüssel erscheint ausschließlich in zugänglicher Beschriftung und Kopiertooltip. Die Aktionszeile benötigt im Ruhezustand keinen Platz und wird beim Überfahren der jeweiligen Literaturangabe oder bei Fokus eingeblendet; ohne Hovermöglichkeit bleibt sie erreichbar und sichtbar. Farben, Fokus und Icons stammen aus dem Theme beziehungsweise den nativen Obsidian-Helfern.

Die Notizaktion delegiert an ZotLits eigenes `citekeyEditor.openIndexedKey` (kann nach dessen Regeln eine Literaturnotiz anlegen); Mittelklick verlangt einen neuen Tab. Zotero- und Anhangsaktionen verwenden dessen kanonische Item-/Gruppenidentitäten und `zotero://select` beziehungsweise `zotero://open`. Mehrere Anhänge erhalten ein natives Auswahlmenü. Fundstellen folgen den tatsächlichen ZotLit-Citation-Positionen und werden zyklisch erreicht. Fehlende Daten deaktivieren nur die betreffende Aktion. Die Suche lädt Fundstellen und CSL-Kontext bei Notizwechsel neu; der Suchbereich bleibt die gesamte Library. ZotLits interne Service-Schnittstelle bleibt eine Versionsabhängigkeit.

Zwölf neue Regressionstests prüfen Pfadwechsel/Ordnergrenzen, Obsidian-Rückverweise, unveränderten CSL-Text ohne Navigationslink, die sechs Aktionen, ausgeblendete Citekeys, alle drei Kopierformate, verspätete UI-Antworten, persönliche/Gruppen-Libraries, Anhangsfilter, echte Fundstellenreihenfolge und Teilfehler der Datenbank. Sie öffnen keine externen Anwendungen und schreiben keine Notizen.

## Gemeldete Source- und CSS-Hinweise

| Gemeldeter Hinweis | Änderung |
| --- | --- |
| Globale Timer in Graph/Provider | `window.setTimeout` und `window.clearTimeout`; beide früheren Lint-Ausnahmen entfernt. |
| `fetch` für Ollama/Wikipedia | Gemeinsame Grenze `src/llm/request.ts` mit Obsidian `requestUrl`; keine entsprechenden Produktionsausnahmen im Linter. |
| Fehlende `getSettingDefinitions()` | Vier echte native Settings-Seiten mit suchbaren Namen/Aliasen und vorhandenen Editoren; kein leerer Definitions-Stub. Typen aus der offiziellen API 1.14.4. |
| SVG per DOM-Namensraum | Öffentlicher Obsidian-Helfer `diagram.createSvg`. |
| Erweiterte Textdekoration fehlender Links | Eigene Dekorationsfarbe/-art entfernt; native Linkfarbe und Transparenz des Themes bleiben. |
| `column-gap` als Multicolumn-Befund | Grid-Abstände gleichwertig über `gap: 0 …`; keine Mehrspalten-Textlayouts. |
| `:has` | Vollständig entfernt. Explizite Literaturzeilenklasse, Flex-Umbruch für Settings und Entfernen unbenutzter alter Graphregeln. |

Der vollständige ESLint-Lauf besteht ohne Fehler und ohne Warnungen. Die gemeldeten CSS-Konstrukte sind im Stylesheet nicht mehr vorhanden. Die externe Obsidian-Review wurde für diesen Arbeitsstand nicht erneut ausgeführt; ihr Ergebnis wird nicht vorweggenommen.

## Netzwerk, Abbruch und Modellidentität

Alle direkten Ollama-Anfragen beginnen am konfigurierten HTTP-Loopback-Endpunkt; Cloudmodelle werden anhand der Modellmetadaten ausgeschlossen. Keine Telemetrie und kein Cloudfallback. Wikipedia erhält ausschließlich den sichtbaren Suchbegriff an den fest vorgegebenen Wikipedia-Hosts. Die optionale Websuche erhält ebenfalls nur ihre sichtbare Suchanfrage.

`requestUrl` unterstützt keinen physischen `AbortSignal`-Abbruch und liefert vollständig gepufferte Antworten. Emergence beendet bei Abbruch/Zeitlimit das Warten, räumt Timer/Listener auf und verwirft späte Antworten. Eine noch laufende native Anfrage blockiert weitere Anfragen an denselben Endpunkt bis zum tatsächlichen Abschluss; ein bewusst eingestellter anderer Loopback-Endpunkt bleibt erreichbar. Größenlimits werden nach Empfang vor der JSON-Verarbeitung geprüft. Dies ist kein Downloadlimit auf Transportebene.

Endpunkt und Modell werden für Fähigkeitenprüfung und Anfrage festgehalten. Ändern sie sich während eines laufenden Checks, wird dessen Ergebnis nicht unter der neuen Identität veröffentlicht. Ein fehlendes optionales `/version` darf „unbekannt“ ergeben; Abbruch oder Timeout darf keinen startbereiten Zustand vortäuschen. Fünf zusätzliche Regressionen decken diese Wechsel-/Timeoutfälle ab; insgesamt bestehen 40 gezielte Provider-/Wikipedia-Tests.

Ein tatsächlicher Obsidian-Probe mit zwei temporären Loopback-Servern bestätigt: `requestUrl` folgt HTTP-307-Weiterleitungen einschließlich POST-Body. Die öffentliche API bietet keine Redirectsteuerung und keine finale Ziel-URL. Der konfigurierte lokale Dienst muss vertrauenswürdig sein. Für diesen Probe wurden ausschließlich Dummy-JSON und lokale Server verwendet; keine Notiz- oder Modelldaten. Die Server wurden geschlossen. Beleg lokal: `docs/request-url-redirect-check.json`.

## Native Einstellungen und Suche

Die vier Bereiche Modell, Beziehungen, Profile und Daten verwenden Obsidian-eigene navigierbare Settings-Seiten. Tatsächliche Modellparameter, Felder, Profilnamen und Datenoptionen sind indexiert. Registrierung erzeugt weder Entwurfänderungen noch Netzwerkaufrufe. Änderungen bleiben bis „Änderungen speichern“ ein Entwurf; „Entwurf verwerfen“ stellt gespeicherte Werte wieder her. Obsidian ruft `hide()` auch bei nativen Seitenwechseln auf. Daher verwirft diese Methode den Entwurf nicht mehr; ausdrücklich Speichern/Verwerfen beendet ihn. Der zunächst im nativen Test entdeckte Entwurfsverlust beim Seitenwechsel ist damit behoben.

Jeder gerenderte Editor besitzt einen eigenen Mount-Kontext und eine Cleanup-Funktion. Dadurch können mehrere Suchtreffer gleichzeitig sichtbar sein, ohne auf die falsche Sektion zu schreiben. Der Entwurf wird gemeinsam gehalten; aktives Speichern sperrt Doppel-Saves, und später hinzugefügte Entwurfsänderungen werden nicht überschrieben. Die native Außenscrollfläche übernimmt das Scrollen, zusätzliche innere Fenster und abgeschnittene Fußleisten entfallen. Bei weniger als 360 Pixeln Editorbreite stehen Beschriftung und Control untereinander; ein fester Flex-Basiswert wurde entfernt, damit vertikale Theme-Zeilen keine künstlichen Leerhöhen erhalten. Die Settings-Aufnahmen wurden im tatsächlichen separaten Einstellungsfenster von Obsidian 1.15.0 erstellt. Definitionen und Migration haben eigene Unit-Tests.

## Visuelle Prüfung mit ui-design-review

Verwendet: [ui-design-review/SKILL.md](https://github.com/mastepanoski/claude-skills/blob/main/skills/ui-design-review/SKILL.md) einschließlich dessen Referenzen zu Evaluationsdimensionen und Reviewverfahren. Referenz ist Obsidian selbst: Properties-Links, native Settings-Controls und die Originalansichten der integrierten Plugins. Es wurden keine eigene Farbpalette, Schriftfamilie, Branding-Fläche oder neuen Bitmap-Assets eingeführt. Die Wertungen sind heuristische Einschätzungen für diesen Desktop-Seitenpanel-Kontext, keine Messung mit Testpersonen oder allgemeine WCAG-Zertifizierung.

| Dimension | Einschätzung (1–5) | Konkrete Evidenz/Änderung |
| --- | --- | --- |
| Visuelle Hierarchie | 4 | Drei gleich breite beschriftete Tabs, eine primäre Feldideenaktion, weitere Einrichtung aufgeklappt bei Bedarf. |
| Typografie | 4 | Obsidian-UI-/Interface-/Linkvariablen; Feldideenzeilen verwenden `--line-height-normal`; keine erzwungenen normalen Linkkursiven. |
| Farbe | 4 | Farben über Themevariablen, vorhandene und fehlende Links über native Farbe/Opacity; keine neue Palette. |
| Abstände | 4 | Wiederverwendete Obsidian-Abstandstokens; feste Synopsenabstände bleiben dort erhalten, wo gemessene Liniengeometrie sie benötigt. |
| Konsistenz | 4 | Einheitlicher Notizlinktyp; wiederverwendete Buttons/Dropdowns, ZotLits ursprüngliche CSL-Formatierung unverändert. |
| Grafiken | 4 | Lucide-Icons und funktionale Relationlinien; SVG mit nativem Helfer. |
| Raster | 4 | Drei Tabspalten; gemeinsam ausgerichtete laterale Überschriften-/Plus-/Tiefenspuren; Literaturzeilen ausdrücklich über volle Breite. |
| Komponenten | 4 | Native Fokus-/Hover-/Disabled-Zustände; flexible Settingszeilen statt `:has`; kompakte Desktop-Iconaktionen. |
| Produktkonvention | 5 | Aktives Obsidian-Theme statt einer eigenen darübergelegten Gestaltung. |
| Zeitgemäße Umsetzung | 4 | Native Settings-Suche, entfernte fragile Selektoren und keine verschachtelten künstlichen View-Fenster. |

Priorisiert behoben: fragile `:has`-Layouts, fehlende Settings-Suche und DOM-Helferhinweis; anschließend die leere vierte Tabspalte, erweiterte Linkdekoration und themeunabhängige Feldideen-Zeilenhöhe. Native Styles können absichtlich kontrastarme oder sehr große Nutzereinstellungen enthalten; eine universelle Aussage über beliebige Themes wäre nicht belegt.

## Build und Prüfungen

- `npm run build`: TypeScript und Produktionsbundle erfolgreich.
- `npm test`: **244 bestanden**, sechs optionale Modelltests im Standardlauf übersprungen. Die geringere Zahl gegenüber dem vorigen Release beruht auf entfernten Recherchetests; erhaltene Feldideen-/Writer-/Graph-Regressionsprüfungen bleiben aktiv.
- `npm audit --omit=dev --audit-level=high`: keine bekannten Schwachstellen in Produktionsabhängigkeiten.
- `npm run lint`: **0 Fehler, 0 Warnungen**; keine Ausblendung der gemeldeten Source-Regeln.
- `npm run test:ux`: zwölf Kombinationen aus Graph/Feldideen/Suche, 280/328 Pixeln und hell/dunkel im aktiven Theme bestanden. Vier kompakte synthetische Feldideen, Tab-Tastaturbedienung, Themefarben/-Transparenz vorhandener und fehlender Notizlinks, kein horizontaler Überlauf; keine gespeicherte Einstellung und keine Notiz geändert.
- `npm run test:literature-scroll`: **16 isolierte native Layoutfälle** aus Kontext-/Suchscrollcontainer, 280/328 Pixeln, hell/dunkel und zwei Scroll-/Ankerpositionen bestanden. Vorher wurde die unerwünschte Gegenbewegung gezielt mit einem folgenden Scrollanker reproduziert: Scrollposition +34 Pixel, Literaturtext −34 Pixel, nachfolgende Überschrift unverändert. Mit `overflow-anchor: none` ausschließlich auf den beiden Emergence-Scrollcontainern bleiben Scrollposition und Literaturtext in allen Fällen unverändert; der Inhalt darunter rückt beim Einblenden um die zusätzliche Aktionshöhe nach unten. Acht neue Screenshots, keine Laufzeitfehler. Synthetische Literatur-/Notizdaten und ein bewusst gewählter unterer Ankerkandidat; keine Vault-Notiz gelesen oder geändert, keine Konfiguration gespeichert. Bericht unter `docs/literature-scroll/`. Grundlage: [CSS Scroll Anchoring – Ausschluss von Ankern](https://drafts.csswg.org/css-scroll-anchoring/#exclusion-api).
- `npm run test:literature-ui`: acht aktuelle Layoutfälle (Graph/Suche × hell/dunkel × 280/328 Pixel), 16 Screenshots mit ein-/ausgeblendeten Aktionen, kein horizontaler Überlauf. Tatsächliche Mausbewegungen zeigen ausschließlich die zugehörige Aktionszeile; sie belegt ausgeblendet keine Höhe. Fokus kann Zeile und Bedienelemente erreichen. Originale ZotLit-CSL-Darstellung in Graph und Suche identisch; drei Kopierformate, unsichtbarer Citekey und exakte Library-Identität bestätigt. Rückverweise entsprechen dem aktuellen Obsidian-Index und folgen nach den freien Verweisen. Umbenennungen werden mit dem tatsächlichen GraphPanel und einer isolierten Speicherkopie geprüft: zentrale Beschriftung sofort neu, auch bei eigenständigem Erkundungsfokus, unverwandte Umbenennung unverändert. Keine echte Vault-Notiz umbenannt oder geschrieben, keine Benutzerkonfiguration gespeichert und keine Laufzeitfehler. Bericht und Screenshots liegen lokal unter `docs/literature-actions/`.
- `npm run test:workspace`: Notiz-/Library-Suche, Öffnen/Erkunden, Mittelklick, originales CSL und Library-Aktionen bestanden. Der Test verwendet für Library-Aktionen einen bereits indexierten Citekey; ein beliebiger aktueller Notiztitel muss selbstverständlich keine Literaturtreffer haben. Keine Notiz geschrieben oder Datei angelegt.

- `npm run test:settings-ui`: Vier echte Settings-Seiten in hell/dunkel bei 280/328 Pixeln verfügbarer **Editorbreite**, insgesamt 16 Layoutfälle, bestanden. Die äußeren nativen Theme-Ränder bleiben erhalten. Entwurf bleibt ungespeichert und überlebt Seitenwechsel; Verwerfen stellt ihn zurück. Native Suche nach „Kontextfenster“ bzw. „Citekey“ öffnet die passenden Modell-/Dateneditoren. Gefundene Editoren aktualisieren ihre eigenen Controls. Keine Einstellung gespeichert.
- Zusätzliche `test:ux`-Läufe mit dem bereits installierten **Minimal**-Stylesheet und den **Obsidian-Basisstyles** bestanden: jeweils dieselben zwölf Fälle, insgesamt 36 UI-Fälle über diese beiden Varianten und das aktive **Typomagical**. Nur temporär die Stylesheet-Darstellung ausgetauscht, danach ursprüngliches Stylesheet und Themezustand wiederhergestellt; keine Theme-Einstellung gespeichert.
- `node scripts/field-ideas-native-check.mjs`: **qwen3.5:9b**, tatsächlicher Obsidian-`requestUrl`-Transport und ausschließlich synthetischer Ontologie-Text. Vier vollständige Pending-Ideen, vorhandene Philosophie mit `[[Philosophie]]` enthalten; 24 Sekunden für Verbindungsprüfung, Wikipedia und Modell zusammen. Wikipedia liefert einen tatsächlichen Artikel. Benutzerkonfiguration und vorherige Analyse unverändert; keine Vault-Notiz ans Modell gesendet oder geschrieben.

`node scripts/synopsis-native-check.mjs --layout-only` besteht zusätzlich: acht Fälle aus 280/328 Pixeln, hell/dunkel und 100/200 Prozent Schriftgröße, jeweils 165 Notizdarstellungen, vollständige sieben Gruppen, lange Begriffe, 24 tiefe Schritte, Kreise und getrennte Sichttiefen. Kein horizontaler Überlauf und keine Linie durch eine Beschriftung. Zwölf neue Screenshots. Ausschließlich synthetische Layoutdaten; keine Einstellungen gespeichert und kein Datei-Unverändertheitsnachweis behauptet.

Der ältere vollständige `test:synopsis`-Lauf mit Datei-/Navigationsprüfung konnte in dieser Sitzung nicht wiederholt werden: Sein Bytevergleich findet den vom laufenden Obsidian gemeldeten aktiven Notizpfad nicht als lokale Datei. Er brach bereits vor den UI-/Navigationsaktionen ab. Es wurde kein positives Ergebnis dafür eingetragen und keine neue Datei angelegt. Daten-/Geometrie-Regressionsprüfungen der Synopse sind Teil der 244 bestandenen Tests; die aktuellen UI-Fälle prüfen die realen sichtbaren Synopsen und ihre Themezustände. Die übrigen Originalansichten sind gegenüber dem vorigen geprüften Stand unverändert; deren vollständiger bisheriger Integrationstest benötigt eine aktuell lokal verfügbare zitierende Notiz.

Lokale Berichte/Screenshots können Vault-Bezüge enthalten und werden nicht veröffentlicht. Persönliche Konfiguration, Notizinhalte und generierte Bundles bleiben vom Git-Quellbestand ausgeschlossen. Die versionsabhängigen Adapter an Breadcrumbs/ZotLit/native Obsidian-Views bleiben eine dokumentierte Integrationsgrenze; absolute Fehlerfreiheit wird nicht behauptet.
