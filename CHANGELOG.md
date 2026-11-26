# 0.0.7

Begleitdokumente: optionale Größenanzeige, schnellere externe Drops und klarere Graph-Rückverweise. Benötigt **Obsidian Desktop ab 1.15.0**.

- **Graph-Rückverweise:** Automatisch erzeugte Zuordnungslinks von Begleitdokumenten und Kapiteldateien sind standardmäßig ausgeblendet. Unter **Einstellungen → Emergence → Graph → Automatische Begleitdokument-Verweise ausblenden** lässt sich das abschalten. Eigene Inhaltslinks bleiben sichtbar, auch wenn dieselbe Datei zusätzlich automatisch verknüpft ist. Obsidians eigener Rückverweisindex bleibt unverändert.
- **Optionale Gliederungsgrößen:** Zeichenzahl und kleine proportionale Balken je Überschrift, wahlweise für den eigenen Abschnitt oder einschließlich Unterabschnitten. Gesamtzeichenzahl und konfigurierbares Zeichenziel ergänzen die Übersicht. Leerzeichen und Fußnoten einschließlich Inline-Fußnoten können getrennt ein- oder ausgeschlossen werden. Die Größenanzeige ist standardmäßig ausgeschaltet.
- **Drag-and-drop:** Texte lassen sich auf Gliederungspunkte ablegen und werden dort als neue Einträge gespeichert. Zielmarkierungen bleiben auch bei ausgewählten Überschriften erkennbar. Überflüssige Neuaufbauten während des Ziehens entfallen; versteckte Graph- und Suchansichten werden nicht mitgerendert.
- **Erster externer Drop:** Zugeordnete Dateien werden beim Öffnen der Begleitansicht mit begrenzter Parallelität lesend vorbereitet. Das verhindert die gemessene Verzögerung durch erst beim Schreiben nachgeladene iCloud-Dateien. Keine dauernde Abfrage, keine zusätzlichen Dateien und keine zurückbehaltenen Textpuffer; Änderungen verwenden weiterhin Obsidians geschützte Dateitransaktionen.
- **Laden und Speichern:** Die Gliederung erscheint unabhängig von noch ladenden Kapitelinhalten. Bestätigte Schreibstände werden direkt angezeigt, ohne alle Kapiteldateien erneut zu lesen. Externe Änderungen invalidieren den Ansichtsstand weiterhin; fehlgeschlagene Änderungen werden nicht als gespeichert dargestellt.
- **EOME und Theme:** Die eingebettete EOME-Ansicht verwendet die öffentliche Host-Option aus EOME 0.2.5 für strukturelle Überschriften. Eigenständige EOME-Ansichten bleiben unverändert. Native Theme-Regeln und farbige Ablagefelder bleiben erhalten. Untereintragspfeil, Kapiteldatei-Aktion und Anzahlen sind kompakter angeordnet.

Build, Lint und **1.156 automatisierte Tests** erfolgreich. Der Produktions-Audit meldet keine bekannten Schwachstellen. Die Rückverweisfilterung wurde zusätzlich direkt in Obsidian geprüft; die Dateivorbereitung wurde mit echten Zotero-Drops auf unterschiedliche Überschriften und nach einer Pause bestätigt.

Zum Installieren `main.js`, `manifest.json` und `styles.css` aus diesem Release in den Emergence-Pluginordner legen und das Plugin neu laden. `SHA256SUMS.txt` enthält die Prüfsummen.

# 0.0.6

Verbesserte Bedienung von **Hierarchical Outline** im Begleitdokument. Benötigt **Obsidian Desktop ab 1.15.0**.

