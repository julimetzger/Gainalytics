# PERF-001 – Performance-Messung am echten Gerät (Release-Build)

Messauftrag, kein Fix. Es wurde **kein App-Code verändert**. Gemessen am 28.09.2026 auf dem echten
Gerät mit den echten Nutzerdaten.

## 1. Messaufbau

| | |
|---|---|
| Gerät | Samsung SM-G986B (Galaxy S20+ 5G), Android 13, Serial R5CN30HWZFN |
| Display | Override 720×1600, aktiver Modus **60 Hz** (Frame-Budget 16,7 ms; `dumpsys display`: `mActiveModeId=9`, `refreshRate=60.000004`) |
| Stromversorgung | USB, Akku 89 % |
| Build | `assembleRelease` von master `0ef9ef2e`, versionName 0.172 / versionCode 7, mit Debug-Key signiert und per `adb install -r` über die installierte App gelegt |
| Release-Nachweis | `pkgFlags=[ HAS_CODE ALLOW_CLEAR_USER_DATA ]` (kein `DEBUGGABLE`), `run-as` → „package not debuggable“, SHA-256 der `base.apk` auf dem Gerät = lokale `app-release.apk` (`d08b2db4…`), `assets/index.android.bundle` beginnt mit der Hermes-Bytecode-Magic `c61fbc03c103191f`, `libhermesvm.so` im APK → `raw/checks/release-hermes-verification.txt` |
| Metro/Dev-Mode | keiner (Release-Bundle im APK) |
| Datenbestand | siehe Szenario 8: 364 abgeschlossene Trainings (15.02.2024–28.02.2026), 11 461 Sätze, 82 Übungen, 4 Pläne; persistierter State ≈ 1,5 MB JSON |

### Messmethoden

* **Start:** `am start -W` (`TotalTime` = bis zum ersten Frame), Perfetto-Trace des Kaltstarts
  (Zeit bis zum ersten großen Mount-Batch = echter Screen-Inhalt), eine Bildschirmaufnahme als Gegenprobe.
* **Interaktionen (Szenario 2–6):** pro Serie `dumpsys gfxinfo <pkg> reset` → Perfetto-Trace
  (ftrace sched + atrace view/gfx/input/am/wm + SurfaceFlinger-Frame-Timeline) → scripted `adb shell input`
  mit festen Pausen → `dumpsys gfxinfo` / `framestats` / `meminfo`.
  Ausgewertet wird **pro Geste** (Gruppe von `deliverInputEvent`-Events der App):
  * `settle_ms` – Fingerabheben bis Ende der durch die Geste ausgelösten Arbeit des RN-JS-Threads (`mqt_v_js`).
    JS-Laufzeitsegmente werden zu Bursts (Lücke ≤ 8 ms) zusammengefasst; Bursts ≥ 10 ms werden ab
    Fingerabheben verkettet, solange die Lücke < 150 ms ist (Timer-Ticks von ~8 ms werden so ignoriert).
    Das ist die Zeit, in der die App nach der Eingabe „beschäftigt“ ist und auf weitere Eingaben verzögert reagiert.
  * `js_busy_ms` – JS-Thread-Laufzeit im Fenster bis zur nächsten Geste.
  * Frames > 16,7 ms / > 33 ms und längster Frame aus der Frame-Timeline, `views_created` = Anzahl
    `SurfaceMountingManager::createViewUnsafe` (neu erzeugte native Views).
* **Speicher:** `dumpsys meminfo` (TOTAL PSS, Native/Java Heap), 5 Durchläufe + ein schrittweiser Lauf.
* **Datenumfang:** In-App-Export (Settings → Export Data, rein lesend) + Vorher-Sicherung per `run-as`.

Alle Skripte: `raw/tools/` (`run.sh`, `scenarios.sh`, `gestures.py`, `coldstart.py`, `aggregate.py`, `counts.py`).
Alle aggregierten Werte: `raw/summary.json`.

