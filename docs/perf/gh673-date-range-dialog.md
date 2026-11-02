# GH-673 – Zeitraum-Wechsel im Analyse-Graph (Messung vorher/nachher, CI-Emulator)

Folge-Ticket aus PERF-004 (Problem Nr. 3). Gemessen am 02.11.2026 auf dem CI-Emulator, **Release-Build vor und nach der Änderung**.
Die Abnahme-Messung der Zielwerte am echten Gerät R5CN30HWZFN steht noch aus (macht der Owner). Die Werte unten sind Emulator-Werte
und kein Nachweis der Zielwerte am Gerät.

## 1. Wo die Zeit blieb

Gemessen mit einem temporären Mess-Build (Release, `performance.now()`-Zähler in App und Bibliothek, Ausgabe per logcat; nicht committet,
Gesten: `raw-gh673/runs/probe-r1`):

| JS-Arbeit je Vorgang | Zeitraum 3 Monate | ab 2025 | ab 2024 | ab 2023 |
|---|---|---|---|---|
| Markierungen im Kalender (Schlüssel in `markedDates`) | 99 | 677 | 1 043 | 1 408 |
| `CalendarList.getMarkedDatesForItem` beim **Öffnen** (66 Aufrufe) | 58 ms | 241 ms | 297 ms | 393 ms |
| dasselbe nach dem **Tippen** eines vollständigen Datums (46 Aufrufe) | – | 188–232 ms | 199–278 ms | 291 ms |
| dasselbe beim **Speichern** (Kalender rendert beim Schließen noch einmal) | – | 103–153 ms | 167–256 ms | 241 ms |
| Markierungen berechnen (`DatePickerModal`) | 4 ms | 3–13 ms | 2–20 ms | 2–32 ms |
| Graph neu berechnen (`AnalyseGraphics`, Selektoren + Serien) | – | 3–4 ms | 2–11 ms | 4 ms |

* **Hauptursache (wächst mit dem Zeitraum):** `react-native-calendars` prüft für jeden gerenderten Monat (~46 Stück), ob er eine Markierung
  hat, indem es **alle** Schlüssel von `markedDates` durchläuft und je Schlüssel zwei `XDate`-Objekte aus Strings parst – O(Tage im
  Zeitraum × Monate) pro Render. Der Dialog markiert jeden Tag des gewählten Zeitraums, ab 2023 also ~1 400 Schlüssel.
* **Zusätzlich:** Das Kalender-`theme` war ein Inline-Objekt und die Handler neue Funktionen. Jedes Re-Render des Dialogs (Öffnen: zweimal,
  Tippen, Speichern) hat deshalb alle ~210 memoisierten Tageszellen neu gerendert (363 Tages-Renders je Öffnen).
* **Grundlast des Öffnens (ohne Kalender 31–142 ms, `runs/expA-nocal`):** Die Bibliothek baut 7 volle Monate (±3 um den sichtbaren, ~1 050
  Views) und rendert danach mit FlatLists Standard-`windowSize` 21 rund 40 Platzhalter-Monate in Batches nach. Diese Batches halten den
  JS-Thread bis ~0,5 s nach dem Tippen beschäftigt.
* Die Graph-Neuberechnung selbst war mit 2–11 ms kein Problem; „Speichern“ war fast nur der Kalender, der beim Schließen noch einmal rendert.

## 2. Änderung

* **Patch `patches/react-native-calendars+1.1314.0.patch`** (nur JS, `src/`):
  * `CalendarList`: „Hat dieser Monat Markierungen?“ über ein einmal je `markedDates` gebautes `Set` der Monats-Präfixe (`yyyy-MM`) statt
    Schlüssel-Scan mit `XDate`-Parsing. Gleiches Ergebnis: Die Schlüssel sind `yyyy-MM-dd`, `XDate` parst sie als lokale Daten, also ist der
    Präfix-Vergleich gleich `sameMonth`.
  * `CalendarList`: `windowSize` 5 (2 Bildschirme über/unter dem sichtbaren) statt 21. Volle Monate werden weiterhin nur ±3 um den sichtbaren
    Monat gezeichnet, an der Darstellung ändert sich nichts. Weniger Platzhalter-Monate werden vorgerendert.
  * `Calendar`, Listen-Element, Kopfzeile und Tages-Bausteine bauen ihr StyleSheet einmal pro Mount statt bei jedem Render
    (`useRef(styleConstructor(theme))` hat das Argument bei jedem Render ausgewertet; der Ref nutzt ohnehin nur den ersten Wert).
