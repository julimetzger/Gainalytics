# UX-Audit: Trainings-Overview („Micro N Overview“)

**Ticket:** [GH-505](https://github.com/julimetzger/Gainalytics/issues/505) · Audit der Trainings-Overview
**Datum:** 12.10.2026
**Gerät:** R5CN30HWZFN, Samsung SM-G986B (Galaxy S20+), Android 13, 720 × 1600 Override
**Build:** Debug-APK 0.179 (arm64), JS-Bundle **live aus diesem Worktree** über Metro (Host-Port 8086, `adb reverse tcp:8081 tcp:8086`). Der Branch ist identisch mit `origin/master` (`4a3c1dab`). Zum APK: Die einzigen frischen master-APKs auf dem Host enthielten nur x86_64-Bibliotheken und stürzten auf dem Gerät mit `libworklets.so` ab. Installiert ist deshalb das arm64-APK aus GH-502. Es hat den nativen Stand direkt vor GH-504, nur der ChatGPT-Login fehlt (JS fängt das ab). Die Overview ist davon nicht betroffen.
**Daten:** `baseline.gains`, importiert über den regulären Import-Flow (Maestro über einen eigenen adb-Filter-Proxy; das Log belegt 720 px Breite = dieses Gerät). Zusätzlich ein Durchgang mit leerer App (`pm clear`). Am Ende wurde die Baseline erneut importiert.
**Theme:** Dark im Hauptdurchgang, Light als Stichprobe.
**Art:** Experten-Audit mit Schwerpunkt **Verständlichkeit der Analysen (Ist und Plan)**. Read-only, **keine** Änderung am App-Code. Der Diff enthält nur diesen Report und die Screenshots unter [`screenshots/gh505/`](screenshots/gh505/).

---

## 0. Gesamtaussage

**Nein. Ein Nutzer versteht anhand der Overview heute nicht zuverlässig, wie seine Woche gelaufen ist, und erst recht nicht, was er ändern sollte.**

Die Overview liefert viele Ist-Zahlen: Dauer, Volumen, Sätze, Werte je Muskel und je Übung. Sie beantwortet damit die Frage „wie viel habe ich gemacht?“. Die eigentliche Frage „wie lief es?“ bleibt offen, aus vier Gründen:

1. **Vergleiche ohne Bezug.** Jede Zahl trägt ein farbiges Delta, aber nirgends steht, womit verglichen wird. Verglichen wird das ganze Micro mit dem ganzen Vor-Micro, auch wenn die Woche erst angefangen hat. Eine Woche mit null Trainings zeigt deshalb `-7496.50` und `-15.00` in Rot, nach dem ersten von vier Trainings `-56 %` (H1).
2. **Plan gegen Ist ist versteckt und teilweise falsch dargestellt.** Der Soll-Ist-Vergleich steckt im vierten Segment „Plan“. Die Muscle Map dort zeichnet den Ist-Wert nur, wenn er den Plan *übersteigt*. Untererfüllung, also der wichtigste Fall, ist unsichtbar (H3). Die Tabelle darunter färbt „zu wenig trainiert“ als positiv/blau (H4).
3. **Zahlen widersprechen sich oder sind falsch.** Dieselbe Plan-Ansicht nennt für denselben Muskel zwei verschiedene Planwerte (H5). „1RM“ je Muskel zeigt für jeden Muskel denselben Wert (H6). Nicht trainierte Übungen erscheinen mit „Max Intensity 100“ und blauem Plus (H7). Die Dauer springt nach 24 h auf null zurück (M1).
4. **Keine Ableitung.** Es gibt keine Zusammenfassung („1 von 4 Trainings, 3 von 31 geplanten Sätzen“) und keine Handlungsempfehlung. Coach Insight, die einzige Stelle mit Interpretation, zeigt für alle Micros der Baseline „Not enough data“, weil sie nur die letzten 28 Tage betrachtet (M9).

Was gut funktioniert: Die Zahlen der Total-Ansicht stimmen bei den Stichproben mit den geloggten Daten überein (Abschnitt 4). Wischen zwischen Micros hält die gewählte Ansicht. Die UI ist durchgehend englisch (GH-450 ist behoben). Light und Dark sind gleichwertig lesbar.

**Größter Hebel:** eine Statuszeile über den Segmenten, die Plan-Erfüllung und Fortschritt zusammenfasst (H2), und beschriftete, faire Vergleiche (H1). Mit diesen beiden Änderungen beantwortet der obere Teil des Screens die Kernfrage. Alles darunter wird zur Vertiefung.

---

## 1. Vorgehen und durchlaufene Zustände

1. Bestehende Tickets und Reports gesichtet: GH-57, GH-143, GH-241, GH-417, GH-436 (inkl. Usability-Report `docs/usability/GH-436-plan-anlegen-bis-auswerten.md`), GH-444, GH-449, GH-450, GH-455/GH-458, GH-467, GH-482, TRN-001/GH-44, TODOS.md, `docs/perf/training-tab-fixes.md`.
2. Code der Overview gelesen, um zu verstehen, welche Formel hinter jeder Zahl steht (`MicroOverviewTraining`, `MicroOverview`, `MicroExerciseOverview`, `MicroPlanOverview`, `MicroMuscleMapCard`, `AnalyseUtils`, `useMuscleInvolvement`).
3. Auf dem Gerät alle Zustände durchgespielt (Plan „Push pull“, Meso 1):

| Zustand | Micro | Wie hergestellt | Screenshots |
|---|---|---|---|
| Komplett absolviert | M5 (4/4 Trainings) | Baseline | 19, 20, 21 |
| Teilweise absolviert (Baseline) | M6 (nur „Pull“, 1/4) | Baseline | 10–18 |
| Erstes Micro ohne Vorgänger | M1 | Baseline | 24, 26, 27 |
| Ausreißer über 24 h | M4 (ein Training mit 42 h) | Baseline | 23 |
| Leeres Micro (nichts geplant, nichts trainiert) | M7 | Baseline | 04–08 |
| Nur geplant | M7 | „Push squat“ und „Pull dl“ per *Suggest based on last Training* geplant | 28, 29, 29b, 30 |
| Teilweise, Training läuft (STARTED) | M7 | „Push squat“ gestartet, 3 Sätze bestätigt | 31–34 |
| Teilweise, 1 Training beendet | M7 | „Push squat“ beendet | 35–39 |
| Leere App | – | `pm clear`, Onboarding übersprungen, leerer Plan „Audit“ | 50–58 |
| Light-Stichprobe | M7, M6 | Settings → Theme Light | 46–49 |
| Konsistenz | – | Home-Dashboard, Analyse eines Trainings, Analyse-Dashboard/Metrics Overview | 01, 35, 40–42, 59, 61, 62 |

4. Zahlen nachgerechnet (Abschnitt 4), mit einem Skript über `baseline.gains`. Ein Maestro-Flow prüft die nachgerechneten Werte auf dem Gerät (Screenshot 60).

---

## 2. Aufbau der Overview (Ist-Zustand)

**Einstieg:** Plan öffnen → Hamburger → Textzeile „Overview“ im Drawer. Wechsel zwischen Micros per Wischen oder über den Pager „‹ Micro N | Micro N ›“ im Drawer. Der Header lautet „Push pull › Meso 1 / Micro 7 Overview“.

| Drawer mit „Overview“ | Öffnet auf „Exercise“ | Total (leeres M7) | Plan (M6) |
|---|---|---|---|
| <img src="screenshots/gh505/03_drawer_m7.png" width="200"> | <img src="screenshots/gh505/04_m7_overview_default.png" width="200"> | <img src="screenshots/gh505/05_m7_total.png" width="200"> | <img src="screenshots/gh505/14_m6_plan.png" width="200"> |

Vier Segmente:
- **Total:** drei Kennzahl-Karten (Duration, Volume, Sets, jeweils mit Delta), Coach Insight, „Muscle Overview“ (Volume (t), Sets, Reps je Muskel mit Delta), „Exercise Overview“ (1RM (kg), Reps, Max Intensity (%1RM) je Übung mit Delta). VL-Insight-Karten erscheinen nur mit verknüpften Videoanalysen; in der Baseline gibt es keine für diesen Plan.
- **Exercise:** je beendetem Training eine Karte mit Sets, Reps, RIR und Weight (Spannweiten).
- **Muscle:** je beendetem Training eine Muskel-Tabelle ohne Deltas.
- **Plan:** „Total Sets: N (planned)“ / „Total Sets: N (done)“, eine Muscle Map „THIS MICRO (PLANNED) vs Trained this micro“, dazu eine Bildunterschrift und eine Muskel-Tabelle (Planwert, Delta zum Ist).

**Records** gibt es in der Overview nicht. Die Seite endet nach der Exercise Overview (Screenshot 11_s3).

---

## 3. Verständlichkeit je Kennzahl und Diagramm

Spalte „Ist/Plan“: worauf sich die Zahl tatsächlich bezieht. „Bezug erkennbar?“: ob der Screen das sagt.

| Element | Was es zeigt (Ist/Plan) | Bezug und Vergleichsbasis erkennbar? | Was wird missverstanden? | Beleg |
|---|---|---|---|---|
| Header „Micro 7 Overview“ | Welches Micro | Micro ja, Zeitraum nein (kein Datum, kein Status) | Ob die Woche läuft, vorbei ist oder in der Zukunft liegt, sieht man nicht | 05, 28 |
| Segment „Total“ | **Nur Ist**, aber ohne Kennzeichnung | Nein. „Total“ klingt nach Plan + Ist | Nutzer erwartet hier die Wochenbilanz inklusive Plan | 05, 28 |
| Karte **Duration** | Ist: Summe der *beendeten* Trainings, `HH:MM:SS` | Nein. Delta steht **über** dem Wert, Basis (Vor-Micro) unbenannt | Obere Zeile (`-01:46:17`) wird als Wert gelesen. Laufende Trainings zählen 0. Über 24 h springt die Anzeige zurück (M1) | 10, 23, 33 |
| Karte **Volume** | Ist: Σ Gewicht × Wdh., kg | Nein. Keine Einheit, zwei Nachkommastellen, Basis unbenannt | „7496.50“ ohne kg. In der Tabelle darunter steht Volumen in Tonnen. `-7496.50` in einer ungestarteten Woche wirkt wie ein Rückschritt | 05, 10 |
| Karte **Sets** | Ist: Anzahl Sätze inkl. laufendem Training | Nein. „15.00“ als Kommazahl | Laufendes Training zählt hier, in Dauer und „Exercise“ nicht (M2) | 10, 33 |
| **Coach Insight** | KI-Interpretation, nur Trainings der letzten 28 Tage | Nein. Warum keine Insight kommt, wird nicht erklärt | „Not enough data“ in Fehlerrot bei einer vollen Woche mit 59 Sätzen | 10, 19, 37 |
| **Muscle Overview** (Total) | Ist je Muskel, Sätze anteilig nach Muskelbeteiligung | Nein. Kein „Δ vs. Micro 5“ (die Analyse-Metrics-Overview hat ihn inzwischen) | „2.80 Sätze Biceps“: dass das gewichtete Sätze sind, erklärt nur ein versteckter Tap-Dialog. 1RM je Muskel ist falsch (H6) | 10, 43, 45, 62 |
| **Exercise Overview** (Total) | Ist je Übung, auch Übungen, die nur im Vor-Micro vorkamen | Nein | Nicht trainierte Übungen: 1RM 0.0 mit großem Minus, Max Intensity 100 mit blauem Plus (H7). Seite wird sehr lang | 08, 11_s1–s3 |
| Segment **Exercise** | Ist je beendetem Training (Spannweiten) | Teilweise. Trainingsname ja, Datum/Tag nein | Weight ohne Einheit, RIR- und Weight-Spalte kleben zusammen. Laufendes Training fehlt. Kein Bezug zum Plan | 12, 21, 32 |
| Segment **Muscle** | Ist je beendetem Training, ohne Deltas | Ja (pro Training) | Kaum Mehrwert gegenüber Total | 13, 38 |
| **Total Sets (planned/done)** | Plan: Σ geplante Sätze. Ist: Σ geloggte Sätze inkl. laufend | Ja, als einzige Zahl klar beschriftet | Plan zählt auch Sätze von Übungen, die aus dem Training entfernt wurden (H5). Erfüllungsgrad (%) fehlt | 14, 26, 34 |
| **Muscle Map** (Plan) | Balken = Plan, Referenz = Ist | Teilweise. Kopf „THIS MICRO (PLANNED) · Sets vs Trained this micro“ plus Unterzeile „THIS MICRO (DONE)“ | Ist ist **unsichtbar**, wenn kleiner als der Plan (H3). Readout „4/5“ ohne Legende, welche Zahl Plan ist. Rosa Tönung und Striche unerklärt | 14, 26, 39 |
| Bildunterschrift „Planned values for this micro, differences against what was trained.“ | Beschreibt Tabelle | Ja | Bleibt stehen, auch wenn oben „vs Micro 5 plan“ gewählt ist (M7) | 16 |
| **Muscle Overview** (Plan) | Plan je Muskel, Delta = **Plan − Ist** | Nur über die Bildunterschrift | „+0.8“ in Blau heißt „0,8 t weniger trainiert als geplant“ (H4). Kein Delta, wenn Ist = 0 | 14, 29b |
| Vergleich „Micro N plan“ | Plan gegen Plan des Vor-Micros | Teilweise | Vergleicht einen 1-Trainings-Plan mit einem 4-Trainings-Plan. Tabelle und Bildunterschrift folgen der Auswahl nicht | 16, 18 |

**Fazit Ist gegen Plan:** Der Unterschied zwischen Plan und Ist ist nur im Segment „Plan“ und nur an der Zeile „Total Sets“ eindeutig. Total, Exercise und Muscle zeigen ausschließlich Ist, ohne das zu sagen. Die eigentlichen Plan/Ist-Visualisierungen (Map, Tabelle) haben eine verdrehte Leserichtung (Plan/Ist statt Ist/Plan wie in der Einzel-Analyse, M8). Zudem ist ihre Farbsemantik verdreht und sie verstecken Untererfüllung.

---

## 4. Stichproben: angezeigte Zahlen gegen geloggte Daten

Nachgerechnet mit `checks/calc/micro_stats.js` direkt aus `baseline.gains` (Volumen = Σ Gewicht × Wdh.; Dauer = Σ end − start der beendeten Trainings). Die Werte S1 und S3 prüft außerdem der Maestro-Flow auf dem Gerät (1/1 Passed, 34 Schritte COMPLETED; eine Negativprobe mit `7496.51` scheitert wie erwartet).

| # | Kennzahl | Angezeigt | Nachgerechnet | Ergebnis | Beleg |
|---|---|---|---|---|---|
| S1 | M6 Volume / Sets / Duration | 7496.50 / 15.00 / 01:46:17 | 7496,5 kg / 15 Sätze / 1:46:17 (nur „Pull“, 28.02.) | ✅ | 10, 60 |
| S2 | M6-Deltas gegen M5 | −38078.50 / −44.00 / −04:47:27 | 45575 → −38078,5; 59 → −44; 6:33:44 → −4:47:27 | ✅ Rechnung korrekt, Basis aber unbenannt | 10 |
| S3 | M7 nach 3 Sätzen (läuft) | Volume 3290.00, Sets 3.00, Δ −4206.50 | Adductor 12×105 + 11×105, Squat 5×175 = 3290 kg; 3290 − 7496,5 = −4206,5 | ✅ | 33 |
| S4 | M4 Duration | **21:56:10** | **45:56:11** (Pull dl am 19.02. lief 42 h bis 21.02.) | ❌ Überlauf nach 24 h | 23 |
| S5 | M5-Delta Duration gegen M4 | −15:22:26 | 6:33:45 − 45:56:11 = **−39:22:26** | ❌ Folgefehler | 19 |
| S6 | M5 Plan: Total Sets | 59 (planned) / 59 (done) | 59 / 59 | ✅ | 20 |
| S7 | M1 Plan: Back geplant | Map **12**, Tabelle **14** | 14 inkl. 2 Sätze „SA lat pulldown“, die nicht mehr in der Übungsliste des Trainings stehen | ❌ zwei Planwerte. Ebenso Chest 0.8 gegen 2.80 („Machine chest press“) | 26 |
| S8 | M6 „1RM (kg)“ je Muskel | 128.5 für **jeden** Muskel, auch Chest mit 0 Sätzen | e1RM Pull up = 94 × (1 + 11/30) = 128,5. Der Wert gilt für Back, nicht für alle Muskeln | ❌ | 45 |
| S9 | Einzel-Analyse M7 D1: Δ Volume / Sets | −9695.50 / −13.00 | Basis = je Übung das letzte beendete Workout: 12985,5 kg / 16 Sätze, aus drei verschiedenen Trainings (27.02., 23.02., 16.02.). M5 D1 wird nicht genutzt | ✅ rechnerisch, ❌ Basis unsichtbar | 35 |
| S10 | Einzel-Analyse M6 Pull: Δ gegen M5 Pull | +00:21:36 / −250.50 / +1.00 | 106 − 85 min; 7496,5 − 7747; 15 − 14 | ✅ | 59 |

---

## 5. Findings

Jedes Finding nennt: was, warum ein Problem, Beleg, Vorschlag. Bereits gemeldete Punkte stehen in Abschnitt 6 und werden hier nur referenziert.

### Hoch

#### H1 – Deltas ohne Vergleichsbasis, und unvollständige Wochen werden gegen volle verglichen
**Was:** Alle Deltas (Karten, Tabellen) vergleichen das ganze Micro mit dem ganzen Vor-Micro. Wogegen verglichen wird, steht nirgends. Das leere M7 zeigt `-7496.50` / `-15.00` / `-01:46:17` in Rot. Nach dem ersten von vier Trainings sind es `-4206.50` und auf Home `-56 %`.
**Warum ein Problem:** Der Nutzer liest „ich bin schlechter geworden“, obwohl die Woche erst begonnen hat. Rot ist hier kein Signal, sondern Rauschen. Ohne Basis („vs was?“) ist kein Delta interpretierbar.
**Beleg:** 05, 28, 33, 37, 40.
**Vorschlag:** Jedes Delta mit „vs M6“ beschriften. Solange das Micro nicht abgeschlossen ist, nur gleiche Trainingspositionen vergleichen („bis D1: 3290 kg vs 7747 kg“), sonst Delta weglassen. In rein geplanten Micros keine Deltas zeigen.

#### H2 – Die Overview hat keine Wochenbilanz; Plan-Erfüllung steckt im vierten Segment
**Was:** Oben stehen nur drei Ist-Karten. Wie viele Trainings erledigt sind und wie viel vom Plan erfüllt ist, erfährt man nur über Home (Ring „1/4“) oder im Segment „Plan“ („31 planned / 3 done“).
**Warum ein Problem:** Die Kernfrage „wie lief meine Woche?“ ist eine Plan-gegen-Ist-Frage. Total zeigt nur Ist und kennzeichnet das nicht. Das geplante M7 mit 31 Sätzen erscheint in Total wie eine leere Woche.
**Beleg:** 28 gegen 29 (gleiches Micro), 40 (Home zeigt 1/4).
**Vorschlag:** Statuszeile über den Segmenten: „1 von 4 Trainings · 3 von 31 geplanten Sätzen (10 %) · 3.290 kg“. Bei abgeschlossenem Micro: „4/4 Trainings · 59/59 Sätze · +26 % Volumen vs M4“.

#### H3 – Muscle Map (Plan) zeigt Untererfüllung nicht
**Was:** Der Balken ist der Planwert. Der Ist-Wert erscheint nur als grauer Fortsatz, wenn er den Plan übersteigt (M6 Hamstrings 4/5). Ist er kleiner, wird er gar nicht gezeichnet: M7 Quads „5.6/1“ ist ein voller blauer Balken. Es gibt keine Legende, die sagt, welche Zahl im Readout Plan und welche Ist ist.
**Warum ein Problem:** Laut GH-436 sollte man den „Erfüllungsgrad auf einen Blick“ sehen. Im häufigsten Fall (weniger trainiert als geplant) sieht die Map identisch aus wie bei voller Erfüllung.
**Beleg:** 39 (Quads 5.6/1, Core 5.2/0.3), 34, 29, 14.
**Vorschlag:** Ist als gefüllten Balken, Plan als Zielmarke bzw. Umriss zeichnen. Legende „■ Ist ▯ Plan“. Readout als „1 von 5,6 Sätzen“.

#### H4 – Plan-Tabelle: Delta „Plan − Ist“ mit Gut/Schlecht-Farben
**Was:** In der Muskel-Tabelle des Plan-Segments ist der Wert der Plan und das Delta = Plan − Ist. Positive Deltas sind blau, negative rot. M6 Triceps zeigt „1.1 / +0.8“ in Blau, also 0,8 t weniger trainiert als geplant. Hamstrings zeigt „−0.7“ in Rot, also 0,7 t *mehr* als geplant.
**Warum ein Problem:** Die Farben sagen das Gegenteil dessen, was passiert ist. Untererfüllung erscheint als Erfolg. Die Erklärung steht nur in der kleinen Bildunterschrift.
**Beleg:** 14, 20.
**Vorschlag:** Spalten „Ist | Plan | Erfüllung %“. Abweichungen neutral einfärben (Untererfüllung warnend, Übererfüllung neutral oder informativ), nicht nach Vorzeichen.

#### H5 – Zwei verschiedene Planwerte in derselben Ansicht
**Was:** In M1/Plan zeigt die Muscle Map „Back 12/14“ (Plan 12), die Tabelle darunter Back-Plan „14.00“. Chest: Map 0.8, Tabelle 2.80. „Total Sets 45 (planned)“ enthält ebenfalls die Abweichung. Ursache in den Daten: Der Plan enthält noch Sätze für „SA lat pulldown“ und „Machine chest press“, die nicht mehr in der Übungsliste des Trainings stehen. Map und Ist-Referenz ignorieren sie, Tabelle und Summe zählen sie.
**Warum ein Problem:** Zwei Zahlen für denselben Sachverhalt untergraben das Vertrauen in alle Zahlen.
**Beleg:** 26; Daten in Abschnitt 4, S7. Verwandt mit GH-436 B12 (dort: leere Tabelle) – das Grundproblem ist **teilweise offen**.
**Vorschlag:** Eine einzige Quelle für „geplante Sätze“. Sätze entfernter Übungen überall ausschließen oder überall sichtbar als „(entfernt)“ führen.

#### H6 – 1RM und Intensität je Muskel sind für alle Muskeln gleich
**Was:** Wählt man in der Muskel-Tabelle die Spalte „1RM“ (oder Max/Average Intensity), steht bei jedem Muskel 128.5 mit −99.5. Das gilt auch für Chest, Core und Glutes mit 0 Sätzen. Der Wert ist das e1RM der stärksten Übung des Micros (Pull up 94 kg × 11).
**Warum ein Problem:** Die Zahl ist für alle Muskeln außer Back schlicht falsch, und die Auswahl wird aktiv angeboten.
**Beleg:** 44 (Auswahl), 45 (Ergebnis); S8.
**Vorschlag:** Pro Muskel nur über die Übungen dieses Muskels rechnen, oder diese Metriken für die Muskel-Tabelle nicht anbieten.

#### H7 – Nicht trainierte Übungen erscheinen als Rückschritt und als Verbesserung zugleich
**Was:** Die Exercise Overview (Total) listet jede Übung des Vor-Micros. Nicht trainierte Übungen erscheinen mit 1RM „0.0 / −112.0“ (rot) und „Max Intensity 100 / +29“ (blau). In M6 sind es über 40 Zeilen, nur 8 davon trainiert. Im leeren M7 stehen nur solche Zeilen.
**Warum ein Problem:** Das blaue Plus suggeriert eine Leistungssteigerung, wo nichts trainiert wurde. Die echten Werte gehen in der Liste unter, und die Seite wird sehr lang.
**Beleg:** 08, 11_s1, 11_s2, 11_s3.
**Vorschlag:** Nicht trainierte Übungen in einen eingeklappten Bereich „Im Vor-Micro, diesmal nicht trainiert (32)“ verschieben, Werte als „—“, ohne Deltas.

### Mittel

#### M1 – Dauer springt nach 24 h zurück; unplausible Trainings zählen voll mit
**Was:** Die Dauer-Karte formatiert über die Uhrzeit (`HH:MM:SS`). M4 zeigt 21:56:10 statt 45:56:11, die Deltas daneben sind um 24 h falsch (−15:22:26 statt −39:22:26). Ursache ist ein 42-h-Training. Die Analyse „Training Length“ blendet solche Ausreißer seit GH-458 H6 aus, die Overview nicht.
**Warum ein Problem:** Die angezeigte Zahl ist falsch. Ein vergessenes „Finish“ verfälscht die ganze Woche unbemerkt.
**Beleg:** 23, 19; S4, S5.
**Vorschlag:** Als Stunden/Minuten ohne Überlauf formatieren (wie Home: „45h 56m“). Ausreißer wie in Training Length markieren („1 Training > 4 h, ausgeblendet“) und korrigierbar machen.

#### M2 – Laufendes Training zählt halb
**Was:** Während „Push squat“ läuft, zählen Volume und Sets mit (3290 kg, 3). Duration bleibt 00:00:00, und die Segmente Exercise und Muscle melden „No executed trainings in this micro.“
**Warum ein Problem:** Drei Ansichten derselben Woche widersprechen sich, und der Hinweistext ist schlicht falsch.
**Beleg:** 32, 33 (gleicher Zeitpunkt).
**Vorschlag:** Das laufende Training überall gleich behandeln: entweder überall mit Kennzeichnung „läuft“ oder überall ausblenden.

#### M3 – Kennzahl-Karten: Delta über dem Wert, keine Einheiten, Kommazahlen
**Was:** Die Karten zeigen das Delta oben und den Wert darunter in gleicher Größe. Es gibt keine Einheit („7496.50“), Sätze erscheinen als „15.00“, die Dauer als „-04:47:27“. Home zeigt dieselben Größen als „7.497 kg“, „−56 %“, „0h 1m“.
**Warum ein Problem:** Die obere Zeile wird als Wert gelesen. Zwei Screens für dieselbe Woche sprechen zwei Zahlenformate.
**Beleg:** 10 gegen 40.
**Vorschlag:** Wert groß mit Einheit, Delta klein darunter, mit Prozent und Basis („−38.078 kg · −84 % vs M5“). Formatierung von Home übernehmen.

#### M4 – Muskel-Tabelle: gebrochene Sätze unerklärt, Δ-Zeitraum fehlt
**Was:** „Biceps 2.80 Sätze / 27.80 Reps“. Dass Sätze anteilig nach Muskelbeteiligung zählen, erklärt nur der Dialog „Back Sets Contribution“, der sich über einen Tap auf eine Zelle öffnet. Nichts weist auf diesen Tap hin. Die Analyse-Metrics-Overview nennt inzwischen „Δ vs. Fri, 29/08/25 to …“, die Micro-Overview nicht.
**Warum ein Problem:** Gebrochene Satzzahlen wirken wie ein Fehler. Die Erklärung existiert, ist aber unauffindbar.
**Beleg:** 10, 43, 62. Status GH-458 H7: **teilweise** (Analyse ja, Overview nein).
**Vorschlag:** Kopfzeile „Δ vs. Micro 5“ wie in der Analyse. Spaltenkopf „Sätze (gewichtet) ⓘ“, der den Contribution-Dialog öffnet.

#### M5 – Overview ist schwer zu finden
**Was:** Der einzige Einstieg ist die Textzeile „Overview“ im Plan-Drawer, ohne Icon und ohne Erklärung. Die Karte „Current micro“ auf Home zeigt dieselben Kennzahlen, führt beim Tippen aber nirgendwohin. Nach dem Micro-Pager bleibt der Drawer offen.
**Warum ein Problem:** Wer die Wochenbilanz sucht, landet auf Home und kommt von dort nicht weiter.
**Beleg:** 03, 42, 09.
**Vorschlag:** Tap auf die Home-Karte „Current micro“ öffnet die Overview dieses Micros. Zusätzlich ein sichtbarer Einstieg im Plan-Header (Icon/Chip „Woche“).

#### M6 – Overview öffnet immer auf „Exercise“
**Was:** Jedes Öffnen über den Drawer setzt die Ansicht auf „Exercise“, auch wenn zuletzt Total gewählt war. Beim Wischen bleibt die Ansicht erhalten (GH-143/GH-467 sind behoben).
**Warum ein Problem:** Die Zusammenfassung (Total) ist nie der Einstieg. Bei geplanten oder leeren Micros begrüßt den Nutzer „No executed trainings in this micro.“
**Beleg:** 04, 30, 46, 55.
**Vorschlag:** Standard „Total“ (später die Statuszeile aus H2) oder die zuletzt gewählte Ansicht merken.

#### M7 – Vergleich „Micro N plan“ ist halb umgesetzt
**Was:** Mit „vs Micro 5 plan“ wechselt nur die Map. Bildunterschrift („differences against what was trained“) und Tabelle vergleichen weiter gegen das Ist. Verglichen wird ein 1-Trainings-Plan (M6) mit einem 4-Trainings-Plan (M5). Rosa Tönung und Teilstriche sind unerklärt.
**Warum ein Problem:** Oben und unten auf demselben Screen gelten unterschiedliche Vergleichsbasen.
**Beleg:** 15, 16, 18.
**Vorschlag:** Bildunterschrift und Tabelle folgen der Auswahl, oder die Option wird auf die Map beschränkt und so beschriftet. Legende für Tönung und Striche ergänzen.

#### M8 – Leserichtung Plan/Ist zwischen Overview und Einzel-Analyse vertauscht
**Was:** Für dieselben Daten (M6 Pull, Hamstrings) zeigt die Overview „4/5“ (Plan/Ist), die Analyse des Trainings „5/4“ (Ist/Plan).
**Warum ein Problem:** Wer beide Screens nutzt, liest einen der beiden zwangsläufig falsch.
**Beleg:** 14 gegen 59.
**Vorschlag:** Überall „Ist / Plan“ mit beschrifteten Einheiten („5 von 4 Sätzen“).

#### M9 – Coach Insight: Fehlerfarbe statt Erklärung
**Was:** Für jedes Baseline-Micro (auch das komplette M5) steht „Not enough data for an insight yet.“ in Fehlerrot. Grund: Es werden nur Trainings der letzten 28 Tage betrachtet. Mit dem ungültigen Key auf dem Gerät steht in M7 „Invalid API key. Check your settings.“ ohne Link.
**Warum ein Problem:** „Nicht genug Daten“ bei 59 Sätzen ist für den Nutzer unverständlich. Rot signalisiert einen Fehler, wo eine Regel greift.
**Beleg:** 10, 19, 37.
**Vorschlag:** Neutraler Text mit Grund („Insights gibt es für Micros der letzten 4 Wochen“) oder die Karte für ältere Micros ausblenden. Key-Fehler mit Button „Zu den Einstellungen“.

### Niedrig

#### N1 – Exercise-Ansicht: Spalten kollidieren, Gewicht ohne Einheit
„0 10.5-13.5“ und „0 52.5-57.5“: Die RIR- und Weight-Werte kleben zusammen. Weight hat keine Einheit, die Trainingskarten haben kein Datum und keinen Tag (D1…D4). **Beleg:** 12, 21. **Vorschlag:** Weight-Spalte breiter bzw. Spannweite umbrechen, Kopf „Weight (kg)“, Datum unter dem Trainingsnamen.

#### N2 – Leere Zustände ohne Hinweis
Ein leeres Micro zeigt in Total Nullkarten und Tabellen nur mit Kopfzeile. Home ohne Plan zeigt nur „Plans“ und eine Suche. **Beleg:** 56, 53. **Vorschlag:** Leerzustand wie im Plan-Segment („Noch nichts trainiert – Training starten“).

#### N3 – Erstes Micro: fehlende Deltas unkommentiert
M1 zeigt keine Deltas und sagt nicht, warum. Die Einzel-Analyse vergleicht in derselben Lage mit dem Vor-Meso. **Beleg:** 24. **Vorschlag:** Hinweis „Erstes Micro – kein Vergleich“.

#### N4 – Pager auf Micro 1 zeigt deaktiviertes „‹ Micro 1“
Auf dem ersten Micro ist der Zurück-Knopf deaktiviert, trägt aber das eigene Label „Micro 1“. **Beleg:** 54. **Vorschlag:** Knopf ausblenden oder leer lassen.

#### N5 – Zahlenformat-Kleinigkeiten
„−0.0“, „+0.00“, und ein Readout ohne Referenz („5.2“) neben „5.6/1“ in derselben Liste. **Beleg:** 14, 34. **Vorschlag:** Nullen ohne Vorzeichen; „5.2/0“ bzw. „0 von 5,2“.

#### N6 – Silbentrennung im Contribution-Dialog
„Hyperextensio / n“ wird mitten im Wort umbrochen. **Beleg:** 43. **Vorschlag:** Namensspalte breiter, Umbruch nur an Leerzeichen.

#### N7 – Segment „Muscle“ ohne eigenen Mehrwert
Es zeigt je Training eine Muskel-Tabelle ohne Deltas und ohne Plan. Total zeigt dasselbe aufsummiert mit Deltas. **Beleg:** 13, 38. **Vorschlag:** Mit Total zusammenlegen (Filter „je Training“) oder je Training Plan gegen Ist zeigen.

#### N8 – Versteckte Bedienung der Tabellen, Metrikwahl wirkt global
Spaltenköpfe (Metrikwahl) und Zellen (Contribution) sind antippbar, ohne dass etwas darauf hinweist. Die Metrikwahl ist eine globale Einstellung und ändert auch die Analyse-Metrics-Overview. **Beleg:** 44. **Vorschlag:** Kopf mit ▾, Zellen mit ⓘ kennzeichnen. Im Picker sagen, dass die Wahl auch in der Analyse gilt.

---

## 6. Bekannte Tickets: Status

| Ticket | Problem | Status heute | Beleg |
|---|---|---|---|
| [GH-450](https://github.com/julimetzger/Gainalytics/issues/450) | Segment hieß „Gesamt“ | **behoben**: „Total“. In der Overview gibt es keine deutschen UI-Reste („Bankdrücken“ ist ein Übungsname aus Nutzerdaten) | 05, 11_s1 |
| [GH-143](https://github.com/julimetzger/Gainalytics/issues/143) / [GH-467](https://github.com/julimetzger/Gainalytics/issues/467) | Ansicht geht beim Wischen verloren | **behoben**: Wischen M5 → M4 → M1 bleibt auf Total. Neu: Reset beim *Öffnen* (M6) | 23, 24 |
| [GH-436](https://github.com/julimetzger/Gainalytics/issues/436) | Plan-Position in der Overview | **umgesetzt** (Segment „Plan“), Verständlichkeit siehe H3/H4/M7 | 14, 20 |
| GH-436 Report B2 | Vergleichsbasis der Einzel-Analyse unklar | **offen**. Zusätzlich beobachtet: M7 D1 vergleicht nicht mit M5 D1, sondern mit „letztes Workout je Übung“ aus drei Trainings (S9). Nirgends steht, womit verglichen wird | 35 |
| GH-436 Report B8 | Einziges Training im Micro: Vergleich „Current micro plan“ ist trivial | **offen**: M6 Pull zeigt 8/8, 2/2 … | 59 |
| GH-436 Report B12 | Planwerte entfernter Übungen | **teilweise**: Heute keine leere Tabelle mehr, aber zwei verschiedene Planwerte (H5) | 26 |
| [GH-458](https://github.com/julimetzger/Gainalytics/issues/458) H7 (aus GH-455) | Metrics: gebrochene Sätze, keine Einheit, Δ-Zeitraum fehlt | **teilweise**: Analyse nennt „Δ vs. …“. Die Overview nutzt dieselbe Tabelle **ohne** Δ-Zeile. Gebrochene Sätze gibt es in beiden (M4) | 10, 62 |
| GH-458 H6 (aus GH-455) | Ausreißer-Training (44 h) verzerrt | **in der Overview offen**: Dauer-Summe nimmt ihn mit und läuft über (M1) | 23 |
| [GH-449](https://github.com/julimetzger/Gainalytics/issues/449) | Coach Insight bricht mitten im Wort ab | **nicht prüfbar**: Die Baseline ist älter als 28 Tage, der Key auf dem Gerät ist ungültig. Es wird keine Insight erzeugt | 10, 37 |
| [GH-241](https://github.com/julimetzger/Gainalytics/issues/241) | Insight pro Micro | **nicht prüfbar** (wie GH-449) | 19 |
| [GH-482](https://github.com/julimetzger/Gainalytics/issues/482) | Home-Diagramm: Labels überlappen | **behoben**: Labels unter den Balken, Werte darüber | 01, 40 |
| TRN-001 / [GH-44](https://github.com/julimetzger/Gainalytics/issues/44) | Records des Micros in der Overview, mit Vergleich | **offen**: Die Overview hat keinen Records-Bereich (Seitenende nach Exercise Overview). Issue ist geschlossen, PR #91 nie gemergt, TODOS.md steht noch auf `[ready]` | 11_s3 |
| TODOS.md „Labels für Sets/Workouts hinzufügen“ | Beschriftungen | **offen** (siehe M3) | 10 |
| TODOS.md „Overview mit Grafik für RIR Sets im Vergleich zum vorherigen Macro“ | RIR in der Overview | **offen**: RIR erscheint nur auf Home („RIR 0.0“), nicht in der Overview | 40 |
| [GH-390](https://github.com/julimetzger/Gainalytics/issues/390) | Meso + Micro im Label | **teilweise**: Header „Push pull › Meso 1 / Micro 7“. Die Plan-Map nennt „Micro 5 plan“ mit globaler Nummer (in einem 1-Meso-Plan identisch) | 16 |

---

## 7. Konsistenz mit Einzel-Analyse und Dashboards

| Aspekt | Micro-Overview | Home „Current micro“ | Analyse eines Trainings | Analyse-Dashboard |
|---|---|---|---|---|
| Vergleichsbasis | ganzes Vor-Micro im Meso, unbenannt | Vor-Micro, **benannt** („vs M6“) | gleiche Position im Vor-Micro → Vor-Meso → „letztes Workout je Übung“, unbenannt | Kalenderwoche |
| Volumen | `7496.50` (kg, ohne Einheit) | `7.497 kg` | `7496.50` | `0.0t` |
| Delta | absolut, über dem Wert | absolut **und %** | absolut, über dem Wert | – |
| Dauer | `01:46:17`, Überlauf > 24 h | `0h 1m` | `01:46:17` | `0min` |
| Fortschritt | fehlt | Ring „1/4“ | – | „0 Workouts“ |
| RIR | fehlt | „RIR 0.0“ | – | – |
| Plan/Ist-Readout | Plan/Ist | – | Ist/Plan | – |
| Records | fehlen | Karte „Records this micro“ (nur wenn vorhanden) | – | – |

**Beleg:** 10, 35, 40, 59, 61. Die Zahlen sind konsistent: Home und Overview zeigen für M7 dieselben −4207 kg und −12 Sätze. Uneinheitlich ist die **Darstellung**. Home ist heute die verständlichere Wochenbilanz und gleichzeitig eine Sackgasse (M5).

| Home | Einzel-Analyse (M7 D1) | Einzel-Analyse (M6 Pull) | Analyse-Dashboard | Analyse-Metrics |
|---|---|---|---|---|
| <img src="screenshots/gh505/40_home_m7partial.png" width="170"> | <img src="screenshots/gh505/35_m7d1_single_analysis_train.png" width="170"> | <img src="screenshots/gh505/59_m6_pull_single_analysis.png" width="170"> | <img src="screenshots/gh505/61_analyse_dashboard_week.png" width="170"> | <img src="screenshots/gh505/62_analyse_metrics_overview_back.png" width="170"> |

---

## 8. Sprache, Darstellung, Light/Dark

- **Sprache:** In der Overview gibt es keine deutschen Reste. „Bankdrücken“ ist ein Übungsname aus den Nutzerdaten. Im Code heißt die Total-Ansicht intern noch `gesamt` (testID `overview-view-gesamt`); das ist nicht sichtbar.
- **Darstellung:** Spaltenkollision in der Exercise-Ansicht (N1), Worttrennung im Dialog (N6), sehr lange Seite in Total durch nicht trainierte Übungen (H7). Überlappungen der Karten gibt es nicht.
- **Light (Stichprobe):** Keine Light-spezifischen Probleme. Rot und Blau der Deltas sind gut lesbar, die Map-Balken haben genug Kontrast. Alle inhaltlichen Findings gelten unverändert.

| Light: Exercise | Light: Total | Light: Plan M7 | Light: Plan M6 |
|---|---|---|---|
| <img src="screenshots/gh505/46_light_m7_exercise.png" width="200"> | <img src="screenshots/gh505/47_light_m7_total.png" width="200"> | <img src="screenshots/gh505/48_light_m7_plan.png" width="200"> | <img src="screenshots/gh505/49_light_m6_plan.png" width="200"> |

---

## 9. Ticket-Vorschläge (priorisiert, ein Problem = ein Vorschlag)

| Prio | Vorschlag | Finding |
|---|---|---|
| 1 | **Wochenbilanz oben in der Overview**: Trainings x/y, geplante Sätze erfüllt in %, Volumen mit Delta | H2 |
| 2 | **Deltas beschriften und fair vergleichen** („vs M6“; laufende Micros nur bis zur gleichen Position; keine Deltas bei rein geplanten Micros) | H1 |
| 3 | **Muscle Map Plan zeigt Ist auch bei Untererfüllung**, mit Legende Ist/Plan | H3 |
| 4 | **Plan-Tabelle: Ist, Plan, Erfüllung %** statt „Plan − Ist“ mit Vorzeichenfarben | H4 |
| 5 | **Eine Quelle für geplante Sätze** (entfernte Übungen einheitlich behandeln) | H5 |
| 6 | **1RM/Intensität je Muskel korrekt rechnen** oder für Muskeln nicht anbieten | H6 |
| 7 | **Nicht trainierte Übungen getrennt und eingeklappt**, ohne „0.0“/„100“-Deltas | H7 |
| 8 | **Dauer ohne 24-h-Überlauf, Ausreißer wie Training Length behandeln** | M1 |
| 9 | **Laufendes Training einheitlich behandeln** (alle Ansichten) | M2 |
| 10 | **Kennzahl-Karten: Wert mit Einheit groß, Delta klein mit % und Basis** (Format wie Home) | M3 |
| 11 | **Muskel-Tabelle: „Δ vs. Micro N“ und Erklärung gewichteter Sätze** (Rest von GH-458 H7 für die Overview) | M4 |
| 12 | **Home-Karte „Current micro“ öffnet die Overview** und sichtbarer Einstieg im Plan-Header | M5 |
| 13 | **Overview öffnet auf Total** bzw. auf der zuletzt genutzten Ansicht | M6 |
| 14 | **Vergleich „Micro N plan“ durchgängig** (Bildunterschrift/Tabelle) oder auf die Map beschränken, Legende für Tönung/Striche | M7 |
| 15 | **Einheitliche Leserichtung „Ist / Plan“** in Overview und Einzel-Analyse | M8 |
| 16 | **Coach Insight erklärt, warum keine Insight kommt**, neutral statt Fehlerrot | M9 |
| 17 | Exercise-Ansicht: Spaltenbreite, Einheit, Datum je Training | N1 |
| 18 | Leerzustände in Total und auf Home ohne Plan | N2 |
| 19 | Hinweis „Erstes Micro – kein Vergleich“ | N3 |
| 20 | Pager-Knopf auf Micro 1 ausblenden | N4 |
| 21 | Zahlenformat: keine „−0.0“, vollständige Readouts | N5 |
| 22 | Worttrennung im Contribution-Dialog | N6 |
| 23 | Segment „Muscle“ zusammenlegen oder mit Plan/Ist füllen | N7 |
| 24 | Affordance für antippbare Tabellenköpfe/Zellen; globale Metrikwahl kenntlich machen | N8 |

Bereits bestehende Tickets (nicht neu anlegen, ggf. neu priorisieren): **TRN-001 / GH-44** Records in der Overview (offen), **GH-436 B2** Vergleichsbasis der Einzel-Analyse (offen), **GH-436 B8** trivialer Vergleich bei einem Training (offen).

---

## 10. Grenzen dieses Audits

- **Coach Insight** mit echter Antwort war nicht prüfbar: Die Baseline ist älter als 28 Tage, und der auf dem Gerät hinterlegte Key ist ungültig. GH-449 und GH-241 bleiben deshalb ohne Urteil.
- **VL-Insight-Karten** erscheinen nur mit Videoanalysen, die mit Workouts dieses Plans verknüpft sind. Die Baseline enthält keine, die Karten wurden deshalb nicht bewertet.
- Es handelt sich um ein Experten-Audit, nicht um einen Nutzertest. „Wird missverstanden“ ist eine begründete Einschätzung, keine Messung.
- Der Zustand „teilweise absolviert“ wurde zusätzlich zur Baseline (M6) durch eigenes Planen, Starten und Beenden in M7 hergestellt. Danach wurde die Baseline erneut importiert, damit das Gerät den Ausgangszustand hat.

---

## Anhang: Screenshots

Alle unter [`screenshots/gh505/`](screenshots/gh505/). Die Nummern entsprechen den Belegen oben.

| | | | |
|---|---|---|---|
| 01 Home (Baseline)<br><img src="screenshots/gh505/01_home_baseline.png" width="170"> | 03 Drawer<br><img src="screenshots/gh505/03_drawer_m7.png" width="170"> | 04 M7 öffnet auf Exercise<br><img src="screenshots/gh505/04_m7_overview_default.png" width="170"> | 05 M7 leer – Total<br><img src="screenshots/gh505/05_m7_total.png" width="170"> |
| 06 M7 leer – Muscle<br><img src="screenshots/gh505/06_m7_muscle.png" width="170"> | 07 M7 leer – Plan<br><img src="screenshots/gh505/07_m7_plan.png" width="170"> | 08 M7 leer – Exercise Overview<br><img src="screenshots/gh505/08_m7_total_scrolled.png" width="170"> | 09 Pager lässt Drawer offen<br><img src="screenshots/gh505/09_m6_after_pager.png" width="170"> |
| 10 M6 teilweise – Total<br><img src="screenshots/gh505/10_m6_total.png" width="170"> | 11_s1 M6 Total (Scroll)<br><img src="screenshots/gh505/11_m6_total_s1.png" width="170"> | 11_s2 M6 Total (Scroll)<br><img src="screenshots/gh505/11_m6_total_s2.png" width="170"> | 11_s3 M6 Total – Seitenende, keine Records<br><img src="screenshots/gh505/11_m6_total_s3.png" width="170"> |
| 12 M6 – Exercise<br><img src="screenshots/gh505/12_m6_exercise.png" width="170"> | 13 M6 – Muscle<br><img src="screenshots/gh505/13_m6_muscle.png" width="170"> | 14 M6 – Plan<br><img src="screenshots/gh505/14_m6_plan.png" width="170"> | 15 Vergleichsauswahl<br><img src="screenshots/gh505/15_m6_plan_compare_menu.png" width="170"> |
| 16 vs Micro 5 plan<br><img src="screenshots/gh505/16_m6_plan_vs_m5plan.png" width="170"> | 17 Metrik-Auswahl<br><img src="screenshots/gh505/17_m6_plan_metric_menu.png" width="170"> | 18 Volume vs Micro 5 plan<br><img src="screenshots/gh505/18_m6_plan_volume_vs_m5plan.png" width="170"> | 19 M5 komplett – Total<br><img src="screenshots/gh505/19_m5_total.png" width="170"> |
| 20 M5 – Plan<br><img src="screenshots/gh505/20_m5_plan.png" width="170"> | 21 M5 – Exercise<br><img src="screenshots/gh505/21_m5_exercise.png" width="170"> | 23 M4 nach Wischen (Dauer-Überlauf)<br><img src="screenshots/gh505/23_m4_total_after_swipe.png" width="170"> | 24 M1 erstes Micro<br><img src="screenshots/gh505/24_m1_total.png" width="170"> |
| 26 M1 – Plan (12 vs 14)<br><img src="screenshots/gh505/26_m1_plan.png" width="170"> | 27 M1 – „No previous plan“<br><img src="screenshots/gh505/27_m1_plan_compare_menu.png" width="170"> | 28 M7 nur geplant – Total<br><img src="screenshots/gh505/28_m7planned_total.png" width="170"> | 29 M7 nur geplant – Plan<br><img src="screenshots/gh505/29_m7planned_plan.png" width="170"> |
| 29b Plan-Tabelle ohne Ist<br><img src="screenshots/gh505/29b_m7planned_plan_scrolled.png" width="170"> | 30 M7 nur geplant – Exercise<br><img src="screenshots/gh505/30_m7planned_exercise.png" width="170"> | 31 Training läuft, 3 Sätze<br><img src="screenshots/gh505/31_m7_started_train_logged.png" width="170"> | 32 läuft – „No executed trainings“<br><img src="screenshots/gh505/32_m7started_exercise.png" width="170"> |
| 33 läuft – Total zählt mit<br><img src="screenshots/gh505/33_m7started_total.png" width="170"> | 34 läuft – Plan<br><img src="screenshots/gh505/34_m7started_plan.png" width="170"> | 35 Einzel-Analyse nach Finish<br><img src="screenshots/gh505/35_m7d1_single_analysis_train.png" width="170"> | 36 M7 teilweise – Exercise<br><img src="screenshots/gh505/36_m7partial_exercise.png" width="170"> |
| 37 M7 teilweise – Total<br><img src="screenshots/gh505/37_m7partial_total.png" width="170"> | 38 M7 teilweise – Muscle<br><img src="screenshots/gh505/38_m7partial_muscle.png" width="170"> | 39 M7 teilweise – Plan (Ist unsichtbar)<br><img src="screenshots/gh505/39_m7partial_plan.png" width="170"> | 40 Home nach 1/4<br><img src="screenshots/gh505/40_home_m7partial.png" width="170"> |
| 41 Home gescrollt<br><img src="screenshots/gh505/41_home_m7partial_scrolled.png" width="170"> | 42 Tap auf Hero-Karte: keine Navigation<br><img src="screenshots/gh505/42_home_hero_tap_no_nav.png" width="170"> | 43 Contribution-Dialog<br><img src="screenshots/gh505/43_m6_muscle_cell_contribution.png" width="170"> | 44 Metrik-Picker<br><img src="screenshots/gh505/44_m6_metric_header_picker.png" width="170"> |
| 45 1RM je Muskel identisch<br><img src="screenshots/gh505/45_m6_muscle_1rm_column.png" width="170"> | 50 Leere App – Onboarding<br><img src="screenshots/gh505/50_empty_onboarding.png" width="170"> | 51 Onboarding 2<br><img src="screenshots/gh505/51_empty_onboarding_2.png" width="170"> | 52 Onboarding 3<br><img src="screenshots/gh505/52_empty_onboarding_3.png" width="170"> |
| 53 Home ohne Plan<br><img src="screenshots/gh505/53_empty_home_no_plan.png" width="170"> | 54 Drawer leerer Plan<br><img src="screenshots/gh505/54_empty_drawer.png" width="170"> | 55 Leer – Exercise<br><img src="screenshots/gh505/55_empty_overview_default.png" width="170"> | 56 Leer – Total<br><img src="screenshots/gh505/56_empty_overview_total.png" width="170"> |
| 57 Leer – Muscle<br><img src="screenshots/gh505/57_empty_overview_muscle.png" width="170"> | 58 Leer – Plan<br><img src="screenshots/gh505/58_empty_overview_plan.png" width="170"> | 59 Einzel-Analyse M6 Pull<br><img src="screenshots/gh505/59_m6_pull_single_analysis.png" width="170"> | 60 Maestro-geprüft: M6 Total<br><img src="screenshots/gh505/60_maestro_m6_total_asserted.png" width="170"> |
