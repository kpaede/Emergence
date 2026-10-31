# Emergence

Ein Obsidian-Plugin für philosophische Begriffsarbeit: Breadcrumbs-Beziehungen überblicken, Notizen und Zotero-Literatur suchen und mit einem lokalen Sprachmodell neue Zuordnungen entwickeln.

**Emergence ist hochgradig für den persönlichen Bedarf seines Autors hergestellt.** Oberfläche, Arbeitsabläufe und Voreinstellungen sind aus einem konkreten Forschungs-Vault entstanden. Es ist ein experimentelles Werkzeug, kein allgemein ausgereiftes Community-Plugin. Andere Breadcrumbs-Felder können zugeordnet und beschrieben werden; die Übertragbarkeit auf andere Arbeitsweisen ist noch begrenzt geprüft.

## Voraussetzungen

- Obsidian Desktop ab **1.14.0**. Mobile wird nicht unterstützt.
- **Breadcrumbs v4** für typisierte Beziehungen und dessen Graph-API. Gewöhnliche Notizlinks funktionieren auch ohne Breadcrumbs.
- Optional **ZotLit 2.2** mit eingerichteter Zotero-Datenbank für Library-Suche und Zitate.
- Optional **Ollama** mit einem bereits lokal installierten Modell für Analyse und Recherche. Die Voreinstellung ist `qwen3.5:9b`; Emergence lädt kein Modell selbst herunter. Graph und Suche brauchen kein Sprachmodell.

## Installation aus dem Quellcode

```sh
git clone https://github.com/kpaede/Emergence.git
cd Emergence
npm ci
npm run build
```

Node.js 20 oder neuer verwenden. Anschließend `main.js`, `manifest.json` und `styles.css` in den Ordner `<Vault>/.obsidian/plugins/emergence/` kopieren und Emergence unter **Einstellungen → Community-Plugins** aktivieren. Die Plugin-ID lautet `emergence` und enthält gemäß Obsidian-Vorgabe nur Kleinbuchstaben. Bei älteren Entwicklungsinstallationen muss auch der Plugin-Ordner entsprechend umbenannt werden; `data.json` bleibt dabei erhalten. Das generierte `main.js` wird nicht im Repository verwaltet.

Über das Netzwerk-Symbol in der Seitenleiste oder den Befehl **Emergence: Wissensgraph und Analyse öffnen** öffnet sich das Plugin im rechten Seitenpanel. Die Hauptnotiz bleibt daneben editierbar.

## Vier Arbeitsbereiche

### Suche

Ein Klick auf den **Citekey** eines Zotero-Treffers kopiert ihn. Unter **Einstellungen → Emergence → Daten → Citekey kopieren** sind `[@citekey]` (Voreinstellung), `@citekey` und `citekey` wählbar.

Der erste Tab mit der Lupe durchsucht alle Markdown-Notizen anhand von Titel, Alias und Tags. Zusätzlich fragt er über ZotLit die **gesamte verfügbare Zotero-Library einschließlich Gruppen-Libraries** ab. Weder die Ordnerauswahl für KI-Kandidaten noch die gerade geöffnete ZotLit-Sammlung begrenzt diese Suche. ZotLits gespeicherte Einstellungen werden dabei nicht verändert.

- **Öffnen:** Notizen im Hauptbereich öffnen; Literaturangaben in der ZotLit Library auswählen.
- **Erkunden:** zum Graph-Tab wechseln und den Treffer dort fokussieren. Ein Literaturtreffer ohne Literaturnotiz wird als zitierter Titel im freien Netz untersucht; dabei entsteht keine Markdown-Datei.
- **Mittelklick:** Notizlinks in einem neuen Tab öffnen, auch beim Erkunden. Literaturangaben behalten ihre eigene Library-Aktion und öffnen per Mittelklick keinen weiteren Tab.

Notiz- und Literaturtreffer stehen getrennt untereinander. Weitere Ergebnisse lassen sich nachladen. Eine fehlende Zotero-Verbindung wird bei den Literaturtreffern angezeigt; die Notizsuche bleibt verfügbar.

### Graph

Die **Relationssynopse** ordnet die aktuelle Notiz in der Mitte an: Überordnung darüber, Unterordnung darunter, Ähnlichkeit links und Reibung rechts. Beispiele, Literatur und freie Verweise stehen in eigenen Registern. Die Namen der zugehörigen Breadcrumbs-Felder werden in **Ansicht und Filter** zugeordnet; Emergence legt dafür keine neuen Frontmatter-Felder an.

Weitere vorhandene Breadcrumbs-Felder wie **Konzept**, **Werk**, **Komponist_in**, **Autor_in**, **Künstler_in** und **Regisseur_in** erscheinen bei vorhandenen Verbindungen in eigenen Registern unter den Beispielen. Ihre Gegenrichtungen stammen aus der Breadcrumbs-Konfiguration. Ein generischer „Werk“-Link wird nicht willkürlich allen Urheberrollen zugewiesen. Die zusätzlichen Register haben ebenfalls eine Plus-Aktion für ihr tatsächliches Frontmatter-Feld.

