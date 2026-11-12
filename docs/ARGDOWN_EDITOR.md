# Argdown: Funktionsumfang und Bedienung

Stand: Entwicklung 0.0.4, 12. November 2026.

Der Editor verwendet den offiziellen Prozessor `@argdown/core` 2.0.1 und lokales Graphviz. Die Syntax ist umfangreicher als das Angebot grafischer Einzelaktionen. **Eine vollständige grafische Abdeckung aller Argdown-Konfigurationen wird nicht behauptet.** Der [Leitfaden-Abgleich](ARGDOWN_GUIDE_AUDIT.md) dokumentiert den aktuellen Stand nach Themen. Der ständig sichtbare Code bleibt für Spezialfälle editierbar; grafische Aktionen ersetzen das Dokument nicht durch ein vereinfachtes Exportformat.

## Verbindungen

Beim Überfahren eines bearbeitbaren Knotens erscheinen drei runde Griffe mittig wie bei Mermaid:

| Griff | Wirkung für den ausgewählten Knoten |
| --- | --- |
| `+` | Ergänzt einen Grund, der den ausgewählten Knoten unterstützt |
| `−` | Ergänzt einen Einwand gegen den ausgewählten Knoten |
| `_>` | Ergänzt einen Einwand gegen den Schluss des ausgewählten Arguments |

Auf ein vorhandenes Element ziehen verbindet unmittelbar. Im Leeren entsteht nach Auswahl von Aussage oder Argument ein neues verbundenes Element. Klick auf den Griff öffnet dieselbe Typauswahl. Unterminierung ist deshalb am ausgewählten Argument verfügbar; als Einwand sind Aussagen und Argumente möglich. An ausgewählten Aussagen ist der Unterminierungsgriff deaktiviert. Es gibt keinen globalen Beziehungsmodus und keine Auswahl Neu/Vorhanden. Neue Knoten und ihre Verbindung sind gemeinsam rückgängig machbar. Der neue oder angezogene Grund zeigt zum ausgewählten Knoten. Der Ablageort bestimmt den Abschnitt des neuen Knotens.

Widerspruch zwischen Aussagen ist über die ausgewählte Verbindung verfügbar. Dort sind auch Wechsel des Beziehungstyps, Löschen und zulässiges Umkehren expliziter Pfeile erreichbar. Ein Gegenargument ist ein Argument mit einer Angriffsbeziehung. Die Schere war eine eigene frühere Symbolwahl; `_>` entspricht der Argdown-Notation.

## Abdeckung

