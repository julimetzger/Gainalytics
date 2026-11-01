# GH-671 – Satz speichern im laufenden Training (Folge aus PERF-004, Problem Nr. 1)

Gemessen am 01.11.2026 auf dem **CI-Emulator** (Android 14 x86_64, 1080×2400, Geometrie von `tool.sh display-geometry`),
**Release-Build** (Hermes, kein Metro, nicht debuggable, Debug-Key) vor und nach der Änderung, jeweils mit dem
importierten Baseline-Datenbestand. Der Baseline-Export ist inhaltsgleich mit dem PERF-004-Gerätebestand
(`workouts`-Slice 1 349 615 Zeichen wie in PERF-004 Szenario 9, 2 883 Workouts / 5 707 in `byId`, Plan „Push pull“,
leerer Slot Meso 1 · M6 · D1).

**Die Abnahme-Werte am echten Gerät R5CN30HWZFN stehen noch aus und müssen vom Owner gemessen werden** (Werkzeuge siehe unten;
die Emulator-Werte sind nicht 1:1 übertragbar).

## 1. Messaufbau (wie PERF-004 Szenario 2)

* Mess-Training wie PERF-004: leerer Slot „Push pull › Meso 1 › Micro 6 › Push squat“ mit **einer** Übung (Bankdrücken, 0 geplante
  Sätze) geplant und gestartet, Eingabezeile 5 Wdh. / RIR 0 / 20 kg (weit unter PR 150 kg → kein Rekord)
  → `raw-gh671/tools/gh671_prep_set_add.yaml`.
* Interaktion wie `scn2save` (PERF-004): 10 s Leerlauf, dann **12 × „Add“ im Abstand von 4 s** (Satz 1 … 12), danach
  Training wieder gelöscht (`gh671_cleanup.yaml`), App per Kaltstart neu gestartet, nächster Durchlauf.
* Trace: `atrace` (sched + view gfx input am wm res, App-Marker) auf dem Gerät statt Perfetto/`trace_processor` (im CI-Job nicht
  verfügbar, siehe GH-672), Auswertung mit `gestures.awk` = Definitionen aus `gestures.py` (PERF-004):
  * `settle_ms` – Fingerabheben bis Ende der durch den Tap ausgelösten JS-Arbeit (Bursts ≥ 10 ms, Lücke < 150 ms) = **Zeit, in der die App
    nach „Add“ blockiert ist** (PERF-004: 549 ms am Gerät).
  * `js_busy_ms` – gesamte JS-Laufzeit bis zum nächsten Tap (4-s-Fenster inkl. Sekundentakt von Trainings- und Pausentimer).
* Vorher: 3 Durchläufe mit dem Release-Build von master `df47048` (Job-Start), nachher: 4 Durchläufe mit dem Release-Build der Änderung.
  Release-Nachweis jedes installierten Builds: `pkgFlags=[ HAS_CODE ALLOW_CLEAR_USER_DATA ]`, Hermes-Magic `c61fbc03c103191f`
  (`raw-gh671/tools/verify-release.sh`).

## 2. Wohin geht die Zeit nach „Add“? (vorher)

Zusätzlich zwei Release-Builds mit einer temporären Zeitmessung im JS (`raw-gh671/tools/perfProbe.ts.txt`: Spannen um Reducer,
Store-Benachrichtigung (= alle `useSelector`), Render-Marken je Komponente, Commit (`useLayoutEffect`), Persistenz).
Werte vom Emulator, Zeit ab Beginn des `onPress`-Handlers, 12 Sätze (`probe-r1`):

| Abschnitt | vorher | Anteil | Ursache |
|---|---|---|---|
| Handler: `START_REST_TIMER` + `ADD_OR_UPDATE_SET_IN_WORKOUT`, je ~8–10 ms Selektoren | 14–26 ms | ~7 % | zwei Dispatches, jeder läuft durch alle Selektoren |
| Render + Commit bis `useLayoutEffect` | 75 ms (Satz 2) → 140 ms (Satz 12) | ~40 % | **jeder** geloggte Satz rendert bei jedem „Add“ neu (je ~3,7 ms) – das ist das Wachstum pro Satz |
| redux-persist: `workouts` serialisieren (1,35 MB) | 24–113 ms | | ganzer Slice bei jeder Änderung |
| redux-persist: Root-Wert doppelt kodieren (1,74 MB) | 13–55 ms | | `JSON.stringify` der Slice-Strings |
| MMKV `set` des 1,74-MB-Werts | 8–47 ms | | |
| **Persistenz gesamt** | **60–150 ms** | ~40 % | |
| Ende der Arbeit nach dem Tap | **207–339 ms** | | dazu Event-Zustellung / Mount auf dem JS-Thread → `settle` 227–455 ms |