Jede der sieben Hauptgruppen hat eine eigene Sichttiefe: **1, 2, 3 oder ∞**. Mehrfachüberordnungen bleiben als vollständige Ahnenpfade erhalten. Rückverweise werden begrenzt, damit Kreise keine endlosen Listen erzeugen. Viele Einträge werden durch vertikales Scrollen zugänglich.

**Die Reihenfolge direkt gespeicherter Begriffe entspricht dem Frontmatter.** Nur zusätzlich abgeleitete Gegenrichtungen folgen danach. Auch weitere Schritte verwenden jeweils die Reihenfolge ihrer eigenen Ausgangsnotiz. Es werden keine Sortierdaten in den Notizen gespeichert.

Ein Klick öffnet die Notiz. Mit **Im Graphen erkunden** verschiebt ein Klick nur den Graphfokus. Mittelklick öffnet Notizen trotzdem in einem neuen Tab. Bestehende und noch fehlende Notizen verwenden Obsidian-Linkstile und die Werte des aktiven Themes.

Das **Plus** bei den fünf Breadcrumbs-Gruppen ergänzt nach Auswahl genau einen Wikilink im zugeordneten Frontmatter-Feld. Bestehende Notizen werden wiederverwendet; fehlende Begriffe erzeugen nur einen Link. Bei mehreren gleichnamigen Dateien wird ein eindeutiges Ziel gewählt. Literatur und freie Verweise haben kein Plus: Sie stammen aus ZotLit beziehungsweise normalen Textlinks.

Zusätzlich stehen **Verbindungspfade** für kürzeste Breadcrumbs-Pfade und **Nachbarschaft und Links** als freies Cytoscape-Netz zur Verfügung. Die Synopse selbst verwendet HTML und SVG; die weiteren Netzanordnungen verwenden unter anderem ELK und fCoSE.

### Analyse

Die Analyse dient als Assoziationshilfe: bis zu **vier Begriffe je ausgewähltem Breadcrumbs-Feld**, das bereits im Frontmatter der aktuellen Notiz vorkommt. Die KI soll diese Felder füllen, keine Begleittexte oder beliebigen neuen Beziehungstypen erfinden.

1. Unter **Analyse einstellen** Felder auswählen und ihre Bedeutung beschreiben. Die Beschreibungen sind editierbar; fremde Feldnamen werden nicht stillschweigend interpretiert.
2. Den Suchbereich für bestehende Zielbegriffe wählen: alle Notizen, bestimmte Ordner und/oder Notizen mit bestimmten Frontmatter-Schlüsseln. „Mindestens ein Breadcrumbs-Feld“ ist ein möglicher Filter. Diese Auswahl betrifft die Analyse, nicht die globale Suche.
3. Optional Wikipedia oder die Websuche hinzuziehen und **Ideen vorschlagen** starten.
4. Vorschläge direkt in den Feldgruppen mit **✓** übernehmen oder **×** ablehnen. Der Stift bearbeitet den Begriff in der Zeile; Enter bestätigt, Escape verwirft die Bearbeitung.

Profilanweisungen und Prompts sind editierbar. Vorhandene Ziele werden gekennzeichnet und bevorzugt verlinkt. Kurze Wikilinks wie `[[Taxonomie]]` werden verwendet, sofern sie das Ziel eindeutig auflösen; andernfalls ist ein qualifizierter Pfad nötig. Ein neuer Vorschlag erzeugt keine neue Notizdatei.

Übernehmen ergänzt nur den betreffenden Link. Vor dem Schreiben werden Dateiänderungen und vorhandene Werte erneut geprüft; Text und andere Eigenschaften bleiben erhalten. Das lokale Änderungsjournal ermöglicht ein gezieltes Rückgängigmachen. Die Vorschlagsprüfung ist Teil der Analyse und hat keinen eigenen Haupttab.

### Recherche

Die Recherche bietet **Konkrete Beispiele**, **Kunstwerke – alle Gattungen** und weiterhin eine **freie Textantwort**. Die Vorlagen „Beispiele“ und „Kunstwerke“ sind direkt auswählbar. Kunstwerke können unter anderem Malerei, Skulptur, Fotografie, Installation, Musik, Oper, Musiktheater, Literatur, Theater, Tanz, Film, Architektur und digitale Kunst umfassen.

Bis zu vier Beispiele erscheinen als einzelne kompakte Zeilen mit Übernehmen, Ablehnen und Bearbeiten. Das Frontmatter-Zielfeld wird aus den vorhandenen Breadcrumbs-Feldern gewählt; die konfigurierte Beispiel-Gruppe ist die Voreinstellung. Ein Klick ergänzt genau einen Wikilink über denselben kontrollierten Writer wie die Synopsen-Plus-Aktion. Vorhandene Notizen werden wiederverwendet, bei Mehrdeutigkeit wird das Ziel ausgewählt. Die Recherche ersetzt keine offenen Ideen der Notizanalyse. Bei Kunstwerken filtert eine zweite, kurze Modellprüfung ungeeignete Vorschläge wie Fachbücher; sie darf keine neuen Titel hinzufügen und ersetzt keine Faktenprüfung. Modellideen und Suchhinweise werden unterschieden; Suchvorschauen gelten nicht als geprüfte Volltexte.

