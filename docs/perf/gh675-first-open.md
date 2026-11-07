# GH-675 – Erstes Öffnen ohne Ruckler (Exercises, Dashboard, Video-Detail, Metrics-Wochenwechsel)

Folge-Ticket aus PERF-004 (Problem Nr. 5). Gemessen am 03.11.2026 auf dem CI-Emulator, **Release-Build vor und nach der Änderung**,
gleicher Datenbestand. Die Abnahme der Zielwerte am echten Gerät R5CN30HWZFN steht aus (macht der Owner). Alle Werte unten sind
Emulator-Werte. Sie sind **kein** Nachweis der Zielwerte am Gerät.

## 1. Ergebnis in Kürze

| Punkt | Änderung | Emulator vorher → nachher (Median) | Stand |
|---|---|---|---|
| Exercises-Tab öffnen | Zeilen werden gestaffelt gemountet (erster Bildschirm sofort, dann 6 Zeilen je Frame) | längster UI-Frame **142 → 47–65 ms**, beschäftigt 233 → 168–178 ms | umgesetzt |
| Metrics: Woche wechseln (Wischen) | Panes ohne neue Woche rendern nicht neu; Workout-Filter je Hook gecacht | beschäftigt je Wisch **264,5 → 112,5 ms** (−57 %), JS 194 → 81 ms | umgesetzt |
| Dashboard öffnen | – (Selektoren schlanker, Wirkung im Rauschen) | 154/162 → 146 ms, längster UI-Frame 45–46 → 48 ms | **offen**, siehe 5.3 |
| Video-Analyse-Detail öffnen | – (zwei Versuche verworfen) | 282–291 → 280 ms (Code unverändert) | **offen**, siehe 5.4 |

Sichtbar ändert sich nichts. Die Vorher/Nachher-Screenshots aller vier Screens sind pixelgleich (ffmpeg-Differenz unterhalb der Statusleiste: max 0).
Ausnahme ist der Video-Detail-Screen in einer mittleren Scroll-Position. Dort weicht nur die Scroll-Position der Zieh-Geste ab; der Code des Screens ist unverändert.

## 2. Messaufbau

| | |
|---|---|
| Gerät | CI-Emulator `emulator-5554`, Android 14 (API 34), x86_64, 2 vCPU, 1080×2400, Software-GPU des Emulators |
| Build | `tool.sh rebuild-release` (assembleRelease x86_64, Hermes, kein Metro, nicht debuggable – `pkgFlags=[ HAS_CODE ALLOW_CLEAR_USER_DATA ]`, Bundle-Magic `c61fbc03c103191f`). **Vorher** = Job-Start-master `99b9319`, **nachher** = `dd68a1a`. Welcher Build installiert war, prüft `raw-gh675/tools/verify-build.sh` an einem Eigenschaftsnamen im Hermes-Bundle. Beide APKs wurden für Gegenproben im selben Lauf per `install -r` getauscht (Daten bleiben). |
| Daten | `baseline.gains` per `tool.sh import-baseline` (inhaltsgleich mit dem PERF-004-Gerätebestand: 82 Übungen, letztes Training 28.02.26). Dazu **eine** echte Videoanalyse: `squat-3reps.mp4` (10 s, 298 Bahnpunkte) über den Import-Dialog analysiert (`.agent-run/flows/video_import_only.yaml`, gekürzte Kopie von `video_import_playback.yaml`). Die Baseline-Analyse #1 hat keine Ergebnisdatei und zeigt deshalb keinen Player. |
| Gesten | wie PERF-004 (`raw-2026-11/tools/scenarios.sh`), Koordinaten per uiautomator auf 1080×2400 gemessen. **Öffnen** (`open_ex`, `open_dash`, `open_vdetail`): Kaltstart, ungetracte Vorbereitung, dann ein Tap; je Serie 5–8 Durchläufe. **Metrics** (`scn5c`): Bankdrücken, Woche 16.–22.02.26 per Datumsdialog, 10× zurück + 10× vor, 2 s Abstand; 2 Läufe = 40 Wischer. **Kontrolle Exercises scrollen** (`scn4a`): 8 Flings runter, 8 hoch. |
| Auswertung | atrace (sched view gfx input am wm res) auf dem Gerät, Analyse mit awk auf dem Gerät (kein Python/trace_processor im CI-Job). `settle_ms`/`js_busy_ms`/`views` mit `raw-gh672/tools/gestures.awk` (= PERF-004-Definition „beschäftigt“). Frames mit `raw-gh675/tools/frames.awk` (siehe unten). |

