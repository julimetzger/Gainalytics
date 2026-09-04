# Usability-Bericht GH-436 — Pfad „Plan anlegen → planen → trainieren → auswerten“

**Rahmen**

| | |
|---|---|
| Datum | 2026-09-04 |
| Gerät | Samsung SM-G986B (R5CN30HWZFN), Android 13, 720×1600 Override, Dark Theme |
| Build | Debug-APK 0.172 mit dem GH-436-JS-Bundle über Metro |
| Datenstand | Baseline-Fixture `__tests__/testdata/1772318214222.gains` importiert, danach ein neuer Plan „UX436“ von Hand angelegt |
| Weg | Training-Home → „+“ → Plan „UX436“ → Meso 1 → Micro 1 Training 1 → Plan-Tab: „Plan new Training“, 2 Übungen (Bankdrücken, Bulgarian split squat), je 1 Satz → Train-Tab: Start, beide Sätze bestätigen, Finish → Analysis-Tab: Plan- und Train-Position → Drawer → Overview → Plan-Position → Micro 2 (leer) |

Der Pfad ist durchgängig begehbar. Kein Absturz, keine leere Fläche. Die Reibung liegt an drei Stellen: beim Anlegen eines Plans (Tastatur, Auffindbarkeit), beim Planen von Sätzen (Gewichtsvorschlag, „Done“ verschwindet, Zurück verwirft) und bei Vergleichswerten, die für das erste Training eines neuen Plans nichts aussagen.

Screenshots des Durchlaufs liegen unter `docs/usability/GH-436/`.

## Schritt für Schritt

| # | Schritt | Beobachtung | Gewicht |
|---|---|---|---|
| 1 | Training-Home → „+“ | Dialog „Add New Training Plan“ öffnet, das Namensfeld hat keinen Fokus; erst ein Tap ins Feld holt die Tastatur. | klein |
| 2 | Name tippen → Save | Dialog schließt, **die Tastatur bleibt über der Planliste stehen** (`01-keyboard-after-save.png`). | klein, behoben |
| 3 | Nach Save | Der neue Plan liegt am Ende der Liste unterhalb des sichtbaren Bereichs; die Liste scrollt nicht hin, es gibt keinen Sprung in den Plan. Der Nutzer sucht. | mittel |
| 4 | Meso 1 → Micro 1 Training 1 | Plan-Tab zeigt „Linear progression“ mit RIR-Delta/Weight-Increase und drei „Suggest based on …“-Buttons, obwohl der Plan keine Historie hat; „Plan new Training“ steht als vierte Option darunter (`04-new-plan-suggest-buttons.png`). | mittel |
| 5 | „Plan new Training“ | Editor öffnet im Modus „EDITING PLAN“ mit Done-Button und Hinweis „Pick an exercise from the picker above“ — der Picker ist aber nicht offen, sichtbar ist nur die „+“-Kachel. Ein Tap mehr. | klein |
| 6 | Picker: zwei Übungen wählen | Auswahl funktioniert („2 selected“). Der Picker hat keinen Abschluss-Button; Schließen geht nur über Zurück oder Tap daneben. | klein |
| 7 | Nach der ersten Übungsauswahl | **Der Header wechselt von „EDITING PLAN / Done“ auf „Plan / ⋮“, obwohl die Übungskarten weiter im Edit-Modus sind („Add set“-Buttons)** (`03-edit-mode-without-done.png`). | groß |
| 8 | „Add set“ → Reps 8 | Nach dem Tippen der Reps erscheint im Weight-Feld der 1RM-Vorschlag „118“. Tap ins Feld setzt den Cursor ans Ende, „60“ wird zu **„11860“** (`02-weight-suggestion-appended.png`). | mittel, behoben |
| 9 | Chip „1 set“ | Der Chip zählt den noch unbestätigten Satz bereits mit. | klein |
| 10 | Zurück (Tastatur bereits zu) | Ohne Done-Button (Schritt 7) verlässt Zurück den Bildschirm; **der offene Satz ist weg**, der Plan zeigt „0 sets / No planned sets yet“. Keine Rückfrage. | groß |
| 11 | ⋮ → „Edit plan“ → Sätze erneut, Done | Über den Overflow ist der Edit-Modus mit Done erreichbar, Done übernimmt die offenen Sätze. Funktioniert. | – |
| 12 | Train-Tab → „Start Training“ | Toast „Training started!“ liegt über der Sub-Tab-Leiste. Der Execute-View zeigt Target-Zeile, eine leere Eingabezeile mit „Add“ und darunter die aus dem Plan vorbelegte Zeile mit ✓ — zwei Wege, ein Satz. | klein |
| 13 | ✓ je Übung → „Finish Training“ | Sätze werden geloggt, Rest-Timer startet, Target-Zeile meldet „All 1 planned sets logged“. Finish springt auf Analysis. | – |
| 14 | Analysis, Position Train | „Total Sets: 2 (done)“, Muscle Map „THIS DONE TRAINING vs Current micro plan“. Die Karten Volume/Sets zeigen **-3380.00 / -2.00** gegen ein „letztes Training“, das aus einem anderen Plan stammt. Die 1RM-Karte im Training meldete für beide Übungen „vs last training 143 kg“. | mittel |
| 15 | Analysis, Position Plan | „Total Sets: 2 (planned)“, Muscle Map „THIS TRAINING (PLANNED) vs Current micro plan“ (`05-analysis-plan-single-training.png`). Mit nur einem Training im Micro ist der Vergleich 1:1 und sagt nichts. | klein |
| 16 | Overview → Plan | „Total Sets: 2 (planned) / 2 (done)“, „THIS MICRO (PLANNED) vs THIS MICRO (DONE)“, Muscle Overview mit Differenzen ±0. Micro 2 (leer): „0 (planned) / 0 (done)“ und Hinweistext statt Tabelle. | – |
| 17 | Micro 2, Training 1 (nie geplant), Analysis | Plan-Position: „Nothing planned for this training yet.“, Train-Position: „No sets logged yet — start the training on the Train tab. Switch to Plan to see what is planned.“ | – |