Die Kategorien wurden mit der [offiziellen Syntaxübersicht](https://argdown.org/syntax/) abgeglichen. Die folgende Tabelle beschreibt die konkrete Integration; sie ersetzt keine Zusicherung logischer Konsistenz einer Argumentation.

| Syntaxbereich | Lesen und Verarbeiten | Grafische Bearbeitung / Grenze |
| --- | --- | --- |
| Aussagen und Argumentbeschreibungen, mehrzeiliger Text | Offizieller Parser | Hinzufügen, **Aussage bearbeiten** / **Argument bearbeiten** mit Titel und Text/Beschreibung gemeinsam, Farbe, Löschen außerhalb geschützter Rekonstruktionen |
| Benannte Definitionen und Referenzen | Offizielles Modell | Verbindungen zu bestehenden Elementen; gemeinsam verwendete Aussagen direkt an einem Rekonstruktionsknoten auswählbar; Umbenennen aktualisiert Verweise und Erwähnungen |
| Anonyme Elemente und mehrere Formulierungen eines Titels | Offizielles Modell | Neue freie Elemente werden benannt angelegt; neue Rekonstruktionsschritte bleiben zunächst übersichtliche anonyme nummerierte Aussagen. Mehrfachdefinitionen und uneindeutige anonyme Vorkommen bleiben im Code vollständig erreichbar; keine eigene Vorkommensverwaltung. Der Textdialog bearbeitet die vom Prozessor gewählte kanonische Formulierung |
| Fett, kursiv, Links, Mentions, Tags, logische und Emoji-Kurzformen | Offizieller Parser | Textdialog mit Obsidian-Live-Preview; Argdown-Syntax eintippbar. Das SVG unterstützt nur die Formatierung des Argdown-Renderers, keine zusätzliche Obsidian-Markdown-Pipeline |
| Unterstützung, Angriff, Unterminierung; alle zulässigen Aussage-/Argumentkombinationen | Offizielles Modell | Drei direkte Ziehgriffe, Typwechsel und Löschen am Pfeil; ungültige Kombinationen schreiben nichts |
| Widerspruch und strikte logische Beziehungen | Offizielles Modell; `model.mode` wird beachtet | Widerspruch am ausgewählten Aussagepfeil; im strikten Modus Folgerung und Unvereinbarkeit. Dokumentmodus unter **Darstellung** umschaltbar |
| Querverweise, Zyklen, verschachtelte Relationsbäume | Offizielles Modell | Bestehende Knoten direkt verbinden. Beim Entfernen einfacher Relationsunterbäume bleiben ihre Definitionen erhalten. Nicht eindeutig transformierbare Sonderfälle werden mit Hinweis abgelehnt |
| Prämissen, Zwischen- und Hauptschlussfolgerungen, gemeinsam verwendete Aussagen | Offizielle Rekonstruktion | **Rekonstruktion bearbeiten** im Haupteditor: formulieren, benennen, wiederverwenden, Prämissen verbinden, neue Schlussfolgerungen aus einer Mehrfachauswahl bilden und zulässige Schritte entfernen; native Markdown-Vorschau |
| Schlussregeln, mehrere Inferenzschritte, explizite `uses`, Schritt- und Inferenzbeziehungen | Offizielles Modell | Doppelklick auf Inferenzschritte bearbeitet die Regel; Pfeile bearbeiten die Abhängigkeiten. Nummern werden angepasst und Zirkelschlüsse abgelehnt. Unveränderte Zusatzmetadaten bleiben erhalten |
| Automatisch abgeleitete Beziehungen zwischen rekonstruierten Argumenten | Offizielles Modell | Zugeordneten Argumentaufbau öffnen; direkt zuordenbare Beziehungen bearbeiten. Gemeinsam abgeleitete, mehrdeutige Änderungen werden geschützt |
| Überschriften definieren Abschnitte, die als Gruppen dargestellt werden | Offizielle Gruppierung | Gruppen erstellen, umbenennen, Elemente zuordnen, ganzen Gruppenbaum verschieben, auf oberste Ebene setzen, auflösen; kein künstliches Limit von sechs Ebenen |
| `isGroup`, `isInGroup`, `isClosed`, Gruppentiefe | Offizielle Gruppierung | Mitgliedschaft und Ein-/Ausklappen. Beim Hinzufügen tieferer Ebenen werden bisher sichtbare Gruppen explizit erhalten |
| Konfigurationsgesteuertes `group.regroup`, `group.sections`, Ignorieren von Datenflags | Offizieller Prozessor | Lesen; Konfiguration im Code. Widersprechende grafische Änderungen werden abgelehnt, die Konfiguration nicht still überschrieben |
| Inline- und Block-YAML, benutzerdefinierte Daten, Frontmatter | Offizieller Datenprozessor | Native Beschriftungs-, Farb-, Formen-, Größen-, Layout- und Auswahlfelder unter **Darstellung**. Allgemeine Metadaten und zusätzliche Konfiguration bleiben im Code |
| Geordnete und ungeordnete Aussagenlisten | Offizieller Parser | Text ihrer Knoten editierbar; Listenstruktur im Code. Keine eigene Listenverwaltung |
| Zeilen-, Block- und HTML-Kommentare | Offizieller Parser | Im Code bearbeitbar; unbeteiligte Kommentare bleiben bei grafischen Änderungen erhalten |

Für Abschnittsbäume gilt die [offizielle Gruppenbeschreibung](https://argdown.org/guide/creating-group-nodes.html). Abschnitte ordnen Elemente; sie sind keine Argumente und erhalten keine eigenen semantischen Verbindungen wie Mermaid-Subgraphen. Kollabierte Gruppen können bestehende Außenbeziehungen zusammengefasst darstellen. Leere Abschnitte erscheinen nur, soweit der native Prozessor sie abbildet; beim grafischen Erstellen wird ein erster Knoten angelegt.

Beliebige externe Prozessor-Plugins, HTML-/Pandoc-Export und das automatische Laden externer Bilder gehören nicht zu dieser Integration. Bilder im SVG werden entfernt, damit Öffnen eines Blocks keine externen Ressourcen nachlädt. Auf bestehende unbekannte Metadaten greift der Editor nicht pauschal zu.

## Rekonstruktion und Darstellung

**Rekonstruktion bearbeiten** öffnet eine eigene Unteransicht für genau ein Argument. Links beziehungsweise oben steht ausschließlich der zugehörige Argdown-Code, daneben sein nativer Inferenzbaum. Die Hervorhebung bleibt in beide Richtungen verbunden. **← Hauptkarte** führt zur Übersicht zurück. Diese Navigation verändert die Sichtbarkeitseinstellung nicht und bleibt auch bei unvollständigem Code verfügbar.

`+` an einem Inferenzschritt oder seiner Schlussfolgerung ergänzt eine Prämisse. Auf eine vorhandene Aussage ziehen verbindet sie als Prämisse; ein Klick oder Ziehen ins Leere legt direkt eine neue Prämisse an. `+` an einer bislang unbegründeten Prämisse erzeugt deren eigene Rekonstruktion als Zwischenschlussfolgerung. Mehrfachauswahl und **Aus ausgewählten Aussagen folgern** erzeugt eine weitere Schlussfolgerung. Ein Prämissenpfeil kann mit Entfernen gelöst werden, ohne seine Aussage zu löschen. Hauptschlussfolgerung und benötigte Definitionen werden geschützt. **Aussage bearbeiten** mit Titel und Text, **Vorhandene Aussage verwenden**, Farben, Regeln, Einwände und Rücknahme bleiben innerhalb dieser Ansicht verfügbar.

**In Hauptkarte anzeigen** ist ein unabhängiger Schalter für das aktuelle Argument; dieselbe Aktion steht am Hauptkartenknoten oder seinem Rahmen. **Rekonstruktionen → Alle anzeigen / Alle ausblenden** setzt individuelle Ausnahmen zurück und gilt für sämtliche Argumente. Eingeblendete Rekonstruktionen sind durch beschriftete native Graphviz-Rahmen erkennbar. Aussagen, die mehrere Argumente gemeinsam verwenden, können außerhalb der Rahmen stehen. Beim Ausblenden verschwinden ausschließlich intern benötigte Schritte auch bei nativem Auswahlmodus `all`. Eigenständige Aussagen bleiben erhalten.

Der globale Schalter verwendet natives `model.explodeArguments`; einzelne Ausnahmen stehen als `{emergence: {derivation: expanded}}` beziehungsweise `compact` im Quelltext, weil Argdown keinen nativen Einzelknotenschalter anbietet. Die Unteransicht setzt diese Flags nicht automatisch. Ihr vorübergehender Fokus überschreibt nur die Darstellung und die sichtbare Codeauswahl. Ein neuer Entwurf bleibt bis zum Einfügen ungespeichert; vorhandene Notizblöcke werden weiterhin gezielt live gespeichert.

**Darstellung der Argumentkarte** schreibt ausschließlich native Frontmatter-Einstellungen: Beschriftungsmodi, Farbschemata, Schriftfarben aller Aussagen/Argumente/Gruppen, Formen, Titel-/Textgrößen, Mindestbreiten, sechs Layout-Verfahren, Abstände, Aussageauswahl, Rekonstruktionen, native Tag-/Abschnittsfilter und strikte Interpretation. Die Bereiche sind aufklappbar; erst **Übernehmen** schreibt die geänderten Werte. Unbekannte Einstellungen und Kommentare bleiben erhalten. Die Änderung ist gemeinsam rückgängig machbar.

Die Textdialoge wandeln Wiki-Links beim Übernehmen in reguläre Markdown-Links mit Obsidian-URI um. Die Karte zeigt deren Linktext; klickbare Links innerhalb nativer SVG-Beschriftungen sind dadurch nicht zugesagt. Unverarbeitete Wiki-Syntax gehört nicht zum Argdown-Quelltextstandard.

## Mehrfachauswahl und Quelltext

Klick auf eine Quelltextzeile oder ihre Zeilennummer markiert das zugehörige sichtbare Element. Umgekehrt bringt ein Klick auf ein Element den Cursor zur passenden Originalstelle. Das gilt auch für anonyme Aussagen und den abgegrenzten Quelltext einer Rekonstruktion; erneutes Klicken am selben Cursor wird berücksichtigt.

Umschalt-Klick erweitert oder verkleinert die Auswahl. Umschalt-Ziehen im freien Bereich spannt einen Auswahlrahmen auf. Die Werkzeugleiste erscheint beim Überfahren. Gehört das überfahrene Element zur Mehrfachauswahl, bietet sie gemeinsame Aktionen an. Ein Klick auf freie Fläche leert Auswahl, Hervorhebung und Werkzeuge. Mehrere Knoten können gemeinsam eingefärbt, in eine Gruppe verschoben oder gelöscht werden. Eine grafische Sammelaktion bildet einen Undo-Schritt. Beim Verschieben erscheint eine Markierung der Zielgruppe; es wird keine Verbindungslinie gezeichnet. Dasselbe gilt für Mermaid.

Neue freie Gründe werden nach Möglichkeit direkt als eingerückte Definition beim unterstützten oder angegriffenen Element eingefügt. Bei verschiedenen Abschnitten bleiben Definition und Referenz getrennt, damit die Gruppierung stimmt. Verbindungen zwischen bestehenden Elementen werden an einer vorhandenen Deklaration ergänzt; bereits vorhandene Verbindungen erzeugen keine weiteren Referenzen. Grafische Änderungen normalisieren sichere Einrückungen und Abstände automatisch; eine eigene Formatierungsschaltfläche entfällt. Die automatische Formatierung prüft das Argumentmodell einschließlich nummerierter Rekonstruktionen und erhält deren Kommentare; beim Tippen wird nicht automatisch umformatiert. Das native Modell wird einschließlich Gruppierung, Beschriftungen, Metadaten und Schlussstrukturen verglichen; unverändertes Öffnen und Übernehmen einer Rekonstruktion bleibt unverändert.

Aussagen behalten ihre nativen weißen Flächen und farbigen Rahmen, Argumente ihre farbigen Füllungen. Es gibt keine zusätzlichen Theme- oder Kontrastregeln. Der Farbdialog bietet Elementfarbe und die dokumentierte typweite Schriftfarbe an, auch in der Rekonstruktionsansicht. Gruppenfüllungen lassen sich über dieselbe Palette bearbeiten. Das Layout erzeugt weiterhin Argdown/Graphviz, Mermaid weiterhin Pele.

## Einheitliche Vorlagen

Mermaid und Argdown verwenden dieselbe **Neu**-Schaltfläche ohne zusätzliches Plus oder Chevron. Die Liste enthält Favoriten und die übrigen Vorlagen; keine separaten Schnellaktionen. Flowchart und Mindmap sind bei Mermaid anfänglich favorisiert, Pro und Contra bei Argdown. Sterne, eigene Vorlagen, Löschen und Rückgängig werden lokal gespeichert. Beim Hover und bei Tastaturfokus erscheint eine Vorschau durch denselben Renderer wie im jeweiligen Editor. Eine verspätete Vorschau ersetzt keine inzwischen andere Auswahl.

## Designentscheidungen

Die drei Ziehgriffe setzen die Entscheidung über die Beziehung direkt am ausgewählten Element um. Die Ablage auf einem vorhandenen Ziel ersetzt eine zusätzliche Zielauswahl. Die Richtung entspricht dem Ergänzen eines Grundes für den ausgewählten Knoten. Die Pfeilspitze der Ziehvorschau zeigt diese tatsächliche Richtung. Der folgende Dialog fragt nur nach dem fehlenden Elementtyp. Unabhängige Elemente werden über die beschriftete Aktion **Element hinzufügen** angelegt.

Bearbeiten einer Rekonstruktion und Anzeigen ihrer Details in der Hauptkarte sind getrennte Aktionen; ein benannter Unterbereich und ein sichtbarer Rückweg zeigen den aktuellen Kontext. Gemeinsame Vorlagenkomponente, gleiche Schaltflächen, Platzierung und Auswahlgesten orientieren sich an [Konsistenz und Standards](https://www.nngroup.com/articles/consistency-and-standards/). Die konkreten Griffe entsprechen der Rückmeldung des Nutzers; sie sind keine vorgegebene Argdown-Werkzeugleiste.

## Nachweise

- `tests/argdown-syntax.test.ts`: Syntaxfamilien einschließlich Metadaten, Listen und verlustfreiem Öffnen mehrstufiger Schlüsse.
- `tests/argdown-sections.test.ts`: tiefere Ebenen, ganze Unterbäume, gleichnamige Abschnitte, Zyklen, Gruppenkonfiguration, Ein-/Ausklappen und Richtungsumkehr.
- `tests/argdown-connections.test.ts`: Beziehungsmatrix, komplexe Leitfaden-Debatte, gemeinsame Aussagen, Schlussregeln und geschützte Abhängigkeiten.
- `scripts/argdown-context-native-check.mjs`: echte Obsidian-Oberfläche mit drei Griffen, Typauswahl, direktem Verbinden, Argumentaufbau und Abschnittsbäumen.
- `scripts/diagram-library-native-check.mjs`: identische Vorlagenbedienung, native Vorschauen, Favoriten, Persistenz und Schutz vor verspäteten Vorschauen.

- `tests/argdown-derivation.test.ts` und `scripts/argdown-derivation-native-check.mjs`: bearbeitbarer nativer Inferenzbaum, exaktes komplexes Beispiel, globale/einzelne Rekonstruktionen, Quelltext, Referenzen, Filter, Löschen und Undo.

Aussagen benötigen zum Wiederverwenden keine manuelle Vorbereitung im Quelltext. Bereits benannte Aussagen behalten ihren Namen. Für anonyme Aussagen legt der Editor nur bei einer tatsächlichen Querverbindung automatisch einen freien Namen an, unter Erhalt von Text, Metadaten und logischen Abhängigkeiten. Bezeichnung und Verbindung bilden eine gemeinsame rückgängig machbare Änderung. Wird ein Inferenzschritt als Quelle eines Einwands verwendet, verweist er auf seine Schlussfolgerung; synthetische Diagramm-IDs werden nicht in den Code geschrieben.