**Frames auf dem Emulator.** Die PERF-004-Kennzahl „längster Frame“ (SurfaceFlinger-Frame-Timeline) lässt sich auf diesem Emulator nicht sinnvoll messen.
Die GPU wird auf der Host-CPU emuliert. Beim ersten Zeichnen eines Screens kompiliert der RenderThread Shader (`glCreateProgram`) für 100–500 ms, z. B. 490 ms beim Dashboard.
Das passiert vorher wie nachher und hat mit der App nichts zu tun. Deshalb zusätzlich:

* `max_ui_ms`: längster **UI-Thread-Anteil** eines Frames = `Choreographer#doFrame` minus `postAndWait` (Warten auf den RenderThread).
  Das ist die Arbeit der App selbst: Views mounten, Text messen, `View#draw` aufzeichnen.
* Nur Frames bis 1,5 s nach dem Tap. In allen Kaltstart-Serien folgt bei ~1,7–2,1 s ein Block langer Frames ohne JS-Arbeit.
  Er tritt vorher wie nachher und auf allen Screens auf und hat nichts mit dem Öffnen zu tun.
* Auf 2 vCPU teilen sich JS-Thread, UI-Thread und emulierte GPU die CPU. Einzelne UI-Slices springen deshalb gelegentlich auf 50 ms,
  z. B. ein einzelnes `createViewUnsafe(RCTText)`. Darum Median über mehrere Läufe.

## 3. Ergebnisse (Emulator, Release; Median [min–max])

Rohwerte: `raw-gh675/runs/<serie>/` (`gestures.tsv`, `frames.tsv`/`frames-win.tsv`, `heavy.txt`, `mounts.txt`, `gfxinfo-summary.txt`),
Zusammenfassung `raw-gh675/runs/summary.txt`. „vorher“ = zwei Serien desselben Laufs (Anfang `before-*`, Gegenprobe gegen Ende `B2-*`).

### 3.1 Exercises-Tab öffnen

| Kennzahl | vorher `before-ex` / `B2-ex` | nachher `Z-ex` / `F-ex` | PERF-004 Gerät (vorher) | Ziel Gerät |
|---|---|---|---|---|
| längster UI-Frame (`max_ui_ms`) | 142 [131–157] / 144 [137–176] | **64,8** [46–94] / **47,3** [46,5–47,4] | 1 Frame 261 ms | kein Frame > 50 ms |
| UI-Frames > 50 ms | 1 / 1 | 1 [0–2] / 0 | | |
| beschäftigt (`settle_ms`) | 233 [229–262] / 233 [223–248] | **178** [89–187] / **168** [149–199] | 229 ms | |
| JS gesamt im Fenster (`js_busy_ms`) | 224 / 221 | 389 / 369 | | |
| neue Views | 758 | 758 | 758 | |
| Scrollen danach (`scn4a`, erste Flings) | JS 95 / 52 ms, beschäftigt 42 / 51 ms, UI-Frame ≤ 32 ms | JS 100 / 47 ms, beschäftigt 0 / 0 ms, UI-Frame ≤ 29 ms | flüssig | unverändert |

* **Wo die Zeit blieb:** Der Tab hat alle 82 Zeilen auf einmal gebaut (758 Views). Der eine lange Frame bestand vorher aus dem Mount
  (`INSERT` 760, `UPDATE_STATE` 346 = Textlayout 44 ms, `UPDATE_LAYOUT` 765 = 30 ms) und dem Aufzeichnen der Views (`View#draw` 44 ms).
* **Nachher:** Der erste Commit enthält Suchfeld, Chips und die ersten 12 Zeilen (≈ ein Bildschirm, `INSERT` 157). Danach kommen 6 Zeilen je Frame
  (`ProgressiveMount`/`useProgressiveLimit` aus PERF-003). Sobald alles gemountet ist, ist die Liste dieselbe `ScrollView` wie vorher.