- **Mehrfachauswahl:** Shift+Klick und Shift+↑/↓ wählen einen Bereich, Strg/Cmd+Klick fügt einzelne Karten hinzu oder entfernt sie. Shift+Home/End erweitert die Auswahl bis zum Listenanfang/-ende; Strg/Cmd+A wählt die Einträge der aktuellen Ebene. Auswahlbereiche lassen sich wieder verkleinern; die Anzahl ausgewählter Einträge wird angezeigt.
- **Gemeinsame Aktionen:** Kopieren, Ausschneiden, Löschen und Verschieben berücksichtigen die gesamte Auswahl mit allen Untereinträgen. Das Kontextmenü benennt Sammelaktionen mit ihrer Anzahl. Ausgeschnittene Einträge bleiben bis zum Einfügen sichtbar; eingefügt wird unter einem einzelnen Zieleintrag. Die eingefügten Gruppen bleiben ausgewählt. Jede Sammelaktion lässt sich gemeinsam rückgängig machen. Funktioniert bei gemeinsamer Begleitdatei und einzelnen Abschnittsdateien.
- **Direkt bearbeiten:** Beim Doppelklick steht der Cursor an der angeklickten Textstelle, auch bei formatiertem Markdown. Das Öffnen mit Enter behält die EOME-Tastaturbedienung mit vollständiger Textauswahl bei.
- **Klarere Navigation und Trennlinien:** Ein kleiner Pfeil an Karten mit Untereinträgen öffnet diese direkt und berücksichtigt den Abgehakt-Filter. Einfügelinien liegen auf den Kartentrennungen, der konkurrierende Fokusrahmen entfällt. Die gemeinsame Einfüge- und Ablageposition bleibt über einen größeren Bereich erreichbar.
- **Weniger Frontmatter:** `emergence-companion-version` wird nicht mehr verlangt oder gespeichert. Vorhandene Angaben werden beim Öffnen beziehungsweise Speichern entfernt. Die Abschnittskennungen bleiben in den Überschriften; Einträge werden weiterhin ohne gespeicherte Gedankenkennungen abgelegt.
- **Sicheres Einfügen:** Änderungen der Zeilenenden durch die Systemzwischenablage erhalten die Gruppenstruktur. Das gewählte Einfügeziel bleibt bei verzögertem Zwischenablagezugriff erhalten. Ungültige Verschiebungen in eigene Untereinträge werden ohne Teiländerungen abgewiesen.

Geprüft mit **1.038 automatisierten Tests** und **277 Prüfungen direkt in Obsidian**, einschließlich echter Maus-/Tastaturbedienung, Gruppen mit 105 Einträgen samt Untereinträgen, Undo/Redo sowie Hell-/Dunkelmodus. Build und Lint erfolgreich.

Zum Installieren `main.js`, `manifest.json` und `styles.css` aus diesem Release in den Emergence-Pluginordner legen und das Plugin neu laden. `SHA256SUMS.txt` enthält die Prüfsummen.

# 0.0.5

Begleitdokumente und Tetrader sind jetzt Teil von Emergence. Benötigt **Obsidian Desktop ab 1.15.0**.

- **Begleitdokumente:** Notizen folgen der Gliederung der Hauptdatei, ohne Kennungen in die Hauptdatei einzutragen. Eine gemeinsame Datei oder einzelne Kapiteldateien, konfigurierbare Ablage neben der Quelle, in einem Unterordner oder einem festen Vault-Ordner. Fehlende Kapiteldateien lassen sich zuordnen oder neu erstellen; unklare Überschriftenzuordnungen bleiben zur Prüfung erhalten.
- **Hierarchical Outline:** Standardansicht mit vollständigen Textauszügen, nativer Markdown-Bearbeitung, Tastaturnavigation, Abhaken und Ein-/Ausblenden erledigter Einträge. Erledigte Verbindungseinträge bleiben sichtbar, wenn offene Nachfahren sie benötigen. Neue Einträge entstehen direkt an ihrer Position, auch per Klick auf die Einfügelinien am Anfang, zwischen Einträgen und am Ende einer Liste.
- **Drag-and-drop im Begleitdokument:** eine gemeinsame Ablageposition je Zwischenraum, unabhängig von der zuvor überfahrenen Karte. Unterordnen, vollständige Teilbäume und Mehrfachauswahlen bleiben erhalten. Veraltete Ansichtsstände dürfen nach Speichern oder Undo die aktuelle Reihenfolge nicht mehr überschreiben.
- **EOME und Lineage:** separat installierte Originaleditoren als zusätzliche Ansichten. Die Speicherung bleibt gewöhnliches eingerücktes Markdown nach EOMEs mehrzeiligem Format; Emergence benötigt keine lokal modifizierte Lineage-Installation. Darstellungs- und Integrationsgrenzen sind im README beschrieben.
- **Native Listendarstellung:** eingebettete Markdown-Listen verwenden jetzt Obsidians eigene Aufzählungszeichen und die Marker-Einstellungen des Themes. Verschachtelung, nummerierte Listen und Aufgaben-Checkboxen bleiben erhalten. Abgehakte Einträge in Hierarchical Outline sind zusätzlich deutlich durchgestrichen.
- **Tetrader:** direktes Bearbeiten von Titel, Kerntexten und äußeren Absätzen, einschließlich nativer Obsidian-Linkvervollständigung. Callouts unterstützen fett gesetzte Bereichstitel oder einheitliche Überschriften jeder Ebene. Schreibweise neuer Diagramme und Legendenposition sind allgemein konfigurierbar.
- **Tetradenlayout und Bedienung:** automatische diagonale Zeilenstaffelung nach den Buchvorlagen, mehrere Absätze, schmale Ansichten sowie Hell- und Dunkelmodus. Ziehgriffe folgen der überfahrenen Textzeile, bleiben beim Greifen stehen und funktionieren auch während der Bearbeitung. Einfügelinien sind über ihre ganze Breite anklickbar. Die Ablage verwendet genau eine Markierung.
- **Anlegen und Speichern:** neue Tetraden im Editor erstellen und am Cursor in eine Notiz einfügen; bestehende Diagramme über ihr Stiftsymbol öffnen. Änderungen werden nur nach erfolgreichem Schreiben übernommen. Undo/Redo, Quellenansicht und Vollbild bleiben verfügbar. Die redundante Statuszeile entfällt bei eingefügten Tetraden.
- **Kompaktere Oberfläche:** Begleitdokument als erster Tab, einzeilige Tabnavigation, reduzierte redundante Bedienelemente und Tooltips bei erhaltenen zugänglichen Beschriftungen.

