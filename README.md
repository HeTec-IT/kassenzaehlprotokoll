# Kassenzählprotokoll – Einrichtung

1. Firestore → Regeln: Inhalt von `firestore.rules` einfügen → Veröffentlichen.
2. Authentication → Anmeldemethode: **Anonym** aktivieren (für die Shops) und **E-Mail/Passwort** aktivieren (für die Regionalleitung).
3. Authentication → Nutzer → Nutzer hinzufügen: `d.dasilva@hetec-gmbh.de` + Passwort.
4. Authentication → Einstellungen → Autorisierte Domains: `hetec-it.github.io` hinzufügen.
5. Alle Dateien und Ordner ins Repo `kassenzaehlprotokoll` hochladen.

Links:
- Regionalleitung: https://hetec-it.github.io/kassenzaehlprotokoll/
- o2 Aalen: https://hetec-it.github.io/kassenzaehlprotokoll/o2-aalen/
- o2 Sindelfingen: https://hetec-it.github.io/kassenzaehlprotokoll/o2-sindelfingen/
- o2 Crailsheim: https://hetec-it.github.io/kassenzaehlprotokoll/o2-crailsheim/
- o2 Schwäbisch Hall: https://hetec-it.github.io/kassenzaehlprotokoll/o2-schwaebisch-hall/
- o2 Stuttgart Vaihingen: https://hetec-it.github.io/kassenzaehlprotokoll/o2-stuttgart-vaihingen/
- Telekom Crailsheim: https://hetec-it.github.io/kassenzaehlprotokoll/telekom-crailsheim/

Bei Updates nur `app.jsx` / `app.css` ändern und in `sw.js` die `VERSION` erhöhen.