## 2. Datensicherheit

* **Vorher-Sicherung** (noch debuggable, `run-as`): `appdata-before.tar` (SHA-256 `16353ec3…`, lesbar, MMKV-Datei
  darin identisch mit Einzelkopie) + Slice-JSONs; liegt im Run-Verzeichnis `backup/`.
* **Vergleich** Vorher-Sicherung ↔ In-App-Export nach allen Messungen (`raw/checks/data-integrity-final.txt`):
  Trainings 381 = 381 (364 F / 17 P), Workouts 2883 (allIds) / 5707 (byId) = gleich, Sätze 11 461 = 11 461,
  Übungen 82, Pläne 4, Videoanalysen 1 – und **inhaltsgleiche Fingerprints** (SHA-256 über
  `trainings.byId`, `workouts.byId/byExerciseId/allIds/plannedWorkouts`, `trainingsPlan.byId`, `exercises.byId`, `videoAnalyses`).
* **Einzige Abweichung:** `settings.restTimer.active` (Pausentimer des letzten Mess-Satzes) ist gesetzt, vorher
  fehlte der Schlüssel. Das ist transienter UI-Zustand; er wird beim nächsten Trainingsstart per
  `DISMISS_REST_TIMER` überschrieben (`dispatchStartTraining.ts`) und nur in einem laufenden Training angezeigt.
  Über die UI lässt er sich nicht in den exakten Ursprungszustand (Schlüssel fehlt) zurücksetzen.
* **Mess-Training (Szenario 2):** leerer Slot „Push pull › Micro 7 › Push squat“ mit einer Übung
  (Bankdrücken, 0 geplante Sätze) geplant, gestartet, 13 Sätze à 5 × 20 kg (weit unter PR 150 kg → kein
  Rekord geschrieben), danach über ⋮ → Delete gelöscht. Die dabei geplante „Training beenden“-Erinnerung
  (Notifee-Alarm) und die Pausen-Benachrichtigung wurden per Force-Stop entfernt (danach 0 Alarme, 0 Notifications der App).
* Eigene Exportdateien aus `/sdcard/Download` wieder gelöscht (Kopien im Run-Verzeichnis), Perfetto-Configs/-Traces
  auf dem Gerät entfernt. Release-Build bleibt installiert, App läuft normal (read-only Maestro-Check grün).
* Historie vorher/nachher: `screenshots/history-before.png`, `screenshots/scn4b-history-list-after.png`
  (neuester Eintrag jeweils „Sat, 28/02/26 – Hyperextension …“).

## 3. Messwerte (alle Szenarien)

Median [min–max], n = Anzahl Durchläufe/Gesten.

