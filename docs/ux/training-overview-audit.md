# UX-Audit: Trainings-Overview („Micro N Overview“) – Runde 2

**Ticket:** [GH-505](https://github.com/julimetzger/Gainalytics/issues/505) · Audit der Trainings-Overview
**Runde 2:** 24.10.2026. Erneuter Durchgang nach dem Overview-Umbau [GH-526](https://github.com/julimetzger/Gainalytics/issues/526) (PR #531). [GH-517](https://github.com/julimetzger/Gainalytics/issues/517) ist darin aufgegangen, [GH-527](https://github.com/julimetzger/Gainalytics/issues/527) (H5/H6) ist noch offen. Runde 1 stammt vom 12.10.2026. Ihre Screenshots liegen in der Git-Historie dieses Branches (Commit `5112d3e8`).
**Gerät:** Android-Emulator `sdk_gphone64_x86_64`, Android 14 (API 34), 1080 × 2400, Schriftgröße 1,0. **Das Testgerät R5CN30HWZFN aus der Ticketbeschreibung stand in dieser CI-Umgebung nicht zur Verfügung. Der Emulator ersetzt es.** Abweichungen, die nur auf dem Samsung mit größerer Schrift auftreten (abgeschnittene Readouts), sind daher nicht abgedeckt.
**Build:** Debug-APK 0.182, gebaut aus diesem Checkout (PR-#511-Branch mit aktuellem master gemergt). Das JS-Bundle ist im APK eingebettet und entspricht exakt diesem Stand. Der Diff enthält keinen App-Code.
**Daten:** Zuerst ein Durchgang mit **leerer App** (frische Installation, Onboarding übersprungen, leerer Plan „Audit“). Danach wurde `baseline.gains` über den regulären Import (Settings → Import Data) eingespielt. Im Datei-Picker war die Datei erst nach einem Media-Scan sichtbar. Geprüft per UI-Dump: „Push pull“ ist sichtbar. Für die Zustände „nur geplant“, „läuft“ und „teilweise“ wurde in Micro 7 „Push squat“ geplant, gestartet (3 Sätze) und beendet.
**Theme:** Dark im Hauptdurchgang, Light als Stichprobe.
**Art:** Experten-Audit mit Schwerpunkt **Verständlichkeit der Analysen (Ist = „Done“, Plan = „Plan“)**. Read-only, **keine** Änderung am App-Code. Der Diff enthält nur diesen Report und die Screenshots unter [`screenshots/gh505/`](screenshots/gh505/).

---

## 0. Gesamtaussage

**Deutlich besser als in Runde 1, aber noch nicht zuverlässig. Wer eine abgeschlossene Woche ansieht, versteht jetzt, wie sie gelaufen ist. Wer mitten in der Woche schaut, wird weiterhin in die Irre geführt, und was er ändern sollte, sagt ihm die Overview nicht.**

Was GH-526 gelöst hat:
- **Jede Zahl hat jetzt eine benannte Vergleichsbasis.** Chips „vs Micro 5 | vs Plan“, darunter die Zeile „Micro 6 (done) vs Micro 5 (done)“. Die Karten zeigen „15 / 59“ mit Delta und Prozent darunter, die Tabellen „Δ vs Micro 5“ (H1-Basis, M3, M4).
- **Plan gegen Ist ist im Total-Tab angekommen** („vs Plan“: Trainings, Sätze, Volumen, Map und Tabelle gegen den Plan dieses Micros) (H2 teilweise).
- **Die Muscle Map zeigt Untererfüllung.** Der Ist-Balken liegt über dem Referenzbalken, eine Marke zeigt die Referenz. Legende und Spaltenkopf („Done/Plan“) sagen, was was ist (H3). Leserichtung und Komponenten sind in Overview und Einzel-Analyse gleich (M8).
- Die Dauer läuft nicht mehr nach 24 h über (M1 teilweise). Für dasselbe Micro widersprechen sich Map und Tabelle nicht mehr (H5-Symptom).

Was die Kernfrage „wie lief meine Woche?“ weiterhin verfälscht:
1. **„Trainings 1 / 1“ in einer Woche mit 4 Trainings.** Der Nenner zählt nur Trainings, die schon Plan-Sätze haben. Micro 7 nach dem ersten von vier Trainings zeigt „1 / 1 ±0 (±0 %)“, Home zur gleichen Zeit „1/4“. Die einzige Wochenbilanz der Overview meldet „fertig“, obwohl drei Trainings fehlen (**neu, R2-H1**).
2. **Standard-Vergleich ist weiterhin „ganzes Vor-Micro“.** Eine leere oder erst begonnene Woche erscheint rot: Micro 7 leer „−15 (−100 %)“, nach einem Training „−12 (−80 %)“. Die Zeile nennt ein leeres Micro „Micro 7 (done)“ (**H1 teilweise**).
3. **Der Plan-Tab vergleicht unvergleichbare Pläne.** Plan M6 (1 Training) gegen Plan M5 (4 Trainings) ergibt „−76 %“. Plan M7 (nur „Push squat“) gegen Plan M6 (nur „Pull“) ergibt Back „0/8“ und Chest „4/0“ (**neu, R2-H2**).
4. **Falsche bzw. irreführende Einzelwerte bleiben:** 1RM je Muskel ist für jeden Muskel gleich (H6, GH-527). Nicht trainierte Übungen erscheinen mit „0.0 / −138.7“ und „100 / +25“ (H7). Das laufende Training zählt nur halb (M2). Ein 42-h-„Training“ erscheint als blaues „+40h 12min“ (M1 + R2-M2).
5. **Keine Ableitung:** Keine Ansicht formuliert, was zu tun ist („Back: 6 Sätze unter Plan“). Coach Insight ist ohne API-Key komplett unsichtbar (R2-N4).

**Größter Hebel jetzt:** (a) den Trainingszähler gegen die Trainings des Plans rechnen und „vs Plan“ in laufenden Micros zum Standard machen; (b) „vs Vor-Micro“ nur bis zur gleichen Position vergleichen. Damit beantwortet der obere Teil der Overview die Kernfrage auch mitten in der Woche.

| Abgeschlossen (M5 vs Plan) | Mitten in der Woche (M7 vs Plan) | Home zur gleichen Zeit |
|---|---|---|
| <img src="screenshots/gh505/c05_m5_total_vs_plan.png" width="220"> | <img src="screenshots/gh505/f13_m7partial_total_vs_plan.png" width="220"> | <img src="screenshots/gh505/h01_home_m7partial.png" width="220"> |

---

## 1. Vorgehen und durchlaufene Zustände

1. Runde-1-Report, GH-526 (Code, Kommentare, Maestro-Flows `gh526_*.yaml`), GH-527/GH-517 (TODOS.md), GH-436-, GH-458- und GH-44-Status gesichtet.
2. Code der neuen Overview gelesen, um die Formel hinter jeder Zahl zu kennen: `MicroOverview.tsx`, `MicroPlanOverview.tsx`, `MuscleMapCard.tsx`, `MuscleMapBarList.tsx`, `ComparisonKpiCards.tsx`, `overview-comparison.ts`, `CoachInsightCard.tsx`, `MicroHeroCard.tsx`.
3. Auf dem Emulator alle Zustände durchgespielt (Plan „Push pull“, Meso 1):

| Zustand | Micro | Wie hergestellt | Screenshots |
|---|---|---|---|
| Leere App | – | frische Installation, Onboarding „Skip“, leerer Plan „Audit“ | e01–e09 |
| Komplett absolviert | M5 (4/4) | Baseline | c04, c05, c07 |
| Teilweise (Baseline) | M6 (nur „Pull“) | Baseline | b04–b19, s01 |
| Unvollständig ohne Plan-Slot | M3 (3 Trainings, „Pull dl“ nie angelegt) | Baseline | c09 |
| Ausreißer > 24 h | M4 (Pull dl 42 h 26 min) | Baseline | c08 |
| Erstes Micro ohne Vorgänger | M1 | Baseline | c10–c12, d02 |
| Leer (Zukunft) | M7 | Baseline | f01 |
| Nur geplant | M7 | „Push squat“ per *Suggest based on last Training* | f02–f06 |
| Läuft (STARTED, 3 Sätze) | M7 | Training gestartet, 2 × Adductor + 1 × Squat bestätigt | f07–f10 |
| Teilweise, 1 Training beendet | M7 | „Push squat“ beendet | f11–f13 |
| Light-Stichprobe | M7 | Settings → Theme Light | l01–l03 |
| Konsistenz | – | Home, Einzel-Analyse des Trainings | b01, h01, g01–g03 |

4. Zahlen nachgerechnet (Abschnitt 4), mit einem Skript direkt über `baseline.gains`. Ein Maestro-Flow prüft die Werte auf dem Gerät: 1/1 Passed. Eine Negativprobe mit falschem Erwartungswert schlägt wie erwartet fehl.

---

## 2. Aufbau der Overview (Ist-Zustand nach GH-526)

**Einstieg:** unverändert. Plan öffnen → Hamburger → Textzeile „Overview“ im Drawer. Micro-Wechsel per Wischen (die Ansicht bleibt erhalten) oder über den Pager „‹ Micro 5 | Micro 7 ›“ im Drawer. Neu: Rechts neben dem Titel steht die Zeitspanne der Trainings des Micros („17/02 – 27/02/2026“).

| Drawer | Öffnet auf „Exercise“ | Total, vs Micro 5 | Total, vs Plan | Plan-Tab |
|---|---|---|---|---|
| <img src="screenshots/gh505/c01_drawer_pager_m6.png" width="170"> | <img src="screenshots/gh505/b04_m6_default_exercise.png" width="170"> | <img src="screenshots/gh505/b05_m6_total_vs_prev.png" width="170"> | <img src="screenshots/gh505/b14_m6_total_vs_plan_map.png" width="170"> | <img src="screenshots/gh505/b18_m6_plan.png" width="170"> |

Vier Segmente:
- **Total:** Chips **„vs Micro N“** (Standard) und **„vs Plan“**, darunter eine Zeile, die beide Seiten nennt. Dazu drei KPI-Karten: bei „vs Micro“ Duration/Sets/Volume, bei „vs Plan“ Trainings/Sets/Volume, jeweils als `Wert / Referenz` mit Delta und Prozent. Darunter die **Muscle Map** (Total | Diff, Sets | Volume; Tap auf eine Zeile klappt Plan/Done von Vor-Micro und diesem Micro auf), Coach Insight (nur mit API-Key), **Muscle Overview** und **Exercise Overview** mit „Δ vs …“.
- **Exercise:** je beendetem Training eine Karte mit Sets, Reps, RIR, Weight (unverändert).
- **Muscle:** je beendetem Training eine Muskel-Tabelle ohne Deltas (unverändert).
- **Plan:** fester Vergleich **„Plan M6 vs Plan M5“** mit Sets/Volume-Karten, Muscle Map und Muskel-Tabelle. Ohne Vorgänger steht dort „No reference available — there is no plan of a previous micro in this meso.“

**Records** gibt es in der Overview weiterhin nicht. Die Seite endet nach der Exercise Overview (b16).

---

## 3. Verständlichkeit je Kennzahl und Diagramm

„Bezug erkennbar?“ heißt: Sagt der Screen selbst, worauf sich die Zahl bezieht (Ist/Plan, welches Micro, Vergleich wozu)?

| Element | Was es zeigt | Bezug und Vergleichsbasis erkennbar? | Was wird missverstanden? | Beleg |
|---|---|---|---|---|
| Header „Micro 7 Overview“ + Datum | Micro und Zeitspanne der *datierten* Trainings | Micro ja, Zeitraum teilweise | Das Datum ist die Spanne der Trainingsdaten, nicht die Woche. M5 „17/02 – 27/02“ überlappt M4 „16/02 – 21/02“. Ein leeres oder rein geplantes Micro hat kein Datum (R2-N2) | c04, c08, f01 |
| Chips „vs Micro 6 / vs Plan“ + Zeile | Welche Referenz gilt | **Ja**, klar benannt | Ein leeres, zukünftiges Micro heißt „Micro 7 (done)“. Standard ist „vs Micro“ auch mitten in der Woche (H1) | b05, f01 |
| KPI **Duration** (vs Micro) | Ist: Summe der beendeten Trainings, `6h 34min` | Ja („/ 45h 56min“) | Laufendes Training zählt 0 min (M2). Länger ist blau = „besser“, auch beim 42-h-Ausreißer (R2-M2) | c04, c08, f09 |
| KPI **Sets** | Ist-Sätze, inkl. laufendem Training | Ja | In laufenden Wochen dominiert das rote „−80 %“ (H1) | b05, f09 |
| KPI **Volume** | Ist Σ Gewicht × Wdh. in t | Ja, mit Einheit | – | b05, c05 |
| KPI **Trainings** (vs Plan) | beendete Trainings / Trainings **mit Plan-Sätzen** | Scheinbar ja, inhaltlich nein | „1 / 1“ heißt nicht „1 von 1 geplanten Trainings der Woche“, sondern „1 von 1 schon geplanten“. Home zeigt 1/4 (R2-H1) | f13, h01, c09 |
| **Muscle Map – Total** | Ist-Balken über Referenzbalken, Marke = Referenz, Readout `Ist/Ref` | **Ja**: Legende „■ Done □ Plan“, Spaltenkopf „Done/Plan“ | Rosa/Mauve-Balken (< 60 % der Referenz) erklärt keine Legende. Im Light-Theme ist der Ist-Balken mauve, das Legendenfeld „Done“ dunkelblau (R2-M1) | b14, c09, l02 |
| **Muscle Map – Diff** | Δ je Muskel, links „less“, rechts „more“, sortiert nach größter Lücke | Ja („Δ vs Micro 5“) | Bei Teilwochen sind alle Balken rot (H1) | b11 |
| **Muscle Map – Zeilen-Details** | Plan/Done von Vor-Micro und diesem Micro | Ja, beschriftet („Plan M5 14 · Plan M6 8 −6 …“) | Gut. Die einzige Stelle, an der Plan und Ist beider Wochen nebeneinander stehen | b12 |
| **Muscle Overview** (Total) | Ist je Muskel mit „Δ vs …“ | Ja, Kopfzeile „Δ vs Micro 5“ / „Δ vs Plan“ | „8.00 Sätze“, „2.80“: gewichtete Sätze unerklärt. „−0.0“ in Rot. Volumenzellen ohne „t“ (M4, N5) | b07, b15 |
| Spalte **1RM** je Muskel | e1RM der stärksten Übung, für **alle** Muskeln gleich | – | „226.7 kg“ für Back, Biceps, Chest, Core … (H6, GH-527) | d02 |
| **Exercise Overview** (vs Micro) | Ist je Übung, auch nur im Vor-Micro trainierte | Ja („Δ vs Micro 5“) | 0.0 / −138.7 rot und 100 / +25 blau für nicht trainierte Übungen (H7) | b08, b10 |
| **Exercise Overview** (vs Plan) | Ist gegen Plan je Übung (e1RM, Reps, Max Intensity) | Ja („Δ vs Plan“) | „Triceps overhead ext. 1RM 16.7 / −44.9“ (rot) und zugleich „Max Intensity 81 / +10“ (blau): Dieselbe Abweichung erscheint als schlechter und als besser (R2-M3) | b16 |
| Segment **Exercise** | Ist je beendetem Training | Trainingsname ja, Datum nein | Weight ohne Einheit, „0 10.5-13.5“ klebt zusammen. Laufendes Training fehlt (N1, M2) | b04, f08 |
| Segment **Muscle** | Ist je Training, ohne Δ, ohne Plan | Ja (pro Training) | Kein Mehrwert gegenüber Total (N7) | b17 |
| **Plan-Tab** | Plan dieses Micros vs Plan des Vor-Micros | **Ja**, Titel „Plan M6 vs Plan M5“ | Vergleicht einen Plan mit 1 Training gegen einen mit 4 („−76 %“). Push-Plan gegen Pull-Plan („Back 0/8“). Rosa „unter Referenz“ wirkt wie „zu wenig trainiert“ (R2-H2, R2-M1) | b18, f06 |
| Coach Insight | KI-Text, nur mit Key | – | Ohne Key verschwindet die Karte spurlos (R2-N4) | b06 |

**Fazit Ist gegen Plan:** Der Unterschied ist jetzt **sprachlich klar**: „Done“ gegen „Plan“, Readout `Done/Plan`, Legende, „Δ vs Plan“. Das ist der größte Fortschritt gegenüber Runde 1. **Inhaltlich klar ist er nur für abgeschlossene, vollständig geplante Micros** (M5: 4/4, 59/59, +3 %). Für laufende Wochen liefern der Trainingszähler (R2-H1), der Standard-Vergleich (H1) und der Plan-Tab (R2-H2) Aussagen, die ein Nutzer falsch versteht.

---

## 4. Stichproben: angezeigte Zahlen gegen geloggte Daten

Nachgerechnet mit einem Skript direkt aus `baseline.gains` (Sätze = Anzahl Sätze; Volumen = Σ Gewicht × Wdh.; Dauer = Σ end − start der beendeten Trainings; Muskel-Sätze = Sätze × Muskel-% / 100; e1RM = Gewicht × (1 + Wdh./30)). Die mit **M** markierten Werte prüft außerdem der Maestro-Flow `gh505_spotcheck.yaml` auf dem Gerät per `assertVisible`/`copyTextFrom` (1/1 Passed, s01). Eine Negativprobe (`" / 4"` statt `" / 1"`) schlägt wie erwartet fehl.

| # | Kennzahl | Angezeigt | Nachgerechnet | Ergebnis | Beleg |
|---|---|---|---|---|---|
| S1 | M6 vs M5: Sets | 15 / 59, −44 (−75 %) **M** | 15 / 59 → −44, −74,6 % | ✅ | b05, s01 |
| S2 | M6 vs M5: Volume | 7.5t / 45.6t, −38.1t (−84 %) **M** | 7.496,5 / 45.575 kg → −38.078,5 kg, −83,6 % | ✅ | b05 |
| S3 | M6 vs M5: Duration | 1h 46min / 6h 34min, −4h 47min **M** | 1:46:17 / 6:33:44 | ✅ | b05 |
| S4 | M6 vs Plan | Sets 15 / 14 +1 (+7 %), Volume −0.3t (−3 %), Hamstrings 5/4 **M** | Plan 14 Sätze, 7.747 kg → −250,5 kg; Hamstrings 5,0 / 4,0 | ✅ | s01 |
| S5 | M5 vs M4 | Sets 59 / 44 +15 (+34 %), Volume 45.6t / 36.0t +9.5t (+26 %), Duration 6h 34min / 45h 56min | 59 / 44; 45.575 / 36.047,5 kg; 45:56 h (Pull dl 42 h 26 min) | ✅ Kein Überlauf mehr (Runde 1: 21:56:10) | c04 |
| S6 | M5 vs Plan | 4 / 4, 59 / 59, 45.6t / 44.1t (+3 %) | 4 / 4; 59 / 59; 44,1 t | ✅ | c05 |
| S7 | M1 Plan: Back | Map 14, Tabelle 14.00 (Total vs Plan und Plan-Tab) | 14,0 inkl. 2 Sätze „SA lat pulldown“, der nicht in der Übungsliste des Trainings steht | ✅ konsistent (Runde 1: 12 vs 14). Ursache aus H5 besteht weiter | c11, c12 |
| S8 | M7 nach 3 Sätzen | Volume 3.3t **M**, Home 3,290 kg | 12×105 + 11×105 + 5×175 = 3.290 kg | ✅ | f12, h01 |
| S9 | M7 vs Plan: Trainings | 1 / 1 ±0 (±0 %) **M** | Plan hat 4 Trainings (Home: 1/4). Nur „Push squat“ hat Plan-Sätze | ❌ rechnerisch „richtig“, inhaltlich falsch (R2-H1) | f13, h01 |
| S10 | M1 „1RM“ je Muskel | 226.7 für **jeden** Muskel | Der Wert ist das e1RM der stärksten Übung des Micros, nicht je Muskel | ❌ (H6, GH-527) | d02 |
| S11 | M6 Triceps overhead ext., 1RM vs Plan | 16.7 / −44.9 | Plan 2 × 44 kg × 12 → 61,6; Ist 13,5 × 7 → 16,65 | ✅ rechnerisch, ❌ Darstellung (R2-M3) | b16 |
| S12 | M3 vs Plan | 3 / 3, Sets 45 / 46, Volume 35.1t / 34.5t, Core 1.9/3.9 | 45 / 46; 35.105 / 34.500 kg; Core 1,9 / 3,9; „Pull dl“ M3 existiert nicht | ✅ Werte, ❌ Trainingszähler (R2-H1) | c09 |

**Ergebnis:** Alle nachgerechneten Summen, Deltas und Prozentwerte stimmen. Falsch bzw. irreführend sind die **Definitionen**: der Nenner des Trainingszählers, 1RM je Muskel, Intensität gegen Plan.

---

## 5. Status der Findings aus Runde 1

| Finding (Runde 1) | Status | Was heute zu sehen ist | Beleg | Ticket |
|---|---|---|---|---|
| **H1** Deltas ohne Basis, Teilwochen gegen volle Wochen | **teilweise** | Basis überall benannt (Chips, Zeile, „Δ vs Micro 5“). Leere/laufende Wochen weiterhin gegen ganze Vor-Wochen: „−100 %“, „−80 %“ in Rot. Leeres Micro heißt „(done)“ | b05, f01, f12 | GH-526 (Rest → V2) |
| **H2** Keine Wochenbilanz, Plan-Erfüllung versteckt | **teilweise** | „vs Plan“ liefert Trainings x/y, Sets x/y, Volumen. Aber nur per Chip, nicht Standard, scrollt mit, und der Trainingszähler ist falsch (R2-H1) | f13, c05 | GH-517 → GH-526 (Rest → V1, V2) |
| **H3** Muscle Map zeigt Untererfüllung nicht | **behoben** | Ist-Balken über Referenzbalken mit Marke, Legende, Readout „Done/Plan“, Akzentfarbe unter 60 %. Neu: Akzentfarbe ohne Legende (R2-M1) | b14, c09 | GH-526 |
| **H4** Plan-Tabelle „Plan − Ist“ mit Gut/Schlecht-Farben | **behoben** | Tabelle zeigt Ist mit „Δ vs Plan“ (Ist − Plan): Hamstrings +1.00 = mehr als geplant, Back −0.8 t = weniger | b15, c11 | GH-526 |
| **H5** Zwei Planwerte in derselben Ansicht | **teilweise** | Symptom in der Overview weg (Map = Tabelle = 14). Ursache offen: Plan-Sätze von Übungen, die nicht mehr in der Übungsliste des Trainings stehen, zählen mit (S7) | c11, c12 | **GH-527** |
| **H6** 1RM/Intensität je Muskel überall gleich | **offen** | 226.7 für jeden Muskel | d02 | **GH-527** |
| **H7** Nicht trainierte Übungen als Rückschritt und Verbesserung | **offen** (bei „vs Micro“) | „45 degree crunch 0.0 / −138.7, 100 / +25“. Bei „vs Plan“ erscheinen nur Übungen dieses Micros | b08, b10, b16 | → V4 |
| **M1** Dauer springt nach 24 h zurück, Ausreißer zählen voll | **teilweise** | Kein Überlauf mehr („45h 56min“). Der 42-h-Ausreißer zählt weiter voll und erscheint als blaues „+40h 12min“ | c08, c04 | → V6 |
| **M2** Laufendes Training zählt halb | **offen** | Sets 3 und 3.3t zählen. Duration 0 min, Trainings 0/1, Exercise „No executed trainings in this micro.“ | f08, f09, f10 | → V5 |
| **M3** KPI-Karten: Delta über Wert, keine Einheit | **behoben** | „15 / 59“, darunter „−44 (−75 %)“. Volumen in t, Dauer in h/min | b05 | GH-526 |
| **M4** Gewichtete Sätze unerklärt, Δ-Zeitraum fehlt | **teilweise** | „Δ vs Micro 5“ steht da. „2.80“ Sätze weiter ohne Erklärung, der Contribution-Dialog ist nur per Tap auf die Zelle erreichbar | b07, d03 | → V9 |
| **M5** Overview schwer zu finden | **offen** | Weiter nur die Textzeile im Drawer. Die Home-Karte „Current micro“ hat keinen Tap-Handler, nur der Tagesstreifen öffnet ein *Training* | c01, e03 | → V10 |
| **M6** Overview öffnet immer auf „Exercise“ | **offen** | Jedes Öffnen über den Drawer → „Exercise“, bei leeren Micros „No executed trainings“ | b04, f03, e06 | → V11 |
| **M7** Vergleich „Micro N plan“ halb umgesetzt | **behoben** (in neuer Form) | Plan-Tab: fester Vergleich, Karten, Map und Tabelle folgen alle „Plan M6 vs Plan M5“. Neu: Was verglichen wird, passt oft nicht (R2-H2) | b18, b19 | GH-526 (Rest → V3) |
| **M8** Leserichtung Plan/Ist vertauscht | **behoben** | Overview und Einzel-Analyse: „Done/Plan“, gleiche Komponenten | b14, g01 | GH-526 |
| **M9** Coach Insight: Fehlerrot statt Erklärung | **nicht prüfbar** | Auf dem Emulator ist kein Key hinterlegt. Die Karte wird dann gar nicht gerendert (R2-N4) | b06 | – |
| **N1** Exercise-Ansicht: Spalten kollidieren, keine Einheit | **offen** | „0 10.5-13.5“, „Weight“ ohne kg, kein Datum je Training | b04 | → V12 |
| **N2** Leere Zustände ohne Hinweis | **teilweise** | Map „Nothing trained in this micro yet.“, Plan-Tab mit klarem Leertext. Muscle-/Exercise-Overview zeigen nur Kopfzeilen | e07, e09 | → V13 |
| **N3** Erstes Micro: fehlende Deltas unkommentiert | **weitgehend behoben** | Plan-Tab: „No reference available — …“. Total: „vs previous micro“ ist ausgegraut, es wird still auf „vs Plan“ gewechselt | c10, c12 | – |
| **N4** Pager auf Micro 1 zeigt „‹ Micro 1“ | **offen** | Deaktivierter Knopf trägt weiter das eigene Label | e05 | → V14 |
| **N5** Zahlenformat „−0.0“, „+0.00“ | **offen** | „4.9 / −0.0“ in Rot, „+0.00“ | b15 | → V15 |
| **N6** Silbentrennung im Contribution-Dialog | **nicht erneut reproduziert** | Dialog funktioniert. Mit den geprüften Namen („Stationary lunges“) gibt es keine Worttrennung | d03 | – |
| **N7** Segment „Muscle“ ohne Mehrwert | **offen** | Unverändert | b17 | → V16 |
| **N8** Versteckte Bedienung, globale Metrikwahl | **teilweise** | Map-Zeilen haben jetzt ▾. Tabellenköpfe und Zellen weiter ohne Hinweis, der Picker sagt nicht, dass die Wahl global ist | d01 | → V17 |

---

## 6. Neue Findings (Runde 2)

Jedes Finding nennt: was, warum ein Problem, Beleg, Vorschlag.

### Hoch

#### R2-H1 – Trainingszähler „x / y“ zählt nur Trainings, die schon Plan-Sätze haben
**Was:** Bei „vs Plan“ ist der Nenner die Zahl der Trainings dieses Micros mit Plan-Sätzen (`plannedWorkouts` nicht leer). M7 nach dem ersten von vier Trainings: „Trainings 1 / 1 ±0 (±0 %)“. Home zeigt zur gleichen Zeit „1/4“ und der Plan-Eintrag „Active · M7 · 1/4“. M6 (nur „Pull“): „1 / 1“. M3 („Pull dl“ wurde nie angelegt): „3 / 3“.
**Warum ein Problem:** Das ist die einzige Wochenbilanz der Overview, und sie meldet „vollständig“, solange man die restlichen Trainings noch nicht geplant hat. Genau der Fall „mitten in der Woche“ wird falsch beantwortet. Home und Overview widersprechen sich.
**Beleg:** f13 gegen h01 und h02; b14 / s01 (M6); c09 (M3); S9, S12.
**Vorschlag:** Nenner = Trainings des Plans in diesem Micro (wie Home, `trainingNames`). Nicht geplante Trainings zählen als „offen“ („1 von 4 · 3 nicht geplant“). Gleiche Zahl wie Home.

#### R2-H2 – Plan-Tab vergleicht unvergleichbare Pläne
**Was:** Der Plan-Tab vergleicht den **ganzen** Plan dieses Micros mit dem **ganzen** Plan des Vor-Micros. In der Baseline: Plan M6 (nur „Pull“ geplant) gegen Plan M5 (4 Trainings) ergibt „Sets 14 / 59 −45 (−76 %)“ in Rot und alle Muskeln rosa. Plan M7 (nur „Push squat“) gegen Plan M6 (nur „Pull“) ergibt Back „0/8“, Chest „4/0“, Volume „+57 %“.
**Warum ein Problem:** „Hat sich der Plan gesteigert?“ ist eine Progressionsfrage pro Training bzw. pro vollständiger Woche. Der Screen beantwortet sie mit dem Planungsfortschritt (wie viele Trainings schon geplant sind) und vergleicht Push mit Pull. Wer das liest, glaubt, er habe den Plan um drei Viertel gekürzt.
**Beleg:** b18, f06.
**Vorschlag:** Nur gleiche Trainingspositionen vergleichen („geplant: D1, D4 · verglichen mit M6 D1, D4“). Bei unterschiedlicher Anzahl geplanter Trainings sichtbar darauf hinweisen. Alternativ den Vergleich erst zeigen, wenn alle Trainings des Micros geplant sind.

### Mittel

#### R2-M1 – Akzentfarbe „unter 60 % der Referenz“ ohne Legende, im Plan-Tab und in Light missverständlich
**Was:** Ist-Balken unter 60 % ihrer Referenz werden rosa (Dark) bzw. mauve (Light) statt blau. Die Legende zeigt nur „■ Done“ (blau) und „□ Plan“. Im Plan-Tab gilt dieselbe Farbe für „Plan kleiner als Vor-Plan“. Im Light-Theme ist der mauve Balken neben dem dunkelblauen Legendenfeld kaum als Warnung erkennbar und wirkt wie eine andere Serie.
**Warum ein Problem:** Farbe ohne Bedeutung wird geraten: „rosa = anderer Datensatz?“ Im Plan-Tab suggeriert sie „zu wenig trainiert“, obwohl es um einen Plan geht.
**Beleg:** b05, b14, c09 (Dark), l02, l03 (Light), b18 (Plan-Tab).
**Vorschlag:** Legendeneintrag „■ unter 60 % von {Referenz}“. Im Plan-Tab ohne Warnfarbe. Für Light eine kontrastreichere Warnfarbe (z. B. die Error-Tönung) wählen.

#### R2-M2 – Farbsemantik der Deltas: „mehr = blau = gut“ auch bei der Dauer
**Was:** Alle Deltas werden nach Vorzeichen gefärbt: mehr ist blau, weniger ist rot. M4 zeigt „Duration 45h 56min / 5h 44min **+40h 12min**“ in Blau. Ursache ist ein vergessenes Finish (Pull dl 42 h 26 min).
**Warum ein Problem:** Längere Dauer ist keine Leistung. Ein offensichtlicher Datenfehler erscheint als Erfolg, und der Ausreißer wird nicht markiert (Rest von M1).
**Beleg:** c08; Gegenbeispiel c04 (−39h 22min rot).
**Vorschlag:** Dauer-Delta neutral (grau) einfärben. Trainings über einer Schwelle (z. B. > 4 h) wie in „Training Length“ (GH-458 H6) markieren: „1 Training > 4 h – prüfen“.

#### R2-M3 – Exercise Overview „vs Plan“: e1RM und Max Intensity widersprechen sich
**Was:** Gegen den Plan zeigt die Tabelle je Übung e1RM, Reps und Max Intensity (%1RM) mit Delta. Triceps overhead extension (M6): Plan 2 × 44 kg × 12, gemacht 13,5 kg × 7 und 10,5 kg × 12. Angezeigt werden „1RM 16.7 / −44.9“ (rot) und „Max Intensity 81 / **+10**“ (blau).
**Warum ein Problem:** Dieselbe Abweichung (viel leichter als geplant) erscheint gleichzeitig als Rückschritt und als Verbesserung. „e1RM eines Plans“ und „%1RM gegen Plan“ sind für Nutzer abstrakt. Der Plan besteht aus Gewicht × Wdh. × RIR.
**Beleg:** b16; S11.
**Vorschlag:** Bei „vs Plan“ die Plan-Größen zeigen: „Gewicht / Wdh. / Sätze: Ist vs Plan“ („13,5 kg statt 44 kg“). Intensität gegen Plan weglassen oder als Abweichung des Arbeitsgewichts ausdrücken.

### Niedrig

#### R2-N1 – Vergleichs-Chip wird beim Tab-Wechsel zurückgesetzt
In M7 war „vs Plan“ gewählt (f13). Nach Plan-Tab → Total steht wieder „vs Micro 6“ (lokaler State je Mount). **Beleg:** f13 → n1b. **Vorschlag:** Auswahl wie die Segment-Ansicht pro Plan merken.

#### R2-N2 – Header-Datum ist die Spanne der Trainingsdaten, nicht die Woche
M5 „17/02 – 27/02/2026“ überlappt M4 „16/02 – 21/02/2026“, weil M5 D4 vor M4 D2 trainiert wurde. Leere und rein geplante Micros zeigen kein Datum. **Beleg:** c04, c08, f04. **Vorschlag:** Bei Überlappung oder Spannen > 7 Tage einen Hinweis („Trainings an 4 Tagen zwischen …“) bzw. die Trainingstage einzeln nennen.

#### R2-N3 – Spaltenkopf „Max Intensity (%1RM)“ bricht dreizeilig um
In der Exercise Overview steht der Kopf über drei Zeilen und macht die Kopfzeile doppelt so hoch wie die Muskel-Tabelle. **Beleg:** b08, e07. **Vorschlag:** „Max %1RM“ oder Kopf zweizeilig mit kleinerer Schrift.

#### R2-N4 – Coach Insight ohne API-Key: Karte verschwindet spurlos
Ohne Key (`no_key`) rendert `CoachInsightCard` nichts. Der Nutzer erfährt nicht, dass es eine Interpretation geben könnte. **Beleg:** b06 (Map direkt gefolgt von Muscle Overview), Code `CoachInsightCard.tsx` (`no_key → return null`). **Vorschlag:** Einzeilige Karte „Coach Insight – mit API-Key in den Einstellungen verfügbar“ mit Link.

---

## 7. Bekannte Tickets: Status

| Ticket | Problem | Status heute | Beleg |
|---|---|---|---|
| [GH-526](https://github.com/julimetzger/Gainalytics/issues/526) (PR #531) | Overview-Umbau: jede Ansicht benennt ihren Vergleich, Map Total/Diff, Chips | **umgesetzt**: deckt H3, H4, M3, M7, M8 ab, H1/H2 teilweise. Neue Folgeprobleme R2-H1, R2-H2, R2-M1 | b05, b14, b18 |
| [GH-517](https://github.com/julimetzger/Gainalytics/issues/517) | Wochenbilanz oben, Deltas mit Basis, Map zeigt Untererfüllung | **geschlossen, in GH-526 aufgegangen**. Basis ✅, Map ✅. Wochenbilanz **teilweise**: nur über den Chip „vs Plan“, scrollt mit, ist kein Button zur Trainingsliste, Zähler falsch (R2-H1) | f13 |
| [GH-527](https://github.com/julimetzger/Gainalytics/issues/527) | H5 eine Quelle für Planwerte, H6 1RM je Muskel | **offen**. H5: Symptom in der Overview weg, Ursache (Sätze entfernter Übungen) besteht. H6 unverändert | c12, d02 |
| [GH-450](https://github.com/julimetzger/Gainalytics/issues/450) | deutsche UI-Reste | **behoben**: keine deutschen UI-Texte („Bankdrücken“ ist ein Übungsname aus den Nutzerdaten) | b10 |
| [GH-143](https://github.com/julimetzger/Gainalytics/issues/143) / [GH-467](https://github.com/julimetzger/Gainalytics/issues/467) | Ansicht geht beim Wischen verloren | **behoben**: Wischen M5 → M4 → M3 → M1 bleibt auf Total. Reset beim *Öffnen* besteht (M6) | c08, c10 |
| [GH-436](https://github.com/julimetzger/Gainalytics/issues/436) | Plan-Position in der Overview | **umgesetzt und überarbeitet** (Plan-Tab, „vs Plan“ in Total) | b14, b18 |
| GH-436 Report B2 | Vergleichsbasis der Einzel-Analyse unklar | **behoben**: „Done vs Micro 5 · Push squat (done) · Mon 23/02/2026“ | g02 |
| GH-436 Report B8 | Einziges Training im Micro: Vergleich mit Micro-Plan trivial | **offen**: „vs Micro“ zeigt für M7 (nur ein Training geplant) dasselbe wie „vs Plan“ (3 / 15) | g01, g03 |
| GH-436 Report B12 | Planwerte entfernter Übungen | **teilweise** (siehe H5 / GH-527) | c12 |
| [GH-458](https://github.com/julimetzger/Gainalytics/issues/458) H6 | Ausreißer-Training verzerrt | **teilweise**: kein Überlauf mehr, Ausreißer zählt aber und wird blau (R2-M2) | c08 |
| [GH-458](https://github.com/julimetzger/Gainalytics/issues/458) H7 | Metrics: gebrochene Sätze, Δ-Zeitraum fehlt | **teilweise**: Δ-Zeile ✅, gebrochene Sätze ohne Erklärung | b07 |
| [GH-449](https://github.com/julimetzger/Gainalytics/issues/449) / [GH-241](https://github.com/julimetzger/Gainalytics/issues/241) | Coach Insight abgeschnitten / pro Micro | **nicht prüfbar** (kein Key, Baseline > 28 Tage) | b06 |
| [GH-482](https://github.com/julimetzger/Gainalytics/issues/482) | Home-Diagramm: Labels überlappen | **behoben** | b01, h01 |
| TRN-001 / [GH-44](https://github.com/julimetzger/Gainalytics/issues/44) | Records des Micros in der Overview | **offen**: kein Records-Bereich, Seitenende nach der Exercise Overview. Home hat „Records this micro“ | b16, b01 |
| TODOS.md „Overview mit Grafik für RIR Sets …“ | RIR in der Overview | **offen**: RIR nur auf Home („RIR 0.0“) | h01 |
| TODOS.md „Labels für Sets/Workouts hinzufügen“ | Beschriftungen | **behoben** für die KPI-Karten (M3) | b05 |
| [GH-390](https://github.com/julimetzger/Gainalytics/issues/390) | Meso + Micro im Label | **behoben**: Header „Push pull › Meso 1“, Plan-Tab nutzt lokale Nummern („Plan M6“) | b18 |

---

## 8. Konsistenz mit Einzel-Analyse und Home

| Aspekt | Micro-Overview | Home „Current micro“ | Analyse eines Trainings |
|---|---|---|---|
| Vergleichsbasis | Chips „vs Micro N / vs Plan“, benannt | „vs M6“, benannt | Chips „vs Plan / vs last Push squat / vs Micro“, benannt mit Datum |
| Fortschritt | „Trainings 1 / 1“ (nur geplante) | Ring **1/4** | – |
| Karten | `Wert / Referenz`, Δ + % darunter | Wert groß, % und Δ daneben | wie Overview |
| Volumen | `3.3t` | `3,290 kg` | `3.3t` |
| Dauer | `2min`, `45h 56min` | `0h 2m`, `-104m` | Zeitspanne im Header |
| Muscle Map | Total/Diff, `Done/Plan` | – | dieselbe Komponente (`Done/Plan`, `Done/M5`) |
| RIR | fehlt | „RIR 0.0“ | – |
| Records | fehlen | Karte „Records this micro“ | – |

**Fazit:** Overview und Einzel-Analyse sind jetzt aus einem Guss (gleiche Karten, gleiche Map, gleiche Leserichtung, benannte Basis). Das ist ein klarer Fortschritt. Home und Overview zeigen dieselben Summen (3.290 kg, 3 Sätze), widersprechen sich aber beim Fortschritt (1/4 gegen 1/1) und formatieren Dauer und Volumen verschieden.

| Home (M7, 1/4) | Einzel-Analyse vs Plan | vs last Push squat | vs Micro |
|---|---|---|---|
| <img src="screenshots/gh505/h01_home_m7partial.png" width="170"> | <img src="screenshots/gh505/g01_single_vs_plan.png" width="170"> | <img src="screenshots/gh505/g02_single_vs_last.png" width="170"> | <img src="screenshots/gh505/g03_single_vs_micro.png" width="170"> |

---

## 9. Sprache, Darstellung, Light/Dark

- **Sprache:** Keine deutschen UI-Reste. Intern heißt die Total-Ansicht weiter `gesamt` (testID `overview-view-gesamt`); das ist nicht sichtbar.
- **Darstellung:** Keine Überlappungen. Spaltenkollision in der Exercise-Ansicht (N1). Dreizeiliger Spaltenkopf „Max Intensity (%1RM)“ (R2-N3). Sehr lange Seite bei „vs Micro“ durch nicht trainierte Übungen (H7: M6 listet jede Übung aus M5, trainiert wurden nur die 8 aus „Pull“). Auf 1080 px Breite wird kein Readout abgeschnitten. Auf dem Samsung mit größerer Schrift ist das ungeprüft.
- **Light (Stichprobe):** Alles lesbar, Deltas gut erkennbar. Einziges Light-spezifisches Problem: Die Akzentfarbe der Map (mauve) ist schwer von der Serienfarbe zu unterscheiden und passt nicht zur Legende (R2-M1).

| Light: Total vs Micro 6 | Light: Total vs Plan | Light: Plan-Tab |
|---|---|---|
| <img src="screenshots/gh505/l01_light_m7_total.png" width="200"> | <img src="screenshots/gh505/l02_light_m7_total_vs_plan.png" width="200"> | <img src="screenshots/gh505/l03_light_m7_plan.png" width="200"> |

---

## 10. Ticket-Vorschläge (priorisiert, ein Problem = ein Vorschlag)

Bereits umgesetzt bzw. vorhanden und **nicht neu anzulegen:** GH-526 (erledigt), GH-517 (in GH-526 aufgegangen), **GH-527** (H5-Ursache, H6: weiter offen und weiter Prio hoch), TRN-001/GH-44 (Records), GH-436 B8.

| Prio | Vorschlag | Finding |
|---|---|---|
| V1 | **Trainingszähler gegen die Trainings des Plans** („1 von 4 · 3 nicht geplant“), gleiche Zahl wie Home | R2-H1 |
| V2 | **Faire Vergleiche in laufenden Micros**: „vs Micro N“ nur bis zur gleichen Position; in laufenden/geplanten Micros „vs Plan“ als Standard; „(done)“ nicht für leere Micros | H1-Rest, H2-Rest |
| V3 | **Plan-Tab vergleicht gleiche Trainingspositionen** bzw. erst bei vollständig geplanten Micros | R2-H2 |
| V4 | **Nicht trainierte Übungen** bei „vs Micro“ eingeklappt und ohne „0.0 / 100“-Deltas | H7 |
| V5 | **Laufendes Training einheitlich** (Dauer, Trainings, Exercise/Muscle-Tab) | M2 |
| V6 | **Dauer: Ausreißer markieren, Delta neutral färben** | M1-Rest, R2-M2 |
| V7 | **Legende für die Akzentfarbe** der Map, keine Warnfarbe im Plan-Tab, Kontrast in Light | R2-M1 |
| V8 | **Exercise Overview „vs Plan“ in Plan-Größen** (Gewicht/Wdh./Sätze) statt e1RM/%1RM-Delta | R2-M3 |
| V9 | **Gewichtete Sätze erklären** (Spaltenkopf „Sätze (gewichtet) ⓘ“ öffnet den Contribution-Dialog), Einheiten in den Zellen | M4-Rest |
| V10 | **Home-Karte „Current micro“ öffnet die Overview**, sichtbarer Einstieg im Plan-Header | M5 |
| V11 | **Overview öffnet auf Total** bzw. merkt Ansicht und Vergleichs-Chip | M6, R2-N1 |
| V12 | Exercise-Ansicht: Spaltenbreite, „Weight (kg)“, Datum je Training | N1 |
| V13 | Leere Muscle-/Exercise-Overview-Tabellen durch Leertext ersetzen | N2-Rest |
| V14 | Pager-Knopf auf Micro 1 ausblenden | N4 |
| V15 | Zahlenformat: keine „−0.0“/„+0.00“, Nullen neutral | N5 |
| V16 | Segment „Muscle“ zusammenlegen oder je Training Plan gegen Ist zeigen | N7 |
| V17 | Affordance für antippbare Tabellenköpfe/Zellen; globale Metrikwahl kenntlich machen | N8 |
| V18 | Coach Insight ohne Key: Hinweiskarte statt nichts | R2-N4 |
| V19 | Header-Datum bei Überlappung / > 7 Tagen erklären | R2-N2 |
| V20 | Spaltenkopf „Max Intensity (%1RM)“ kürzen | R2-N3 |

---

## 11. Grenzen dieses Audits

- **Gerät:** Emulator (API 34, Schriftgröße 1,0) statt R5CN30HWZFN. Layoutprobleme, die nur bei größerer Schrift auftreten (laut Agent-Memory z. B. abgeschnittene Readouts), sind nicht geprüft.
- **Coach Insight** war nicht prüfbar (kein API-Key auf dem Emulator, Baseline älter als 28 Tage). GH-449, GH-241 und M9 bleiben ohne Urteil.
- **VL-Insight-Karten** erscheinen nur mit verknüpften Videoanalysen. Die Baseline enthält für diesen Plan keine.
- Experten-Audit, kein Nutzertest. „Wird missverstanden“ ist eine begründete Einschätzung, keine Messung.
- Der Emulator reagierte zeitweise verzögert (Launcher-ANR beim Start, verspätete Taps). Jeder Screenshot wurde nach dem Aufnehmen angesehen; nur Screenshots, die den beschriebenen Zustand zeigen, sind im Report.
- Endzustand des Geräts: Baseline plus M7 „Push squat“ (3 Sätze, beendet), Theme Dark.

---

## Anhang: Screenshots

Alle unter [`screenshots/gh505/`](screenshots/gh505/). Die Kürzel entsprechen den Belegen oben.

| | | | |
|---|---|---|---|
| e01 Leere App – Onboarding<br><img src="screenshots/gh505/e01_empty_onboarding.png" width="170"> | e02 Home ohne Plan<br><img src="screenshots/gh505/e02_empty_home.png" width="170"> | e03 Home, leerer Plan (Tap auf Karte: keine Navigation)<br><img src="screenshots/gh505/e03_empty_home_plan.png" width="170"> | e05 Drawer, Pager „‹ Micro 1“<br><img src="screenshots/gh505/e05_empty_drawer.png" width="170"> |
| e06 Leer – öffnet auf Exercise<br><img src="screenshots/gh505/e06_empty_overview_default.png" width="170"> | e07 Leer – Total<br><img src="screenshots/gh505/e07_empty_overview_total.png" width="170"> | e08 Leer – Muscle<br><img src="screenshots/gh505/e08_empty_overview_muscle.png" width="170"> | e09 Leer – Plan<br><img src="screenshots/gh505/e09_empty_overview_plan.png" width="170"> |
| b01 Home (Baseline, M6 1/4)<br><img src="screenshots/gh505/b01_home_baseline.png" width="170"> | c01 Drawer mit Pager<br><img src="screenshots/gh505/c01_drawer_pager_m6.png" width="170"> | b04 M6 öffnet auf Exercise<br><img src="screenshots/gh505/b04_m6_default_exercise.png" width="170"> | b05 M6 Total vs Micro 5<br><img src="screenshots/gh505/b05_m6_total_vs_prev.png" width="170"> |
| b06 M6 Map → Muscle Overview<br><img src="screenshots/gh505/b06_m6_total_vs_prev_s1.png" width="170"> | b07 M6 Muscle Overview Δ vs M5<br><img src="screenshots/gh505/b07_m6_total_vs_prev_s2.png" width="170"> | b08 Exercise Overview (nicht trainierte)<br><img src="screenshots/gh505/b08_m6_total_vs_prev_s3.png" width="170"> | b10 Exercise Overview (Scroll)<br><img src="screenshots/gh505/b10_m6_total_vs_prev_s5.png" width="170"> |
| b11 Map Diff vs M5<br><img src="screenshots/gh505/b11_m6_total_prev_diff.png" width="170"> | b12 Map Zeilen-Details<br><img src="screenshots/gh505/b12_m6_total_prev_row_detail.png" width="170"> | b14 M6 Total vs Plan (1 / 1)<br><img src="screenshots/gh505/b14_m6_total_vs_plan_map.png" width="170"> | b15 Muscle Overview vs Plan („−0.0“)<br><img src="screenshots/gh505/b15_m6_total_vs_plan_s1.png" width="170"> |
| b16 Exercise Overview vs Plan, Seitenende<br><img src="screenshots/gh505/b16_m6_total_vs_plan_s2.png" width="170"> | b17 M6 Muscle-Segment<br><img src="screenshots/gh505/b17_m6_muscle.png" width="170"> | b18 M6 Plan-Tab (Plan M6 vs M5)<br><img src="screenshots/gh505/b18_m6_plan.png" width="170"> | b19 Plan-Tab Tabelle<br><img src="screenshots/gh505/b19_m6_plan_s1.png" width="170"> |
| c04 M5 komplett vs M4<br><img src="screenshots/gh505/c04_m5_total_vs_m4.png" width="170"> | c05 M5 vs Plan (4/4, 59/59)<br><img src="screenshots/gh505/c05_m5_total_vs_plan.png" width="170"> | c07 M5 Plan-Tab<br><img src="screenshots/gh505/c07_m5_plan.png" width="170"> | c08 M4 nach Wischen (45h 56min, +40h 12min)<br><img src="screenshots/gh505/c08_m4_total_after_swipe.png" width="170"> |
| c09 M3 vs Plan (3 / 3)<br><img src="screenshots/gh505/c09_m3_total_vs_plan.png" width="170"> | c10 M1 erstes Micro<br><img src="screenshots/gh505/c10_m1_total.png" width="170"> | c11 M1 Tabelle vs Plan (Back 14)<br><img src="screenshots/gh505/c11_m1_total_vs_plan_table.png" width="170"> | c12 M1 Plan-Tab (Map 14 = Tabelle 14)<br><img src="screenshots/gh505/c12_m1_plan.png" width="170"> |
| d01 Metrik-Picker<br><img src="screenshots/gh505/d01_metric_picker.png" width="170"> | d02 1RM je Muskel identisch<br><img src="screenshots/gh505/d02_m1_muscle_1rm.png" width="170"> | d03 Contribution-Dialog<br><img src="screenshots/gh505/d03_contribution_dialog.png" width="170"> | f01 M7 leer vs M6 (−100 %)<br><img src="screenshots/gh505/f01_m7_empty_total.png" width="170"> |
| f02 M7 „Push squat“ geplant<br><img src="screenshots/gh505/f02_m7_pushsquat_planned.png" width="170"> | f03 nur geplant – öffnet auf Exercise<br><img src="screenshots/gh505/f03_m7planned_default.png" width="170"> | f04 nur geplant – Total vs M6<br><img src="screenshots/gh505/f04_m7planned_total.png" width="170"> | f05 nur geplant – vs Plan (0 / 1)<br><img src="screenshots/gh505/f05_m7planned_total_vs_plan.png" width="170"> |
| f06 nur geplant – Plan M7 vs M6 (Push vs Pull)<br><img src="screenshots/gh505/f06_m7planned_plan.png" width="170"> | f07 Training läuft, 3 Sätze<br><img src="screenshots/gh505/f07_m7_started_3sets.png" width="170"> | f08 läuft – „No executed trainings“<br><img src="screenshots/gh505/f08_m7started_exercise.png" width="170"> | f09 läuft – Total (3 Sätze, 0 min)<br><img src="screenshots/gh505/f09_m7started_total.png" width="170"> |
| f10 läuft – vs Plan (0 / 1)<br><img src="screenshots/gh505/f10_m7started_total_vs_plan.png" width="170"> | f11 teilweise – Exercise<br><img src="screenshots/gh505/f11_m7partial_exercise.png" width="170"> | f12 teilweise – vs M6 (−80 %)<br><img src="screenshots/gh505/f12_m7partial_total.png" width="170"> | f13 teilweise – vs Plan (1 / 1)<br><img src="screenshots/gh505/f13_m7partial_total_vs_plan.png" width="170"> |
| g01 Einzel-Analyse vs Plan<br><img src="screenshots/gh505/g01_single_vs_plan.png" width="170"> | g02 vs last Push squat<br><img src="screenshots/gh505/g02_single_vs_last.png" width="170"> | g03 vs Micro<br><img src="screenshots/gh505/g03_single_vs_micro.png" width="170"> | h01 Home nach 1/4 in M7<br><img src="screenshots/gh505/h01_home_m7partial.png" width="170"> |
| n1b Chip nach Tab-Wechsel zurück auf „vs Micro 6“<br><img src="screenshots/gh505/n1b_chip_after_tab_switch.png" width="170"> | h02 Plan-Liste „Active · M7 · 1/4“<br><img src="screenshots/gh505/h02_home_m7partial_scrolled.png" width="170"> | | |
| l01 Light – Total<br><img src="screenshots/gh505/l01_light_m7_total.png" width="170"> | l02 Light – vs Plan<br><img src="screenshots/gh505/l02_light_m7_total_vs_plan.png" width="170"> | l03 Light – Plan-Tab<br><img src="screenshots/gh505/l03_light_m7_plan.png" width="170"> | s01 Maestro-geprüft: M6 vs Plan<br><img src="screenshots/gh505/s01_m6_vs_plan_asserted.png" width="170"> |