Der Notizkontext wird ausdrücklich gewählt: kein zusätzlicher Notiztext, Markierung, aktuelle Notiz, Beziehungen oder bestimmte Notizen. Die freie Textantwort bleibt lesend; nur die ausdrückliche Übernahme einer Beispielzeile schreibt einen Link.

Jede Frage ist zunächst unabhängig. Nur **Bisheriges Gespräch einbeziehen** sendet die letzten drei Gesprächsrunden mit. Der sichtbare Sitzungsverlauf wird nicht automatisch Kontext für neue Fragen oder Wikipedia-Suchen.

Recherche hat ein eigenes, an den verfügbaren Kontext angepasstes Ausgabebudget. Erreicht eine Antwort das Ausgabelimit, bleibt ihr Text sichtbar und wird als gekürzt gekennzeichnet. **Antwort fortsetzen** setzt genau diese Antwort fort. Unvollständige strukturierte Analysen bleiben dagegen für die Übernahme gesperrt.

## Lokale Verarbeitung und optionale Webquellen

Graphindex und Suche arbeiten lokal über Obsidian und ZotLit. KI-Anfragen gehen ausschließlich an den konfigurierten lokalen Ollama-Endpunkt. Je nach ausdrücklich gewählter Funktion enthalten sie die aktuelle Notiz, Feldbeschreibungen, ausgewählte Kontexte und/oder Kandidatentitel. Es gibt keine Telemetrie und keinen Cloud-Modell-Fallback.

**Websuche ist optional und ohne Anmeldung nutzbar.** DuckDuckGos öffentliche HTML-Suche liefert Titel und Vorschautexte aus höchstens zwei Ergebnisseiten, insgesamt höchstens 20 unterschiedliche Treffer. Nur der sichtbare Suchbegriff mit dem gewählten Zusatz „Beispiele“ oder „Kunstwerke“ wird gesendet. Zielseiten werden nicht automatisch geöffnet. Suchtreffer werden im Modellkontext begrenzt und als externes Datenmaterial behandelt. Bei Sperrprüfungen oder Ausfällen wird der tatsächliche Status angezeigt; es gibt keine Umgehung oder erfundenen Treffer. Die HTML-Anbindung ist keine zugesicherte Such-API und kann sich ändern.

**Wikipedia ist ebenfalls optional.** Bei eingeschaltetem Haken wird der angegebene Begriff an Wikipedia geschickt und ein begrenzter Auszug mit Quellenangabe als zusätzlicher Modellkontext verwendet. Notiztexte und Gesprächsverläufe werden nicht als Wikipedia-Suchanfrage übertragen. Ohne Haken erfolgt keine neue Wikipedia-Abfrage. Das Modell kann nicht selbstständig im Web browsen.

Plugin-Einstellungen und das Änderungsjournal liegen in Obsidian-typischem `data.json`. Rechercheverlauf und Suchtreffer bleiben im Arbeitsspeicher. Persönliche Einstellungen, Vault-Inhalte und lokale Prüfberichte gehören nicht ins Repository.

## Grenzen und Entwicklung

Die Modellvorschläge können fachlich falsch sein und bleiben eine Denkhilfe. Große Kontextmengen und lokale Hardware beeinflussen die Laufzeit. Die ZotLit-Integration kapselt eine interne, nicht als dauerhaft stabil zugesicherte `services`-Schnittstelle; inkompatible Versionen können Anpassungen erfordern. Fehlende oder mehrdeutige Literaturzuordnungen werden angezeigt, statt willkürlich ein Ziel zu öffnen.

```sh
npm run dev        # Entwicklung mit automatischem Bundle-Build
npm run build      # TypeScript-Prüfung und Produktionsbundle
npm test           # Unit- und Integrationstests mit lokalen Fixtures
npm run lint       # ESLint einschließlich Obsidian-Regeln
```

Die optionalen Tests gegen ein installiertes Modell werden mit `npm run test:ollama` gestartet. Native UI-Prüfungen benötigen eine laufende Obsidian-Entwicklungsinstanz mit aktivierter CLI. Dafür `OBSIDIAN_VAULT` auf den Namen des Test-Vaults setzen; bei Bedarf `OBSIDIAN_CLI` auf das ausführbare Programm. Manche ältere Prüfskripte sind auf die ursprüngliche Entwicklungsumgebung zugeschnitten und gehören nicht zur portablen Testsuite.

Die Implementierung liegt in `src/`, Tests mit synthetischen Notizen in `tests/`. [Aktuelle Prüfungen und technische Entscheidungen](docs/VALIDATION.md) beschreiben die jüngsten Änderungen. Architekturentscheidungen orientieren sich an der [offiziellen Obsidian-API](https://github.com/obsidianmd/obsidian-api) und den tatsächlich vorhandenen Breadcrumbs- und ZotLit-Schnittstellen.

Lizenz: [Zero-Clause BSD](LICENSE).
