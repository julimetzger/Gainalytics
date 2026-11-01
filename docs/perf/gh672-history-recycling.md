# GH-672 – Trainings-Historie: Recycling statt Neuaufbau (Messung vorher/nachher, CI-Emulator)

Folge-Ticket aus PERF-004 (Problem Nr. 2). Gemessen am 01.11.2026 auf dem CI-Emulator, **Release-Build vor und nach der Änderung**.
Die Abnahme-Messung der Zielwerte am echten Gerät R5CN30HWZFN steht noch aus (macht der Owner).

## 1. Ursache

Die Historie war schon eine flache FlashList (Datumskopf / Workout-Karte als eigene Items mit `getItemType`). Recycelt wurde trotzdem nichts,
weil in jeder Karte **datenabhängige React-`key`s** saßen:

* `WorkoutView`: `key={workout.id}` auf `OutsidePressHandler`, `Card` und `WorkoutSetView`;
* `WorkoutSetView`: jede Satzzeile mit `key = index + reps + rir + weight + Range + Datum`.

Bekommt eine recycelte Zelle ein anderes Workout, ändern sich diese Keys, und React baut den ganzen Karten-Baum neu auf (≈ 20 native Views je Satz).
Zusätzlich hat sich jede Karte bei jedem Render neu im app-weiten `EventProvider` von `react-native-outside-press` registriert (State-Update dort),
weil `onOutsidePress` eine neue Inline-Funktion war.

## 2. Änderung (nur die Historien-Karten)

* `WorkoutView`: keine `key`s mehr; `showEdit` / `linkVideoSet` mit `useRecyclingState(…, [workoutId])` (FlashList v2) – eine recycelte Karte zeigt nie
  den Bearbeiten-Modus eines anderen Workouts; stabiler `onOutsidePress`-Callback.
* `WorkoutSetView`: Satzzeilen nach Position gekeyt; neues optionales Prop `resetKey` (von `WorkoutView` = `workout.id`) setzt den offenen Satz-Editor
  zurück, wenn die Zelle ein anderes Workout zeigt. Ohne `resetKey` (laufendes Training, `ExecuteTraining`) verhält sich der Editor wie bisher.
* Aussehen und Verhalten unverändert: Pixelvergleich vorher/nachher (Abschnitt 4), Maestro-Flow, Löschen und Bearbeiten am Gerät.

## 3. Messaufbau

| | |
|---|---|
| Gerät | CI-Emulator `emulator-5554`, Android 14 (API 34, userdebug), x86_64, 2 vCPU, 1080×2400 @ 420 dpi, Geometrie unverändert (`tool.sh display-geometry`, Statusleiste 136 px) |
| Build | `tool.sh rebuild-release` (assembleRelease x86_64, Hermes, kein Metro, nicht debuggable, Debug-Key, `install -r` über dieselben Daten). **Vorher** = Job-Start-master `b77b2f6` (Arbeitsbaum für `app/` byte-gleich mit master), **nachher** = Commit `4af5263`. Nachweis: `pkgFlags=[ HAS_CODE ALLOW_CLEAR_USER_DATA ]`, `run-as` → „package not debuggable“, `assets/index.android.bundle` beginnt mit der Hermes-Magic `c61fbc03…`, `libhermesvm.so` im APK; das neue Prop `resetKey` ist nur im Nachher-Bundle (`grep -c` 0 / 1). |
| Daten | `__tests__/e2e/maestro/fixtures/baseline.gains` per `tool.sh import-baseline`: 364 abgeschlossene Trainings, 11 461 Sätze, 5 707 Workouts in `byId` – dieselben Zahlen wie der PERF-004-Gerätebestand. Historie öffnen erzeugt in beiden Fällen **369 Views** (PERF-004: 369), oberster Eintrag „Sat, 28/02/26 – Hyperextension 13 reps 45 kg“. |
| Gesten | wie PERF-004 Szenario 4b (`scenarios.sh` prep4b/scn4b): Kaltstart → Analyse-Tab → Drawer → History, 12 Flings nach unten + 6 nach oben (`input swipe … 120 ms`, 1,5 s Pause). Koordinaten ×1,5 vom 720×1600-Override des Telefons auf 1080×2400. |
| Auswertung | Definitionen aus `gestures.py` (Geste = `deliverInputEvent`-Lauf, `settle_ms`, `js_busy_ms`, `views` = `SurfaceMountingManager::createViewUnsafe`), Flings = Gesten i ≥ 2 wie `aggregate.py`. **Abweichung:** Der CI-Runner hat weder `trace_processor` noch darf dort Python laufen. Deshalb `atrace` (sched + view gfx input am wm res, App-Marker an) statt Perfetto und dieselbe Logik als `awk`-Skript auf dem Emulator (`raw-gh672/tools/gestures.awk`). |
| Speicher | wie die PERF-004-Schrittreihe (06 History offen → 07 nach 5 → 08 nach 15 Flings, `dumpsys meminfo`, 4 s Ruhe); Historie direkt nach Kaltstart geöffnet (PERF-004 ging vorher über Plan/Exercises/Dashboard). |

## 4. Ergebnisse (Emulator, Release; Median [min–max])

