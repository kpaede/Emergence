# Emergence

Ein Obsidian-Plugin für philosophische Begriffsarbeit: Breadcrumbs-Beziehungen überblicken, Notizen und Zotero-Literatur suchen und mit einem lokalen Sprachmodell neue Zuordnungen entwickeln.

**Emergence ist hochgradig für den persönlichen Bedarf seines Autors hergestellt.** Oberfläche, Arbeitsabläufe und Voreinstellungen sind aus einem konkreten Forschungs-Vault entstanden. Es ist ein experimentelles Werkzeug, kein allgemein ausgereiftes Community-Plugin. Andere Breadcrumbs-Felder können zugeordnet und beschrieben werden; die Übertragbarkeit auf andere Arbeitsweisen ist noch begrenzt geprüft.

## Voraussetzungen

- Obsidian Desktop ab **1.14.0**. Mobile wird nicht unterstützt.
- **Breadcrumbs v4** für typisierte Beziehungen und dessen Graph-API. Gewöhnliche Notizlinks funktionieren auch ohne Breadcrumbs.
- Optional **ZotLit 2.2** mit eingerichteter Zotero-Datenbank für Library-Suche und Zitate.
- Optional **Ollama** mit einem bereits lokal installierten Modell für Feldideen. Die Voreinstellung ist `qwen3.5:9b`; Emergence lädt kein Modell selbst herunter. Graph und Suche brauchen kein Sprachmodell.

## Installation

