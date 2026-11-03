# GH-674 – Speicher nach der Tab-Runde / Sprung beim Öffnen von Settings (Emulator-Messung)

Folge-Ticket aus PERF-004 (Problem 4). **Gemessen auf dem CI-Emulator, nicht am Testgerät.** Die Abnahme-Werte am echten
Gerät R5CN30HWZFN (Ziel: PSS nach der Runde ≤ 450 MB) sind noch vom Owner zu messen. #672 (Recycling der Historie) ist
**nicht** enthalten; gemessen wurde master `b77b2f6` (vorher) und derselbe Stand + GH-674 (nachher).

## 1. Messaufbau

| | |
|---|---|
| Gerät | CI-Emulator `emulator-5554`, x86_64, Android userdebug, 1080×2400 @ 420 dpi (= 411 dp breit, wie die 720×1600-Override des SM-G986B), Status-Bar-Geometrie per `tool.sh display-geometry` |
| Build | beide Male `tool.sh rebuild-release` (Hermes, kein Metro, nicht debuggable, Debug-Key, `install -r` behält die Daten). Vorher = Job-Start-master, nachher = Commit `f676868`; die APKs liegen nur im Run-Verzeichnis |
| Datenbestand | `__tests__/e2e/maestro/fixtures/baseline.gains` über `tool.sh import-baseline`. Gleiche Trainingsbasis wie der Gerätebestand aus PERF-004 (364 abgeschlossene + 17 geplante Trainings, Next Training „Push pull › Meso 1 › M6 Push squat“, Micro 4 = 16/02/26), aber ohne Videoanalysen und Chat-Verlauf |
| Gesten | PERF-004 `scn8.sh` (`round()` / `steps`), Koordinaten ×1,5 bzw. für Drawer-Toggle und Drawer-Zeilen neu per `uiautomator dump` vermessen (Toggle 68,220; Dashboard 406, Analysis 547, History 973, Metrics 1114; Tabs y = 2232) |
| Abweichung | Die Skripte aus `raw-2026-11/tools/` konnten in dieser Umgebung nicht direkt laufen (Shell-Skripte/Python nicht freigegeben); dieselben `adb shell input`-Folgen und Pausen wurden als einzelne Befehlsketten ausgeführt. Rohdaten: `raw-gh674/` |

Absolutwerte des Emulators sind nicht mit dem Gerät vergleichbar (x86_64, kein GPU-Speicher in `meminfo`, ~25 % weniger PSS); verglichen werden nur vorher/nachher auf demselben Emulator.

## 2. Was beim Öffnen von Settings passiert (Erklärung des Sprungs)

**Schrittweise Messung** (`raw-gh674/before-steps`, `after-steps`, PSS MB):

| Schritt | vorher | nachher |
|---|---|---|
| Start | 198,7 | 199,5 |
| Plan Next Training / Micro 4 | 283,7 / 301,3 | 284,9 / 302,5 |
| Exercises | 324,7 | 329,9 |
| Dashboard / History / 5 Flings | 340,4 / 354,2 / 393,7 | 342,2 / 353,8 / 400,7 |
| Analysis / Metrics / Dashboard | 380,5 / 397,7 / 391,3 | 384,9 / 402,9 / 395,3 |
| **Settings** | **482,8 (+91,5)** | **416,2 (+20,9)** |
| Training | 438,0 | 408,3 |

**`meminfo -d` vorher/nachher (Dashboard → Settings, Vorher-Build, `before-steps/11`, `/12`):** Native Heap *Alloc* (lebende
Allokationen) nur +15 MB (262,7 → 277,5), aber Heap *Size* +124 MB und Heap *Free* 28 → 137 MB. Der Sprung ist also eine
**kurze Spitze von ~110 MB kleiner nativer Allokationen**, die wieder freigegeben werden; der Allocator (scudo) behält die
Seiten, PSS zählt sie mit. `showmap` (root, `raw-gh674/showmap-*.txt`, aufgenommen mit dem GH-674-Stand plus Dispatch-Logs, Sprung +79,8 MB) bestätigt: der Zuwachs liegt komplett in
`[anon:scudo:primary]` (119 → 185 MB, kleine Größenklassen), `scudo:secondary` (große Blöcke) bleibt gleich; `Other mmap`
+1,7 MB ist das MMKV-Rewrite des persistierten Stores. Kein Zuwachs im Hermes-Heap (`Unknown`).

**Ursache 1 (gefunden, behoben): App-weites Re-Render bei jeder Settings-Änderung.**
`App.tsx` abonnierte den ganzen `settings`-Slice und baute bei jedem Render mit `buildThemes()` ein neues Theme-Objekt für
`PaperProvider` und `NavigationContainer`. Settings speichert beim Öffnen immer `SET_EXACT_ALARM_PERMISSION` – auch wenn sich
nichts ändert, der Reducer lieferte trotzdem ein neues Objekt. Folge: neues Theme → alle gemounteten Screens mit `useTheme`
rendern neu. Beleg (temporärer Release-Build mit Render-Logs, logcat `ReactNativeJS`): mit altem Code rendern beim Öffnen von
Settings direkt nach `SET_EXACT_ALARM_PERMISSION` `TrainingsPlanTab`, drei `TrainingsPlanNode` (Micro 4/5/6) und `ExerciseTab`
im Hintergrund neu; mit GH-674 rendert kein anderer Screen mehr. Dasselbe passierte bei **jeder** Settings-Änderung, z. B.
beim Rest-Timer jedes geloggten Satzes (`settings.restTimer`) – während eines Trainings also bei jedem Satz.

