# Emergence

[English](README.md) · **Deutsch**

Zusammenhänge zwischen Notizen erkunden, neue Ideen entwickeln und Diagramme in Obsidian bearbeiten. Emergence verbindet diese Aufgaben in einem Seitenpanel, während du in deiner Notiz weiterarbeitest.

Das Plugin ist aus philosophischer Begriffsarbeit in einem persönlichen Forschungs-Vault entstanden. Beziehungsfelder und Darstellung sind anpassbar; andere Arbeitsweisen wurden bisher weniger umfassend erprobt.

## Was du damit machen kannst

| Deine Aufgabe | Dein Einstieg |
| --- | --- |
| Gedanken und Textauszüge zu Kapiteln sammeln | [**Begleitdokument**](#begleitdokument) folgt der Gliederung deiner Hauptdatei und bietet Hierarchical Outline, EOME oder Lineage zum Bearbeiten. |
| Beziehungen zwischen Notizen verstehen und ordnen | [**Graph**](#notizen-erkunden-und-ordnen) zeigt die aktuelle Notiz im Zusammenhang mit deinen Breadcrumbs-Feldern und vorhandenen Links. |
| Neue Zusammenhänge finden | [**Feldideen**](#neue-zusammenhänge-entwickeln) schlägt mit einem lokalen Sprachmodell Begriffe vor. Du entscheidest, welche Beziehungen du übernimmst. |
| Abläufe, Mindmaps oder Argumentationen darstellen | [**Mermaid** und **Argdown**](#diagramme-neben-ihrem-quelltext-bearbeiten) verbinden grafische Bearbeitung mit einem ständig sichtbaren Quelltexteditor. |
| Vier Perspektiven gegenüberstellen | [**Tetrader**](#tetrader-und-eigene-markdown-muster) verbindet einen grafischen Editor mit eigenen Markdown-Mustern. |
| Notizen und Literatur finden | [**Suche**](#notizen-und-literatur-finden) durchsucht Notiztitel, Aliase und Tags sowie über ZotLit deine Zotero-Bibliothek. |

Die sieben Tabs stehen in der Reihenfolge **Begleitdokument → Graph → Feldideen → Mermaid → Argdown → Tetrader → Suche**. Jeden davon kannst du in den Einstellungen deaktivieren.

## Einstieg

### Voraussetzungen

Emergence benötigt **Obsidian Desktop ab 1.15.0**. Mobile wird nicht unterstützt.

Welche weiteren Werkzeuge du brauchst, hängt von deiner Nutzung ab:

| Für diese Funktion | Benötigst du |
| --- | --- |
| Typisierte Beziehungen in Graph und Feldideen | **Breadcrumbs v4** mit eingerichteten Beziehungsfeldern |
| Zotero-Suche, Literaturangaben und Literaturaktionen | **ZotLit 2.2** mit Verbindung zu deiner Zotero-Datenbank |
| KI-Vorschläge unter Feldideen | **Ollama** mit einem bereits installierten lokalen Modell |

Mermaid, Argdown und Tetrader funktionieren ohne diese optionalen Integrationen. Graph und Suche brauchen kein Sprachmodell; gewöhnliche Notizlinks und die Notizsuche funktionieren ohne ZotLit.

### Installation

1. Lade `main.js`, `manifest.json` und `styles.css` aus dem [neuesten stabilen Release](https://github.com/kpaede/Emergence/releases/latest) herunter.
2. Lege alle drei Dateien unter `<Vault>/.obsidian/plugins/emergence/` ab.
3. Aktiviere Emergence unter **Einstellungen → Community-Plugins**. Falls Obsidian beim Kopieren bereits geöffnet war, lade es neu.

Die Installation erfolgt derzeit manuell. Zum Prüfen der Dateien liegt dem Release auch `SHA256SUMS.txt` bei.

### Arbeitsbereich öffnen

Öffne eine Notiz und wähle das Netzwerk-Symbol in Obsidians Seitenleiste oder den Befehl **Emergence: Arbeitsbereich öffnen** in der Befehlspalette. Emergence öffnet sich im rechten Seitenpanel.

Unter **Einstellungen → Emergence** wählst du die Sprache und aktivierst die Bereiche, die du brauchst. Die Oberfläche unterstützt Deutsch und Englisch oder folgt Obsidians Sprache. Änderungen wirken sofort.

## Mit Emergence arbeiten

### Notizen erkunden und ordnen

**Graph** stellt die aktuelle Notiz in die Mitte ihrer Beziehungen. In der Voreinstellung stehen übergeordnete Begriffe oben, untergeordnete unten, ähnliche links und Gegenpositionen rechts. Beispiele, Literatur und weitere Verweise haben eigene Bereiche.

Ordne diesen Bereichen deine vorhandenen Breadcrumbs-Felder zu. In der Einstellungsvorschau kannst du Überschriften, Positionen, Reihenfolge und die Anzahl angezeigter Beziehungsebenen verändern. Deine eigenen Feldnamen bleiben erhalten.

Ein Klick öffnet eine Notiz. Im Erkundungsmodus folgst du ihren Verbindungen, während deine Schreibnotiz geöffnet bleibt. Über die Gruppenüberschrift ergänzt du Beziehungen; durch Ziehen verschiebst du eine bestehende Zuordnung in ein anderes Feld. Dabei werden die entsprechenden Notiz-Properties geändert. Bei verfügbaren Integrationen bietet die Ansichtsauswahl außerdem Breadcrumbs’ eigene Matrix und Baumansicht, ZotLits Literaturverzeichnis und Obsidians lokalen Graphen an.

### Neue Zusammenhänge entwickeln

**Feldideen** ist eine Assoziationshilfe für die aktuelle Notiz. Beschreibe die Bedeutung deiner Breadcrumbs-Felder, wähle den Suchbereich für vorhandene Begriffe und verbinde dein lokales Ollama-Modell. Als Modell ist `qwen3.5:9b` voreingestellt; Emergence lädt keine Modelle herunter.

Die Vorschläge erscheinen als unzugeordnete Begriffe. Bearbeite oder verwerfe sie und ziehe einen passenden Begriff auf das gewünschte Feld. Alternativ wählst du erst seinen Griff und dann das Zielfeld. Vorhandene Notizen werden wiederverwendet; für fehlende Begriffe entsteht ein Link, ohne automatisch eine Notiz anzulegen. Eine übernommene Beziehung kannst du rückgängig machen.

Feldbeschreibungen, Anweisungen und Modelleinstellungen bestimmst du selbst. Vorschläge können falsch sein und brauchen dein Urteil. Wikipedia-Auszüge und Websuche lassen sich ausdrücklich als zusätzlicher Kontext hinzunehmen.

### Diagramme neben ihrem Quelltext bearbeiten

**Mermaid** und **Argdown** zeigen Diagramm und Quelltext mit Syntax-Highlighting gleichzeitig. Die Auswahl wird in beiden Richtungen hervorgehoben. Du arbeitest im Seitenpanel oder im Vollbild und kannst grafische Änderungen sowie Codeänderungen gemeinsam rückgängig machen und wiederholen.

**Mermaid** eignet sich für Flowcharts und Mindmaps. Durch Ziehen verbindest du Elemente oder ergänzt einen verbundenen Knoten; per Doppelklick bearbeitest du Beschriftungen. Kompakte Werkzeuge bieten Formen, Farben und verschachtelte Subgraphen. Darstellung und automatische Anordnung übernimmt vollständig Obsidians integriertes Pele. Weitere Pele-Diagrammtypen stehen über Beispiele und Quelltextbearbeitung zur Verfügung; die grafischen Bearbeitungswerkzeuge unterstützen derzeit Flowcharts und Mindmaps.

**Argdown** dient der Arbeit mit Aussagen, Argumenten und ihren Beziehungen. Durch Ziehen ergänzt du unterstützende Gründe, Angriffe oder Unterminierungen. Verschachtelte Gruppen ordnen die Karte. Um Prämissen und Schlussfolgerungen zu bearbeiten, öffnest du die Rekonstruktion eines Arguments in einer eigenen Ansicht mit dem passenden Quelltext. Ob diese Rekonstruktion auch in der Hauptkarte sichtbar ist, entscheidest du unabhängig davon. Darstellung und Anordnung verwenden Argdown und Graphviz.

<details>
<summary>Vorlagen, Speichern und Markdown-Unterstützung</summary>

Beide Editoren haben dasselbe **Neu**-Menü mit mitgelieferten Beispielen, Vorschauen, Favoriten und wiederverwendbaren Vorlagen. Ergänze eigene Vorlagen oder wähle einen Vault-Ordner mit Markdown-Notizen, die Diagramm-Codeblöcke enthalten.

**Speichern:** Ein neues Diagramm bleibt ein Entwurf, bis du **In Notiz einfügen** wählst. Vorhandene Diagramme öffnest du über den Stift neben dem gerenderten Codeblock oder den Editorbefehl für das Diagramm am Cursor. Änderungen werden anschließend automatisch in genau diesen Block gespeichert, auch bei mehreren Diagrammen in einer Notiz. Füge Entwürfe vor dem Entladen des Plugins ein oder speichere sie als Vorlage; nicht eingefügte Entwürfe liegen nur im Arbeitsspeicher.

**Markdown:** Beschriftungsdialoge bieten Obsidians Markdown-Vorschau. Im Diagramm selbst gelten die Formatierungs- und Linkmöglichkeiten von Pele beziehungsweise Argdown; nicht jede Obsidian-Markdown-Erweiterung wird dort unterstützt. Für Syntax ohne grafisches Bedienelement bleibt der Quelltexteditor verfügbar.

</details>

### Tetrader und eigene Markdown-Muster

Der neue Tab **Tetrader** integriert die Schmetterlingsdarstellung von Tetrader mit Quelltext, Vorschau, Vollbild und gemeinsamem Rückgängig/Wiederholen. Bearbeite die vier Felder über ihre Schaltflächen oder per Doppelklick mit dem eingebetteten Markdown-Editor. Wähle vorhandene Tetraden über die Notizauswahl, **In Tetrader bearbeiten** am Callout oder den Befehl **Tetrade am Cursor bearbeiten**. Entwürfe werden erst mit **In Notiz einfügen** geschrieben; anschließend speichert der Editor nur diesen Block automatisch.

Mit **+ → Neues Muster** legst du Name, eindeutige Callout-Kennung, Überschriftenebene und die vier Überschriften selbst fest. Das Muster **McLuhan** unterstützt weiterhin das ursprüngliche Format `> [!tetrad]` mit englischen Überschriften und deren Aliasnamen. Eigene Muster können beispielsweise `> [!vier-perspektiven]` mit **Stärken**, **Risiken**, **Chancen** und **Verluste** verwenden. Die vier Positionen bleiben eindeutig: oben links, oben rechts, unten links, unten rechts. Der erste Absatz ist die Kernaussage; weitere Absätze erläutern sie von innen nach außen. Markdown, Links und Zeilenumbrüche bleiben erhalten.

Gespeicherte Muster bleiben stabil, damit bestehende Notizen erkannt werden. Für eine andere Struktur legst du ein neues Muster an. Frei konfigurierbar sind Kennung und Überschriften, keine beliebigen Markdown-Grammatiken. Muster und Darstellungseinstellungen liegen lokal in den Plugin-Daten. **Darstellung der Tetraden** konfiguriert Mitte, Legende, Gesetzesnamen und Kürzel. Falls ein gebundener Block parallel geändert oder entfernt wird, stoppt das Speichern und erhält den Entwurf. **Als Entwurf kopieren** löst die Bindung für die Wiederherstellung. Öffne den ursprünglichen Block erneut, um dessen aktuellen Stand zu bearbeiten.

Das eigenständige Tetrader-Plugin ist dafür nicht erforderlich. Der Renderer basiert auf Tetrader 0.2.3, Commit `77a502800ccc924ece5b6c027ca1b99794205b45`; die Lizenz liegt unter `third-party/Tetrader-LICENSE.txt`. Es kommen keine Netzwerkzugriffe hinzu.

### Begleitdokument

Der Tab **Begleitdokument** sammelt Einträge entlang der Überschriften eines Hauptdokuments. Das Hauptdokument bekommt keine Kennungen, Metadaten oder automatisch geänderten Überschriften. Öffne es in Obsidian und wähle **Begleitdokument anlegen** im neuen Tab oder über die Befehlspalette.

Du kannst mehrere unabhängige Begleitdokumente zum selben Hauptdokument anlegen und über die Dateiauswahl wechseln. Bei geöffnetem Begleitdokument stehen **Weiteres Begleitdokument anlegen** und **Anderes Begleitdokument auswählen** im Dokumentmenü. Die Kopfzeile bietet dafür keine zusätzlichen Symbole. Die Dateiauswahl zeigt Begleitdokumente mit Zuordnungsmetadaten; gewöhnliche Markdown-Notizen werden nicht automatisch umgewandelt. Bei gelöschten, fehlenden oder beschädigten Dateien bietet die Ansicht Neuanlegen, Auswahl und erneutes Prüfen nach einer Wiederherstellung an. Fehlende Abschnittsdateien werden nicht automatisch durch leere Dateien ersetzt. Fehlt das Hauptdokument, bleiben Einträge lesbar und eine neue Hauptdatei kann zugeordnet werden. Nicht gespeicherte Änderungen an einer fehlenden Datei werden abgelehnt; es entstehen keine Ansichtskopien.

Die **Dateiaufteilung für ein neues Begleitdokument** wählst du direkt in der Startansicht: **Alle Kapitel in einer Begleitdatei** oder **Eine Datei je Kapitel**. Diese Auswahl bleibt auch im Anlagedialog bei Verwendung der allgemeinen Ablagevorgaben frei wählbar. Bestehende Begleitdokumente zeigen ihre gespeicherte Aufteilung neben der Auswahl **Ansicht** an. Die Auswahl für neue Dokumente stellt vorhandene Dateien nicht um. Im Frontmatter speichert `emergence-storage.mode` die Variante (`document` oder `sections`); `emergence-companion-role` unterscheidet gemeinsame Datei (`document`), Kapitelübersicht (`index`) und Kapiteldatei (`section`). Kapiteldateien verweisen über `emergence-parent-companion-id` auf ihre zugehörige Übersicht. Eindeutige ältere Dateien ohne explizite Rolle bleiben lesbar; widersprüchliche Angaben stoppen den Abgleich.

Unter **Einstellungen → Emergence → Begleitdokument** legst du Vorgaben fest: eine gemeinsame Begleitdatei oder eine Datei je Überschrift, jeweils neben der Originaldatei, in einem festen Vault-Ordner oder in einem benannten Unterordner bei der Originaldatei (Vorgabe: `Companions`). Beim Anlegen wählst du **Allgemeine Vorgaben verwenden** oder **Für dieses Dokument festlegen**. Die Ablage wird je Dokumentpaar gespeichert; spätere Änderungen an den Vorgaben gelten für neue Paare. Fehlende Ordner werden angelegt. Bei Abschnittsdateien enthält eine zusätzliche Markdown-Indexdatei die Gliederung, Dateiverbindungen und Zuordnungsinformationen; Einträge stehen ausschließlich in den Abschnittsdateien. Dateinamen bleiben bei Überschriftenänderungen stabil. Relative Ablagen folgen Ordnerwechseln des Hauptdokuments; ein fester Zielordner bleibt bestehen.

Die Kapitelnavigation verwendet Obsidian-Überschriftenmetadaten und den Syntaxbaum des offenen Editors sowie die Theme-Klassen der Outline. Sie folgt der Schreibposition; das Fadenkreuz schaltet diese Funktion um. Einträge bleiben von der Kapitelgliederung getrennt. Die Auswahl **Ansicht** liegt direkt unter der Gliederung beim Bearbeitungsbereich und bietet die installierten Originalansichten von **Excerpt Outline Mindmap Editor** und **Lineage** an derselben Stelle. **Hierarchical Outline** benötigt kein zusätzliches Plugin. Die Ansicht zeigt die vollständigen Texte einer Ebene zwischen kurzen Vorschauen des übergeordneten Eintrags und seiner Untereinträge, mit Pfeiltastennavigation, Enter zum Bearbeiten, Markdown-Editor, Aufgabencheckboxen und Unterbaum-Verschiebungen. Die Anlegekürzel folgen EOME: Strg/Cmd+←/→ fügt Einträge davor oder danach hinzu, Strg/Cmd+↓ einen Untereintrag. ↑/↓ wechselt zwischen Einträgen derselben Ebene, ← zum übergeordneten Eintrag, → zu den Untereinträgen. Neue Einträge werden direkt an ihrer Einfügeposition bearbeitet. Die freie Fläche unter der Liste nimmt per Drag-and-drop Einträge samt Unterbaum als letzte Einträge auf derselben Ebene auf; eine Markierung zeigt das Ablageziel. Rückgängig stellt die vorherige Struktur wieder her. Das Eingabefeld beginnt einzeilig und wächst mit dem Text; Bestätigen und Abbrechen stehen als Symbolschalter rechts in der Zeile. Escape verwirft auch bei Fokus auf diesen Schaltern; offene Linkvorschläge werden zuerst geschlossen. **Abgehakte ausblenden** blendet erledigte Zweige aus; nötige Verbindungen zu offenen Nachkommen bleiben sichtbar. Im Editor übernimmt Enter außerhalb von Listen; Shift+Enter fügt einen Zeilenumbruch ein. Linkvorschläge kommen direkt aus Obsidian. Escape verwirft. Einträge werden als Markdown mit Einrückungen gespeichert; Kennungen stehen nur an den Kapitelüberschriften. Fehlgeschlagene Reader-Änderungen werden abgelehnt und der aktuelle Dateistand angezeigt; es entsteht kein Sicherungsdokument. Alle drei Ansichten verwenden dieselben Begleitdateien. **Hierarchical Outline** ist die Standardansicht und steht zuerst in der Auswahl. Unter **Einstellungen → Emergence → Begleitdokument → Standardansicht** lässt sich die Vorgabe ändern. Eine ausdrücklich je Begleitdokument gewählte Ansicht bleibt erhalten. Deaktivierte Plugins können ausdrücklich aktiviert werden. Die Haupt-Tabs bleiben einzeilig und horizontal scrollbar; Suche und Bearbeitungsfunktionen liegen im jeweiligen Originaleditor unterhalb der Kapitelnavigation.

Im Modus **Eine Datei je Kapitel** zeigt die Gliederung den Dateistatus direkt am Kapitel an: **Datei fehlt** oder **Datei prüfen**. Die Dateischaltfläche öffnet die jeweilige Kapiteldatei in einem Obsidian-Tab und verwendet einen bereits offenen Tab erneut. Bei fehlenden Dateien ist sie deaktiviert. Fehlende oder nicht lesbare Kapitel blockieren die übrige Gliederung und die Bearbeitung vorhandener Kapitel nicht. Auch Überschriftenänderungen werden weiter abgeglichen; nicht verfügbare Dateien werden dabei weder als leer behandelt noch automatisch neu angelegt. Wiederhergestellte Dateien werden erneut eingelesen. Für eine fehlende Datei bietet die Ansicht **Vorhandene Datei auswählen** oder **Neue leere Kapiteldatei anlegen** nach dem gespeicherten Ablagemuster.

Beide Originalansichten verwenden die registrierten Komponenten der installierten Plugins, einschließlich ihrer ursprünglichen Texteditoren, Tastaturnavigation, Teilbaumoperationen und Rückgängig-Funktionen. EOMEs Checkbox-Bedienung ist bei neuen Ansichten beim Überfahren sichtbar und bleibt in dessen Einstellungen konfigurierbar. Es entstehen keine Arbeitskopie und kein zusätzlicher Workspace-Tab. Ansichtsoptionen werden lokal je Abschnitt gespeichert. Das Hauptdokument wird keinem der beiden Editoren zum Schreiben übergeben.

Neue Companion-Abschnitte verwenden EOMEs Markdown-Format 2: Struktur-Tabs kennzeichnen Einträge, zwei zusätzliche Leerzeichen ihre Textfortsetzungen. Absätze, interne Listen, Zitate, Überschriften und Code gehören zum selben Eintrag, bis ein tatsächlicher Untereintrag angelegt wird. Bestehende ältere Abschnitte werden anhand ihrer bisherigen Hierarchie dargestellt und beim Speichern eines geänderten Abschnitts ins neue Format übertragen. Nicht unterstützter älterer Fließtext stoppt die Umstellung zur Prüfung. Unbearbeitete Abschnitte behalten ihren ursprünglichen Text. Die Formatregeln sind aus EOME adaptiert (MIT; `third-party/companion-outline-LICENSE.txt`).

Innerhalb von Emergence übergibt der Lineage-Adapter vollständige Inhalte an dessen natives Knotenmodell und speichert dieses ohne Abschneiden von Rand-Leerzeichen. Dadurch bleiben auch führende und abschließende Leerzeilen sowie Codebeispiele mit Abschnittskommentaren erhalten. Diese Anpassung gilt für die eingebettete Ansicht; das eigenständige Lineage behält seine eigenen Formatgrenzen. Bei Schreibkonflikten wird die Änderung abgelehnt und der tatsächliche Dateistand erneut geladen. Ansichtswechsel warten auf das Abschließen einer offenen EOME-Bearbeitung.

EOME und Lineage bleiben separat installierte Originalplugins. Emergence setzt keine lokal veränderte Ausgabe voraus. Das gemeinsame Begleitformat folgt EOMEs mehrzeiligem Markdown-Format; Lineage wird über sein natives Knotenmodell angebunden. Die benötigten Editorfunktionen werden beim Laden geprüft. Bei einer inkompatiblen Plugin-Version bleibt die Begleitdatei als Markdown erreichbar.

Darstellungsunterschied: Lineage 0.8.5 kann eingegebene Absätze außerhalb des Bearbeitens in der geprüften Konfiguration zusammenziehen. Der gespeicherte Text bleibt erhalten. Emergence übernimmt die originale Textdarstellung; Eintragshierarchie und Markdown-Speicherung sind davon unabhängig.

Die Darstellung der beiden Originalansichten folgt dem Obsidian-Theme, einschließlich Texteditoren und neuer Einträge. Gemeinsame Ausgangsschrift, kompaktere Karten und ein Startzoom von 100 Prozent werden einmalig als lokale Originaloptionen gesetzt; spätere bewusste Änderungen bleiben erhalten. Die Trennlinie zur Kapitelgliederung lässt sich ziehen oder mit den Pfeiltasten bewegen. In breiten Ansichten liegt die Gliederung daneben. [Gestaltungsregeln und Integrationsgrenze](docs/companion-presentation.md) beschreiben die Zuständigkeiten und die verbleibenden versionsgebundenen Schnittstellen.

Ein aus dem Companion-YAML und Obsidian-Metadaten wiederhergestellter Rückwärtsindex findet die Begleitdateien beim Öffnen des Hauptdokuments auch nach einem Neustart. Er ist unabhängig von der Backlink-Seitenleiste und ergänzt keine Metadaten im Hauptdokument.

Die Verbindung zum Hauptdokument liegt im Companion-YAML unter `emergence-main-document`. Gespeicherte Abschnittskennungen stehen ausschließlich im Begleitdokument. Einzelne Einträge erhalten keine gespeicherten Kennungen; ihre Arbeitsreferenzen gelten nur während der Sitzung. Der Abgleich reagiert auf Editor- und Dateiereignisse, bündelt Gliederungsänderungen und prüft keine Dateien im Leerlauf. Normale Fließtexteingaben lösen keinen Companion-Schreibvorgang aus. Bei mehrdeutigen Änderungen bleibt ein früherer Abschnitt mit seinen Einträgen unter **Zuordnung prüfen** erhalten. Dort kann er einem aktuellen Abschnitt zugeordnet oder **ohne Abschnitt** behalten werden. Entfernte oder doppelte Abschnittskennungen stoppen den automatischen Abgleich, bis die Zuordnung korrigiert ist.

Bei gleichzeitigen Änderungen bleibt die externe Fassung geschützt. Eine veraltete Änderung wird mit Fehlermeldung abgelehnt und die gespeicherte Fassung angezeigt. Es gibt keine Ansichtsentwürfe, Exportkopien oder Verwerfen-Zeile. Mehrdatei-Operationen werden mit einem lokalen Wiederherstellungsprotokoll abgesichert. Bei einem unterbrochenen Vorgang versucht **Wiederherstellung versuchen**, bereits ausgeführte Schritte nur dann zurückzunehmen, wenn keine neuere Fremdänderung überschrieben würde. Bei einem Konflikt zeigt der Wiederherstellungsdialog den vorherigen und den geplanten Dateiinhalt. Nach deren Prüfung kann der aktuelle Stand ausdrücklich beibehalten werden; dabei werden keine Dateien überschrieben. Dieses Protokoll ist kein geräteübergreifender Schreib-Lock; gleichzeitige Cloud-Konfliktkopien benötigen weiterhin Klärung.

Im **…**-Menü des Dokuments liegen **Begleitdatei öffnen** (im Abschnittsmodus die ausgewählte Abschnittsdatei) und **Verbindung ändern**. Bearbeitet wird direkt in der Begleitdokument-Ansicht. EOME und Lineage bleiben eigenständige, optionale Plugins. Die Adapter wurden mit EOME 0.2.4 und Lineage 0.8.5 geprüft; EOME ab 0.2.3 ist erforderlich. Es kommen keine Netzwerkzugriffe hinzu.

### Notizen und Literatur finden

**Suche** findet Notizen anhand von Titel, Alias und Tags. Mit ZotLit durchsucht sie außerdem deine verfügbaren Zotero-Bibliotheken einschließlich Gruppenbibliotheken. Die Ergebnisse sind unabhängig vom Suchbereich für Feldideen.

Öffne eine Notiz direkt oder erkunde sie im Graphen. Literaturtreffer verwenden ZotLits Zitationsformatierung und bieten Aktionen für den Bibliothekseintrag, die Literaturnotiz, den Zotero-Eintrag, den Anhang, die Fundstelle und den Citekey. Manche Aktionen setzen passende Metadaten voraus. Für die Formatierung bisher nicht in der aktuellen Notiz zitierter Literatur muss Zotero gegebenenfalls mit aktivierter lokaler API geöffnet sein.

## Datenschutz und Speicherung

Graph, Notizsuche und Diagrammbearbeitung arbeiten lokal. KI-Anfragen gehen an deinen konfigurierten lokalen Ollama-Endpunkt und enthalten die Notiz, Feldbeschreibungen sowie relevante Kandidatentitel oder ausgewählte Quellenauszüge. Es gibt keine Telemetrie und keinen Cloud-Modell-Fallback.

Wikipedia und DuckDuckGo sind optionale externe Quellen. Wenn du sie aktivierst, wird der gewählte Suchbegriff an den jeweiligen Dienst geschickt, nicht dein Notiztext. Bei DuckDuckGo werden die Suchergebnisseiten abgefragt; verlinkte Webseiten werden nicht automatisch geöffnet. Die Literaturformatierung kann auf Zoteros konfigurierte lokale API zugreifen.

Übernommene Beziehungen und eingefügte Diagramme liegen in deinen Notizen. Einstellungen, Vorlagenpräferenzen und das Änderungsjournal für Beziehungen speichert das Plugin in `data.json`. Vorlagen können außerdem als Markdown-Notizen in deinem gewählten Vault-Ordner liegen. Suchtreffer, Vorschläge und nicht eingefügte Diagrammentwürfe sind vorübergehend.

## Mehr erfahren

- [Einstellungen, Graph-Darstellung und Vorlagenordner](docs/PREFERENCES.md)
- [Argdown-Editor: Bedienung und Funktionsumfang](docs/ARGDOWN_EDITOR.md)
- [Argdown-Leitfadenabgleich und verbleibende Grenzen](docs/ARGDOWN_GUIDE_AUDIT.md)
- [Prüfergebnisse und Kompatibilität](docs/VALIDATION.md)

Die [Versionsgeschichte](CHANGELOG.md) beschreibt die Änderungen je Release. Integrationen mit anderen Plugins hängen von deren verfügbaren Schnittstellen ab; die Prüfdokumentation nennt getestete Versionen und bekannte Grenzen.

<details>
<summary>Aus dem Quellcode bauen</summary>

Verwende Node.js ab 22.12 innerhalb der unterstützten 22er- oder 24er-LTS-Reihen und npm. So baust du die veröffentlichte Version:

```sh
git clone --branch 0.0.4 https://github.com/kpaede/Emergence.git
cd Emergence
npm ci
npm run build
```

Kopiere `main.js`, `manifest.json` und `styles.css` in den oben beschriebenen Pluginordner. Zur Entwicklung dient `npm run dev`; `npm test` und `npm run lint` prüfen Änderungen. Native Oberflächentests benötigen zusätzlich einen laufenden Obsidian-Test-Vault mit aktivierter CLI.

</details>

Lizenz: [Zero-Clause BSD](LICENSE). Lizenzen und Hinweise zu eingebundenen Komponenten stehen unter [third-party](third-party/).
