# EOME: strukturelle Überschriften in eingebetteten Listen ausblenden

Die installierte EOME-Version 0.2.4 bietet **Add heading for this tree** auch
innerhalb von Emergence an. Diese Aktion erzeugt eine neue Strukturüberschrift
außerhalb der Eintragsliste. Sie ist im Begleitdokument geschützt und wird beim
Speichern abgelehnt. Markdown-Überschriften innerhalb eines Eintrags bleiben erlaubt.

EOME besitzt dafür noch keinen öffentlichen Host-Schalter. Ein fertiges Menü über
private Felder oder CSS zu verändern und das Originalmenü nachzubauen scheiden aus.
Die beiliegende `eome-host-capability.patch` ist für das eigenständige EOME-Projekt
vorbereitet; die installierte Erweiterung wurde nicht geändert.

## Übergabeauftrag an das EOME-Projekt

Ergänze an jeder MindmapView eine öffentliche, nicht persistierte Instanzoption
`supportsStructuralHeadings = true`. Prüfe sie vor dem Aufbau des Kontextmenüpunkts
**Add heading for this tree** und am Beginn von `executeAddHeadingCommand`.
Bei `false` soll die Aktion nicht angeboten und nicht ausgeführt werden. Alle
anderen Originalmenüaktionen bleiben unverändert. Standalone-EOME behält `true`.
Die Option darf weder ins Markdown noch in die globalen EOME-Einstellungen gelangen.

Der Patch zeigt den minimalen Eingriff auf Basis von EOME 0.2.4. Ergänze dort Tests:

1. Standalone/default: Menüpunkt vorhanden, bestehende Überschriftenfunktion intakt.
2. Host-Instanz mit `false`: Menüpunkt fehlt, direkter Command-Aufruf verändert nichts.
3. Eine zweite Standalone-View bleibt unabhängig von der Host-Instanz.
4. Markdown-Überschriften innerhalb eines mehrzeiligen Eintrags bleiben bearbeitbar.

Emergence erkennt diese optionale Schnittstelle bereits und setzt sie ausschließlich
auf der eingebetteten EOME-Instanz auf `false`. Mit 0.2.4 bleibt der Menüpunkt bis zur
Übernahme des EOME-Patches sichtbar; der vorhandene Speicherschutz verhindert seine
Übernahme. Der Hook wird weder vorgetäuscht noch durch private Menümanipulation ersetzt.