Aus [Release 0.0.3](https://github.com/kpaede/Emergence/releases/tag/0.0.3) die drei Dateien `main.js`, `manifest.json` und `styles.css` herunterladen und unter `<Vault>/.obsidian/plugins/emergence/` ablegen. Anschließend unter **Einstellungen → Community-Plugins** aktivieren. Der Release enthält zusätzlich SHA-256-Prüfsummen. Bis zur Aufnahme ins Community-Verzeichnis erfolgt die Installation manuell.

### Aus dem Quellcode

```sh
git clone https://github.com/kpaede/Emergence.git
cd Emergence
npm ci
npm run build
```

Node.js **22.12 oder neuer innerhalb der unterstützten 22er-/24er-LTS-Reihen** verwenden. Anschließend `main.js`, `manifest.json` und `styles.css` in den Ordner `<Vault>/.obsidian/plugins/emergence/` kopieren und Emergence unter **Einstellungen → Community-Plugins** aktivieren. Die Plugin-ID lautet `emergence` und enthält gemäß Obsidian-Vorgabe nur Kleinbuchstaben. Bei älteren Entwicklungsinstallationen muss auch der Plugin-Ordner entsprechend umbenannt werden; `data.json` bleibt dabei erhalten. Das generierte `main.js` wird nicht im Repository verwaltet.

Über das Netzwerk-Symbol in der Seitenleiste oder den Befehl **Emergence: Wissensgraph und Analyse öffnen** öffnet sich das Plugin im rechten Seitenpanel. Die Hauptnotiz bleibt daneben editierbar.

## Drei Arbeitsbereiche

Die Tabs stehen in dieser Reihenfolge: **Graph** (Netzwerk), **Feldideen** (Text-search), **Suche** (Lupe).

### Graph

Die Ansicht **Kontext** ordnet die aktuelle Notiz in der Mitte an: Überordnung darüber, Unterordnung darunter, Ähnlichkeit links und Reibung rechts. Beispiele, Literatur und freie Verweise stehen in eigenen Registern. Die Namen der zugehörigen Breadcrumbs-Felder werden unter **Felder und Quellen** über native Auswahlmenüs mit Häkchen zugeordnet. Mehrere Felder pro Gruppe bleiben möglich; Literatur und freie Verweise zeigen ihre festen Quellen. Emergence legt dafür keine neuen Frontmatter-Felder an.

**Konzept**, **Komponist_in**, **Autor_in**, **Künstler_in**, **Regisseur_in**, **Librettist_in** und weitere über **Werk** konfigurierte Urheberrollen erscheinen in eigenen Registern unter den Beispielen, wenn die zentrale Notiz im Frontmatter-Feld `tags` einen Untertag von `Werk` hat, etwa `Werk/Musiktheater/Oper` oder `Werk/Film`. Dabei stehen alle diese Felder gemeinsam zur Verfügung, auch leer. Andere zusätzliche Felder wie **Werk** erscheinen bei vorhandenen Verbindungen. Ihre Gegenrichtungen stammen aus der Breadcrumbs-Konfiguration. Ein generischer „Werk“-Link wird nicht willkürlich allen Urheberrollen zugewiesen.

Jede der sieben Hauptgruppen hat eine eigene Sichttiefe: **1, 2, 3 oder ∞**. Mehrfachüberordnungen bleiben als vollständige Ahnenpfade erhalten. Rückverweise werden begrenzt, damit Kreise keine endlosen Listen erzeugen. Viele Einträge werden durch vertikales Scrollen zugänglich. Unter **Freie Verweise** stehen zusätzlich **Rückverweise** aus Obsidians eigenem Linkindex: alle verlinkenden Markdown-Notizen einmalig, einschließlich Properties-Links. Dafür wird kein Frontmatter-Feld angelegt.

**Die Reihenfolge direkt gespeicherter Begriffe entspricht dem Frontmatter.** Nur zusätzlich abgeleitete Gegenrichtungen folgen danach. Auch weitere Schritte verwenden jeweils die Reihenfolge ihrer eigenen Ausgangsnotiz. Es werden keine Sortierdaten in den Notizen gespeichert.

Beim Umbenennen einer Notiz aktualisiert sich auch die zentrale Beschriftung unmittelbar, einschließlich des Erkundungsmodus und umbenannter übergeordneter Ordner. Ein Klick öffnet die Notiz. Mit **Im Graphen erkunden** verschiebt ein Klick nur den Graphfokus. Mittelklick öffnet Notizen trotzdem in einem neuen Tab. Bestehende und noch fehlende Notizen verwenden Obsidian-Linkstile und die Werte des aktiven Themes.

Das **Plus** steht direkt neben dem jeweiligen Gruppentitel und ergänzt immer eine Beziehung in der zentralen Notiz. Der Dialog nennt die betroffene Notiz ausdrücklich. Einzelne Begriffe haben kein Plus; bei ihnen erscheint beim Überfahren links ein **Ziehgriff**, der die dahinterliegende Linie verdeckt. Ohne Hover bleibt die Linie vollständig sichtbar. Begriffe und Ziehgriffe zeigen keine Tooltips. Bestehende Notizen werden wiederverwendet; fehlende Begriffe erzeugen nur einen Link. Bei mehreren gleichnamigen Dateien wird ein eindeutiges Ziel gewählt. Literatur und freie Verweise stammen aus ZotLit beziehungsweise normalen Textlinks und bleiben ohne diese Bearbeitungsaktionen.

Ziehe einen Begriff am Griff auf eine andere Breadcrumbs-Gruppe, um seine Zuordnung zu verschieben. Bei mehreren zugeordneten Feldern wählst du anschließend das konkrete Zielfeld. Emergence entfernt die ursprüngliche Verbindung und ergänzt den Link im Zielfeld der zentralen Notiz. Auch explizit gespeicherte Gegenrichtungen werden in den Notizen geändert, denen sie gehören. Alle betroffenen Änderungen werden vor dem Schreiben geprüft; bei einem Schreibkonflikt werden bereits ausgeführte Schritte zurückgenommen. Der Notiztext bleibt erhalten.

Im Dropdown **Ansicht** steht **Kontext** (HTML/SVG) an erster Stelle und ist vorausgewählt. Es ist jeweils genau eine Ansicht sichtbar; sie füllt die verbleibende Seitenpanelfläche ohne zusätzlichen Fensterrahmen. Zusätzlich sind die **originalen Ansichten** der aktivierten Plugins auswählbar:

- **Breadcrumbs · Matrix** und **Breadcrumbs · Baum**, mit deren eigenen Filtern und Bedienelementen.
- **ZotLit · Literaturverzeichnis** der aktuellen Notiz, in ZotLits eigener Darstellung und mit dessen Zitationsstil.
- **Obsidian · Lokaler Graph** der aktuellen Notiz. Er erscheint nur bei aktiviertem Obsidian-Core-Plugin „Graph“. Emergence aktiviert es nicht und zeigt keinen Gesamtgraphen an.

Die ausgewählte Originalansicht folgt der geöffneten Hauptnotiz. Beim Umschalten wird die vorherige native Ansicht entladen. Der lokale Graph wird beim Öffnen und Notizwechsel auf die aktuelle Notiz zentriert und mit lesbarem Maßstab gestartet; anschließendes manuelles Zoomen bleibt erhalten. Das Erkunden der Synopse ändert diesen Notizkontext nicht. Bestehende Plugin-Tabs bleiben an ihrem Platz; für die Einbettung werden keine zusätzlichen Workspace-Tabs angelegt.

Literaturangaben in Synopse und Suche stammen aus **ZotLits originalem Bibliografie-Renderer mit dem dort ausgewählten CSL-Stil**. Auch Notizstil, Sprache und Importprofil werden berücksichtigt. Es gibt keine eigene Kurzformatierung oder selbst zusammengesetzte Autoren-/Jahresangabe. Das auswählbare ZotLit-Literaturverzeichnis verwendet seine Originaloberfläche. Fehlende oder mehrdeutige Datensätze werden als solche bezeichnet; Citekeys werden nicht als erfundene Buchtitel ausgegeben.

Für Zitate der aktuellen Notiz verwendet Emergence ZotLits vorhandene CSL-Daten auch bei geschlossenem Zotero. Bei bisher unzitierten Suchtreffern liefert Zotero die kanonischen CSL-Daten über seine bereits eingerichtete lokale API; dafür muss Zotero geöffnet und dessen lokale API aktiviert sein. Emergence ändert diese Einstellung nicht. Ist die Originalformatierung nicht verfügbar, wird das knapp angezeigt, statt einen Ersatz-Zitationsstil zu erfinden; Öffnen und Citekey-Kopieren bleiben möglich.

### Feldideen

Die Analyse dient als Assoziationshilfe: Die KI erzeugt eine **gemeinsame Liste unzugeordneter Begriffe**. Alle für die Analyse verfügbaren Breadcrumbs-Felder aus dem Frontmatter und ihre Beschreibungen dienen als Denkanstöße. Die Zuordnung zu einem Feld entscheidest du selbst; die KI speichert keine Verbindungen.

1. Breadcrumbs-Felder im Frontmatter der aktuellen Notiz bereitstellen, auch leer. Unter **Analyse einstellen** ihre Bedeutung beschreiben. Die Beschreibungen sind editierbar; fremde Feldnamen werden nicht stillschweigend interpretiert.
2. Den Suchbereich für bestehende Zielbegriffe wählen: alle Notizen, bestimmte Ordner und/oder Notizen mit bestimmten Frontmatter-Schlüsseln. „Mindestens ein Breadcrumbs-Feld“ ist ein möglicher Filter. Diese Auswahl betrifft die Analyse, nicht die globale Suche.
3. Optional Wikipedia oder die Websuche hinzuziehen und **Ideen vorschlagen** starten.
4. Einen Begriff am **Ziehgriff** auf eines der oben angezeigten Felder ziehen. Alternativ erst seinen Griff und dann das Zielfeld auswählen; das funktioniert auch per Tastatur. **×** verwirft einen Vorschlag. Der Stift bearbeitet den Begriff in der Zeile; Enter bestätigt, Escape verwirft die Bearbeitung.

Profilanweisungen und Prompts sind editierbar. Vorhandene Ziele werden gekennzeichnet und bevorzugt verlinkt. Kurze Wikilinks wie `[[Taxonomie]]` werden verwendet, sofern sie das Ziel eindeutig auflösen; andernfalls ist ein qualifizierter Pfad nötig. Ein neuer Vorschlag erzeugt keine neue Notizdatei.

Übernehmen ergänzt nur den betreffenden Link. Vor dem Schreiben werden Dateiänderungen und vorhandene Werte erneut geprüft; Text und andere Eigenschaften bleiben erhalten. Das lokale Änderungsjournal ermöglicht ein gezieltes Rückgängigmachen. Die Vorschlagsprüfung ist Teil der Analyse und hat keinen eigenen Haupttab.

**Lange Notizen:** Passt der relevante Notiztext nicht in eine Anfrage, wird er vollständig abschnittweise verarbeitet. Die abschließenden Feldideen verwenden dann eine gekennzeichnete Arbeitszusammenfassung. Feldrollen werden bei Bedarf in Gruppen bearbeitet. Es wird kein bloßer Anfangsausschnitt verwendet und die Originalnotiz bleibt unverändert. Diese zusätzliche Verarbeitung dauert länger und kann Details verdichten oder verlieren. Fehler oder Abbruch geben keine unvollständige Vorbereitung zur Übernahme frei.

### Suche

Die **Literaturangabe ist auswählbarer Text ohne Link**. Beim Überfahren der jeweiligen Literaturangabe erscheinen darunter dieselben sechs Symbolaktionen in Suche und Kontext: **ZotLit öffnen** (ZotLit-Logo), **Literaturnotiz öffnen**, **Zotero öffnen**, **Anhang öffnen**, **Zur Fundstelle** und **Citekey kopieren**. Ohne Hover benötigt die Aktionszeile keinen Platz. Beim Einblenden bleiben Literaturangabe und Scrollposition unverändert; nur die folgenden Einträge rücken nach unten. Mit Tastaturfokus erscheint sie ebenfalls; auf Geräten ohne Hover bleibt sie sichtbar. Der Citekey selbst erscheint nicht zusätzlich in der Liste; der Tooltip des Kopiersymbols zeigt den zu kopierenden Wert. Fehlende Anhänge oder Fundstellen werden durch deaktivierte Aktionen gekennzeichnet. Die Literaturnotiz wird über ZotLits eigene Öffnen-/Anlegen-Funktion erreicht; ein Mittelklick auf diese Aktion öffnet sie in einem neuen Tab. Unter **Einstellungen → Emergence → Daten → Citekey kopieren** sind `[@citekey]` (Voreinstellung), `@citekey` und `citekey` wählbar.

Der letzte Tab mit der Lupe durchsucht alle Markdown-Notizen anhand von Titel, Alias und Tags. Zusätzlich fragt er über ZotLit die **gesamte verfügbare Zotero-Library einschließlich Gruppen-Libraries** ab. Weder die Ordnerauswahl für KI-Kandidaten noch die gerade geöffnete ZotLit-Sammlung begrenzt diese Suche. ZotLits gespeicherte Einstellungen werden dabei nicht verändert.

- **Öffnen:** Notizen im Hauptbereich öffnen; Literaturangaben in der ZotLit Library auswählen.
- **Erkunden:** bei Notiztreffern zum Graph-Tab wechseln und die Notiz dort fokussieren. Literaturangaben öffnen immer ihren ZotLit-Eintrag; sie werden nicht zu erfundenen Markdown-Knoten.
- **Mittelklick:** Notizlinks in einem neuen Tab öffnen, auch beim Erkunden. Literaturangaben behalten ihre eigene Library-Aktion und öffnen per Mittelklick keinen weiteren Tab.

Notiz- und Literaturtreffer stehen getrennt untereinander. Weitere Ergebnisse lassen sich nachladen. Eine fehlende Zotero-Verbindung wird bei den Literaturtreffern angezeigt; die Notizsuche bleibt verfügbar.

## Lokale Verarbeitung und optionale Webquellen

Graphindex und Suche arbeiten lokal über Obsidian und ZotLit. Für CSL-Daten bisher unzitierter Literatur kann zusätzlich ZotLits eigener HTTP-Client die konfigurierte lokale Zotero-API auf `127.0.0.1` anfragen; dabei werden nur die ausgewählten Zotero-Item-IDs übertragen. KI-Anfragen gehen über Obsidian `requestUrl` ausschließlich an den konfigurierten lokalen Ollama-Endpunkt. Sie enthalten die aktuelle Notiz, Feldbeschreibungen und gegebenenfalls Kandidatentitel sowie die ausdrücklich aktivierten externen Suchauszüge. Es gibt keine Telemetrie und keinen Cloud-Modell-Fallback.

**Abbrechen:** Die Oberfläche beendet das Warten und verwirft verspätete Antworten. Obsidian `requestUrl` kann die bereits gestartete HTTP-Verbindung nicht physisch abbrechen; Ollama kann deshalb noch weiterrechnen. Bis zum tatsächlichen Abschluss lässt Emergence keine zweite lokale Anfrage an denselben Endpunkt zu. Ein bewusst eingestellter anderer Loopback-Endpunkt bleibt erreichbar. Größenlimits werden an der vom Host vollständig empfangenen Antwort vor der JSON-Verarbeitung geprüft. Die native API folgt HTTP-Weiterleitungen; der konfigurierte lokale Dienst muss daher vertrauenswürdig sein.

**Websuche ist optional und ohne Anmeldung nutzbar.** DuckDuckGos öffentliche HTML-Suche liefert Titel und Vorschautexte aus höchstens zwei Ergebnisseiten, insgesamt höchstens 20 unterschiedliche Treffer. Nur der sichtbare Suchbegriff mit dem gewählten Zusatz „Beispiele“ oder „Kunstwerke“ wird gesendet. Zielseiten werden nicht automatisch geöffnet. Suchtreffer werden im Modellkontext begrenzt und als externes Datenmaterial behandelt. Bei Sperrprüfungen oder Ausfällen wird der tatsächliche Status angezeigt; es gibt keine Umgehung oder erfundenen Treffer. Die HTML-Anbindung ist keine zugesicherte Such-API und kann sich ändern.

**Wikipedia ist ebenfalls optional.** Bei eingeschaltetem Haken wird der angegebene Begriff an Wikipedia geschickt und ein begrenzter Auszug mit Quellenangabe als zusätzlicher Modellkontext verwendet. Notiztexte werden nicht als Wikipedia-Suchanfrage übertragen. Ohne Haken erfolgt keine neue Wikipedia-Abfrage. Das Modell kann nicht selbstständig im Web browsen.

Plugin-Einstellungen und das Änderungsjournal liegen in Obsidian-typischem `data.json`. Feldideen und Suchtreffer bleiben nur im Arbeitsspeicher; sie werden beim Entladen gelöscht. Persönliche Einstellungen, Vault-Inhalte und lokale Prüfberichte gehören nicht ins Repository.

## Entwicklungsstand und Community-Prüfung

Der aktuelle Quellcode entfernt den früheren Recherchebereich vollständig. Die lokale KI bleibt für Breadcrumbs-Feldideen erhalten. Der bereits veröffentlichte Release 0.0.1 enthält noch den früheren Funktionsumfang.


Version **0.0.1** verwendet die unveränderliche ID `emergence`. Manifest, Paketversion, `versions.json`, exakter Git-Tag und Einzeldateien werden vor der Veröffentlichung geprüft. GitHub Actions führt Build, Tests, Lint und einen Produktionsabhängigkeits-Audit aus, erstellt zunächst einen Entwurf und veröffentlicht ihn erst nach Download und Prüfsummenvergleich der Assets. Generierte Bundles werden ausschließlich als Release-Assets veröffentlicht.

Die offizielle automatische Obsidian-Prüfung ist ein eigener Schritt: Im [Community-Verzeichnis](https://community.obsidian.md) mit dem Obsidian-Konto anmelden, GitHub verknüpfen und das Repository als Plugin hinzufügen. Danach zeigt das Verzeichnis die Prüfergebnisse. Ein GitHub-Release allein startet diese Prüfung nicht. Siehe [offizielle Einreichungsanleitung](https://docs.obsidian.md/plugins/releasing/submit-plugin).

## Grenzen und Entwicklung

Die Modellvorschläge können fachlich falsch sein und bleiben eine Denkhilfe. Große Kontextmengen und lokale Hardware beeinflussen die Laufzeit. Die ZotLit-Integration kapselt eine interne, nicht als dauerhaft stabil zugesicherte `services`-Schnittstelle; inkompatible Versionen können Anpassungen erfordern. Auch die Einbettung der Originalansichten benötigt einen isolierten Adapter an Obsidian-interne View-Factories und deren Lebenszyklus, da die öffentliche API hierfür keine Einbettungsschnittstelle anbietet. Er prüft die benötigten Methoden, räumt die erzeugten View-Komponenten beim Schließen auf und zeigt Ladefehler im betreffenden Abschnitt an. Getestet ist die aktuelle Desktop-Entwicklungsumgebung mit Breadcrumbs 4.22.1 und ZotLit 2.2. Fehlende oder mehrdeutige Literaturzuordnungen werden angezeigt, statt willkürlich ein Ziel zu öffnen.

```sh
npm run dev        # Entwicklung mit automatischem Bundle-Build
npm run build      # TypeScript-Prüfung und Produktionsbundle
npm test           # Unit- und Integrationstests mit lokalen Fixtures
npm run lint       # ESLint einschließlich Obsidian-Regeln
npm run test:ux          # Graph, Feldideen, Suche und Theme-Linkzustände bei 280/328 Pixeln
npm run test:literature-scroll # Hover ohne Sprünge in Kontext und Suche
npm run test:literature-ui # Literaturaktionen, Rückverweise, Umbenennung und Screenshots
npm run test:settings-ui # Native Settings-Suche, Entwürfe und schmale Editoren
node scripts/synopsis-native-check.mjs --layout-only # Synthetischer Graph-Stresstest ohne Datei-/Navigationsaktionen
npm run test:native-views # Originalansichten und Literaturaktionen in Obsidian
```

Die optionalen Tests gegen ein installiertes Modell werden mit `npm run test:ollama` gestartet. Native UI-Prüfungen benötigen eine laufende Obsidian-Entwicklungsinstanz mit aktivierter CLI. Dafür `OBSIDIAN_VAULT` auf den Namen des Test-Vaults setzen; bei Bedarf `OBSIDIAN_CLI` auf das ausführbare Programm. Manche ältere Prüfskripte sind auf die ursprüngliche Entwicklungsumgebung zugeschnitten und gehören nicht zur portablen Testsuite.

Die Implementierung liegt in `src/`, Tests mit synthetischen Notizen in `tests/`. [Aktuelle Prüfungen und technische Entscheidungen](docs/VALIDATION.md) beschreiben die jüngsten Änderungen. Architekturentscheidungen orientieren sich an der [offiziellen Obsidian-API](https://github.com/obsidianmd/obsidian-api) und den tatsächlich vorhandenen Breadcrumbs- und ZotLit-Schnittstellen.

Lizenz: [Zero-Clause BSD](LICENSE).
