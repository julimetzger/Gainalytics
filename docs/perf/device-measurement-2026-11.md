# PERF-004 – Performance-Neumessung der gesamten App am echten Gerät (Release-Build), Vergleich mit PERF-001

Messauftrag, kein Fix. Es wurde **kein App-Code verändert** (nur `docs/perf/` und `screenshots/PERF-004/`).
Gemessen am 01.11.2026 auf dem Testgerät mit dessen echtem Datenbestand. Vergleichsbasis ist PERF-001 vom 28.09.2026
(`docs/perf/device-measurement.md`, PR #463). Methode, Perfetto-Konfiguration und Auswerteskripte sind dieselben wie dort;
nur die Tipp-Koordinaten wurden an die heutige Oberfläche angepasst.

## 1. Messaufbau

| | PERF-001 (28.09.2026) | PERF-004 (01.11.2026) |
|---|---|---|
| Gerät | Samsung SM-G986B (Galaxy S20+ 5G), Android 13, Override 720×1600, **60 Hz** (`mActiveModeId=9`) | identisch |
| Stromversorgung | USB, Akku 89 % | USB (lädt), Akku 15–17 %, **kein** Energiesparmodus (`low_power=0`), Thermal Status 0 (AP 30 °C) → `raw-2026-11/checks/device-conditions-start.txt` |
| Build | `assembleRelease` master `0ef9ef2e`, versionName 0.172 | `assembleRelease -PreactNativeArchitectures=arm64-v8a` von master **`7b289e66`**, versionName 0.182 / versionCode 9 |
| Signatur | Debug-Key, `adb install -r` über die installierte App | Debug-Key über die Umgebungsvariablen `ANDROID_RELEASE_STORE_FILE=debug.keystore`, `ANDROID_RELEASE_PASSWORD=android`, `ANDROID_RELEASE_KEY_ALIAS=androiddebugkey` – **keine Datei geändert** |
| Release-Nachweis | `pkgFlags` ohne `DEBUGGABLE`, Hermes-Magic | `pkgFlags=[ HAS_CODE ALLOW_CLEAR_USER_DATA ]` (kein `DEBUGGABLE`), `run-as` → „package not debuggable“, SHA-256 der `base.apk` auf dem Gerät = lokale `app-release.apk` (`1e9de275…`), `assets/index.android.bundle` beginnt mit der Hermes-Bytecode-Magic `c61fbc03c103191f`, `libhermesvm.so` im APK → `raw-2026-11/checks/release-hermes-verification.txt`, `…/dumpsys-package-release.txt` |
| Metro/Dev-Mode | keiner | keiner (Release-Bundle im APK, `adb reverse` entfernt) |
| Datenbestand | 364 abgeschlossene Trainings, 11 461 Sätze, 82 Übungen, 4 Pläne | **inhaltsgleich**: alle Fingerprints über Trainings, Workouts, Pläne und Übungen identisch zu PERF-001. Unterschiede: 10 statt 1 Videoanalyse, 2 AI-Chat-Nachrichten (vorher keine) → Szenario 9 |

Weil der Datenbestand inhaltsgleich mit PERF-001 ist, war kein Testdaten-Import nötig.

### Messmethode (unverändert aus PERF-001)

* **Start:** `am start -W` (`TotalTime` = bis zum ersten Frame), 5 Perfetto-Traces des Kaltstarts (erster großer Mount-Batch = echter Inhalt).
* **Interaktionen:** pro Serie `dumpsys gfxinfo reset` → Perfetto (ftrace sched + atrace view/gfx/input/am/wm/res + SurfaceFlinger-Frame-Timeline)
  → gescriptete `adb shell input`-Gesten mit festen Pausen → `gfxinfo` / `framestats` / `meminfo`. Auswertung **pro Geste**:
  * `settle_ms` – Fingerabheben bis Ende der durch die Geste ausgelösten Arbeit des JS-Threads (`mqt_v_js`). JS-Bursts ≥ 10 ms werden
    verkettet, solange die Lücke < 150 ms ist. **Das ist die Zeit, in der die App nach einer Eingabe beschäftigt ist** und neue Eingaben verzögert.
  * `js_busy_ms` – JS-Laufzeit bis zur nächsten Geste; Frames > 16,7 / > 33 ms und längster Frame aus der Frame-Timeline;
    `views` = neu erzeugte native Views (`SurfaceMountingManager::createViewUnsafe`).
* **Speicher:** `dumpsys meminfo` (TOTAL PSS, Native/Java Heap, Views), 5 Durchläufe + ein schrittweiser Lauf.
* **Datenumfang:** Vorher-Sicherung (`run-as`, MMKV) + In-App-Export (Settings → Export Data, rein lesend).
* Skripte: `docs/perf/raw-2026-11/tools/` (README dort). Aggregierte Werte: `raw-2026-11/summary.json`, vollständige Alt/Neu-Tabelle aller
  Kennzahlen: `raw-2026-11/comparison.md` (automatisch aus beiden `summary.json` erzeugt).

## 2. Datensicherheit

* **Vorher-Sicherung** (noch debuggable, `run-as tar` des ganzen App-Verzeichnisses): `appdata-before.tar` (52 MB, SHA-256 `ac81faf8…`),
  MMKV-Datei einzeln (SHA-256 `e0a26cf2…`, identisch mit der Kopie im Tar) und daraus extrahierte Redux-Slices – im Run-Verzeichnis
  `.codex-orchestrator/runs/PERF-004/backup/`.
* **Vergleich** Sicherung ↔ Export direkt nach der Installation ↔ Export nach allen Messungen (`raw-2026-11/checks/data-integrity-final.txt`):
  Trainings 381 = 381 = 381 (364 F / 17 P), Workouts 2 883 / 5 707, Sätze 11 461, Übungen 82, Pläne 4, Videoanalysen 10 – **alle Inhalts-Fingerprints
  identisch**, ebenso die Slices `aiChat`, `videoAnalyses`, `bodyWeight`, `effects` (byte-gleich).
* **Einzige Abweichung (wie in PERF-001):** `settings.restTimer.active` (Pausentimer des letzten Mess-Satzes) ist gesetzt; vorher fehlte der Schlüssel.
  Transienter UI-Zustand, wird beim nächsten Trainingsstart überschrieben und nur in einem laufenden Training angezeigt. Ein Re-Import des
  Vorher-Exports hätte ihn entfernt, ersetzt aber den gesamten Store – das Risiko schien für einen Timer-Wert nicht gerechtfertigt.
* **Mess-Training (Szenario 2):** leerer Slot „Push pull › Meso 1 › Micro 6 › Push squat“ mit einer Übung (Bankdrücken, 0 geplante Sätze)
  geplant, gestartet, 13 Sätze à 5 × 20 kg (weit unter PR 150 kg → kein Rekord), danach über ⋮ → Delete gelöscht.
  Danach Force-Stop: 0 ausstehende Alarme und 0 Notifications der App (`raw-2026-11/checks/alarms-notifications-after-scn2.txt`).
  Der Export direkt danach ist inhaltsgleich mit dem Vorher-Export (`counts-after-scn2-cleanup.json`).
* **AI-Chat (Szenario 6):** Auf dem Gerät ist kein API-Key hinterlegt. Für die Messung wurde in Settings ein **ungültiger Platzhalter-Key**
  (`sk-ant-perf004-dummy-not-a-key`) gespeichert, damit das Eingabefeld erscheint. Es wurde **nichts gesendet** (kein Tap auf Senden; Verlauf
  vorher/nachher 2 Nachrichten, `aiChat`-Slice byte-gleich), Screens mit automatischer Coach-Insight-Abfrage wurden in dieser Zeit nicht geöffnet.
  Danach Key gelöscht („API key removed“), der Chat zeigt wieder „Please add your Anthropic API key…“ (`screenshots/scn6-ai-chat-key-removed.png`).
* Eigene Exportdateien aus `/sdcard/Download` gelöscht (Kopien im Run-Verzeichnis), Perfetto-Traces auf dem Gerät entfernt.
* Historie vorher/nachher: `screenshots/PERF-004/history-before.png`, `screenshots/PERF-004/history-after.png` (neuester Eintrag jeweils
  „Sat, 28/02/26 – Hyperextension 13 reps 45 kg“). Rein lesender Maestro-Check nach der Messung grün (`raw-2026-11/checks/maestro-readonly-check.log`):
  Plan „Push pull“, Next-Training-Slot „Meso 1 · M6 · D1 · 0 exercises“ (Mess-Training wieder weg), Historie „Sat, 28/02/26“ + „Hyperextension“.
* Release-Build bleibt installiert, App läuft normal.

## 3. Messwerte und Vergleich mit PERF-001

Median [min–max], n = Anzahl Durchläufe/Gesten. „beschäftigt“ = `settle_ms`. Δ = Veränderung des Medians gegenüber PERF-001.
**Bewertung:** besser/schlechter erst ab ±15 % und wenn die Spannen sich kaum überlappen, sonst „gleich“.

**Kontrollgrößen:** Kaltstart, Warmstart, Exercises-Scrollen, Kalender und Tippen in die Satzfelder liegen auf den PERF-001-Werten (±2–8 %).
Gerät und CPU-Zustand sind also vergleichbar, trotz des niedrigen Akkustands; die großen Veränderungen unten kommen aus der App.

| # | Szenario / Aktion | n | PERF-001 | PERF-004 | Δ | Bewertung | weitere Werte (PERF-004) |
|---|---|---|---|---|---|---|---|
| 1 | Kaltstart bis erstes Frame (`am start -W`) | 12 | 190 ms [183–211] | **194 ms** [189–211] | +2 % | gleich | Trace: erstes Frame 142 ms [133–149] (PERF-001 134) |
| 1 | Kaltstart bis erster bedienbarer Inhalt (Training-Home, Mount fertig ab Fork) | 5 | 617 ms [592–630] | **631 ms** [623–653] | +2 % | gleich | Mount-Beginn 468 ms [449–480] (455); JS vor dem Inhalt 307 ms am Stück (286) |
| 1 | Warmstart (HOME → Start, HOT) | 12 | 66 ms [56–74] | **66 ms** [57–85] | ±0 | gleich | |
| 2 | Satz speichern (Tap „Add“, laufendes Training) | 12 | 341 ms [272–449] | **549 ms** [486–608] | **+61 %** | **schlechter** | JS 588 ms; zusammenhängender JS-Block 471 → 597 ms (PERF-001 264 → 351), wächst ~+11 ms je Satz; 0 Frames > 33 ms (max. Frame 23 ms); 39 neue Views je Satz (27) |
| 2 | Tippen in Wdh.-/Gewichtsfeld (je Tastendruck) | 20 | 44 ms [22–61] | **52 ms** [25–174] | +20 % | gleich (JS 61 vs. 58 ms) | Feld antippen 40 ms; 0 Frames > 33 ms |
| 2 | Grundlast laufendes Training (Leerlauf, 10 s) | 10 s | 15 ms JS/s | **16 ms JS/s** (1,6 % eines Kerns) | | gleich | |
| 3 | Wischen zwischen Trainings, Train-Reiter (Micro 3 ↔ 4) | 24 | 182 ms [168–484] | **51 ms** [32–71] | **−72 %** | **besser** | max. Frame 15 ms (55); 0 Frames > 33 ms (1); janky 1,3 % (5,1) |
| 3 | dito, Plan-Reiter | 24 | 269 ms [250–616] | **155 ms** [112–174] | **−42 %** | **besser** | max. Frame 15 ms (57); janky 0,7 % (7,5) |
| 3 | dito, Analysis-Reiter | 24 | 263 ms [243–630] | **140 ms** [122–160] | **−47 %** | **besser** | max. Frame 16 ms (57); janky 2,5 % (7,6) |
| 3 | Ansichten umschalten (Reiter Train/Plan/Analysis) | 11 | – (PERF-003: gewählter Knopf 37 ms, Inhalt 373 ms) | gewählter Knopf sichtbar **39 ms** [31–59], Inhalt komplett 375 ms [289–481] | neu | wie PERF-003 | beschäftigt 352 ms, max. Frame 35 ms, 363 Views je Wechsel; janky 34 % |
| 4 | Exercises-Tab öffnen | 5 | 1 Frame 243 ms (n=1) | **1 Frame 261 ms** [257–261], beschäftigt 229 ms | +7 % | gleich (Views +15 %) | **758 Views auf einmal** (658) |
| 4 | Exercises scrollen (Fling) | 16 | flüssig, max. Frame 9 ms | **flüssig**, max. Frame 10 ms, 0 Views | | gleich | janky 0,2 % |
| 4 | Trainings-Historie öffnen (Tap auf „History“) | 5 | 353 ms (n=1), 251 Views | **320 ms** [314–328], 369 Views | −9 % | gleich | 1 Frame > 33 ms (max. 73 ms) |
| 4 | Trainings-Historie scrollen (Fling) | 18 | 1 288 ms [1 153–1 591] | **1 213 ms** [0–1 503] | −6 % | **gleich** | **JS 846 ms und 822 neue Views pro Fling** (809 / 804), 8 Frames > 16 ms (13), max. Frame 25 ms |
| 4 | Historien-Kalender: Monat wechseln | 9 | 40 ms [37–63] (n=7) | **47 ms** [36–55] | +18 % | gleich (Spannen überlappen) | |
| 4 | Historien-Kalender: Tag antippen (Detailkarte) | 11 | 92 ms [61–103] | **95 ms** [75–124] | +3 % | gleich | 92 Views, max. Frame 33 ms |
| 5 | Analyse-Tab öffnen (Dashboard) | 5 | 115 ms (n=1), Frame 43 ms | **155 ms** [143–206], Frame 85 ms | +35 % | schlechter (Einzelwert alt) | 159 Views (107); Scrollen flüssig (max. Frame 9 ms) |
| 5 | Graph: Zeitraum-Dialog öffnen | 6 | 1 117 ms [768–1 472] | **1 187 ms** [821–1 564] | +6 % | gleich | **1 050 Views**, 2 Frames > 33 ms (max. 57 ms); wächst mit dem aktuellen Zeitraum: 3 M 821, ab 2025 1 048–1 064, ab 2024 1 309–1 313, ab 2023 1 564 ms |
| 5 | Graph: Zeitraum speichern (Neuberechnung, Bankdrücken 1RM) | 6 | 618 ms [424–783] | **660 ms** [446–842] | +7 % | gleich (je Zeitraum +6–10 %) | ab 2025: 446–471, ab 2024: 659–661, ab 2023: 840–842 ms (PERF-001 ~425 / ~620 / ~765) |
| 5 | Graph: Datum ins Feld tippen (23 Tastenereignisse je Gruppe) | 6 | 570 ms je Gruppe | **624 ms** [411–807] | +9 % | gleich | wächst mit dem Zeitraum: 411–424 / 606–642 / 801–807 ms ≈ 18–35 ms je Taste |
| 5 | Metrics: Woche wechseln (Wischen) | 20 | 87 ms [66–231] | **167 ms** [83–297] | **+93 %** | **schlechter** | zweigeteilt je nach Woche: 9× 83–116 ms, 11× 218–297 ms (dieselben Wochen wie PERF-001); 0 Frames > 33 ms, janky 0,9 % |
| 6 | AI-Chat öffnen (Drawer → AI Chat) | 6 | 39 ms [30–79] (nur Hinweistext) | **67 ms** [61–77] (mit Verlauf + Eingabefeld) | +72 % | nicht vergleichbar (anderer Inhalt) | 0 Frames > 33 ms; zurück zum Dashboard 61 ms |
| 6 | Tippen ins Chat-Eingabefeld (je Taste, nichts gesendet) | 22 | nicht messbar (kein Eingabefeld) | **30 ms** [18–52] | neu | unauffällig | JS 24 ms/Taste; 0 Frames > 33 ms |
| 7 | Video-Analyse: Liste öffnen (10 Analysen) | 5 | nicht gemessen | **247 ms** [240–265] | neu | – | 208 Views, 1 Frame > 33 ms (max. 62 ms) |
| 7 | Video-Analyse: Liste scrollen | 8 | – | **flüssig**, max. Frame 9 ms | neu | – | |
| 7 | Video-Analyse: Analyse öffnen (Detail) | 5 | – | **601 ms** [566–807] | neu | – | 2 Frames > 33 ms (max. 70 ms), 91 Views |
| 7 | Video abspielen (12 s, Overlay + Graph) | 1 × 12 s | – | **flüssig**: 752 Frames, 0 > 16,7 ms, max. 16 ms | neu | – | JS 86 ms/s (8,6 % eines Kerns) |
| 8 | PSS nach Kaltstart | 5 | 222 MB [213–223] | **241 MB** [240–244] | +8 % | etwas schlechter | Native Heap 127 MB (123), Java Heap 10 MB, 284 Views (273) |
| 8 | PSS nach einer Runde durch alle Tabs | 5 | 489 MB [486–490] | **572 MB** [558–584] | **+17 %** | **schlechter** | Native Heap **394 MB** (320), Java Heap 24 MB (37), 2 616 Views (2 847) |
| 9 | Gespeicherte Daten | – | State-Export 1 492 351 B; persist-Wert 1 736 076 Zeichen | State-Export **1 516 639 B**; persist-Wert **1 766 484 Zeichen** | +2 % | – | siehe unten |

MB = MiB (kB/1024) wie in der PERF-001-Tabelle.

**Szenario 2, Satz für Satz** (zusammenhängender JS-Block nach „Add“, ms; `raw-2026-11/scn2-save/burst-structure.txt`):

| Satz (Übung hat danach n Sätze) | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PERF-001 | 264 | 269 | 277 | 286 | 295 | 304 | 311 | 323 | 335 | 343 | 360 | 351 |
| PERF-004 | 471 | 506 | 485 | 499 | 514 | 531 | 537 | 546 | 569 | 577 | 576 | 597 |

Der Sockel ist um ~200 ms gestiegen, die Steigung pro Satz ist ähnlich (~+8 → ~+11 ms). Es gibt weiter keine Frames > 33 ms; spürbar ist die
Blockade, wenn man direkt nach „Add“ ein Feld antippt oder scrollt.

**Speicher schrittweise** (`raw-2026-11/scn8-memory/steps/`, PSS / Native Heap in MB (= 1000 kB, wie die PERF-001-Schrittreihe) / Views; PERF-001 in Klammern):
Start 248 / 130 / 284 (228 / 127 / 273) → Plan Next Training 312 / 182 / 437 (296 / 183 / 448) → Plan Micro 4 341 / 204 / **910** (366 / 233 / 1 275) →
Exercises 382 / 233 / 1 674 (388 / 244 / 1 939) → Dashboard 400 / 244 / 1 833 (391 / 251 / 2 046) → History offen 408 / 251 / 2 203 (406 / 261 / 2 548) →
nach 5 Flings 491 / 300 / 2 257 (479 / 312 / 2 524) → nach 15 Flings 518 / 316 / 2 259 (498 / 324 / 2 564) → Analysis/Metrics/Dashboard 479–494 / 295–304 →
**Settings 602 / 415 / 2 618** (493 / 330 / 2 847) → Training 603 / 421.

* Bis einschließlich Dashboard liegt PERF-004 gleichauf oder besser (Plan: −25 MB, −365 Views durch PERF-003).
* Die Trainings-Historie wächst weiter um ~110 MB über 15 Flings (PERF-001 ~92 MB).
* **Neu:** In der Runde springt der Native Heap beim Öffnen von Settings um ~110 MB (PERF-001: +13 MB). Isoliert ist das nicht reproduzierbar:
  Kaltstart → Settings +16 MB, History/Metrics/Analysis → Settings +13 bis +32 MB (`raw-2026-11/scn8-memory/settings-isolated/`). Der Sprung
  entsteht also erst nach der ganzen Runde. Die Ursache ist offen; der Native Heap wird danach nicht wieder kleiner.

**Datenumfang (Szenario 9, `raw-2026-11/scn9-datasize/datasize.json`):** 381 Trainings (364 abgeschlossen, 17 geplant), 2 883 Workouts in `allIds`
(5 707 in `byId`, davon 2 833 geplante Workouts), 11 461 Sätze, 82 Übungen, 4 Pläne, 10 Videoanalysen (7 done, 3 failed;
Ergebnis-JSONs bis 1,5 MB), AI-Chat 2 Nachrichten / 1 archivierter Verlauf.
Persistierter Redux-Wert (ein Key `persist:root`, Slices doppelt JSON-kodiert) 1 766 484 Zeichen: `workouts` 1 349 615, `trainings` 112 290,
`exercises` 24 695, `aiChat` 20 167, `videoAnalyses` 4 901, `trainingsPlan` 4 449, Rest < 400. MMKV-Datei 16 MiB. App-Daten laut `diskstats`
33,8 MB (Snapshot), App-Verzeichnis inkl. Video-Vorschauen, Analyse-Ergebnissen und Pose-Modell ~50 MB.

## 4. Die Top 5 aus PERF-001 – besser, gleich oder schlechter?

| # | Problem aus PERF-001 | PERF-001 | PERF-004 | Urteil |
|---|---|---|---|---|
| 1 | Trainings-Historie scrollt schwer | 1 288 ms beschäftigt, ~800 Views, JS 809 ms pro Fling | 1 213 ms, 822 Views, JS 846 ms pro Fling; +110 MB PSS über 15 Flings | **gleich** – unverändert das spürbarste Problem |
| 2 | Zeitraum-Dialog im Analyse-Graph langsam | Öffnen 1 117 ms (~1 219 Views), Speichern 618 ms, Datum tippen ~31 ms/Taste | Öffnen 1 187 ms (1 050 Views), Speichern 660 ms, Tippen 18–35 ms/Taste (wächst mit Zeitraum) | **gleich** (tendenziell +6–9 %) – der Dialog sitzt jetzt hinter dem neuen Filter-Panel („Custom“), die Kosten sind dieselben |
| 3 | Hoher Speicherverbrauch nach einer Tab-Runde | 222 → 489 MB | 241 → 572 MB (Native Heap 394 MB) | **schlechter** (+17 %) |
| 4 | Satz speichern blockiert die UI und wächst mit jedem Satz | 341 ms, Block 264 → 351 ms | **549 ms**, Block 471 → 597 ms | **schlechter** (+61 %) |
| 5 | Ruckler beim Wischen zwischen Trainings | 182–269 ms + ein ~55-ms-Frame je Wisch | 51–155 ms, längster Frame 15–16 ms, 0 Frames > 33 ms | **besser** (PERF-003 wirkt). Gegenüber dem PERF-003-Endstand (57 / 104 / 100 ms) sind Plan und Analysis aber wieder um ~50 % / ~40 % langsamer (155 / 140 ms) |

## 5. Aktuelle Top 5 der spürbarsten Probleme (mit Folge-Vorschlag)

1. **Satz speichern blockiert die App ~0,55 s und wächst mit jedem Satz** (Szenario 2, +61 % gegenüber PERF-001).
   Ein zusammenhängender JS-Block von 471–597 ms pro „Add“. Die Frames bleiben flüssig, aber jeder Tap direkt danach (nächstes Feld, Scrollen,
   Rest-Timer) reagiert eine halbe Sekunde verzögert. Das passiert im Kern-Workflow, Dutzende Male pro Training.
   **Folge:** eigenes Ticket „Satz speichern < 150 ms“. Erst messen, wohin die Zeit geht: einmal mit einem Profiling-Build (Hermes Sampling
   Profiler) Persist und Re-Render trennen. Erwartete Hebel: (a) redux-persist schreibt pro Änderung den ganzen Root-Wert (~1,77 MB, doppelt
   JSON-kodiert) – `workouts` in einen eigenen Persist-Key auslagern und Schreiben drosseln/nach der Interaktion ausführen; (b) Selektoren/Re-Renders,
   die mit der Satzanzahl wachsen (+11 ms je Satz, 39 neue Views je Satz statt 27) – geloggte Satzzeilen memoisieren. Dabei prüfen, was seit
   0.172 hinzugekommen ist (z. B. die MMKV-4/Nitro-Umstellung, Health-Connect-Sync, Rest-Timer-Logik), weil der Sockel um ~200 ms gestiegen ist.

2. **Trainings-Historie scrollt schwer** (Szenario 4, unverändert seit PERF-001). Jeder Fling erzeugt ~820 neue native Views und hält den JS-Thread
   ~0,85 s beschäftigt; die App reagiert 1,2–1,5 s verzögert, der Speicher wächst um ~110 MB über 15 Flings.
   **Folge:** Ticket „Historie: Recycling statt Neuaufbau“. Die Liste so umbauen, dass FlashList wirklich recycelt: einen flachen Datensatz
   (Datumskopf, Übungskopf, Satzzeile als eigene Items mit `getItemType`) statt einer Karte pro Tag, die alle Sätze per `map` rendert; Zellen
   ohne datenabhängige `key`s in der Tiefe; Erfolg messen an „neue Views pro Fling ≈ 0“.

3. **Zeitraum-Dialog im Analyse-Graph** (Szenario 5, unverändert). Öffnen 0,8–1,6 s (1 050 Views, wächst mit dem gewählten Zeitraum), Speichern
   0,45–0,84 s Neuberechnung, Tippen ins Datumsfeld 18–35 ms pro Taste. Ein Zeitraumwechsel kostet zusammen 2–3 s Wartezeit.
   **Folge:** Ticket „DateRangePicker leichtgewichtig“: den Monats-Kalender des Dialogs virtualisieren bzw. nur die sichtbaren Monate rendern,
   die Neuberechnung der Graph-Daten erst nach gültigem Datum/„Save“ und memoisiert pro Übung+Zeitraum ausführen; die neuen Presets
   (4W/3M/6M/1Y) als Standardweg ohne Dialog anbieten.

4. **Speicherverbrauch** (Szenario 8, +17 %). 241 MB direkt nach dem Start, 572 MB nach einer Tab-Runde (Native Heap 394 MB). Besuchte Screens bleiben
   gemountet (2 616 Views), und in der Runde kommt beim Wechsel auf Settings ein nicht erklärter Sprung von ~110 MB Native Heap hinzu.
   Auf Geräten mit weniger RAM steigt das Risiko, dass Android die App im Hintergrund beendet (laufendes Training!).
   **Folge:** Ticket „Speicher nach Tab-Runde < 450 MB“: (a) den Sprung bei Settings mit Hermes-Heap-Snapshot / `meminfo -d` vor/nach eingrenzen;
   (b) Drawer-Screens im Analyse-Tab und die Historie beim Verlassen abbauen (`unmountOnBlur` bzw. `freezeOnBlur` + Lazy-Mount), Historien-Fix aus Punkt 2.

5. **Neue, spürbare Einzel-Ruckler beim Öffnen:**
   * **Video-Analyse-Detail öffnen:** 0,6 s [0,57–0,81] beschäftigt mit 2 Frames > 33 ms (bis 74 ms). Neue Funktion, in PERF-001 nicht vorhanden.
   * **Metrics-Wochenwechsel** fast verdoppelt (87 → 167 ms je Wisch); Ursache nicht gemessen; ein Kandidat ist der neue Hinweisbanner „letztes Training am …“, der je Woche über alle Trainings sucht.
   * **Dashboard öffnen:** 155 ms und ein 85-ms-Frame (PERF-001 115 ms / 43 ms).
   * **Exercises öffnen:** weiter ein einzelner 261-ms-Frame mit 758 Views (nicht virtualisierte Liste, +100 Views).
   **Folge:** ein Sammel-Ticket „Erstes Öffnen ohne Frames > 50 ms“: Video-Detail (Player/Graph/Overlay gestaffelt mounten wie `ProgressiveMount`
   aus PERF-003), Exercises-Liste virtualisieren, beim Metrics-Wochenwechsel erst messen, welcher Teil wächst (Banner-Berechnung „letztes Training vor dem Zeitraum“ ist der erste
   Kandidat) und diesen memoisieren.

**Nicht auffällig:** Kalt- und Warmstart (Inhalt nach ~0,63 s, Warmstart 66 ms), Wischen zwischen Trainings (jetzt ohne Ruckler),
Umschalten der Reiter (gewählter Knopf nach 39 ms sichtbar), Kalender, Scrollen in Exercises / Dashboard / Video-Liste, Video-Wiedergabe,
Tippen in Satzfelder und Chat-Eingabe, Timer-Grundlast (1,6 %).

## 6. Einschränkungen und Abweichungen

* **Build-Umgebung:** Der erste Release-Build stürzte beim Start ab (`TypeError: undefined is not a function` beim Laden der Module). Ursache war nicht
  master, sondern das geteilte `node_modules` der Worktrees (Symlink auf das Haupt-Repo): `react-native-mmkv` 3.3.3 statt 4.3.2, `react-native-nitro-modules`
  fehlte. Gemessen wurde ein Build mit `npm ci` exakt nach `package-lock.json` im Worktree (`raw-2026-11/checks/release-hermes-verification.txt`).
  Log des fehlerhaften Builds: Run-Verzeichnis `checks/build-release-attempt1-stale-node_modules.log`.
* **Release nur arm64-v8a** (`-PreactNativeArchitectures=arm64-v8a`, wie PERF-003); das Gerät ist arm64, zur Laufzeit identisch.
* **Akku 15–17 %** (lädt über USB), PERF-001 hatte 89 %. Kein Energiesparmodus, keine thermische Drosselung; die Kontrollgrößen (Start, Kalender,
  Exercises-Scrollen, Tippen) liegen auf den PERF-001-Werten, deshalb ist kein Einfluss erkennbar.
* **Navigation geändert:** „Next Training“ führt heute auf Micro 6 statt Micro 7; gemessen wurde wie in PERF-001 zwischen Micro 3 (02.02.26) und
  Micro 4 (16.02.26) – dieselben Trainings (jetzt 2 statt 3 Wischer zurück). Der Graph-Zeitraum-Dialog wird über das neue Filter-Panel
  („Custom“) geöffnet, die Metrics-Übung über „Search all“; der Dialog selbst ist derselbe. Der Kalender startet im November statt September
  (9 statt 7 Monatswechsel bis Februar 2026).
* **Szenario 6:** mit ungültigem Platzhalter-Key gemessen (siehe Abschnitt 2), deshalb ist „AI-Chat öffnen“ nicht 1:1 mit PERF-001 vergleichbar
  (damals nur der Hinweistext, heute Verlauf + Eingabefeld + gespeicherte Fehlermeldung).
* **Szenario 7:** Liste/Detail/Wiedergabe der neuesten Analyse (#10, Status done, Galerie-Video ~1:15). Das Video wurde nur abgespielt und pausiert,
  nichts gespeichert („Secure video in app“ nicht benutzt).
* Öffnen-Messungen (Exercises, Dashboard, Historie, Video-Liste/-Detail) je 5 Kaltstart-Durchläufe; PERF-001 hatte dort jeweils nur einen Wert.
* `settle_ms` misst JS-Arbeit, nicht Pixel; native Animationen laufen parallel weiter. Messung mit USB und laufendem adb/Perfetto, wie in PERF-001.
* `npm test`: 237/238 Suites grün. `__tests__/components/picker/filter/AnalyseFilterPanel.spec.tsx` scheitert auf master `7b289e66` nur in der Zeitzone
  Europe/Berlin nach der Zeitumstellung (erwartet „27 Apr“, erhält „26 Apr“); mit `TZ=UTC` 8/8 grün. Kein Zusammenhang mit diesem Messauftrag.

## 7. Rohdaten

`docs/perf/raw-2026-11/` (ohne Perfetto-Traces – die sind 25–45 MB je Serie und liegen im Run-Verzeichnis
`.codex-orchestrator/runs/PERF-004/raw/<serie>/trace.pftrace`):

* `summary.json` – alle aggregierten Werte; `summary-perf001.json` – PERF-001-Werte; `comparison.md` – vollständige Alt/Neu-Tabelle aller Kennzahlen
* `scenario1-start.txt`, `scn1-coldstart-trace/` – Start
* `scn2-save/`, `scn2-type/`, `scn3-*/`, `scn4a|b|c/`, `scn5a|b|c/`, `scn6-open|type/`, `scn7a|b/`, `rep/open-*` – je Serie `gestures.json` (Werte pro Geste),
  `gfxinfo.txt`, `gfxinfo-framestats.txt`, `gfx-summary.json`, `meminfo.txt`, `interaction.log`, `prep.log`, `conditions.txt` (Akku);
  `scn2-save/burst-structure.txt`
* `scn8-memory/` – meminfo je Lauf, schrittweise (`steps/`) und Settings-Gegenprobe (`settings-isolated/`); `scn9-datasize/` – Datenumfang
* `checks/` – Release/Hermes-Nachweis, `dumpsys package`, Zähl-/Fingerprint-Vergleich vorher/nachher, Alarme/Notifications, Gerätezustand, Maestro-Log
* `tools/` – alle Mess- und Auswerteskripte (README dort)

Screenshots der gemessenen Screens: Run-Verzeichnis `screenshots/` (u. a. `scn2-running-training-13-sets.png`, `scn3-micro4-{train,plan,analysis}.png`,
`scn4a-exercises-tab.png`, `scn4b-history-list-scrolled.png`, `scn4c-history-calendar-feb26.png`, `scn5a-analyse-dashboard.png`,
`scn5b-analysis-graph-collapsed.png`, `scn5c-metrics-week.png`, `scn6-ai-chat-typing.png`, `scn7a-video-list.png`, `scn7b-video-detail-after-play.png`);
eine Auswahl im Repo unter `screenshots/PERF-004/`.