* Die JS-Summe steigt, weil jeder der 13 Teil-Commits Layout/Diff für die bereits gemounteten Zeilen rechnet. Diese Arbeit liegt verteilt zwischen den Frames.
  „Beschäftigt“ (Ende der Burst-Kette) sinkt trotzdem.
* **Verworfen: FlashList.** Erste Version mit `FlashList`: Öffnen 223 Views, JS 155 ms, längster UI-Frame 103 → mit `initialDrawBatchSize` 12 82 ms.
  Dafür baute jedes Scrollen durch die Liste Zeilen neu, weil die Sparkline und zwei Selektoren je Zeile beim Recycling neu laufen.
  Ergebnis beim ersten Fling: **JS 412 ms, 1,2 s beschäftigt, UI-Frames bis 56 ms** (vorher 95 ms / 42 ms / 13 ms). Das ist eine Verschlechterung beim Scrollen.
  Serien `after-ex`, `exp-ex-batch12`, `after-4a`.

### 3.2 Metrics: Woche wechseln

| Kennzahl | vorher (`before-5c-r1+r2`, n = 40) | nachher (`Z-5c-r1+r2`, n = 40) | PERF-004 Gerät | Ziel Gerät |
|---|---|---|---|---|
| beschäftigt je Wisch | 264,5 [105–418] | **112,5** [0–183] | 167 [83–297] | ≤ 90 ms |
| JS je Wisch | 194 [84–322] | **81** [44–106] | | |
| längster UI-Frame | 8–9 ms (Median), max 56 | 10–15 ms, max 50 | 0 Frames > 33 ms | |

Ein Kontroll-Build mit derselben Metrics-Änderung (`after-5c`, `F-5c`, n = 80) ergab 115,5 [62–222] ms.
Wie in PERF-004 ist die Verteilung vorher zweigeteilt (Wochen mit Bankdrücken-Sätzen 274–418 ms, leere 105–167 ms).
Nachher liegen auch die vollen Wochen unter 210 ms. In PERF-004 war das Gerät beim Wischen ~1,6× schneller als dieser Emulator
(167 vs. 264,5 ms vorher). Gerät nachher grob ≈ 70 ms, das ist eine Schätzung und keine Messung.

* **Wo die Zeit blieb:** Jeder Wisch rendert in `RangeSwiper` alle drei Panes neu, weil jede Pane ein neues `Range`-Objekt bekommt,
  auch wenn ihre Woche gleich bleibt. Jede `MetricsNode` ruft `useWorkoutsIn` dreimal auf (Woche, Vorwoche, Banner) und
  `useLastWorkoutDateForExercises` einmal (Banner seit GH-458). `useWorkoutsIn` war ein **gemeinsamer** `createSelector` mit dem `Range`-Objekt als Schlüssel.
  Neun Aufrufe mit wechselnden Objekten je Render haben deshalb jedes Mal alle 2 883 Workouts gefiltert, mit drei `Date`-Parses je Workout.
  Der Banner-Selektor lief zusätzlich bei jedem Render über alle Workouts. Der Banner ist der in PERF-004 vermutete Teil der Verdopplung.
* **Änderung:**
  * `MetricsNode` ist mit `memo` umhüllt und vergleicht den Zeitraum nach Wert. Nach einem Wisch rendert nur die eine Pane neu, die eine neue Woche bekommt.
    `RangeSwiper.setRange` ist dafür stabil (funktionales Update, `determineValueByIndex` über eine Ref). Eine Pane, die nicht neu rendert, ruft so nie einen veralteten Callback.
  * `useWorkoutsIn` und `useLastWorkoutDateForExercises` haben je Hook-Instanz einen Selektor (`lruMemoize`), Schlüssel sind die Werte (Start/Ende in ms bzw. die Id-Liste).
  * Gleiches Verhalten: Banner-Aktion („Show up to Mon, 23/02/26“ → `setRange`), danach einmal zurück und zweimal vor gewischt,
    ergibt vorher/nachher **pixelgleiche** Screenshots (`raw-gh675/tools/metrics-banner.sh`).

### 3.3 Dashboard öffnen

| Kennzahl | vorher `before-dash` / `B2-dash` | nachher `Z-dash` | PERF-004 Gerät |
|---|---|---|---|
| beschäftigt | 154 [141–182] / 162 [136–223] | 146 [130–161] | 155 ms |
| JS | 135 / 134 | 131 | |
| längster UI-Frame | 46,4 [45–49] / 44,9 [43–54] | 48,1 [41–51] | 1 Frame 85 ms |
| Views | 159 | 159 | 159 |