| # | Szenario / Aktion | n | Hauptwert | weitere Werte | Methode |
|---|---|---|---|---|---|
| 1 | Kaltstart bis erstes Frame | 12 | **190 ms** [183–211] | Trace: erstes Frame 134 ms [130–142] nach Fork (n=5) | `am start -W`, Perfetto |
| 1 | Kaltstart bis erster bedienbarer Inhalt (Training-Home) | 5 | **455 ms** [427–475] Mount-Beginn, **617 ms** [592–630] Mount fertig (ab Prozess-Fork) | JS-Thread 286 ms [271–308] durchgehend beschäftigt vor dem Inhalt; Video-Gegenprobe: Inhalt 0,63 s nach Launch, davon ~0,3 s Splash + ~0,1 s weiß | Perfetto (Mount-Batch ≥ 50 Views), screenrecord |
| 1 | Warmstart (HOME → Start) | 12 | **66 ms** [56–74] | LaunchState HOT | `am start -W` |
| 2 | Satz speichern (Tap „Add“, laufendes Training) | 12 | **settle 341 ms** [272–449] | JS 378 ms; ein zusammenhängender JS-Block 264 → 351 ms, wächst mit jedem Satz (~+8 ms/Satz); Frames > 33 ms: 0 (max. Frame 20 ms [16–29]); 27 neue Views je Satz | Perfetto, gfxinfo |
| 2 | Tippen in Wdh.-/Gewichtsfeld (je Tastendruck) | 20 | **settle 44 ms** [22–61] | JS 58 ms/Taste; 0 Frames > 33 ms; Vergleich Suchfeld Exercises: 13 ms/Taste | Perfetto |
| 2 | Grundlast laufendes Training (Leerlauf, Trainings- + Pausentimer) | 10 s | **15 ms JS/s** (1,5 % eines Kerns) | 2 Timer-Ticks à 7–9 ms pro Sekunde | Perfetto |
| 3 | Wischen zwischen Trainings (Train-Reiter, Micro 3 ↔ 4) | 24 | **settle 182 ms** [168–484] | 1 Frame > 33 ms pro Wisch (max. 55 ms [14–82]); gfxinfo janky 5,1 % | Perfetto, gfxinfo |
| 3 | dito, Plan-Reiter | 24 | **269 ms** [250–616] | max. Frame 57 ms [47–93]; janky 7,5 % | |
| 3 | dito, Analysis-Reiter | 24 | **263 ms** [243–630] | max. Frame 57 ms [48–79]; janky 7,6 % | |
| 4 | Exercises-Tab öffnen | 1 (+ 5 Speicher-Läufe) | **1 Frame 243 ms**, settle 199 ms | **658 Views auf einmal erzeugt** | Perfetto |
| 4 | Exercises scrollen (Fling) | 16 | **flüssig**: max. Frame 9 ms, 0 Jank | JS ~15 ms/Fling, 0 neue Views | Perfetto, gfxinfo (janky 0,2 %) |
| 4 | Trainings-Historie (Analyse → History) öffnen | 1 | settle 353 ms | 251 Views | Perfetto |
| 4 | Trainings-Historie scrollen (Fling, FlashList) | 17 | **settle 1 288 ms** [1 153–1 591] | **JS 809 ms und ~800 neue Views pro Fling**, 12 Frames > 16 ms, max. Frame 34 ms | Perfetto, gfxinfo |
| 4 | Historien-Kalender: Monat wechseln | 7 | settle 40 ms [37–63] | | Perfetto |
| 4 | Historien-Kalender: Tag antippen (Detailkarte) | 11 | settle 92 ms [61–103] | max. Frame 31 ms, 92 Views | Perfetto |
| 5 | Analyse-Tab öffnen (Dashboard) | 1 | settle 115 ms | 1 Frame 43 ms, 107 Views; Scrollen flüssig (max. Frame 7 ms) | Perfetto |
| 5 | Graph: Zeitraum-Dialog öffnen | 6 | **settle 1 117 ms** [768–1 472] | **~1 219 Views**; Dauer wächst mit Zeitraumlänge (2025: 768–1 000, 2024: 997–1 261, 2023: 1 234–1 472 ms) | Perfetto |
| 5 | Graph: Zeitraum speichern (Neuberechnung, Bankdrücken 1RM) | 6 | **settle 618 ms** [424–783] | wächst mit Zeitraum (ab 2025: ~425, ab 2024: ~620, ab 2023: ~765 ms) | Perfetto |
| 5 | Graph: Datum ins Feld tippen (23 Tastenereignisse je Gruppe: MOVE_END, 12× DEL, 10 Zeichen) | 6 | settle 570 ms je Gruppe | JS 718 ms je Gruppe ≈ 31 ms pro Tastenereignis | Perfetto |
| 5 | Metrics: Woche wechseln (Wischen) | 20 | settle 87 ms [66–231] | 0 Frames > 33 ms | Perfetto |
| 6 | AI-Chat öffnen | 6 | settle 39 ms [30–79] | Eingabefeld nicht vorhanden (siehe Einschränkungen) | Perfetto |
| 6 | Proxy: Tippen ins Exercises-Suchfeld (je Taste, filtert Liste) | 21 | settle 17 ms [9–117] | JS 13 ms/Taste | Perfetto |
| 7 | PSS nach Kaltstart | 5 | **222 MB** [213–223] | Native Heap 123 MB, Java Heap 10 MB, 273 Views | `dumpsys meminfo` |
| 7 | PSS nach einer Runde durch alle Tabs | 5 | **489 MB** [486–490] | Native Heap 320 MB, Java Heap 37 MB, 2 847 Views | `dumpsys meminfo` |
| 8 | Gespeicherte Daten | – | State-Export 1 492 351 B; redux-persist-Wert (doppelt JSON-kodiert) 1 736 076 Zeichen | Slices: workouts 1 349 615 B, trainings 112 290 B, exercises 24 695 B, Rest < 5 kB; MMKV-Datei 16 MiB; App-Daten laut `diskstats` 35,2 MB (Snapshot) | Export, Backup, diskstats |