* **`DatePickerModal`:** Markierungen per `useMemo` auf den Datums-*Werten* (der Dialog übergibt beim Öffnen und Speichern ein neues, gleiches
  Objekt). Dazu stabiles `theme` und stabile Handler, `Set`-Lookup statt `Array.includes` für die Tage im Zeitraum. Die Liste bekommt den
  heutigen Monat als `current`. Sie öffnet ohnehin dort, braucht aber so keinen Platzhalter-Durchgang mehr. Das Punkte-Fenster (Trainingstage) startet dort, wo es die
  erste Meldung des sichtbaren Monats bisher hingesetzt hat (heute ±2 Monate).
* Keine Änderung an Graph, Filter-Panel, Presets oder Datumsfeldern.

## 3. Messaufbau

| | |
|---|---|
| Gerät | CI-Emulator `emulator-5554`, Android 14 (API 34), x86_64, 2 vCPU, 1080×2400 |
| Build | `tool.sh rebuild-release` (assembleRelease x86_64, Hermes, kein Metro, nicht debuggable – `pkgFlags=[ HAS_CODE ALLOW_CLEAR_USER_DATA ]`). **Vorher** = Job-Start-master `8484505`, **nachher** = Commit `b022688` (+ nur Flow/Doku danach). |
| Daten | `__tests__/e2e/maestro/fixtures/baseline.gains` per `tool.sh import-baseline` (inhaltsgleich mit dem PERF-004-Gerätebestand, letztes Training 28.02.26) |
| Gesten | PERF-004 Szenario 5b (`scenarios.sh` `set_start`/`scn5b`): Analysis, Bankdrücken, 1RM, Day; sechsmal „Custom“ → Startfeld → `MOVE_END` + 12× `DEL` + Datum (23 Tastenereignisse) → „Save“, Startdaten 01/01/2025, 2024, 2023, 2025, 2024, 2023; dieselben Pausen. Vorbereitung ungetraced per `raw-gh673/tools/prep5b.yaml`, Interaktion `raw-gh673/tools/scn5b.sh` auf dem Gerät. Koordinaten per uiautomator auf dem Emulator gemessen. |
| Presets | 3 Runden 4W → 3M → 6M → 1Y, 2,5 s Pause (`scn5b.sh <label> presets`) |
| Auswertung | wie GH-672: atrace (sched + view gfx input am wm res) und `raw-gh672/tools/gestures.awk` (= `gestures.py`-Definitionen) auf dem Emulator. `settle_ms` = Fingerabheben bis Ende der verketteten JS-Bursts (PERF-004-Kennzahl). Je Lauf Kaltstart + neue Vorbereitung, n = 3 Läufe je Seite. |

## 4. Ergebnisse (Emulator, Release; `settle_ms` Median [min–max])

| Kennzahl | vorher (master) | nachher (GH-673) | Δ | Zielwert (Gerät) |
|---|---|---|---|---|
| Zeitraum-Dialog öffnen (n = 18) | 834 ms [89–1 065] | **333 ms** [77–452] | −60 % | ≤ 300 ms |
| – bei aktuellem Zeitraum 3 Monate / ab 2025 / ab 2024 / ab 2023 | 691 / 790 / 939 / 1 007 ms | 378 / 338 / 330 / 333 ms | wächst nicht mehr mit dem Zeitraum | unabhängig von der Länge |
| – JS-Laufzeit / neu erzeugte Views | 506 ms / 1 085 | 190 ms / 1 048 | −62 % / gleich | – |
| Speichern bis Graph (n = 18) | 265 ms [189–359] | **34,5 ms** [25–64] | −87 % | ≤ 300 ms |
| – Speichern auf ab 2025 / 2024 / 2023 | 204 / 259 / 326 ms | 35 / 34 / 38 ms | | |
| Datum tippen, Gruppe aus 23 Tasten (n = 18) | 315 ms [215–506] ≈ 13,7 ms/Taste | **174 ms** [107–221] ≈ **7,6 ms/Taste** | −45 % | ≤ 16 ms/Taste |
| – JS-Laufzeit der Gruppe / 23 | 19,3 ms/Taste | 12,8 ms/Taste | −34 % | |
| Preset antippen 4W/3M/6M/1Y (n = 12) | 49 ms [20–116] | 46,5 ms [22–89] | gleich | ≤ 200 ms |

Rohwerte je Geste: `raw-gh673/runs/{before,after}-r{1,2,3}/gestures.tsv`, Presets `runs/{before,after}-presets/`. Werte unter 100 ms beim Öffnen
(z. B. 77/89 ms) sind Läufe, in denen eine Lücke > 150 ms die Burst-Kette früh beendet hat; sie kommen vorher wie nachher vor.