* Der lange Frame ist der Mount aller 159 Views in einem Commit: `INSERT` 161, `UPDATE_STATE` 59, `UPDATE_LAYOUT` 166, ~46 ms UI-Thread.
  Danach kommt der Shader-Compile des Emulators (~480 ms `postAndWait`). Die JS-Arbeit ist klein.
* Der Dashboard nutzt die beschleunigten Selektoren mit: `useWorkoutsIn` je Instanz, `findLastWorkoutDateByMuscle` in einem Durchlauf statt einem je Muskel.
  Die Wirkung beim Öffnen liegt im Rauschen.
* **Verworfen: gestaffelter Mount.** Getestet wurde (a) die Übungskarten eine Stufe später. Die rendern mit diesem Datenbestand fast nichts, der erste Frame bleibt gleich.
  Getestet wurde (b) zusätzlich das Muskel-Radar. Ergebnis: beschäftigt **154 → 272 ms**, längster UI-Frame 46 → 53 ms (`exp-dash-stage`).
  Der zweite Commit landet auf dem Shader-Compile des RenderThreads und konkurriert um die 2 CPUs.

### 3.4 Video-Analyse-Detail öffnen

| Kennzahl | vorher `before-vdetail` / `B2-vdetail` | nachher `Z-vdetail` (Code unverändert) | PERF-004 Gerät |
|---|---|---|---|
| beschäftigt | 291 [265–536] / 282 [263–345] | 280 [252–360] | 601 ms [566–807] |
| JS | 238 / 205 | 226,5 | |
| längster UI-Frame | 65 / 72 | 66 | 2 Frames > 33 ms, max 70–74 ms |

**Wo die Zeit bleibt.** Gemessen mit einem nicht committeten Mess-Build (`performance.now()` → logcat), dazu die UI-Thread-Slices:
1. erster Render ohne Ergebnis 34–43 ms JS
2. Ergebnisdatei lesen ~53 ms (asynchron)
3. Mount der Overlay-Karte: Player, Steuerung, Geschwindigkeits-Chart, Rep-Tabelle, ~100 Views, ein Commit ~95–99 ms JS
4. Auf dem UI-Thread: `createViewUnsafe(VideoAnalysisPlayerView)` **47 ms**. Der Konstruktor baut den `ExoPlayer` (media3) auf dem Main-Thread, im frischen Prozess inkl. Klassenladen.
   Der Mount-Frame der Karte braucht 65–80 ms UI.
5. Nachdem der Player seine Länge meldet, ändert sich `xAxis.axisMaximum` des Charts (vom letzten Bahnpunkt 9 933 ms auf 10 000 ms).
   `react-native-charts-wrapper` ruft bei **jeder** Prop-Änderung `notifyDataSetChanged()` + Neuzeichnen auf.
   In 2 von 13 Vorher-Läufen kostete das einen Frame mit 62–71 ms `UPDATE_PROPS` und einen mit 65–88 ms `View#draw` (`heavy.txt`).
   Auf dem Gerät mit 75-s-Videos (~2 250 statt 298 Punkte) ist dieses Neuzeichnen deutlich teurer.

**Verworfen (sichtbare Änderung bzw. nicht besser):**
* **Achse von Anfang an auf die beim Import gespeicherte Videolänge** (`videoMeta.durationMs` = Player-Länge, beide 10 000 ms):
  Das zusätzliche Chart-Update fiel weg, 0 von 16 Läufen. Aber MPAndroidChart legt seinen Plotbereich nur bei einem `notifyDataSetChanged()` nach dem Layout richtig an.
  Ohne das zweite Update lag der Plot **~20 px zu tief**, gemessen an den konfigurierten Offsets 8 dp oben / 22 dp unten.
  Das ist eine sichtbare Änderung, deshalb zurückgenommen (Commit `dd68a1a`).
* **Rep-Tabelle/Metriken unter dem Scrubber und Rep-Chart-Karte eine Stufe später** (unsichtbar beim Öffnen):
  beschäftigt 291 → 325 ms, längster UI-Frame 65 → 92 ms (`after-vdetail`). Der zweite Commit trifft wieder auf den Shader-Compile.