**Speicher schrittweise** (`raw/scn7-memory/steps-summary.txt`, PSS / Native Heap / Views):
Start 228 MB / 127 MB / 273 → Plan (Micro 7) 296 / 183 / 448 → Plan Micro 4 366 / 233 / 1 275 →
Exercises 388 / 244 / 1 939 → Dashboard 391 / 251 / 2 046 → History offen 406 / 261 / 2 548 →
History nach 5 Flings 479 / 312 / 2 524 → nach 15 Flings 498 / 324 / 2 564 → Analysis/Metrics/Dashboard ≈ 476–480 →
Settings 493 / 330 / 2 847. Views werden nicht wieder freigegeben – besuchte Screens bleiben gemountet.

**Datenumfang (Szenario 8):** 381 Trainings (364 abgeschlossen, 17 geplant), 5 707 Workouts im Store, davon 2 883 in
`allIds` und 2 824 geplante Workouts (in `plannedWorkouts`, ~0,5 MB – kein Datenfehler), 11 461 Sätze, 82 Übungen,
4 Pläne, 1 Videoanalyse, kein AI-Chat-Verlauf.

## 4. Top 5 der spürbarsten Probleme

1. **Trainings-Historie scrollt schwer (Analyse → History):** jeder Fling erzeugt ~800 neue native Views und
   hält den JS-Thread ~0,8 s beschäftigt; die App reagiert 1,2–1,6 s lang verzögert. PSS wächst um ~90 MB über
   15 Flings. Das FlashList-Recycling greift in der Praxis offenbar nicht (Views werden neu erzeugt statt wiederverwendet).
2. **Zeitraum-Dialog im Analyse-Graph:** Öffnen dauert 0,8–1,5 s (~1 200 Views, wächst mit Zeitraumlänge),
   Speichern/Neuberechnen 0,4–0,8 s, jeder Tastendruck im Datumsfeld ~31 ms JS. Ein Zeitraumwechsel kostet damit
   insgesamt deutlich über 2 s Wartezeit.
3. **Speicherverbrauch:** 222 MB PSS direkt nach Start, ~489 MB nach einer Tab-Runde (Native Heap ×2,6); gemountete
   Screens und ihre Views (273 → 2 847) bleiben dauerhaft erhalten. Auf Geräten mit weniger RAM ist das ein Risiko für
   Hintergrund-Kills.
4. **Satz speichern im laufenden Training:** ~0,34 s JS-Block pro Satz, wächst mit jedem Satz der Übung
   (264 ms beim 1. → 351 ms beim 12. Satz). Frames bleiben flüssig, aber ein schneller zweiter Tap/Feldwechsel direkt
   nach „Add“ wird spürbar verzögert verarbeitet.
5. **Wischen zwischen Trainings im Plan:** 0,18–0,27 s JS pro Wisch plus ein sichtbarer Ruckler (ein Frame ~55 ms,
   also 2–3 verworfene Frames) bei jedem Wechsel; Ausreißer bis 0,6 s beim ersten Wisch.