Geprüft mit automatisierten Tests sowie nativen Obsidian-Bedienprüfungen für Begleitdokument und Tetrader, einschließlich Hell-/Dunkelmodus, Tastaturbedienung, Mauswegen zu Ziehgriffen, Schreibkonflikten und Rückgängigmachen.

Zum Installieren `main.js`, `manifest.json` und `styles.css` aus diesem Release in den Emergence-Pluginordner legen und das Plugin neu laden. `SHA256SUMS.txt` enthält die Prüfsummen.

# 0.0.4

Stabiler Release auf Basis der geprüften Beta 2. Benötigt **Obsidian Desktop ab 1.15.0**.

- Native DOM-Helfer für den eingebetteten Markdown-Editor und fensterübergreifend sichere Typprüfung der Diagramm-Bedienelemente.
- Unbenutzte TypeScript-Imports entfernt; auch die Test-Fixtures sind ohne Lint-Warnungen.
- `:has()` durch ausdrücklich gesetzte Zustände für Feldideen-Aktionen und Mermaid-Richtungswerkzeuge ersetzt.
- CSS-Auswahlfarben und Markdown-Dialoggrößen mit gezielter Selektorspezifität statt `!important`.
- Unsichtbare Screenreader-Beschriftungen ohne `clip-path`; zugängliche Namen bleiben erhalten.

- **Mermaid-Editor:** Flowcharts und Mindmaps gleichzeitig grafisch und im Quelltext bearbeiten; Syntaxfarben, gegenseitige Hervorhebung, Vollbild und gemeinsame Undo-/Redo-Historie. Layout und Rendering übernimmt ausschließlich Obsidians integriertes Pele.
- **Mermaid-Werkzeuge:** Verbindungen ziehen und beschriften, neue Kinder und explizite Geschwister, kompakte Formen-/Pfeilvorschauen, Farben, Mehrfachauswahl und verschachtelte Subgraphen. Auch ganze Subgraphen können miteinander oder mit Einzelknoten verbunden werden. Schwebende Werkzeuge verdecken während des Ziehens keine Zielknoten.
- **Argdown-Editor:** Argumentkarten mit offiziellem lokalem Prozessor und eingebettetem Graphviz. Aussagen und Argumente in einem gemeinsamen Titel-/Textdialog bearbeiten, Unterstützung/Angriff/Unterminierung ziehen, Gruppen verschachteln und mehrere Elemente auswählen.
- **Rekonstruktionen:** eigene Unteransicht mit gemeinsamem Quelltext, Prämissen und Inferenzschritten. Die Darstellung in der Hauptkarte lässt sich global und je Argument steuern. Die native Argdown-Darstellung und ihre Farboptionen bleiben erhalten.
- **Argdown-Pfeilrichtung:** eindeutige Beschriftung und Häkchen für die wirksame Einstellung, einschließlich Argdowns Standard **BT**. Die Auswahl ändert die Anordnung entlang der Pfeile; Unterstützungs- und Angriffsbeziehungen bleiben erhalten.
- **Allgemeine Einstellungen:** fünf native Bereiche für Graph, Feldideen, Mermaid, Argdown und Suche mit eigenen Aktivierungsschaltern. Nicht verwendete Bereiche und ihre Editoraktionen lassen sich ausblenden; bestehende Entwürfe und Undo-Verläufe bleiben erhalten.
- **Deutsch und Englisch:** lokale Übersetzungen mit Englisch-Fallback. Sprachwechsel wirken sofort; eigene Notizen, Feldnamen, Profile und Diagrammtexte bleiben erhalten. Die KI-Ausgabesprache bleibt separat.
- **Graph-Vorschau:** Überschriften, Feldzuordnungen, Positionen, Reihenfolge und Tiefe an derselben Visualisierung einstellen, die auch der Graph verwendet. Die bisherige Anordnung bleibt die Vorgabe.
- **Vorlagen:** einheitliches Neu-Menü mit Favoriten und Vorschauen, 58 Pele-Beispiele sowie Argdown-Beispiele. Beide Editoren können eigene Vault-Ordner mit Markdown-Vorlagennotizen verwenden, einschließlich mehrerer Diagramme je Notiz und Unterordnern.
- **Notizbearbeitung:** vorhandene Diagrammblöcke gezielt über das benachbarte Stiftsymbol oder den Cursor-Befehl öffnen, live speichern oder neue Entwürfe einfügen. Beschriftungsdialoge verwenden Obsidians Markdown-Bearbeitung; die Darstellung im Diagramm folgt den Möglichkeiten des jeweiligen Renderers.
- Korrigierte transitive Parser-Abhängigkeit. Der Produktions-Audit meldet **keine bekannten Schwachstellen**.