**Warum rendert alles neu?** Der laufende Pausentimer steht in `settings.restTimer.active`. Jedes „Add“ startet ihn
(`START_REST_TIMER`) und ersetzt damit das ganze `settings`-Objekt. Daran hingen:

1. `App.tsx` (`useSettings()` für die Palette) → die App-Wurzel rendert, `buildThemes()` baut **neue** Theme-Objekte →
   `PaperProvider`/`NavigationContainer` bekommen ein neues Theme → **jede** Komponente mit `useTheme()` rendert neu, auch
   jede Satzzeile (`AddWorkoutSet`). Dasselbe über `useThemeMode()` (las ebenfalls die ganzen Settings).
2. `AddWorkoutSet` selbst (`useSettings()` für zwei Schalter) – je Satzzeile ein eigenes Abo.
3. `BottomTabs` (`useSettings()` + `useTrainings()`, das bei jedem Dispatch ein neues Array liefert → rendert bei **jeder** Aktion).
4. `TrainingsPlanNode` + `PauseDoneNotification`/`FinishTrainingNotification` (ganze Settings) → auch die Nachbar-Panes
   (Micro 5 / 7) des Swipers rendern bei jedem „Add“.

**Was hat sich seit PERF-001 (0.172) verschlechtert?** Eine Messung von 0.172 war im CI-Job nicht möglich (Checkout mit
Tiefe 1, kein `git fetch` erlaubt) – der Vergleich ist deshalb eine Zuordnung, keine Messung:

* Die **Steigung pro Satz** ist seit PERF-001 gleich (~+8 → ~+11 ms/Satz am Gerät). Sie kommt von den neu rendernden Satzzeilen
  (Ursache 1/2 oben), die es also schon in 0.172 gab.
* Der **Sockel** stieg um ~200 ms am Gerät. Die Probe zeigt heute ~40 % Persistenz und ~60 % Render/Selektoren.
  Seit 0.172 hinzugekommen und im Profil sichtbar:
  * mehr Komponenten auf dem Training-Screen, die bei jedem Theme-Wechsel mitrendern: Exercise-Leiste mit Swipe-Delete und
    Satzzähler (GH-483 `loggedSetCounts`), Header mit Sitzungs-Timer (GH-401), Estimated-1RM-Karte, Pausentimer-Ring;
  * Theme-Aufbau pro Render über `buildThemes()` (GH-478, bei eigener Farbe zusätzlich `buildDynamicSchemes`) statt fester Objekte;
  * MMKV 4 / Nitro (PERF-004 Abschnitt 6): `set` eines 1,74-MB-Strings kostet hier 8–47 ms je Satz;
  * `BottomTabs`/Health-Connect-Middleware (GH-528) laufen bei jeder Aktion mit.
  Wie viel jeder Punkt am Gerät ausmacht, lässt sich ohne 0.172-Build nicht trennen. Nach der Änderung ist er aber
  ohnehin nicht mehr pro „Add“ im Spiel (siehe 3.).

## 3. Änderung

* **Inkrementelle Persistenz** (`app/redux/persist/incremental-storage.ts`, `configureStore.ts`): redux-persist läuft mit
  `serialize: false`; die Storage schreibt **nur, was sich geändert hat**: je Slice ein Teil, `workouts.byId` in Blöcken
  à 100 IDs. Ob ein Workout geändert ist, wird gegen die eigene Liste der zuletzt geschriebenen Objekte geprüft (nicht gegen den
  vorigen Redux-State, den manche Reducer verändern). Ein „Add“ schreibt so den Settings-Teil, die kleinen Workout-Listen und einen
  Block (~20 KB) statt 1,74 MB.
  * **Absturzsicher:** Teile werden copy-on-write unter neuen Schlüsseln geschrieben, danach das Manifest (ein Schlüssel) als
    einziger Commit. Ein Kill vorher lässt das alte Manifest mit dem alten, vollständigen Stand stehen; verwaiste Teile werden beim
    nächsten Start entfernt.
  * **Migration:** ohne Manifest wird der alte Einzelwert `persist:root` wie bisher gelesen. Der erste Schreibvorgang legt alle
    Teile + Manifest an und löscht `persist:root` erst danach.
  * `FINALIZE_WORKOUT` setzte `end` direkt am gespeicherten Workout-Objekt. Jetzt entsteht ein neues Objekt; sonst hätte die
    inkrementelle Storage das Ende nie geschrieben (Test `workoutImmutability.spec.ts`).