Nicht auffällig: Kaltstart (Inhalt nach ~0,6 s), Warmstart (66 ms), Exercises-Scrollen, Dashboard, Kalender,
Metrics-Wochenwechsel, Timer-Grundlast (1,5 %).

## 5. Hypothesen aus dem Code-Audit

| Hypothese | Urteil | Begründung aus den Messwerten |
|---|---|---|
| Satz speichern löst eine Neuberechnung der ganzen App aus und schreibt den kompletten Datenbestand neu | **bestätigt (Symptom) / Anteil unklar** | Jeder Satz = ein durchgehender JS-Block von 264–351 ms, weit mehr als das Rendern der geänderten Zeile rechtfertigt (nur 27 neue Views) und ~6× ein Tastendruck im selben Screen. Das komplette Neuschreiben ist im Code belegt (redux-persist mit einem einzigen Key `root`, `workouts` im Whitelist → pro Änderung ~1,74 MB serialisiert und nach MMKV geschrieben). Wie viel der 0,34 s auf die Serialisierung und wie viel auf Re-Render entfällt, lässt sich ohne JS-Profiler im Release-Build nicht trennen; dieselbe Serialisierung dauert in Node/V8 auf einem Desktop-CPU 13,6 ms (`raw/scn2-save/serialize-estimate-node.txt`), Hermes ohne JIT auf dem Gerät ist erfahrungsgemäß um ein Vielfaches langsamer. Der Anstieg um ~8 ms pro zusätzlichem Satz spricht dafür, dass Rendering einen Teil ausmacht. |
| Tippen in die Satzfelder erzeugt unnötige Renders | **bestätigt, spürbar gering** | 58 ms JS pro Tastendruck (Wdh./Gewicht) gegenüber 13 ms pro Tastendruck im Exercises-Suchfeld, das dabei sogar die Liste filtert. Keine Frames > 33 ms, settle ~44 ms → der Mehraufwand ist messbar (~4×), aber beim normalen Tippen kaum sichtbar. |
| Der Trainingsplan rendert mehrere Tage gleichzeitig | **bestätigt** | `RangeSwiper` rendert immer drei Panes (Code). Messbar: erster Wisch erzeugt 922 Views, jeder Wechsel 180–270 ms JS + ein ~55-ms-Frame; Öffnen des Plans und Wechsel auf Micro 4 kosten zusammen +138 MB PSS und ~1 000 Views. Die Kosten hängen kaum vom aktiven Unterreiter ab (Plan ≈ Analysis ≈ 265 ms, Train 182 ms) – gerendert wird mehr als der sichtbare Inhalt. |
| Die Exercises-Liste ist nicht virtualisiert | **bestätigt, aber nur beim Öffnen spürbar** | `ScrollView` + `map` (Code). Öffnen erzeugt alle 658 Views auf einmal (ein 243-ms-Frame), danach ist Scrollen völlig flüssig (max. Frame 9 ms, 0 neue Views). Bei 82 Übungen ist das ein einmaliger Ruckler von ~¼ s; er wächst linear mit der Übungsanzahl. |
| Der Start wartet auf das Einlesen aller gespeicherten Daten | **bestätigt (Mechanismus), Auswirkung gering** | `PersistGate loading={null}` rendert nichts bis zum Rehydrate. Im Trace ist der JS-Thread vom Start bis zum ersten Inhalt 286 ms am Stück beschäftigt (Bundle-Ausführung + MMKV-Lesen + JSON-Parse + erster Render, nicht trennbar), Inhalt steht 0,46–0,63 s nach Prozessstart. Im Video sieht man nach dem Splash ~0,1 s eine leere Fläche. Für 1,5 MB Daten ist das akzeptabel; es skaliert mit der Historie. |

## 6. Einschränkungen und Abweichungen