## 4. Gleiches Aussehen und Verhalten

* Screenshots in festen Zuständen, Release vorher/nachher: Exercises, Dashboard, Metrics (Woche 16.–22.02.26 nach 20 Wischern), Video-Detail oben und unten,
  Metrics nach Banner-Aktion / zurück / 2× vor. Alle **pixelgleich**, ffmpeg-Differenz unterhalb der Statusleiste max 0 (Befehl wie in
  `raw-gh675/tools/pixdiff.sh`, im CI-Job je Screen einzeln ausgeführt). Video-Detail in mittlerer Scroll-Position: Die Zieh-Geste endete 50 px
  weiter unten. Der Chart-Inhalt ist relativ zur Karte gleich, und der Code des Screens ist zum Endstand unverändert.
* Maestro auf dem Endstand-Release: `exercises_list_detail.yaml` (neu: Teil 0 scrollt die ungefilterte Liste bis „Walking lunges“ (id 70) unter id 58 → alle Zeilen kommen an, in Reihenfolge),
  `analyse_dashboard_drilldown.yaml` (Dashboard, Banner, Radar → Metrics, Wisch) und `smoke.yaml`: grün.
* Jest: alle 242 Suites / 2 589 Tests grün. Neu: `useWorkoutsIn.spec.ts` (Cache je Instanz/Wert), Gleichheitstest
  `findLastWorkoutDateByMuscle` gegen `findLastWorkoutDateForMuscle`, `ExerciseTabRows.spec.tsx` (Stufen: 12 → 18 → … → alle, Reihenfolge).

## 5. Bewertung und offene Punkte

### 5.1 Exercises
Der lange Frame ist am Emulator von 142 auf 47–65 ms UI-Thread gefallen. Auf dem Gerät bestand der 261-ms-Frame aus demselben Mount aller 758 Views.
Der erste Commit hat jetzt ~1/5 davon. Ob am Gerät jeder Frame unter 50 ms bleibt, zeigt erst die Abnahme.
Stellschrauben, falls nicht: `FIRST_ROWS` (12) und `ROWS_PER_STAGE` (6) in `ExerciseTab.tsx`.

### 5.2 Metrics
Am Emulator −57 %. Das Ziel ≤ 90 ms am Gerät ist wahrscheinlich, aber nicht gemessen.

### 5.3 Dashboard (Ziel nicht erreicht)
Am Emulator liegt der längste UI-Frame schon vorher bei ~46 ms. Am Gerät waren es 85 ms für denselben Commit mit 159 Views.
Kleiner wird er nur, wenn sichtbare Teile (z. B. das Radar) einen Frame später erscheinen. Das war hier messbar schlechter, siehe 3.3.
Am Gerät mit echter GPU kann das anders aussehen. Vorschlag: am Gerät dieselbe Staffelung (Radar + Übungskarten `Stage at={1}`) messen. Hier nicht umgesetzt.

### 5.4 Video-Detail (Ziel nicht erreicht)
Ohne sichtbare Änderung bzw. ohne nativen Umbau war hier nichts zu holen. Vorschläge für ein Folge-Ticket:
* `ExoPlayer` nicht im View-Konstruktor bauen. Den Player einmal je Prozess anlegen und wiederverwenden oder vorwärmen: 47 ms UI-Thread am Emulator.
* Das Chart-Update nach dem Laden ist nötig, damit MPAndroidChart richtig layoutet. Statt Achse und Neuzeichnen getrennt:
  das Chart erst nach dem `onLoad` des Players mounten (kurz leere Chart-Fläche, also eine sichtbare Änderung beim Öffnen; braucht eine Entscheidung).
  Oder im nativen Wrapper ein Update ohne zweites `notifyDataSetChanged` machen.
* Am Gerät mit einem langen Video messen. Die 298 Punkte des Test-Clips unterschätzen die Chart-Kosten.

## 6. Werkzeuge

`raw-gh675/tools/`, laufen **auf dem Gerät** (`adb push` nach `/data/local/tmp`, `adb shell sh …`). Die Analyse der atrace-Dumps läuft mit awk auf dem Gerät.
Übersicht: `raw-gh675/tools/README.md`.
