# GH-438 / GH-439 — Video-Import und Wiedergabe: Untersuchung

Reine Diagnose. Es wurde nichts am Verhalten der App geändert. Die einzige Ergänzung im
Code sind zwei Maestro-Flows unter `__tests__/e2e/maestro/flows/`, die nur zum Belegen
dienen und nichts an der App verändern.

---

## 1. Methode

| | |
|---|---|
| Gerät | Samsung SM-G986B (Galaxy S20+ 5G), Seriennummer `R5CN30HWZFN`, API 33 |
| Build | Branch `feature/ANA-438-439`, Commit `9b42c898`, Debug-Build `versionName 0.172` |
| JS-Bundle | vom Worktree-Metro (Host-Port 8083, `adb reverse tcp:8081 tcp:8083`) — es lief also genau der Code dieses Commits |
| Store | der **echte Datenbestand des Nutzers** auf dem Gerät (Plan „Push pull upper lower", laufendes Training, vorhandene Analysen). Bewusst **kein** Baseline-Import, weil der die für GH-439 nötigen fertigen Analysen mit echtem Video überschrieben hätte |
| Zeitraum | 05.09.2026, 15:04–16:20 |

### Verwendete Videos

Alle vier wurden so importiert, wie der Nutzer es tut: über „Import Video" und den
System-Dateiauswahldialog aus dem Speicher des Geräts.

| | Datei | Länge | Größe | Auflösung | Herkunft |
|---|---|---|---|---|---|
| A | `squat-3reps.mp4` | 10,0 s | 147 KB | – | Repo-Fixture, nach `/sdcard/Download` gelegt |
| B | `157-6reps@7-18-6-23.mp4` | 71,5 s | 73,6 MB | 1920×1080 | **echtes Video aus der Galerie des Nutzers** |
| C | `ANA438-long-squat-80s.mp4` | 80,0 s | 1,17 MB | – | 8× A aneinandergehängt, nach `/sdcard/DCIM/Camera` gelegt |
| D | `112-4reps@8-0623.mp4` | 46,9 s | 55,5 MB | – | **echtes Video aus der Galerie des Nutzers** |

C wurde gebraucht, weil B im Import scheitert (siehe 2.5) und damit die lange
Analysephase gar nicht erreicht. C hat garantiert dasselbe erste Bild wie A und läuft
deshalb sicher durch — dafür ist es klein. D deckt den realistischen Fall ab: langes,
schweres Video aus der Galerie, das tatsächlich analysiert wird.

### Messverfahren

* **Dauer der Blockade** — nach dem Antippen des Videos im Dateidialog wird aus einer
  zweiten, unabhängigen adb-Verbindung zu bekannten Zeitpunkten **eine echte Eingabe**
  gesendet (Tipp auf „Filters", was das Filterpanel sichtbar auf- bzw. zuklappt).
  Parallel läuft eine Schleife, die etwa alle 0,3 s den Bildschirm abgreift. Aus dem
  ersten Bild, in dem sich das Panel bewegt hat, ergibt sich, wie lange die App auf
  diese Eingabe nicht reagiert hat. Skripte: `checks/probe-import.sh`,
  `checks/probe-import2.sh` im Run-Verzeichnis.
* **Nullmessung** — dieselbe Messung ohne laufenden Import, um zu wissen, was allein das
  Messverfahren an Verzögerung kostet.
* **Flüssigkeit der Oberfläche** — `dumpsys gfxinfo` über eine durchgehende Wischgeste
  während der laufenden Analyse.
* **Verlassen der App** — `probe-minimize.sh` (HOME während der Analyse) und
  `probe-preflight-kill.sh` (HOME unmittelbar nach der Videoauswahl). Beide protokollieren
  fortlaufend, ob der Prozess noch lebt, ob ein Vordergrunddienst läuft und welchen
  `oom_score_adj` der Prozess hat.
* **GH-439** — der angezeigte Geschwindigkeitswert und die Wiederholungsnummer werden
  während **einer** durchgehenden Wiedergabe wiederholt aus dem Bildschirm ausgelesen,
  danach dasselbe nach einem manuellen Einzelbild-Sprung.

Rohdaten: `docs/investigation/logs/ana438-439/`.

---

## 2. GH-438 — „App reagiert nicht beim Video-Import"

### 2.1 Was gemessen wurde

| Lauf | Video | Vorbereitung (nativ) | Vorbereitung (JS) | Import gesamt | Ergebnis |
|---|---|---|---|---|---|
| 1 | A (10 s) | 288 ms | 330 ms | **1221 ms** | Analyse gestartet |
| 2 | B (71,5 s / 73,6 MB) | 386 ms | 396 ms | **1414 ms** | **Fehlgeschlagen — keine Hantelscheibe erkannt** |
| 3 | C (80 s) | 222 ms | 315 ms | **1270 ms** | Analyse gestartet |
| 4 | D (46,9 s / 55,5 MB) | 307 ms | 307 ms | **1315 ms** | Analyse gestartet |

Quelle: `[VideoAnalysisImportMetrics]` aus dem JS und `prepareSquatVideoSeed …
totalPreflightMs` aus dem nativen Modul, jeweils in den `*-logcat-filtered.txt`.

Die Länge des Videos spielt für diese Phase **keine Rolle** — sie liest nur das erste
Bild und sucht darin die Hantelscheibe. 10 s und 80 s kosten dasselbe.

### 2.2 Ab wann und wie lange die App nicht reagiert

Der Zeitpunkt 0 ist immer der Moment, in dem der Nutzer das Video im Dateidialog antippt.

| Messung | Eingabe gesendet bei | Sichtbare Reaktion | Verzögerung |
|---|---|---|---|
| Nullmessung (kein Import) | 1,01 s | 1,34 s | **0,32 s** |
| Lauf 1 (Video A) | 1,01 s | zwischen 1,53 s und 1,79 s | 0,5–0,8 s |
| Lauf 3 (Video C), Eingabe 1 | 1,01 s | 1,88 s | 0,88 s |
| Lauf 3, Eingabe 2 | 7,39 s | 8,36 s | 0,97 s |
| Lauf 3, Eingabe 3 | 13,39 s | 14,19 s | 0,80 s |
| Lauf 3, Eingabe 4 | 19,39 s | 19,98 s | 0,59 s |
| Lauf 3, Eingabe 5 | 25,39 s | 26,41 s | 1,02 s |

Die Eingaben 4 und 5 liegen mitten in der laufenden Analyse. Sie sind nicht langsamer
als die erste.

Dazu die Flüssigkeit der Oberfläche **während** der laufenden Analyse, gemessen über eine
durchgehende Wischgeste (`gfxinfo-during-analysis.txt`):

```
Total frames rendered: 296
Janky frames: 1 (0.34%)
50th percentile: 8ms   90th: 9ms   95th: 11ms   99th: 13ms
Number Missed Vsync: 0
```

**Befund:** Auf diesem Build und diesem Gerät gibt es **keine mehrsekündige Blockade**.
Die eigentliche Vorbereitung dauert 1,2–1,4 s; in dieser Zeit ist der Knopf „Import Video"
ausgegraut und zeigt einen Ladekreis. Die zusätzliche Eingabeverzögerung liegt bei
höchstens einigen Hundert Millisekunden — die Auflösung des Messverfahrens ist ~0,3 s,
mehr lässt sich daraus nicht herauslesen. Während der eigentlichen Analyse (bei Video C
über zwei Minuten) läuft die Oberfläche mit 60 Bildern/s.

Das ist **nicht** das im Ticket beschriebene Bild. Siehe 2.6 „Offen".

### 2.3 Was der Nutzer in dieser Zeit sieht

Belegt durch `screenshots/gh438-import-timeline.png` (Bilder aus Lauf 1, Zeitpunkte
0,0 s / 0,8 s / 1,5 s / 1,8 s / 2,3 s / 5,9 s):

1. **sofort** (< 1 s nach der Auswahl): der Dateidialog schließt sich, in der Liste steht
   bereits ein neuer Eintrag „Unknown Exercise · Today · 15:10 · Unlinked workout",
   Statusabzeichen **„Queued"**, darunter **„Progress 0 %"** und **„0:00 / 0:10 estimated"**.
   Der Knopf „Import Video" ist ausgegraut und zeigt einen Ladekreis.
2. **nach ~1,3 s**: Hinweis „Video analysis started — Analysis is running in the
   background.", der Knopf ist wieder benutzbar, der Fortschritt beginnt zu zählen.
3. **während der Analyse**: der Balken und die Prozentzahl laufen mit, die Zeile zeigt
   „0:06 / 0:10 estimated". Das Statusabzeichen bleibt die ganze Zeit **„Queued"**.
4. **am Ende**: Benachrichtigung „Video analysis complete. Tap to view the results.",
   der Eintrag wird „Done".

Zwei Dinge daran sind aus Nutzersicht trotzdem falsch:

* **Das Abzeichen sagt die ganze Zeit „Queued".** In `VideoAnalysisStatusPill` werden alle
  nicht abgeschlossenen Zustände (queued, copying, preflight, processing) über
  `getVideoAnalysisVisualStatus` auf `'queued'` abgebildet und tragen dieselbe Aufschrift.
  Zwei Minuten lang steht neben einer laufenden Analyse „in der Warteschlange".
* **Die Restzeit läuft ab und wird nicht nachgeführt.** Der Balken ist bei
  `MAX_REPORTED_PROGRESS = 0.95` gedeckelt (`app/utils/videoAnalysisProgress.ts:27,37`)
  und die Schätzung wird nie korrigiert. Bei Video C stand am Ende **„Progress 95 % —
  1:53 / 1:53 estimated"**, während die Analyse noch lief (`screenshots/gh438-eta-exhausted.png`).
  Ab diesem Punkt hat der Nutzer keine Angabe mehr, wie lange es noch dauert.

### 2.4 Was beim Verlassen der App wirklich passiert

Es gibt zwei klar verschiedene Fälle, und nur einer davon führt zu dem gemeldeten
„Failed".

**Fall 1 — Verlassen während der laufenden Analyse (Lauf 4, echtes Video D):**

HOME bei t = 15 s. Protokoll aus `run4-heavy-minimize-timeline.txt`:

```
t=17.9 s   pid=19925  fgs_records=3  oom_score_adj=50
t=39.8 s   pid=19925  fgs_records=3  oom_score_adj=200
t=70.5 s   pid=19925  fgs_records=3  oom_score_adj=200
t=76.9 s   pid=19925  fgs_records=0  oom_score_adj=700     <- Analyse fertig, Dienst beendet
t=102.4 s  pid=19925  fgs_records=0  oom_score_adj=700
```

Der Prozess überlebt die vollen 90 Sekunden im Hintergrund, die Analyse läuft zu Ende,
es kommt die Benachrichtigung „Video analysis complete", und beim Zurückkehren steht der
Eintrag auf **Done** (`screenshots/gh438-minimize-during-analysis.png`).
**Der Import bricht hier nicht ab.**

**Fall 2 — Verlassen unmittelbar nach der Videoauswahl (Lauf 5, Video C):**

HOME 0,44 s nach dem Antippen des Videos, also noch in der Vorbereitung. Protokoll aus
`run5-preflight-kill-timeline.txt`:

```
STATE right-after-home   pid=19925  fgs_records=0  oom_score_adj=700
```

**Kein Vordergrunddienst, und `oom_score_adj=700`** — das ist die Klasse, die das System
als erstes wegräumt. Anschließend wurde das System gebeten, den Prozess so zu beenden,
wie es sein Speichermanager tut (`am kill`; dieser Befehl lässt Prozesse mit
Vordergrunddienst ausdrücklich in Ruhe, deshalb ist er hier ein unterscheidender Test).
Er hat gegriffen:

```
ActivityManager: Killing 19925:com.powerliftingworkoutplanner/u0a4724 (adj 700): kill background
```

Beim nächsten Start der App steht der Eintrag in der Liste auf
**„Failed — App was closed while import or ana…"** — genau die gemeldete Meldung
(`screenshots/gh438-failed-after-kill.png`).

### 2.5 Ursache (belegt)

**Warum der Import das Verlassen der App überlebt oder nicht:**

* Der Vordergrunddienst wird erst gestartet, **nachdem** die Vorbereitung erfolgreich war:
  `runBackgroundAnalysis` ruft `startVideoAnalysisForegroundService()`
  (`app/utils/video-analysis-import.ts:93-96`), und `runBackgroundAnalysis` wird erst in
  Zeile 203 aufgerufen — nach `getVideoDuration` und `prepareSquatVideoSeed`.
  Alles davor (Eintrag anlegen → QUEUED → PREFLIGHT) läuft ohne jeden Schutz. Gemessen:
  `oom_score_adj=700` ohne Dienst gegen 50/200 mit Dienst.
* Die Meldung selbst kommt aus `RECOVER_STALE_VIDEO_ANALYSES`
  (`app/redux/VideoAnalysis/videoAnalysisReducer.ts:212-235`): jeder Eintrag, der beim
  Start noch in QUEUED / COPYING / PREFLIGHT / PROCESSING steht, wird auf FAILED gesetzt
  mit dem Text „App was closed while import or analysis was running". Ausgelöst wird das
  in `App.tsx:102` über `PersistGate onBeforeLift`, also **nur beim Kaltstart** — nicht
  beim bloßen Minimieren. Das passt zu Fall 1: dort wurde der Prozess nie beendet, also
  gab es auch keinen Kaltstart und keine Fehlermarkierung.

**Warum es keine Restzeit gibt, nachdem die Schätzung abgelaufen ist:** `calculateAnalysisProgress`
deckelt bei 0,95 und die Schätzung wird nach dem Start nicht mehr angepasst
(`app/utils/videoAnalysisProgress.ts:32-38`).

**Warum das Abzeichen „Queued" bleibt:** `getVideoAnalysisVisualStatus`
(`app/utils/video-analysis-presentation.ts:235-239`) kennt nur „done", „failed" und
„queued".

**Nebenbefund:** Video B — ein ganz normales, echtes Trainingsvideo aus der Galerie —
endet nach 1,4 s mit **„Failed — No outer plate candidate found at t=0"**. Der Nutzer
bekommt für dieses Video also gar keine Analyse.

### 2.6 Was offen bleibt

* **Die im Ticket beschriebene Blockade ließ sich auf diesem Build nicht reproduzieren.**
  Vier Importe, davon zwei mit echten Videos des Nutzers (73,6 MB und 55,5 MB), blieben
  alle bei 1,2–1,4 s, und die Oberfläche blieb währenddessen und danach flüssig. Mögliche
  Erklärungen, die hier **nicht** geprüft werden konnten: ein anderer (Release-)Build oder
  eine ältere Version, ein Gerätezustand unter Speicherdruck, oder Videos, deren erstes
  Bild deutlich teurer auszuwerten ist als die vier getesteten (222–386 ms).
* **Ob der Prozess auf dem Gerät des Nutzers auch *mit* laufendem Vordergrunddienst
  weggeräumt wird** (Samsung-Akkuoptimierung, „App im Schlaf"), konnte nicht erzwungen
  werden. In Fall 1 hat er 90 s überlebt; über längere Zeiträume oder unter Speicherdruck
  sagt das nichts.
* **Wie lange das Fenster ohne Schutz wirklich ist**, wenn Metro nicht mitspielt: gemessen
  wurden 1,2–1,4 s auf einem Debug-Build. Auf einem Release-Build dürfte es kürzer sein.

---

## 3. GH-439 — „Rep-Geschwindigkeit aktualisiert sich nicht bei der Wiedergabe"

### 3.1 Was gemessen wurde

Analyse Nr. 4 (Video C, 80 s, 23 erkannte Wiederholungen). Unter dem Video stehen zwei
Werte untereinander: oben die Wiederholungsnummer, darunter die Geschwindigkeit.
Während **einer** durchgehenden Wiedergabe abgelesen
(`gh439-playback-sampling-timeline.txt`, Bildbelege `screenshots/gh439-velocity-frozen.png`):

| Zeit seit Start der Wiedergabe | Wiederholung | Geschwindigkeit |
|---|---|---|
| 2,3 s | Rep 5 | 0,440 m/s |
| 5,3 s | Rep 7 | 0,440 m/s |
| 8,5 s | Rep 8 | 0,440 m/s |
| 11,9 s | Rep 9 | 0,440 m/s |
| 15,0 s | Rep 10 | 0,440 m/s |
| 18,0 s | Rep 11 | 0,440 m/s |
| 21,3 s | Rep 12 | 0,440 m/s |
| 24,4 s | Rep 13 | 0,440 m/s |
| 27,5 s | Rep 14 | 0,440 m/s |
| 41,9 s | Rep 18 | 0,440 m/s |

**Die Wiederholungsnummer läuft mit (5 → 18). Die Geschwindigkeit steht 40 Sekunden lang
unverändert auf 0,440 m/s.**

Der Wert 0,440 m/s ist genau der Wert an der Stelle, an der die Wiedergabe zuletzt
angehalten worden war.

### 3.2 Ab wann der stehengebliebene Wert wieder aktualisiert wird

Ein zweiter, sauber von t = 0 gestarteter Durchlauf, automatisiert und mit Zusicherungen
auf die tatsächlich angezeigten Werte
(`__tests__/e2e/maestro/flows/ana439_playback_velocity_stale.yaml`, Protokoll
`gh439-maestro-run.log`, Bildbeleg `screenshots/gh439-play-vs-step.png`):

| Zustand | Wiederholung | Geschwindigkeit |
|---|---|---|
| angehalten bei t = 0 | – | **0,372 m/s** |
| nach ~10 s Wiedergabe | **Rep 20** | **0,372 m/s** ← unverändert |
| nach **einem** manuellen Einzelbild-Sprung (+50 ms) | – | **0,375 m/s** ← aktualisiert |

Der Durchlauf ist grün, das heißt: „0.372 m/s" war nach zehn Sekunden Wiedergabe
nachweislich noch da, obwohl die Wiederholungsnummer schon bei 20 stand, und war nach
dem Einzelbild-Sprung nachweislich weg.

**Antwort auf die Frage:** Der Wert wird ausschließlich dann wieder aktualisiert, wenn
der Nutzer selbst springt — Einzelbild-Knöpfe, Tippen auf das Geschwindigkeitsdiagramm,
Ziehen des Reglers —, oder wenn er auf Pause drückt, oder wenn das Video zu Ende ist.
Solange das Video von allein weiterläuft, ändert er sich nie.

### 3.3 Ursache (belegt)

In `app/components/video/VideoAnalysisPlaybackOverlayCard.tsx`:

* Die angezeigte Geschwindigkeit hängt an `currentBarVerticalVelocityPxPerSecond`
  (Zeile 1227), das aus dem React-Zustand **`playbackTimeMs`** berechnet wird
  (Zeilen 680-683).
* `setPlaybackTimeMs` wird an genau vier Stellen aufgerufen: am Ende des Videos
  (Zeile 837), beim manuellen Springen `applySeekTimeMs` (852), beim Drücken auf Pause
  (961) und beim Zurücksetzen (1133).
* `onPlayerProgress` — der Rückkanal des Abspielers, der ~alle 50 ms meldet, wo das Video
  gerade steht — ruft `setPlaybackTimeMs` **nicht** auf (Zeilen 769-794). Es setzt nur die
  Reanimated-Werte für den Positionsstrich (789-790) und ruft
  `updateCurrentRepForPlaybackTime` (782).
* `updateCurrentRepForPlaybackTime` setzt dagegen sehr wohl React-Zustand:
  `setCurrentRepIndex` (Zeile 740).

Damit ist beides erklärt: die Wiederholungsnummer hängt an einem Zustand, der bei jedem
Fortschrittsereignis nachgezogen wird, die Geschwindigkeit an einem, der es nicht wird.
Der Positionsstrich im Diagramm läuft übrigens flüssig mit, weil er über die
Reanimated-Werte auf dem UI-Thread gezeichnet wird und React dafür gar nicht gebraucht
wird — für den Nutzer sieht es deshalb so aus, als würde alles mitlaufen außer der Zahl.

**Zweiter, direkt daraus folgender Fehler** — sichtbar in der Tabelle in 3.2: nach dem
Einzelbild-Sprung steht bei der Wiederholung wieder „–". Die Einzelbild-Knöpfe rechnen
ihr Ziel aus `playbackTimeRef.current` (Zeilen 1213-1217), und dieser Merker wird aus dem
eingefrorenen `playbackTimeMs` nachgezogen (Zeilen 970-972). „+50 ms" während der
Wiedergabe springt deshalb nicht ein Bild weiter, sondern **zurück** auf
(eingefrorene Position + 50 ms) — im Beispiel von Rep 20 zurück auf 50 ms.

### 3.4 Was offen bleibt

* **Die Analyse eines der echten Galerie-Videos (Nr. 5, Video D) lässt sich gar nicht
  abspielen.** Das Symbol wechselt auf Pause, aber Bild, Wiederholungsnummer und
  Geschwindigkeit bewegen sich über 90 Sekunden um kein Pixel (zwei Bildschirmabgriffe im
  Abstand von 8 s sind byteweise identisch). Bei den beiden Analysen mit Fixture-Video
  (Nr. 2 und Nr. 4) läuft die Wiedergabe normal. Warum, ist offen — es ist ein eigener
  Fehler und nicht die Ursache von GH-439.
* Beim Drücken auf Play/Pause protokolliert die App
  `Unhandled SoftException: getJSModule(RCTEventEmitter) is not recommended in the new
  architecture and will stop working with interop disabled` aus
  `VideoAnalysisPlayerView.dispatchEvent`. Die Ereignisse kommen derzeit trotzdem an
  (sonst würde die Wiederholungsnummer nicht mitlaufen), es ist also **nicht** die Ursache
  von GH-439 — aber die Meldung sagt ausdrücklich, dass dieser Weg wegfallen wird. Sobald
  das passiert, hört auch die Wiederholungsnummer auf mitzulaufen.

---

## 4. Vorschläge für Folge-Tickets

### 4.1 GH-438-A — „Ich will sehen, wie weit die Analyse ist und wie lange es noch dauert"

Aus Nutzersicht: Solange ein Video ausgewertet wird, zeigt der Eintrag in der Liste an,
dass er *ausgewertet wird* — nicht „in der Warteschlange". Der Fortschritt läuft bis zum
Ende durch, und die Restzeit bleibt eine Aussage: dauert es länger als geschätzt, wird die
Schätzung nachgeführt statt bei „1:53 / 1:53" stehenzubleiben. Verlasse ich die App, sehe
ich denselben Fortschritt in der laufenden Benachrichtigung.

### 4.2 GH-438-B — „Wenn ich die App verlasse, läuft mein Import trotzdem zu Ende"

Aus Nutzersicht: Wähle ich ein Video aus und wechsle sofort danach die App oder gehe auf
den Startbildschirm, wird das Video trotzdem fertig ausgewertet. Ich komme nicht zu einem
Eintrag „Failed — App was closed while import or analysis was running" zurück und muss den
Import nicht wiederholen.

### 4.3 Zusammen oder getrennt lösen?

**Getrennt, und B zuerst.**

* Es sind zwei verschiedene Dinge: A ist reine Anzeige, B ist Schutz des Prozesses. Sie
  teilen keinen Code.
* B ist der Fehler, bei dem Arbeit des Nutzers verloren geht — bei A sieht er nur schlecht,
  was ohnehin passiert. Die Messungen zeigen außerdem, dass B ein eng umrissenes Fenster
  von rund 1,3 s betrifft und entsprechend klein zu beheben ist, während A drei
  unabhängige Anzeigestellen berührt (Abzeichen, Restzeit, Benachrichtigung).
* Als ein Ticket zusammengefasst würde die schnelle, wichtige Absicherung an der größeren
  Anzeigearbeit hängen.

### 4.4 GH-439 — „Die Geschwindigkeit läuft beim Abspielen mit"

Aus Nutzersicht: Während das Video läuft, verändert sich die Geschwindigkeit neben der
Wiederholungsnummer genauso mit wie diese und wie der Strich im Diagramm — ich kann das
Video einfach laufen lassen und sehe zu jedem Moment den Wert, der zu dem Bild gehört, das
ich gerade sehe. Ich muss nicht mehr erst anhalten oder ein Einzelbild anspringen, damit
die Zahl stimmt. Und wenn ich während der Wiedergabe ein Einzelbild weiterspringe, geht es
von der Stelle weiter, an der das Video gerade ist — nicht zurück an den Anfang.

---

## 5. Belege

| Datei | Zeigt |
|---|---|
| `screenshots/gh438-import-timeline.png` | Was der Nutzer in den ersten 6 s nach der Videoauswahl sieht |
| `screenshots/gh438-minimize-during-analysis.png` | App minimieren während der Analyse → läuft weiter, Benachrichtigung, Eintrag „Done" |
| `screenshots/gh438-failed-after-kill.png` | Eintrag „Failed — App was closed while import or ana…" nach dem Wegräumen in der ungeschützten Phase |
| `screenshots/gh438-eta-exhausted.png` | „Progress 95 % — 1:53 / 1:53 estimated" bei noch laufender Analyse |
| `screenshots/gh439-velocity-frozen.png` | Rep 5 → Rep 13, Geschwindigkeit durchgehend 0,440 m/s |
| `screenshots/gh439-play-vs-step.png` | 0,372 (angehalten) → Rep 20 / 0,372 (Wiedergabe) → 0,375 (nach Einzelbild-Sprung) |
| `docs/investigation/logs/ana438-439/` | Rohdaten: gefilterte Logcats, Zeitleisten aller Läufe, `gfxinfo`, Maestro-Protokoll und -Bericht |