**Zwischenschritte und Experimente** (je ein Lauf, Öffnen-Median n = 6):

| Lauf | Stand | Öffnen | Bemerkung |
|---|---|---|---|
| `after1-r1` | nur Monats-Set-Patch + Memoisierung | 563 ms | Speichern 40 ms, Tippen-Gruppe 186 ms |
| `after2-r1` | + `current` / Punkte-Fenster | 495 ms (n = 5) | erster Öffnen-Vorgang fehlt im Trace (Ringpuffer) |
| `expA-nocal` | Dialog **ohne** Kalender (Experiment) | 79 ms | Grundlast von Modal + zwei Datumsfeldern |
| `expB-win5` | + `windowSize` 5 | 378 ms | |
| `expC-lazystyle` | + StyleSheet einmal je Mount (= Endstand) | 325 ms | |

**Aussehen und Werte unverändert:**
* Dialog direkt nach dem Öffnen (Standard-Zeitraum) und der Graph nach „Save“ (Bankdrücken 1RM ab 01.01.2025) sind vorher/nachher
  **pixelgleich** (ffmpeg-Differenz unterhalb der Statusleiste: max 0).
* Kalender mit getipptem Start 01/01/2025, per Maestro auf Februar 2026 gescrollt: Der Februar-Block (Kopf, Wochentage, alle Tage mit
  Zeitraum-Farbe, Trainingspunkten und Ende am 28.) ist pixelgleich (max 0 bei 251 px Versatz der Scroll-Position).
* `analyse_graphics_metrics.yaml` Teil 4 (neu) läuft auf beiden Builds grün: Tages-Labels „28 February 2026 period end“,
  „27 February 2026 You have entries for this day“, „26 February 2026“ ohne Markierung, nach „Save“ Zeitraum „1 Jan 2025 – 28 Feb 2026“ und Charts.

## 5. Bewertung und offene Punkte

* **Speichern** (35 ms) und **Presets** (47 ms) liegen am Emulator weit unter den Zielen. **Tippen** liegt mit 7,6 ms/Taste (PERF-004-Rechnung:
  Gruppen-`settle_ms` / 23) unter 16 ms.
* **Öffnen** wächst nicht mehr mit dem Zeitraum und ist um 60 % schneller, liegt am Emulator aber mit 333 ms noch knapp über 300 ms. In PERF-004
  war das Gerät beim Öffnen ~1,4× langsamer als dieser Emulator vorher (1 187 vs. 834 ms). Am Gerät ist das Ziel ≤ 300 ms damit eher nicht
  erreicht. Der Rest ist der Aufbau von 7 vollen Monaten (~1 050 Views) durch `react-native-calendars` selbst.
  Weitere Hebel würden das Aussehen oder Verhalten berühren und sind deshalb nicht umgesetzt:
  weniger volle Monate um den sichtbaren (beim schnellen Scrollen erscheinen dann früher die Monats-Platzhalter), oder ein eigener,
  leichterer Monats-Kalender statt `CalendarList`.
* Risiko `windowSize` 5: Bei sehr schnellen Flings über viele Monate kann FlatList kurz leere Flächen zeigen, wo bisher Platzhalter-Monate
  standen. In Stichproben (Flings in beide Richtungen, Screenshots direkt danach) war nichts zu sehen.
* Abnahme am echten Gerät (Release, Methode PERF-004) durch den Owner.

## 6. Werkzeuge

`raw-gh673/tools/` – laufen **auf dem Gerät** (`adb push` + `adb shell sh …`), Analyse mit `../raw-gh672/tools/gestures.awk`:

| Datei | Zweck |
|---|---|
| `prep5b.yaml` | ungetracte Vorbereitung (Maestro): Analysis, Filter aufgeklappt, 1RM, Bankdrücken |
| `scn5b.sh <label> [presets]` | Szenario 5b mit atrace (6 Runden Custom → Tippen → Save) bzw. 3 Runden Presets, danach `gestures.awk` + gfxinfo |
| `agg5b.sh [-p] <runs…>` | Median [min–max] je Phase (i % 4: 0 Öffnen, 2 Tippen, 3 Speichern), Öffnen je aktuellem Zeitraum |
| `bursts.awk` | JS-Bursts nach einer Geste (Offset, Dauer, Lücke) – zeigt, welche Arbeit die Kette verlängert |
| `shots.sh <prefix>` | Screenshots in festen Zuständen (Dialog, gescrollter Kalender, Graph nach Save) |