**Ursache 2 (eingegrenzt, nicht behoben): native Spitze beim ersten Settings-Mount nach der Runde.**
Auch ohne jedes Re-Render anderer Screens tritt die Spitze weiterhin auf (nachher 5 von 7 Durchläufen, s. u.). Eingegrenzt:
* nicht beim Verlassen des Analyse-Tabs: Dashboard → Training +3 MB, danach Training → Settings +75 MB;
* nicht durch Redux: alle Dispatches beim Öffnen inkl. Selektoren 1–103 ms, JS-Thread maximal ~0,4 s am Stück blockiert;
* `simpleperf` (root, Aufnahme während des Sprungs): JS-Thread ~85 % der 8 s in `libhermesvm`/`libreactnative`, 19 % in
  `fmod` (Yoga rundet Layouts mit `fmod` aufs Pixelraster) – also Layout/Shadow-Tree-Arbeit von React Native, keine App-Logik.
* Halbierungen des Settings-Screens (temporäre Builds) waren nicht eindeutig: Bei ~75 % Trefferquote sind drei „kein Sprung“
  aus sechs Einzelläufen noch mit Zufall vereinbar (~13 %); selbst ein leerer Platzhalter in der Höhe des Data-Abschnitts sprang.
Nächster Schritt: Native-Heap-Profil (heapprofd/`am dumpheap -n` mit Symbolen der RN-Bibliotheken) am Gerät oder ein
Profiling-Build mit Hermes-Sampling-Profiler, um zu sehen, welcher Fabric-/Yoga-Pfad die Spitze erzeugt.

## 3. Ergebnisse vorher/nachher

**Settings-Sprung, pausierte Runde (Steps-Protokoll mit ~4 s Pause je Schritt), Dashboard → Settings, PSS-Zuwachs:**

| | n | Median | min–max | Läufe |
|---|---|---|---|---|
| vorher | 5 | **+88,2 MB** | +77,0 – +116,6 | +79,4 / +92,0 / +77,0 / +88,2 / +116,6 (`before-settings/r1–r5`) |
| nachher (gleicher App-Code) | 7 | **+75,1 MB** | +14,6 – +85,5 | +20,9 (`after-steps`) / +14,6 (`after-settings/r1`) / +85,5 (`r2`) / +80,6 (`sp`, mit simpleperf) / +69,6, +79,8, +75,1 (temporäre Builds mit Dispatch-/Render-Logs, App-Code sonst identisch; Werte aus der Konsole, keine Dateien) |

PSS am Ende der pausierten Runde (Training): vorher Median 449,0 MB [432,9–463,0], nachher 408,3 / 408,6 / 465,8 MB.

**PERF-004-Protokoll (`scn8.sh runs`, Runde ohne Pausen, 5 Durchläufe):**

| | vorher | nachher |
|---|---|---|
| PSS nach Kaltstart | 199,7 MB [199,2–200,0] | 199,8 MB [199,6–203,4] |
| PSS nach einer Runde durch alle Tabs | 495,7 MB [474,6–508,0] | 503,1 MB [427,5–507,6] |

In diesem Protokoll ist **kein Unterschied messbar**: Ohne Pausen bleiben bis zum Messzeitpunkt ~80 MB mehr *lebende*
native Allokationen übrig (Native Heap Alloc ~355 MB statt ~272 MB nach der pausierten Runde; vorher-Lauf 1 und nachher-Lauf 3
sind die Ausnahmen) – alte Shadow-Tree-Revisionen, die erst freigegeben werden, wenn Hermes die JS-Objekte einsammelt, die sie
referenzieren. Das überdeckt den Settings-Effekt. Das Ziel ≤ 450 MB wird auf dem Emulator in diesem Protokoll nicht erreicht.

**Zurück auf bereits besuchte Tabs** (nach der Runde: Exercises → Analysis → Settings → Training, `dumpsys gfxinfo`, je 5 Läufe):

| | Frames gesamt | Frames > 50 ms (Median, min–max) | längster Frame (Median) |
|---|---|---|---|
| vorher | 22–24 | 18 (16–19) | 125 ms |
| nachher | 23–24 | 17 (16–18) | 113 ms |

Der Emulator rendert in Software (fast alle Frames > 50 ms); relevant ist nur: nachher nicht mehr Frames > 50 ms als vorher.

## 4. Akzeptanzkriterien – Stand

| Kriterium | Stand |
|---|---|
| Sprung bei Settings erklärt und beseitigt | **teilweise**: Mechanismus belegt (kurze Spitze kleiner nativer Allokationen, scudo behält die Seiten); Ursache 1 (App-weites Re-Render) behoben; Ursache 2 (native Layout-/Fabric-Spitze beim ersten Settings-Mount) eingegrenzt, nicht behoben – tritt nachher noch in 5/7 Läufen auf |
| PSS nach der Runde ≤ 450 MB am Gerät, Start nicht höher | Start unverändert (199,7 → 199,8 MB). Runde: auf dem Emulator kein messbarer Unterschied (495,7 → 503,1 MB); **Gerätemessung durch den Owner offen**, Ziel nach diesen Daten nicht zu erwarten |
| Zurückwechseln bleibt flüssig | erfüllt auf dem Emulator (Frames > 50 ms 18 → 17) |
| Laufendes Training + Pausentimer überleben den Tab-Wechsel | erfüllt: `train_rest_timer_1rm.yaml` Abschnitt 7 + Screenshots |