* **Szenario 6 (AI-Chat, Tippen bei vorhandenem Verlauf):** nicht wie gefordert messbar. Auf dem Gerät ist kein
  Anthropic-API-Key hinterlegt, `AIChatTab` rendert dann nur den Hinweis „Please add your Anthropic API key …“ und
  kein Eingabefeld. Außerdem existiert kein Chat-Verlauf (`aiChat.messages = []`, `history = []`); ihn zu erzeugen
  hätte das verbotene Absenden erfordert. Gemessen wurden stattdessen das Öffnen des Chats und – als Proxy für
  Texteingabe – das Tippen ins Exercises-Suchfeld. Für eine echte Messung braucht es einen API-Key und einen Verlauf.
* **Kaltstart „bis zur ersten bedienbaren Ansicht“:** Der vorherige Lauf hatte per `uiautomator dump`-Polling
  ~2,7 s ermittelt. Dieser Wert ist ein Messartefakt (der Dump selbst dauert und wartet auf Idle) und wird verworfen;
  Trace (5×) und Video (1×) zeigen übereinstimmend ~0,6 s. Rohdaten des alten Laufs bleiben in
  `raw/scn1-amstart-and-prev-uiautomator-poll.txt` (die `am start`-Werte daraus sind gültig und im Report verwendet).
* **Szenario 3, alte Serie:** Die abgebrochenen Traces des Vorläufers (`raw/prev-worker-scn3-plan-swipe*`) enthalten
  viele Wischer über das Ende der vorhandenen Micros hinaus (No-Ops, ~95 ms). Sie wurden durch saubere Serien ersetzt,
  in denen jeder Wisch ein echter Wechsel Micro 3 ↔ Micro 4 ist. Hinweis: Im Plan wechselt ein Wisch zwischen den
  Micros desselben Trainingstags (z. B. „Push squat“ Micro 3 ↔ 4), nicht zwischen Tagen.
* **`settle_ms` misst JS-Arbeit, nicht Pixel:** Native Animationen laufen parallel weiter; die Zahl beschreibt, wie
  lange die App nach einer Eingabe mit Verarbeiten beschäftigt ist (und neue Eingaben verzögert).
* `dumpsys gfxinfo framestats` hält nur die letzten ~120 Frames; Frame-Kennzahlen pro Geste stammen deshalb aus der
  Perfetto-Frame-Timeline, die gfxinfo-Zusammenfassung (Total/Janky/Perzentile) deckt die ganze Serie ab.
* Messung mit USB-Verbindung und laufendem adb/Perfetto; Tracing kostet etwas CPU, alle Serien sind aber unter
  denselben Bedingungen entstanden und damit untereinander vergleichbar.
* `npm test`: 1 Test-Suite (`__tests__/tabs/analyse/AIChatTabCancel.spec.tsx`, 10 Tests) scheitert bereits auf
  master `0ef9ef2e` (`Cannot read properties of undefined (reading 'Title')` im Dialog-Mock); ohne diese Datei
  166/166 Suites, 1 721/1 721 Tests grün. Kein Zusammenhang mit diesem Messauftrag.

## 7. Rohdaten

`docs/perf/raw/` (ohne Perfetto-Traces, die sind 35–50 MB je Serie und liegen im Run-Verzeichnis
`.codex-orchestrator/runs/PERF-001/raw/<serie>/trace.pftrace`):

* `summary.json` – alle aggregierten Werte dieser Tabelle
* `scn*/` – je Serie `gestures.json` (Werte pro Geste), `gfxinfo.txt`, `gfxinfo-framestats.txt`, `gfx-summary.json`,
  `meminfo.txt`, `interaction.log`; `scn1-coldstart-trace/cold*.json`; `scn2-save/burst-structure.txt`
  (JS-Bursts pro Satz + Leerlauf-Grundlast); `scn7-memory/` (meminfo je Lauf + schrittweise); `scn8-datasize/`
* `checks/` – Release/Hermes-Nachweis, `dumpsys package`, Zähl-/Fingerprint-Vergleich vorher/nachher, Maestro-Log
* `tools/` – alle Mess- und Auswerteskripte
