# Abgleich mit dem Argdown-Leitfaden

Stand: 12. November 2026, Beta 0.0.4. Abgeglichen wurden die Kapitel des [offiziellen Leitfadens](https://argdown.org/guide/) und die [Syntaxreferenz](https://argdown.org/syntax/) mit `src/argdown/`. „Syntax unterstützt“ bedeutet nicht automatisch „grafisch bearbeitbar“. Die Integration deckt den Leitfaden noch nicht vollständig als GUI ab.

## Bezeichnungen

Die deutsche Oberfläche benennt die fachlichen Elemente nach Argdown; eine englische Oberfläche ist ebenfalls verfügbar. Englische Originalbegriffe stehen hier zur eindeutigen Zuordnung.

| Originalbegriff | Oberfläche / Bedeutung |
| --- | --- |
| Statement | **Aussage**; **Aussage bearbeiten** öffnet Titel und Text gemeinsam |
| Argument / argument description | **Argument** / **Beschreibung**; **Argument bearbeiten** öffnet Titel und Beschreibung gemeinsam |
| Node | **Knoten** ist nur der allgemeine graphentheoretische Oberbegriff; Bearbeitungsaktionen nennen den konkreten Typ |
| Group / subgroup / cluster | **Gruppe** / Untergruppe in der Argumentkarte, auch verschachtelt |
| Section / subsection / heading | **Abschnitt** / Unterabschnitt / Überschrift im Quelltext; Abschnittsfilter behalten diese Bezeichnung |
| Logical reconstruction | **Rekonstruktion**; ersetzt „Herleitung“ in Werkzeugen, Navigation und Rahmenbeschriftungen |
| Premise / conclusion / main conclusion | **Prämisse** / **Schlussfolgerung** / **Hauptschlussfolgerung**, statt „Grund“ / „Ergebnis“ |
| Inferential step / inference rule | **Inferenzschritt** / **Schlussregel** |
| Premise-conclusion structure (PCS) | Prämissen-Schlussfolgerungs-Struktur eines Arguments |
| Inference tree | Inferenzbaum; keine zusätzliche Quelltextstruktur |
| Support / attack / undercut | Unterstützung / Angriff / Unterminierung |
| Entails / contrary / contradictory | Logische Folgerung / Unvereinbarkeit (Kontrarietät) / Widerspruch (Kontradiktion); der Prozessor bestimmt die Interpretation nach Elementtypen und `model.mode` |
| Equivalence class / reference / mention | Äquivalenzklasse / Verweis / Erwähnung; derselbe Titel bezeichnet dieselbe Klasse, gleiche Texte allein tun das nicht |

Belege: [Elemente](https://argdown.org/guide/elements-of-an-argument-map.html), [Gruppen und Abschnitte](https://argdown.org/guide/creating-group-nodes.html), [Rekonstruktionen](https://argdown.org/guide/creating-oldschool-argument-maps-and-inference-trees.html), [Syntax](https://argdown.org/syntax/).

## Vollständiger Kapitelabgleich

| Kapitel / Thema | Tatsächlich vorhanden | Grenze / Abweichung |
| --- | --- | --- |
| Getting started, Installation in VS Code / CLI, erstes Beispiel | Obsidian-Tab, lokale Vorlagenbibliothek, Einfügen und Bearbeiten des konkret gewählten Notizblocks | VS-Code-Erweiterung und CLI werden nicht installiert; eigenständige Werkzeuge |
| [Elements of an argument map](https://argdown.org/guide/elements-of-an-argument-map.html) | Aussagen, Argumente, Gruppen und native Beziehungstypen; ursprüngliche Farben und Formen bleiben erhalten | Auswahlmarkierungen und Ziehgriffe gehören zum Editor, nicht zur gespeicherten Darstellung |
| [Changing the graph layout](https://argdown.org/guide/changing-the-graph-layout.html) | Richtung, sechs Graphviz-Verfahren, Ebenen- und Knotenabstände in **Darstellung**; Zoom und Einpassen | `sameRank`, `rank`, `newrank`, weitere Graphviz-Attribute nur Code. Dagre und yEd/GraphML fehlen |
| [Creating statement and argument nodes](https://argdown.org/guide/creating-statement-and-argument-nodes.html) | Hinzufügen, sechs native Aussage-Auswahlmodi, Abschnitts- und Tagfilter | Include-/Exclude-Titellisten, `isInMap` und weitere Auswahlflags nur Code. Unverbundene Elemente sind in dieser Editorintegration standardmäßig sichtbar, abweichend vom allgemeinen Prozessorstandard; explizites `excludeDisconnected` wird respektiert |
| [Creating edges](https://argdown.org/guide/creating-edges.html) | Unterstützung, Angriff und Unterminierung per Ziehen, Widerspruch, native strikte Interpretation, Umkehren und Entfernen | Abgeleitete Beziehungen bleiben an ihre tatsächlichen Prämissen und Schlussfolgerungen gebunden. Mehrdeutige Änderungen werden geschützt; keine erfundenen freien Beziehungstitel |
| [Oldschool argument maps and inference trees](https://argdown.org/guide/creating-oldschool-argument-maps-and-inference-trees.html) | Eigene Rekonstruktionsansicht mit zugehörigem Quelltext, Prämissen, Schlussfolgerungen, Schlussregeln, mehreren Inferenzschritten und beiden `uses`-Positionen; gemeinsame Aussagen wiederverwenden; Mehrfachauswahl und Entfernen | Öffnen einer bestehenden Rekonstruktion verändert ihre Sichtbarkeit nicht. Einzelne Sichtbarkeitsausnahmen und beschriftete Übersichtsrahmen sind Integrationsfunktionen, siehe unten |
| [Creating group nodes](https://argdown.org/guide/creating-group-nodes.html) | Gruppen erstellen, verschachteln, ganze Unterbäume verschieben, ein-/ausklappen, auflösen, Farbe wählen; native Zuordnung anhand der Abschnitte | `groupDepth`, explizite Gruppenauswahl, `isGroup` und `regroup` nur Code. Bei `regroup` sind unpassende Quelltext-Verschiebungen geschützt |
| [Changing the node style](https://argdown.org/guide/changing-the-node-style.html) | Native Beschriftungsmodi, globale Formen und Titel-/Textgrößen; ein Bearbeitungsdialog pro Aussage/Argument, der die kanonische Formulierung bearbeitet und Titelverweise gemeinsam umbenennt | `isCanonical`, Schriftfamilie/-stärke, Entfernen von Tags und weitere Stile nur Code; kein grafischer Formulierungswähler |
| [Changing the node size](https://argdown.org/guide/changing-the-node-size.html) | Mindestbreiten und Schriftgrößen unter **Darstellung** | `charactersInLine`, `measureLineWidth`, `lineWidth`, Ränder und weitere Parameter nur Code; keine eigenen Messalgorithmen |
| [Adding images](https://argdown.org/guide/adding-images.html) | Bildmetadaten können im Quelltext erhalten bleiben | Bilddarstellung und automatische lokale Größenbestimmung fehlen; SVG-Bildobjekte werden entfernt, es werden keine Bilder nachgeladen |
| [Colorizing maps](https://argdown.org/guide/colorizing-maps.html) | Native Elementfarbe, Gruppenfüllung, Farbschemata und typweite Schriftfarben; CSS-Palette und Farbrad schreiben Hexwerte. Schriftfarbe auch direkt vom ausgewählten Element und in der Rekonstruktionsansicht erreichbar | `tagColors`, Prioritäten, eigene Schemata, Titel-Farbzuordnungen, Relationstypfarben und Ignorierflags nur Code. Keine zusätzliche unabhängige Schrift-/Rahmen-/Füllfarbe pro Element eingeführt |
| [Logical symbols and emojis](https://argdown.org/guide/using-logical-symbols-and-emojis.html) | Unicode und native Kurzformen | Eigene Kurzformen nur Code; kein Symbolpicker und keine mitgelieferte ArgVu-Schrift |
| Publishing argument maps / [Web-Komponente](https://argdown.org/guide/embedding-your-maps-in-a-webpage.html) | Karte als Notizblock einfügen und lokal in Obsidian anzeigen | Keine Web-Komponenten-/HTML-Veröffentlichung, kein SVG-/PNG-/GraphML-Export |
| [Using Argdown in Markdown](https://argdown.org/guide/using-argdown-in-markdown.html) | Exakte Blockbindung, Live Preview und Leseansicht | Bewusste bestehende Integrationsabweichung: Hier zeigen sowohl `argdown` als auch `argdown-map` die Karte; die dokumentierten Markdown-Exporter unterscheiden hervorgehobenen Code (`argdown`) von Karte (`argdown-map`) |
| [Publishing with Pandoc](https://argdown.org/guide/publishing-argdown-markdown-with-pandoc.html) | Nicht integriert | PDF-/LaTeX-/Bildexport über Pandoc fehlt |
| [Integrating Argdown Markdown into applications](https://argdown.org/guide/integrating-argdown-markdown-into-applications.html) | Obsidian-Codeblockprozessor und lokales `@argdown/core` | Keine zusätzliche Integration in remark, markdown-it, marked oder Eleventy |
| [Configuration files](https://argdown.org/guide/configuration-with-config-files.html) | Keine externe Dateisuche | `argdown.config.*` und ausführbare Konfigurationsdateien werden nicht geladen |
| [Frontmatter configuration](https://argdown.org/guide/configuration-in-the-frontmatter-section.html) | Native YAML-Frontmatter zwischen `===`; grafische Einstellungen schreiben reguläre Konfiguration; unbekannte Felder und Kommentare bleiben erhalten | Nur die tatsächlich eingebundenen Prozessoren können ihre jeweiligen Einstellungen ausführen |
| [Running custom processes](https://argdown.org/guide/running-custom-processes.html) | Fest eingebundene lokale Parser-, Modell-, Karten-, Farb- und DOT/SVG-Verarbeitung | Keine frei konfigurierbaren Prozesse/Exports; `process` lädt keine zusätzlichen Programme |
| [Configuration cheatsheet](https://argdown.org/guide/configuration-cheatsheet.html) | Häufige Karten-, Auswahl-, Farb- und DOT-Einstellungen grafisch; weitere Optionen im Quelltext | Kein vollständiges Formular für jedes Feld; `html`, `webComponent`, `graphml`, `dagre`, Dateiexport und externe Bilder sind damit nicht automatisch implementiert |
| Extending Argdown / [custom plugins](https://argdown.org/guide/writing-custom-plugins.html), [loading plugins](https://argdown.org/guide/loading-custom-plugins-in-a-config-file.html), [application integration](https://argdown.org/guide/using-argdown-in-your-application.html) | Offizieller Prozessor; eingebettetes Graphviz; eigene Editoroperationen als lokale Integration | Keine vom Dokument nachgeladenen Plugins, kein Ausführen von Konfigurations-JavaScript |

## Darstellung und Farben

Die früheren zusätzlichen CSS-Regeln für Theme-Flächen und automatischen Textkontrast sind entfernt. Aussagen behalten den nativen weißen Hintergrund und ihren farbigen Rahmen, Argumente ihre farbige Füllung. Schriftfarben verwenden `color.statementFontColor`, `argumentFontColor` und `groupFontColor` und gelten jeweils für den gesamten Typ. Der Farbdialog nennt diesen Geltungsbereich ausdrücklich, auch in der Rekonstruktionsansicht. Die Palette übersetzt CSS-Farbnamen in native Hexwerte. Andere Einstellungen im Quelltext behalten die Priorität des offiziellen Prozessors. Es gibt keine zusätzlichen erfundenen Farbfelder. [Dokumentation](https://argdown.org/guide/colorizing-maps.html)

## Gemeinsame Bearbeitung und Markdown

Doppelklick und das einzelne Stiftwerkzeug öffnen **Aussage bearbeiten** beziehungsweise **Argument bearbeiten** mit Titel und Text/Beschreibung. Umbenennungen aktualisieren Definitionen, Verweise und Erwähnungen derselben Art gemeinsam. Metadaten und Beziehungen bleiben erhalten. In der Rekonstruktion gilt das auch für unbenannte und gemeinsam verwendete Aussagen. Ungültige Eingaben lassen den Dialog samt Entwurf offen. Eine Übernahme ist ein Rückgängig-Schritt.

Argdown unterstützt einen Markdown-Teilumfang, insbesondere fett, kursiv und reguläre Links. Wiki-Syntax `[[…]]` ist keine native Argdown-Linksyntax. Die Textdialoge wandeln Wiki-Links daher beim Übernehmen in reguläre Markdown-Links mit Obsidian-URI um; Aliase, Überschriften und Blockziele bleiben enthalten. Das ist eine Eingabehilfe, keine Erweiterung des Renderers. Manuell eingegebener Argdown-Quelltext wird nicht heimlich vorverarbeitet. Der native DOT-Exporter zeigt den Linktext, erzeugt daraus aber keine anklickbaren Obsidian-Links in den Beschriftungen. Die Obsidian-Live-Preview im Textdialog unterstützt mehr Markdown als die spätere Argdown-Darstellung; beispielsweise sind Callouts, Tabellen und eingebettete Notizen keine zugesagten Argdown-Funktionen. [Syntaxreferenz](https://argdown.org/syntax/), [Argdown und Markdown](https://argdown.org/guide/using-argdown-in-markdown.html)

## Ausgewiesene Editorfunktionen

Die eigene Rekonstruktionsansicht isoliert ein Argument und seinen Original-Quelltextbereich; Änderungen verwenden dieselbe Notizbindung und Historie. Der allgemeine Schalter verwendet Argdowns `model.explodeArguments`. Individuelle Ausnahmen werden als zusätzliche Metadaten `{emergence: {derivation: expanded}}` beziehungsweise `compact` gespeichert. Andere Argdown-Anwendungen kennen diese Ausnahmen nicht. Beschriftete Rahmen in der Hauptkarte werden als temporäre native Gruppenelemente an Graphviz übergeben; sie stehen nicht als zusätzliche Abschnitte im Dokument. Auch die Reparatur der Zuordnung von `uses` bei einzelnen nativen Inferenzschritten und Unterminierungsverweisen erfolgt in dieser Projektion. Diese Integrationsfunktionen sind keine Behauptung, dass der Leitfaden genau diese Benutzeroberfläche vorgibt.

Quelltext und sichtbare Karte sind in beiden Ansichten gekoppelt: Inhaltszeilen markieren ihre Aussage/ihr Argument, Beziehungsoperatoren die Beziehung, Inferenzzeilen den Inferenzschritt. Bei kompakter Rekonstruktion wird das sichtbare Argument markiert. Umgekehrt zeigt ein Klick die zugehörige Originalstelle; Titelverweise bevorzugen die kanonische Definition. Zeilennummern, Einrückungen und erneutes Klicken an derselben Cursorstelle funktionieren ebenfalls. Hover-Werkzeuge bleiben auf dem Weg zur Leiste erreichbar; Klick auf freie Fläche hebt die Auswahl auf. Automatische Formatierung grafischer Änderungen beschränkt sich auf semantisch geprüfte Leerzeichen; beim Tippen wird nicht umformatiert.

Die wichtigsten verbleibenden GUI-Lücken sind Bilder, Export, Ranggruppen, weitere native Stilfelder und ein Wähler für kanonische Formulierungen. Der Kapitelabgleich weist zusätzlich die vorhandenen Integrationsabweichungen aus; er bezeichnet den Editor ausdrücklich nicht als vollständige Umsetzung des Leitfadens.