| Kennzahl | vorher (master) | nachher (GH-672) | Δ | Zielwert (Gerät) |
|---|---|---|---|---|
| neu erzeugte native Views pro Fling (n = 54) | 417 [0–960] | **50,5** [0–104] | **−88 %** | < 100 ✔ (Median; Max 104) |
| JS-Laufzeit pro Fling `js_busy_ms` (n = 54) | 346 [4–774], Mittel 356 | **261** [45–679], Mittel 299 | −25 % (Mittel −16 %) | – |
| beschäftigt pro Fling `settle_ms` (n = 54) | 356 [0–1 360], Mittel 472 | 460 [0–1 349], Mittel 482 | gleich (Streuung) | ≤ 300 ms ✘ |
| PSS-Zuwachs über 15 Flings (n = 3) | 74,3 MB [71,9–75,8] | **36,7 MB** [34,7–44,6] | **−51 %** | ≤ 30 MB ✘ (Emulator) |
| Historie öffnen (n = 3) | 271 ms, 369 Views | 272 ms, 369 Views | gleich | – |

MB = 1000 kB wie die PERF-004-Schrittreihe (in MiB: 72,6 → 35,8). Rohwerte je Geste: `raw-gh672/runs/{before,after}-r{1,2,3}/gestures.tsv`,
Speicher: `raw-gh672/runs/mem-{before,after}/`.

**Warum `settle_ms` nicht sinkt – Gegenprobe mit Platzhaltern.** Als Experiment (nicht committet) wurde jede Workout-Karte durch ein leeres
`View` fester Höhe ersetzt. Selbst dann kostet jeder Fling 247 ms JS [28–337] und `settle_ms` liegt bei 196 ms [0–836] (`runs/exp-placeholder-paged`).
`settle_ms` misst während eines langen Momentum-Flings praktisch dessen Dauer: FlashList v2 verarbeitet jedes Scroll-Event im JS-Thread und rendert,
sobald neue Items in den Zeichenbereich kommen. Diese Bursts ≥ 10 ms folgen in Abständen < 150 ms und verketten sich so. Die Karten tragen
nach der Änderung nur noch ~40 % der JS-Zeit eines langen Flings bei (≈ 430 statt ≈ 270 ms ohne Karten). Weitere Experimente ohne messbaren
Effekt (alle verworfen): Zellen ohne `TouchableRipple` (`runs/exp-cell-r2..r4`; `exp-cell-r1` lief wegen eines fehlgeschlagenen
Bundle-Schritts noch mit dem Nachher-APK und ist ein weiterer Nachher-Lauf), alle Workouts auf einmal statt Seiten à 20 (`runs/exp-nopage-r1`),
`maintainVisibleContentPosition` aus (`runs/exp-placeholder-nomvcp`).

Die Emulator-Flings sind zweigeteilt: Mal scrollt der Wisch kaum (JS < 100 ms, kein Nachlauf), mal läuft er ~1 s nach (JS 400–600 ms).
Deshalb sind die Spannen groß, und Medianwerte vorher/nachher sind nur mit n = 54 vergleichbar.

**Aussehen:** Listenanfang und Bearbeiten-Modus sind vorher/nachher **pixelgleich** (ffmpeg-Differenz unterhalb der Statusleiste: max 0).
An der gescrollten Position (6 langsame Drags ohne Nachlauf) sind 1 400 Pixelzeilen mit 33 px Versatz pixelgleich; der Versatz kommt von der Geste.
Screenshots: `screenshots/GH-672/`.

## 5. Bewertung und offene Punkte

* **Views pro Fling:** erfüllt (Median 50,5, vorher 417). Am Gerät ist pro Fling ~doppelt so viel Inhalt zu sehen (PERF-004: 822 Views vorher);
  dort ist ein Median um ~100 zu erwarten – Abnahme-Messung am Gerät nötig.
* **Speicher:** halbiert, am Emulator aber noch 35–45 MB statt ≤ 30 MB. Ein Teil davon ist der Seitenzuwachs der Liste (20 Workouts je Seite).
* **„Höchstens 300 ms beschäftigt“:** am Emulator nicht erreicht. Die Grenze liegt hier in FlashList (Platzhalter-Gegenprobe), nicht in den Karten.
  Vorschlag für ein Folge-Ticket: auf dem Gerät mit Platzhalter-Build die FlashList-Grundlast messen. Wenn sie dort über 300 ms liegt, die
  Scroll-Verarbeitung von FlashList v2 untersuchen (z. B. `onScroll`-Pfad, Offset-Projektion, `drawDistance`) oder das Kriterium auf JS-Zeit nach
  Ende des Nachlaufs umstellen.
* Die Zielwerte am echten Gerät R5CN30HWZFN misst der Owner.

## 6. Werkzeuge

`raw-gh672/tools/` – laufen **auf dem Gerät** (`adb push` + `adb shell sh …`):

| Datei | Zweck |
|---|---|
| `scn4b.sh <label>` | PERF-004 Szenario 4b mit atrace, danach `gestures.awk`, gfxinfo, meminfo |
| `gestures.awk` | `gestures.py`-Definitionen für einen atrace-Textdump |
| `agg.sh <runs…>` | Median [min–max] über Läufe (Flings i ≥ 2, Öffnen i = 1) |
| `mem15.sh <label> <n>` | Speicher 06 → 07 → 08 (n Läufe) |
| `nav.sh open\|fling N\|drag N` | Historie öffnen / Flings / Drags ohne Nachlauf (`input motionevent`) für Screenshots an gleicher Position |