Die grafischen Mermaid-Werkzeuge unterstützen zunächst Flowchart und Mindmap; weitere Pele-Typen sind als Beispiele und über den Quelltext verfügbar. Den Umfang der Argdown-Werkzeuge beschreibt der [Leitfadenabgleich](https://github.com/kpaede/Emergence/blob/0.0.4/docs/ARGDOWN_GUIDE_AUDIT.md). Hinweise zu Schaltern, Graph-Vorschau und Vorlagenordnern: [Einstellungen](https://github.com/kpaede/Emergence/blob/0.0.4/docs/PREFERENCES.md).

Zum Installieren `main.js`, `manifest.json` und `styles.css` aus diesem Release in den Emergence-Pluginordner legen und das Plugin neu laden. `SHA256SUMS.txt` enthält die Prüfsummen. **0.0.4 ist der neueste stabile Release.**

# 0.0.3

- Feldideen liefern eine gemeinsame Liste assoziierter Begriffe ohne automatische Feldzuordnung. Begriffe werden per Drag-and-drop oder über Begriffsauswahl und Zielfeld übernommen.
- Ziehgriffe im Graphen verschieben bestehende Breadcrumbs-Zuordnungen und aktualisieren die betroffenen Frontmatter-Felder, einschließlich explizit gespeicherter Gegenrichtungen. Aliase und unbeteiligte Notizdaten bleiben erhalten; Schreibkonflikte werden geprüft und bereits ausgeführte Schritte bei Fehlern zurückgenommen.
- Plus-Aktionen stehen ausschließlich am Gruppentitel und beziehen sich immer auf die zentrale Notiz. Der Eingabedialog nennt die betroffene Notiz ausdrücklich.
- Konzept und Urheberfelder erscheinen gemeinsam bei Notizen mit einem Untertag von `Werk` im Frontmatter-Feld `tags`. Andere zusätzliche Felder erscheinen bei vorhandenen Verbindungen. Die Feldideen berücksichtigen dieselbe Einschränkung.
- Sichtbare Ziehgriffe verdecken die dahinterliegende Linie; ohne Hover bleibt die Linie sichtbar. Tooltips an Begriffen und Griffen entfernt, Screenreader-Beschriftungen erhalten.
- SVG-Verbindungen an die neuen Bedienelemente angepasst; initialen Überlauf in schmalen Panels und Unterbrechungen beim Ziehen verhindert.
- 267 Regressionstests bestanden; sechs optionale Modelltests im Standardlauf übersprungen. Isolierter Obsidian-Oberflächentest bei 280, 360 und 480 Pixeln ohne Änderungen an echten Notizen bestanden.

# 0.0.2

- Die bisherige Relationssynopse heißt jetzt **Kontext**; gespeicherte Zuordnungen und Sichttiefen bleiben erhalten.
- Literaturaktionen blenden sich ohne Scrollsprünge ein: Die Literaturangabe bleibt stehen, nachfolgende Inhalte rücken nach unten.

- Zentrale Graphbeschriftung folgt Notiz-/Ordnerumbenennungen sofort, auch im Erkundungsmodus.
- Rückverweise aus Obsidians eigenem Linkindex unter den freien Verweisen ergänzt.
- Literatur in Graph und Suche als reiner CSL-Text mit sechs Symbolaktionen; ZotLit zuerst, Citekey ausschließlich über Kopiersymbol und Tooltip. Aktionen erscheinen bei Hover oder Tastaturfokus; ohne Hoverfähigkeiten bleiben sie sichtbar.
- Literaturaktionen und CSL-Kontext der Suche wechseln mit der aktuellen Notiz.

- Recherche vollständig entfernt; lokale Breadcrumbs-Feldideen bleiben erhalten.
- Ollama/Wikipedia auf Obsidian requestUrl und native Timer umgestellt; Abbruch, Timeout und Endpunktwechsel abgesichert.
- Einstellungen in der nativen Obsidian-Suche auffindbar; explizite Entwürfe und Speichern bleiben erhalten.
- Gemeldete CSS-/SVG-Hinweise behoben und drei Arbeitsbereiche an Obsidian-Themes ausgerichtet.

# 0.0.1

Erster öffentlicher Entwicklungsrelease von Emergence. Das Plugin ist für persönliche philosophische Begriffsarbeit entstanden und bleibt experimentell.

- Relationssynopse und Originalansichten von Breadcrumbs, ZotLit und Obsidian in einem vollflächigen Seitenpanel mit Ansichtsauswahl.
- Lokale Feldideen mit kontrollierter Ein-Klick-Übernahme kurzer Wikilinks. Neue Ziele erzeugen keine Datei.
- Lange Notizen werden bei Bedarf vollständig abschnittweise vorbereitet. Die abschließende Anfrage verwendet eine gekennzeichnete Arbeitszusammenfassung; die Originaldatei bleibt unverändert.
- Recherche behält pro Notiz ausschließlich das letzte Ergebnis. Neue Fragen ersetzen es; andere Notizen und alte Fragen werden nicht als Gesprächsverlauf mitgesendet.
- Globale Notiz-/Zotero-Suche, originale ZotLit-CSL-Formatierung und separate Citekey-Kopierfunktion.
- Optionale Wikipedia- und DuckDuckGo-Kontexte ohne Cloud-Modell oder Telemetrie.

Benötigt Obsidian Desktop 1.14.0 oder neuer. Breadcrumbs v4 und ZotLit 2.2 sind optionale, versionsabhängige Integrationen. KI-Funktionen benötigen Ollama mit einem bereits lokal installierten Modell. Zusammenfassungen und Modellideen können fachliche Fehler enthalten und sind keine automatische Faktenprüfung. Vorhandene Notizzitate werden offline formatiert; für die CSL-Formatierung bisher unzitierter Suchtreffer muss Zotero mit seiner lokalen API geöffnet sein.

Build, Tests, konkrete Prüfergebnisse und bekannte Grenzen stehen in `docs/VALIDATION.md`. Dieser Release behauptet keine bereits abgeschlossene Obsidian-Community-Prüfung.

- Argdown-Herleitungen direkt im Haupteditor neben ständig sichtbarem Quelltext bearbeiten; alter Strukturformulardialog und separate Vorschau entfernt. Globale und einzelne Detailansichten, native Schlussstufen, Prämissen per Ziehen, gemeinsame Ergebnisse aus Mehrfachauswahl, Text/Regeln per Doppelklick, benannte Verweise und atomare Rücknahme. Native Tag-/Abschnittsfilter und erweiterter Leitfaden-Abgleich. Kommentare, beide `uses`-Positionen, Abschnittszugehörigkeit und native Darstellung werden geschützt.

- Argdown: eigene Herleitungs-Unteransicht mit begrenztem Quelltext und Rückweg zur Hauptkarte. Sichtbarkeit davon getrennt; globale Anzeige setzt Einzelausnahmen zurück, ausgeblendete interne Aussagen bleiben auch im Auswahlmodus `all` verborgen. Beschriftete native Grenzen für sichtbare Herleitungen. Werkzeuge und Ziehgriffe bei Hover, Markieren per Klick, Abwählen auf freier Fläche; automatisches Aufräumen statt Formatierungsschaltfläche.

- Argdown: vorhandene Aussagen lassen sich ohne manuelle Quelltext-Benennung verbinden. Notwendige Referenznamen entstehen automatisch zusammen mit der Verbindung und sind gemeinsam rückgängig machbar. Ein geometrischer Übergangsbereich hält Hover-Werkzeuge bei langsamen oder diagonalen Mauswegen und Pausen erreichbar; die bisherige Zeitgrenze entfällt.
