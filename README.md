# Kassenzählprotokoll – Einrichtung

1. **Firestore-Regeln:** Inhalt von `firestore.rules` in Firebase → Firestore → Regeln einfügen → Veröffentlichen.
2. **Anmeldung aktivieren:** Firebase → Authentication → Anmeldemethode → E-Mail/Passwort aktivieren.
3. **Benutzer anlegen** (Authentication → Nutzer → Nutzer hinzufügen), Passwort frei wählbar (min. 6 Zeichen):
   - d.dasilva@hetec-gmbh.de (Regionalleitung)
   - o2-aalen@kassen.hetec-gmbh.de
   - o2-sindelfingen@kassen.hetec-gmbh.de
   - o2-crailsheim@kassen.hetec-gmbh.de
   - o2-schwaebisch-hall@kassen.hetec-gmbh.de
   - o2-stuttgart-vaihingen@kassen.hetec-gmbh.de
   - telekom-crailsheim@kassen.hetec-gmbh.de
4. **Autorisierte Domain:** Authentication → Einstellungen → Autorisierte Domains → `hetec-it.github.io` hinzufügen.
5. **Hochladen:** Alle Dateien (inkl. Ordner `icons`) ins GitHub-Repo, GitHub Pages aktivieren.
6. **Links:** `https://hetec-it.github.io/<repo>/#shop=o2-crailsheim` usw., Regionalleitung: `#shop=admin`.
7. Optional: Firestore → TTL-Richtlinien → Sammlungsgruppe `fotos`, Feld `expireAt` (Fotos werden zusätzlich beim Öffnen der Regionalleitung gelöscht).

Bei Updates in `sw.js` die `VERSION` hochzählen.