## A. Direkt behoben (in diesem PR)

1. **Tastatur bleibt nach „Save“ im Plan-Dialog offen** (Schritt 2). `AddTrainingsPlan` ruft beim Bestätigen jetzt `Keyboard.dismiss()`.
2. **Gewichtsvorschlag wird beim Tippen ergänzt statt ersetzt** (Schritt 8). Das Weight-Feld einer offenen Satzzeile bekommt `selectTextOnFocus`, solange der Wert noch der Vorschlag ist; der erste Tastendruck ersetzt „118“ statt „11860“ zu bauen. Sobald der Nutzer ein eigenes Gewicht eingetragen hat, verhält sich das Feld wie zuvor.
3. **Analyse eines Trainings zeigte Micro-Zahlen** — der Kern von GH-436, siehe PR-Beschreibung. Plan-Position = geplante Werte dieses Trainings, Micro-Planübersicht in der Overview.
4. **Train-Position eines nicht gestarteten Trainings** sagte „Analysis available after the training is finished“, obwohl die Plan-Position daneben Zahlen hat. Der Text verweist jetzt auf Train-Tab und Plan-Position (Schritt 17).

## B. Vorschläge (nicht Teil dieses PR)

Sortiert nach Gewicht.

1. **Header verliert „Done“ nach der ersten Übungsauswahl; Zurück verwirft den offenen Satz** (Schritte 7 und 10). Zwei Ursachen greifen ineinander: Die Header-Chrome fällt nach dem ersten Pick auf „read“ zurück, während `PlanTab` im Full-Edit bleibt; und offene Satzzeilen werden nur über „Done“ oder das nächste „Add set“ übernommen. Vorschlag: Chrome an den tatsächlichen Editor-Modus binden (Done bleibt, bis der Nutzer ihn drückt) und beim Verlassen mit gültiger offener Zeile entweder übernehmen oder nachfragen. Beides ist GH-401-Terrain (`onPlanChromeChange`, `handleBack`), deshalb hier nicht angefasst.
2. **Vergleichswerte ohne passende Referenz** (Schritt 14). Für das erste Training eines neuen Plans werden Volume/Sets gegen das zuletzt beendete Workout derselben Übung aus irgendeinem Plan verglichen (−3380 kg). Vorschlag: Vergleich nur innerhalb des Plans anbieten oder die Referenz benennen („vs Push pull · M6“). Die 1RM-Karte zeigte für Bankdrücken und Bulgarian split squat denselben Referenzwert (143 kg); das sollte einmal gegen die Daten geprüft werden.
3. **Neuer Plan ohne Historie zeigt drei „Suggest“-Buttons** (Schritt 4). Vorschlag: ohne Vorgänger nur „Plan new Training“ zeigen, die Suggest-Buttons ausblenden oder deaktivieren mit Grund.
4. **Nach dem Anlegen eines Plans keine Orientierung** (Schritt 3). Vorschlag: nach Save zum neuen Plan scrollen oder direkt in Meso 1 springen.
5. **„Plan new Training“ öffnet den Picker nicht** (Schritt 5) und der Hinweistext spricht von einem „picker above“, der nicht sichtbar ist. Vorschlag: Picker direkt öffnen (wie beim „Add Exercises“-Weg aus GH-403) oder den Text auf die „+“-Kachel beziehen.
6. **Picker ohne Abschluss** (Schritt 6). Vorschlag: „Done (2)“-Button im Picker-Kopf.
7. **Chip „1 set“ zählt die unbestätigte Zeile** (Schritt 9). Vorschlag: nur gespeicherte Sätze zählen oder „1 set · 1 open“.
8. **Muscle-Map-Vergleich bei einem Training pro Micro** (Schritt 15). „Current micro plan“ ist dann identisch mit dem Training. Vorschlag: in diesem Fall die Referenz weglassen und das benennen („only training in this micro“).
9. **Zwei Wege für denselben Satz im Execute-View** (Schritt 12): leere Eingabezeile mit „Add“ plus vorbelegte Zeile mit ✓. Vorschlag: die leere Zeile erst nach dem Bestätigen der vorbelegten zeigen.
10. **Toast über der Sub-Tab-Leiste** (Schritt 12). Vorschlag: Toast unter dem Header positionieren oder kürzer einblenden.
11. **Namensfeld im Plan-Dialog ohne Autofokus** (Schritt 1). `autoFocus` auf dem Feld, sobald der Dialog gemountet wird (siehe Erfahrung aus GH-403: `focus()` im selben Commit öffnet die IME nicht).
12. **Leere „Muscle Overview“-Tabelle** in der Plan-Position, wenn ein geplanter Satz zu einer Übung gehört, die nicht mehr in der Übungsliste des Trainings steht (Fixture: Micro 1 „Push squat“, Adductor). Die Metrik-Tabelle listet die Übung, die Muscle Map nicht. Vorschlag: verwaiste `plannedWorkouts` beim Entfernen einer Übung mit aufräumen.
13. **Testbarkeit**: Die Eingaben offener Satzzeilen teilen sich die testIDs `plan-pending-set-*` über alle Übungen hinweg; bei zwei offenen Zeilen trifft ein Test die falsche. Vorschlag: Exercise-ID in das Präfix aufnehmen.