* **Kein Neu-Rendern über die Settings:** `useSettingsSelector(select)` für Einzelwerte. `App.tsx` liest nur die Palette und
  baut die Themes per `useMemo` je Palette; `useThemeMode` liest nur `themeMode`/`mode`. `AddWorkoutSet` liest nur seine zwei
  Schalter, `BottomTabs` nur einen Schalter und ein Boolean `selectIsAnyTrainingStarted`. `TrainingsPlanNode` (3 Zeilen,
  Rücksicht auf PR #677) und die beiden Notification-Hooks lesen nur ihre Werte.
* Keine sichtbare Änderung: Training-Screen mit 12 Sätzen vorher/nachher **pixelgleich** unterhalb des Headers
  (ffmpeg-Differenz `YMAX=0`, die Uhr im Header ausgenommen).

**Nachher (Probe-Build `probe-after-r1`, vor dem letzten Schritt für `TrainingsPlanNode`):** Handler 17–37 ms, Render + Commit bis
`useLayoutEffect` meist 52–70 ms (ohne Wachstum, die Satzzeilen rendern nicht mehr), Persistenz **9–24 ms**, Ende der Arbeit
≈ 70–90 ms nach dem Tap (vorher 207–339 ms).

## 4. Ergebnis (Emulator, Release, Median [min–max] über die Durchläufe)

`raw-gh671/gh671-export/agg-before.tsv`, `agg-after.tsv`; je Durchlauf `gestures.tsv`.

| Satz | settle vorher (n=3) | settle nachher (n=4) | js_busy vorher | js_busy nachher |
|---|---|---|---|---|
| 1 | 384 [285–414] | 210 [177–222] | 271 [269–287] | 209 [185–224] |
| 2 | 319 [227–369] | 189 [107–288] | 252 [227–282] | 136 [121–153] |
| 3 | 326 [263–342] | 129 [89–156] | 238 [234–241] | 138 [111–147] |
| 4 | 327 [260–338] | 113 [97–220] | 248 [243–264] | 129 [127–158] |
| 5 | 379 [293–419] | 101 [90–131] | 297 [252–316] | 123 [118–131] |
| 6 | 281 [269–304] | 251 [133–338] | 269 [264–279] | 155 [139–179] |
| 7 | 362 [293–374] | 125 [106–172] | 289 [275–302] | 139 [127–151] |
| 8 | 350 [298–381] | 109 [97–267] | 286 [268–291] | 134 [127–142] |
| 9 | 359 [340–370] | 121 [113–126] | 313 [308–314] | 136 [128–137] |
| 10 | 322 [319–404] | 159 [127–345] | 300 [298–304] | 146 [129–172] |
| 11 | 328 [285–414] | 191 [102–296] | 312 [289–314] | 137 [122–152] |
| 12 | 403 [324–455] | 138 [111–164] | 335 [330–351] | 152 [145–170] |
| **alle 12** | **333 [227–455]** | **129 [89–345]** | **287 [227–351]** | **138 [111–224]** |

* **settle −61 %** (333 → 129 ms), JS-Last im 4-s-Fenster −52 %.
* **Kein Wachstum mehr:** Satz 12 liegt unter Satz 1 (settle 138 vs. 210 ms; js_busy 152 vs. 209 ms). Satz 1 ist teurer, weil er das
  Workout anlegt (`ADD_WORKOUT`, Trainings-Slice ändert sich). Vorher: js_busy 271 → 335 ms (+24 %).
* Einzelne Ausreißer nach oben (z. B. 338/345 ms bei Satz 6/10) haben dieselbe JS-Last wie ihre Nachbarn. Dort fällt ein Tick von
  Trainings-/Pausentimer (~10 ms je Sekunde) in die 150-ms-Kette der `settle`-Definition und verlängert sie. Das passiert vorher wie
  nachher und gehört zur Methode, nicht zur Änderung.
* **Übertrag aufs Gerät (Schätzung, keine Messung):** PERF-004 549 ms am Gerät ↔ 333 ms hier vorher (Faktor ~1,65) ergäbe
  ~210 ms am Gerät. Ob die Zielwerte (≤ 150 ms Median, Satz 12 ≤ +20 % über Satz 1) am R5CN30HWZFN erreicht werden, ist
  **offen** und muss am Gerät gemessen werden. Verbleibende Kosten je „Add“ laut Probe: zwei Store-Benachrichtigungen (je ~9 ms
  Selektoren), Render des sichtbaren Trainings (~30 ms, u. a. `DraggableExercise` ~7 ms) und das Einhängen der neuen Satzzeile
  (27 Views, ~10 ms).

## 5. Datensicherheit

* **Kill direkt nach „Add“** (`raw-gh671/tools/forcestop-after-add.sh`: `input tap` → `am force-stop` = SIGKILL ohne
  Lifecycle → Kaltstart → laufendes Training öffnen):
  * Kill ~0,4 s nach dem Tap: neuer Satz vorhanden („Set 14“ nach 13 Sätzen) → `screenshots/GH-671/safety-01-after-forcestop-0.3s.png`.
  * Kill ~0,28 s nach dem Tap: neuer Satz vorhanden („Set 15“) → `screenshots/GH-671/safety-04-after-forcestop-0.1s.png`.
  * Kill ~0,1 s nach dem Tap: der Satz fehlt. Er war zu diesem Zeitpunkt noch nicht geschrieben. Dieses Fenster gab es vorher auch,
    nur länger: der Schreibvorgang endete vorher 207–339 ms nach dem Tap, jetzt ~70–90 ms (Probe-Builds). Die Datensicherheit ist
    also nicht schlechter, das Fenster ist ~3× kürzer.
* **Neustart:** Nach jedem Messdurchlauf wurde die App kalt gestartet, die Daten waren da (Prep-Flow prüft Plan + Slot). Das Update
  über den alten Bestand (Migration `persist:root` → neues Format) lief auf dem Gerät mit dem Baseline-Bestand
  (`screenshots/GH-671/after-install-migrated.png`). Danach war der read-only-Check aus PERF-004 grün
  (`perf004-readonly-check.yaml`: Plan „Push pull“, Slot „Meso 1 · M6 · D1 · 0 exercises“, Historie „Sat, 28/02/26“ + „Hyperextension“).
  Ein erneuter Voll-Import der Baseline (FULL_IMPORT) lief ebenfalls über das neue Format. Maestro auf dem Release-Build
  nachher: `train_start_log_finish`, `train_rest_timer_1rm`, `train_delete_exercise_running` grün.
* **Jest:** `__tests__/redux/persist/` – Migration vom Altformat, nur geänderte Blöcke werden geschrieben, Kill vor dem Manifest →
  alter vollständiger Stand + Aufräumen, Purge; Neustart-Rundlauf über den echten Store (`configureStore` + alle Reducer) mit dem
  Baseline-Bestand: Sätze, beendetes Workout, Pausentimer nach dem „Neustart“ identisch. Der Rundlauf-Test schlägt mit dem alten
  `FINALIZE_WORKOUT` fehl (`end` fehlt) – geprüft.
* **Downgrade:** Eine ältere App-Version findet nach dem Update kein `persist:root` mehr und startet leer. Die Daten bleiben in
  den neuen Schlüsseln erhalten, und ein erneutes Update liest sie wieder. Downgrades sind nicht vorgesehen; vor einem Downgrade
  ein Export (Settings → Export Data).

## 6. Nebenbefund (nicht geändert)

`ADD_OR_UPDATE_SET_IN_WORKOUT` ohne Index sortiert die vorhandenen Satz-Indizes **lexikografisch** (`.sort()` ohne Vergleichsfunktion):
ab dem 11. Satz eines Workouts bekommt jeder neue Satz den Index **10** (sichtbar an den Zeilen-IDs `add-workout-set-logged-10`
mehrfach; das Label „Set N“ zählt richtig). Folgen: doppelte React-Keys, und eine Korrektur eines dieser Sätze trifft den ersten mit
Index 10. Das ist Verhalten, deshalb hier nicht geändert → eigenes Ticket vorgeschlagen.

## 7. Abnahme am echten Gerät (Owner)

1. Release-Build dieses Branches wie PERF-004 installieren (`install -r`, Daten bleiben; der erste Start migriert `persist:root`).
2. PERF-004 `scn2save` (oder `raw-gh671/tools/scn2save.sh` mit den Gerätekoordinaten des „Add“-Knopfs, Gerät 720×1600-Override:
   632 454) mit ≥ 12 Sätzen, Auswertung `gestures.py`/`bursts.py` wie in PERF-004.
3. Ziel: Median `settle` ≤ 150 ms, Satz 12 ≤ 1,2 × Satz 1.

## 8. Rohdaten und Werkzeuge

* `raw-gh671/gh671-export/` – je Durchlauf `gestures.tsv` (+ `gfxinfo.txt`, `meminfo.txt`, `conditions.txt`, `ids.txt`), Aggregate
  `agg-before.tsv` / `agg-after.tsv`. Die atrace-Dumps (~100 MB je Durchlauf) sind nicht eingecheckt.
* `raw-gh671/tools/` – `gh671_prep_set_add.yaml`, `gh671_cleanup.yaml`, `gh671_open_running.yaml` (Maestro), `scn2save.sh`,
  `gestures.awk` (+ Spalte `block_ms`), `agg.sh`, `export.sh`, `forcestop-after-add.sh`, `verify-release.sh` (alle auf dem Gerät
  per `adb shell sh` ausgeführt), `perfProbe.ts.txt` (die temporäre Zeitmessung).
