# Emergence

[English](README.md) · **Deutsch**

Zusammenhänge zwischen Notizen erkunden, neue Ideen entwickeln und Diagramme in Obsidian bearbeiten. Emergence verbindet diese Aufgaben in einem Seitenpanel, während du in deiner Notiz weiterarbeitest.

Das Plugin ist aus philosophischer Begriffsarbeit in einem persönlichen Forschungs-Vault entstanden. Beziehungsfelder und Darstellung sind anpassbar; andere Arbeitsweisen wurden bisher weniger umfassend erprobt.

## Was du damit machen kannst

| Deine Aufgabe | Dein Einstieg |
| --- | --- |
| Beziehungen zwischen Notizen verstehen und ordnen | [**Graph**](#notizen-erkunden-und-ordnen) zeigt die aktuelle Notiz im Zusammenhang mit deinen Breadcrumbs-Feldern und vorhandenen Links. |
| Neue Zusammenhänge finden | [**Feldideen**](#neue-zusammenhänge-entwickeln) schlägt mit einem lokalen Sprachmodell Begriffe vor. Du entscheidest, welche Beziehungen du übernimmst. |
| Abläufe, Mindmaps oder Argumentationen darstellen | [**Mermaid** und **Argdown**](#diagramme-neben-ihrem-quelltext-bearbeiten) verbinden grafische Bearbeitung mit einem ständig sichtbaren Quelltexteditor. |
| Notizen und Literatur finden | [**Suche**](#notizen-und-literatur-finden) durchsucht Notiztitel, Aliase und Tags sowie über ZotLit deine Zotero-Bibliothek. |

Die fünf Tabs stehen in der Reihenfolge **Graph → Feldideen → Mermaid → Argdown → Suche**. Jeden davon kannst du in den Einstellungen deaktivieren.

## Einstieg

### Voraussetzungen

Emergence benötigt **Obsidian Desktop ab 1.15.0**. Mobile wird nicht unterstützt.

Welche weiteren Werkzeuge du brauchst, hängt von deiner Nutzung ab:

| Für diese Funktion | Benötigst du |
| --- | --- |
| Typisierte Beziehungen in Graph und Feldideen | **Breadcrumbs v4** mit eingerichteten Beziehungsfeldern |
| Zotero-Suche, Literaturangaben und Literaturaktionen | **ZotLit 2.2** mit Verbindung zu deiner Zotero-Datenbank |
| KI-Vorschläge unter Feldideen | **Ollama** mit einem bereits installierten lokalen Modell |

Mermaid und Argdown funktionieren ohne diese optionalen Integrationen. Graph und Suche brauchen kein Sprachmodell; gewöhnliche Notizlinks und die Notizsuche funktionieren ohne ZotLit.

### Installation

1. Lade `main.js`, `manifest.json` und `styles.css` aus dem [neuesten stabilen Release](https://github.com/kpaede/Emergence/releases/latest) herunter.
2. Lege alle drei Dateien unter `<Vault>/.obsidian/plugins/emergence/` ab.
3. Aktiviere Emergence unter **Einstellungen → Community-Plugins**. Falls Obsidian beim Kopieren bereits geöffnet war, lade es neu.

Die Installation erfolgt derzeit manuell. Zum Prüfen der Dateien liegt dem Release auch `SHA256SUMS.txt` bei.

### Arbeitsbereich öffnen

Öffne eine Notiz und wähle das Netzwerk-Symbol in Obsidians Seitenleiste oder den Befehl **Emergence: Wissensgraph und Analyse öffnen** in der Befehlspalette. Emergence öffnet sich im rechten Seitenpanel.

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
