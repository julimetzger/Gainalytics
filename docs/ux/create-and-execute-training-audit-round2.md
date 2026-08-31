# UX-Audit Runde 2: „Training anlegen" + „Training durchführen"

**Ticket:** GH-426 · Runde 2 zu [GH-399](https://github.com/julimetzger/Gainalytics/issues/399)
**Datum:** 31.08.2026
**Gerät:** R5CN30HWZFN — Samsung SM-G986B (Galaxy S20+), Android 13
**Auflösung:** 720 × 1600 (Override, physisch 1440 × 3200), Dichte 280 dpi → **1 dp = 1,75 px**
**Build:** `assembleDebug` aus diesem Worktree (`feature/GH-426`, identisch zu `origin/master`),
Bundle **im APK eingebettet** (`assets/index.android.bundle`, Task `createBundleDebugJsAndAssets`)
**Daten:** Baseline-Fixture `baseline.gains` über den regulären Import-Flow eingespielt
**Art:** Experten-/Heuristik-Audit (Nielsen u. ä.) — **kein** Nutzertest, read-only, keine Code-Änderung

> **Zur Build-Herkunft (Review-Finding aus Runde 1).** Runde 1 lief gegen einen älteren
> installierten Build. Für Runde 2 wurde das APK aus diesem Worktree gebaut und das JS-Bundle
> ist im APK eingebettet (`debuggableVariants = []`). Vor dem Start wurden alle
> `adb reverse`-Mappings entfernt — eines zeigte auf **Port 8086, den Metro eines fremden
> Workers**. Ohne dieses Aufräumen hätte die App das Bundle eines anderen Branches geladen.
> Der Audit lief damit nachweislich gegen den Stand des eigenen Branches.

---

## 1. Was tatsächlich durchgespielt wurde

**Flow A — Training anlegen.** Plan „Audit R2" neu angelegt, geöffnet, Training geplant,
zwei Übungen (Bankdrücken, Squat) über den Picker ausgewählt — eine davon über die Suche —
und je drei Sätze angelegt (Bankdrücken 3 × 8 @ 60 kg, Squat 3 × 5 @ 100 kg).

**Flow B — Trainieren.** Einheit gestartet, Sätze real protokolliert, Übung gewechselt,
**zweimal unterbrochen und fortgesetzt** (einmal per Home-Taste, einmal per echtem
Prozess-Tod via `am force-stop`), Rest-Timer-Menü und Header-Menü geprüft, Einheit beendet.

Ergebnis der Einheit laut App: **Duration 00:10:56, Total Sets 4 (done), Volume 1960.00**
(Bankdrücken 2 × 8 @ 60 + Squat 2 × 5 @ 100 = 1960 kg — rechnerisch korrekt).

Zusätzlich geprüft: Anlegen mit leerem Namen, deaktivierte „Suggest"-Aktionen,
1RM-Umschalter, Löschen eines Satzes, Löschen eines Plans, Zurück-Navigation.

Alle 70 dokumentierten Zustände liegen unter [`screenshots/gh426/`](screenshots/gh426/).

---

## 2. Objektive Metriken

Zählweise: **Touch-Interaktionen** = Taps, Wischgesten und erzwungene Tastatur-Schließungen.
**Tastenanschläge** werden getrennt gezählt. Beides zusammen = „Eingaben".
(Runde 1 hat anders gezählt; die absoluten Zahlen sind deshalb *nicht* 1:1 vergleichbar —
die Pro-Satz-Werte schon, weil sie dort gleich definiert waren.)

### 2.1 Flow A — Training anlegen

| Metrik | Wert |
|---|---|
| Touch-Interaktionen bis fertiges Training (2 Übungen, 6 Sätze) | **24** |
| Tastenanschläge dabei | **26** (davon **6 reine Backspaces**, um den automatischen Gewichtsvorschlag zu löschen) |
| Eingaben gesamt | **50** |
| Interaktionen pro **geplantem** Satz | **4,0** — erster Satz einer Übung 10, jeder weitere identische Satz **1** |
| … wenn man den Gewichtsvorschlag akzeptiert | **1,7** (erster Satz 3, jeder weitere 1) |
| Minimalpfad 1 Übung / 1 Satz | **9** Touch + 3 Anschläge |
| Distinkte Screens/Zustände | **9** |
| Sackgassen | **1** — drei deaktivierte „Suggest based on …"-Aktionen ohne Begründung (M8) |
| Fehlende Abbrechen-/Zurück-Wege | **1** — der „Done"-Knopf verschwindet, sobald die erste Übung gewählt ist (M9) |

### 2.2 Flow B — Trainieren

| Metrik | Wert |
|---|---|
| Touch-Interaktionen bis Training **tatsächlich** läuft | **3** (Plan öffnen → „Train" → „Start Training") — **keine verlorenen Interaktionen** |
| Interaktionen pro **Wiederholungssatz** (Werte stimmen bereits) | **1** — Tap auf „Add" |
| Interaktionen pro Satz, wenn der **Vorschlag korrigiert** werden muss | **7** (Weight → 3 × Backspace → 2 Ziffern → „Add") |
| Interaktionen pro Satz **direkt nach Übungswechsel** | **12** (Reps und Weight müssen beide korrigiert werden — H4) |
| Interaktionen Start → Finish (4 Sätze, 2 Übungen, inkl. 2 Korrekturen) | **19** |
| Distinkte Screens/Zustände | **8** |
| Sackgassen | **3** — „Pause session" dauerhaft deaktiviert (M2); FAB schluckt „Continue Training" (H5); deaktivierte Suggest-Aktionen (M8) |
| Fehlende Abbrechen/Zurück-Wege | **2** — kein „Training abbrechen/verwerfen" (nur „Delete"); kein Pausieren |
| Bedienelemente unter 48 dp Mindest-Trefferfläche | **9 von 12** (M1) |

### 2.3 Was objektiv gut funktioniert

Damit die Findings das Bild nicht verzerren:

- **Wiederholungssatz = 1 Tap.** Die Eingabezeile behält die Werte des letzten Satzes,
  „Add" protokolliert sofort. Das ist der Kernvorgang und er ist optimal kurz.
  ([B10](screenshots/gh426/B10-set4-onetap.png))
- **Unterbrechen/Fortsetzen ist verlustfrei — auch nach Prozess-Tod.** Nach `am force-stop`
  startet die App auf dem Home-Screen mit einer eigenen Karte „**Training running**",
  Laufzeit, Inhaltsvorschau („Bankdrücken 60 × 8", „Squat 100 × 5") und „Continue Training".
  ([B16](screenshots/gh426/B16-resumed-soft.png), [B17](screenshots/gh426/B17-resumed-hard-relaunch.png))
- **Der Einstieg ins Training ist eindeutig.** Der „Train"-Tab hat einen echten
  „Start Training"-Knopf **mit erklärender Zeile** („Starts the session timer and opens set
  logging."). ([B01](screenshots/gh426/B01-train-subtab.png))
- **Rest-Timer ist sichtbar und ehrlich.** Er erscheint direkt nach dem Satz ohne Scrollen,
  zeigt „target 01:30" und Überzug als „**+01:21**" in Rot.
  ([B09](screenshots/gh426/B09-set3-logged.png), [B19](screenshots/gh426/B19-continued-training.png))
  Sein Menü ist genau richtig geschnitten: „Skip rest / Edit target… / Adjust default for this
  exercise". ([B22](screenshots/gh426/B22-rest-menu.png))
- **Zahlenkontext zwischen den Sätzen.** „ESTIMATED 1RM / PR / vs last training" aktualisiert
  live. ([B09](screenshots/gh426/B09-set3-logged.png))
- **Numerische Tastatur** in allen Zahlenfeldern. ([B04](screenshots/gh426/B04-reps-focused-live.png))
- **Abschluss-Zusammenfassung** springt automatisch auf „Analysis" mit Duration, Volume,
  Sets, Muscle Map. ([B23](screenshots/gh426/B23-finish-tapped.png))
- **Gute Accessibility-Labels** auf den Listenkarten, z. B. „Last Training, Pull, Meso 1 · M6 ·
  D4 · 184d ago, Sets, 15, …" — vorbildlich für Screenreader.
- **Löschen eines Plans fragt nach.** ([C02](screenshots/gh426/C02-delete-plan.png))

---

## 3. Findings

Priorisierung: **H** = hoch, **M** = mittel, **N** = niedrig.

### H1 — „Save" mit leerem Namen legt einen namenlosen Plan an

**Was.** Im Dialog „Add New Training Plan" direkt auf „Save" getippt: Der Dialog schließt
kommentarlos ([A02](screenshots/gh426/A02-save-empty-name.png)) — und in der Liste steht ein
**Plan ganz ohne Titel**, nur „Draft · no trainings yet"
([A04](screenshots/gh426/A04-home-plans.png)). Sein Accessibility-Label lautet ebenfalls nur
`'Draft · no trainings yet'`, während alle anderen Zeilen `'Upper lower, Paused · …'` heißen —
der Plan ist für Screenreader-Nutzer nicht identifizierbar.

**Warum ein Problem.** Verletzt „Error prevention" (Nielsen #5) und „Visibility of system
status" (#1): eine destruktiv wirkende Nicht-Eingabe wird stillschweigend zu einem echten
Datensatz. Der Nutzer bekommt weder eine Fehlermeldung noch eine Bestätigung und hat
anschließend einen Eintrag, den er nicht auseinanderhalten kann.

**Vorschlag.** „Save" deaktivieren, solange das Feld leer ist, **oder** beim Speichern einen
Vorgabenamen („Plan 6") setzen. Zusätzlich eine Inline-Validierung am Feld.

---

### H2 — Beim Planen scrollt das fokussierte Eingabefeld nicht über die Tastatur

**Was.** Beim Anlegen des ersten Squat-Satzes wurde das Feld „Reps" fokussiert. Die Tastatur
öffnet sich und verdeckt die **komplette Squat-Karte** — sichtbar bleibt nur die Karte der
*anderen* Übung. Man tippt in ein Feld, das man nicht sieht.
([A36](screenshots/gh426/A36-keyboard-open-layout.png))

Messbar: Das fokussierte Feld liegt bei y = 1081–1158 px, die Tastatur beginnt bei ≈ y = 930 px.

**Warum ein Problem.** Verletzt „Visibility of system status" fundamental. Man kann Tippfehler
nicht bemerken und nicht gegenprüfen, ob der automatische Gewichtsvorschlag (H3) überhaupt
plausibel ist. Praktische Folge: Ein Tap von „Reps" auf „Weight" ist unmöglich, ohne vorher
die Tastatur zu schließen — das ist die **Ursache der 6 Backspaces und der 4 Interaktionen
pro Satz** aus §2.1.

**Vorschlag.** Den Editor in eine `KeyboardAvoidingView` setzen bzw. das fokussierte Feld beim
Fokus in den sichtbaren Bereich scrollen. Im laufenden Training ist das bereits korrekt gelöst
([B04](screenshots/gh426/B04-reps-focused-live.png)) — die Lösung existiert also schon im Haus.

---

### H3 — Der Gewichtsvorschlag überschreibt die eigene Planung und wird mit einem Tap protokolliert

**Was.** Im laufenden Training für Bankdrücken „8" Reps eingetippt. Das Gewichtsfeld füllt sich
automatisch mit **113 kg** ([B05](screenshots/gh426/B05-reps8-live.png)) — obwohl der Nutzer
für genau diese Übung **60 kg geplant** hat und die beiden geplanten Sätze direkt darunter mit
„60" dastehen. Ein Tap auf „Add" protokolliert **8 × 113 kg**; die geschätzte 1RM springt von
76 auf 143 kg ([B06](screenshots/gh426/B06-added-suggested-weight.png)).

Derselbe Mechanismus beim Planen: 5 Reps Squat → automatisch 193 kg.

**Warum ein Problem.** Der Vorschlag stammt aus dem 1RM der Übung, nicht aus dem Plan des
Nutzers. Er ist damit systematisch zu hoch und widerspricht dem, was der Nutzer selbst
eingetragen hat („Match between system and the real world", „User control and freedom").
Mitten im Training, mit einem Tap, entsteht ein Trainingsprotokoll, das nie stattgefunden hat —
und das anschließend PR- und 1RM-Statistiken verfälscht. Der Vorschlag ist zwar blau
dargestellt, aber diese Farbcodierung ist nirgends erklärt.

**Vorschlag.** Die Eingabezeile aus dem **geplanten Satz** vorbelegen, nicht aus dem 1RM. Wenn
ein 1RM-Vorschlag gewünscht ist, ihn als *nicht übernommenen* Hinweis anzeigen („Vorschlag:
113 kg" zum Antippen), statt ihn in das Feld zu schreiben, das „Add" protokolliert.

---

### H4 — Übungswechsel im laufenden Training lässt die Werte der vorherigen Übung stehen

**Was.** Von Bankdrücken auf Squat gewechselt. Die Eingabezeile zeigt weiterhin **8 Reps /
60 kg** — die Werte von Bankdrücken — obwohl Squat mit **5 × 100 kg** geplant ist und die
geplanten Squat-Sätze direkt darunter stehen.
([B11](screenshots/gh426/B11-switched-to-squat.png))

Verschärfend: Nach Korrektur der Reps auf 5 wird das Gewicht **nicht** neu berechnet, sondern
bleibt bei 60 kg stehen ([B12](screenshots/gh426/B12-squat-reps5.png)) — die Automatik aus H3,
die sonst ungefragt zuschlägt, greift hier gerade nicht.

**Warum ein Problem.** „Error prevention". Ein Tap auf „Add" nach dem Übungswechsel
protokolliert die Zahlen der falschen Übung. Genau dieser Tap ist im Normalfall der
Ein-Tap-Wiederholungssatz — der Nutzer ist darauf trainiert, ihn ohne Hinsehen zu drücken.
Das macht die Fehleingabe wahrscheinlich statt unwahrscheinlich.

**Vorschlag.** Beim Übungswechsel die Eingabezeile aus dem geplanten bzw. letzten Satz **der neu
gewählten Übung** vorbelegen (oder leeren). Auf keinen Fall die Werte der vorherigen Übung
stehen lassen.

---

### H5 — Der „+"-FAB überlagert „Continue Training" und schluckt den Tap

**Was.** Auf dem Training-Home mit laufender Einheit überlappt der runde „+"-FAB die rechte
Seite des Knopfes „Continue Training"
([B17](screenshots/gh426/B17-resumed-hard-relaunch.png)). Ein Tap in den Überlappungsbereich
(720-px-Koordinate 650 / 1327) öffnet **den Dialog „Add New Training Plan"** statt die laufende
Einheit fortzusetzen ([B18](screenshots/gh426/B18-fab-overlap-tap.png)).

Dasselbe gilt ohne laufendes Training für den Knopf „Next Training": FAB `add-trainings-plan`
= (603, 1259)–(701, 1357), Knopf = (49, 1227)–(678, 1297) → **75 × 38 px Überlappung**.

**Warum ein Problem.** Der FAB verdeckt genau die primäre Aktion des Screens und gewinnt den
Tap. Der Nutzer landet in einem Dialog zum Anlegen eines Plans, während er sein laufendes
Training fortsetzen wollte — und ein versehentliches „Save" dort erzeugt wieder H1.

**Vorschlag.** Der scrollenden Liste unten so viel Padding geben, dass der FAB nie über
interaktivem Karteninhalt liegt; alternativ den FAB ausblenden, solange eine Einheit läuft.

---

### M1 — Fast alle Bedienelemente im laufenden Training sind kleiner als 48 dp

**Was.** Aus der Hierarchie der **laufenden** Einheit gemessen (`checks/train-hierarchy.json`,
280 dpi → 1 dp = 1,75 px):

| Element | Größe (dp) | ≥ 48 dp? |
|---|---|---|
| `rest-timer-reset` („Reset") | 57 × **30** | ✗ |
| `rest-timer-overflow` (⋮) | **36 × 36** | ✗ |
| `add-workout-set-reps/rir/weight-input` | 86 × **35** | ✗ |
| `add-workout-set-submit-button` („Add") | 74 × **40** | ✗ |
| `train-tab-finish-button` | 143 × **40** | ✗ |
| `drawer-menu-button`, `header-overflow-icon`, Icon-Buttons | 40 × 40 | ✗ |
| Häkchen / Papierkorb je Satzzeile | 42 × 42 | ✗ |
| `subtab-plan/train/analysis` | 137 × **42** | ✗ |
| Übungs-Chips | 96 × 60 | ✓ |
| `rest-timer-big` | 66 × 66 | ✓ |

**9 von 12** geprüften Bedienelementen liegen unter der Mindest-Trefferfläche von 48 × 48 dp
(Material Design / WCAG 2.5.5).

**Warum ein Problem.** Das ist genau der Kontext, in dem große Trefferflächen zählen: zwischen
zwei schweren Sätzen, einhändig, mit zittrigen oder eingegipsten Fingern. Besonders kritisch:
Häkchen (42 dp) und **Papierkorb (42 dp) liegen direkt nebeneinander** — die harmlose und die
destruktive Aktion sind gleich klein und gleich weit weg.

**Vorschlag.** Trefferflächen aller Aktionen im Trainingsscreen auf ≥ 48 dp anheben
(notfalls per `hitSlop`, ohne die Optik zu ändern) und Häkchen/Papierkorb deutlicher trennen.

---

### M2 — „Pause session" ist während des laufenden Trainings deaktiviert; es gibt kein „Abbrechen"

**Was.** Das Header-Menü der laufenden Einheit bietet „Finish Training", „**Pause session**"
(ausgegraut), „Edit training" und „Delete"
([B20](screenshots/gh426/B20-header-menu.png)). Ein Tap auf „Pause session" schließt nur das
Menü, der Timer läuft weiter ([B21](screenshots/gh426/B21-pause-tap.png)).

**Warum ein Problem.** Pausieren ist genau *während* einer laufenden Einheit sinnvoll — dann ist
es deaktiviert, ohne Begründung. Und wer eine Einheit abbrechen will, ohne die Daten zu
verlieren, hat keine Option: Es gibt nur „Delete" (rot, destruktiv). Das ist eine echte
Sackgasse. **Unverändert seit Runde 1 (M4).**

**Vorschlag.** „Pause session" für laufende Einheiten aktivieren (Timer anhalten) oder den
Eintrag ausblenden statt ihn tot anzuzeigen. Zusätzlich „Training verwerfen" mit Rückfrage
anbieten, klar getrennt von „Delete".

---

### M3 — Nach Prozess-Neustart verschwinden die geplanten, noch offenen Sätze

**Was.** Vor der Unterbrechung zeigte Bankdrücken **vier** Satzzeilen — zwei mit blauem Haken
(geplant) und zwei mit grünem Haken (protokolliert) — Zähler „**Set 5**"
([B10](screenshots/gh426/B10-set4-onetap.png)). Nach `am force-stop` und „Continue Training"
sind es nur noch **zwei** Zeilen, beide grün, Zähler „**Set 3**"
([B19](screenshots/gh426/B19-continued-training.png)).

**Warum ein Problem.** Dieselbe Einheit sieht nach einem Neustart anders aus. Die noch offenen
geplanten Sätze — die Information „was habe ich noch vor mir" — sind weg. Wer während des
Trainings sein Handy neu startet (oder von Android weggeräumt wird), verliert die Sicht auf
sein eigenes Pensum.

**Vorschlag.** Beim Rehydrieren der Einheit die geplanten, noch nicht protokollierten Sätze
genauso wiederherstellen wie die protokollierten.

---

### M4 — Die Liste im Übungs-Picker liegt unter der Tastatur; die untersten Treffer sind nicht antippbar

**Was.** Im Picker nach „squat" gesucht. Von sieben Treffern sind bei offener Tastatur nur sechs
sichtbar; der exakte Treffer „Squat" liegt **hinter der Tastatur**
([A29](screenshots/gh426/A29-search-squat.png)). Ein Tap auf seine gemeldete Position
(720-px-Koordinate 360 / 942) trifft die Tastatur und wählt nichts aus
([A30](screenshots/gh426/A30-squat-selected.png), weiterhin „1 selected").
**Exakt dieselbe Koordinate funktioniert, sobald die Tastatur geschlossen ist** — dann steht
„2 selected" ([A31](screenshots/gh426/A31-keyboard-dismissed.png),
[A32](screenshots/gh426/A32-squat-selected-ok.png)).

**Warum ein Problem.** Das Panel bezieht die Tastatur nicht in sein Layout ein. Die Elemente
existieren im Accessibility-Baum, sind aber physisch nicht erreichbar — der Nutzer tippt
mehrfach ins Leere, ohne zu verstehen, warum nichts passiert.

**Vorschlag.** Das Picker-Panel um die Tastaturhöhe einrücken (Keyboard-Inset), sodass die
Liste immer vollständig scroll- und antippbar bleibt.

---

### M5 — Die Suche im Picker wird nach jeder Auswahl zurückgesetzt

**Was.** Direkt vor der Auswahl stand „squat" im Suchfeld und die Liste war gefiltert
([A31](screenshots/gh426/A31-keyboard-dismissed.png)). Unmittelbar nach der Auswahl ist das
Suchfeld leer und die Liste zeigt wieder alle Übungen ab „45 degree crunch machine free".

**Warum ein Problem.** Wer mehrere verwandte Übungen aufnehmen will („Squat", „Front squat",
„Paused Squats"), muss die Suche jedes Mal neu tippen. Der Picker ist ausdrücklich
mehrfachauswahlfähig („2 selected") — das Verhalten arbeitet gegen seinen eigenen Zweck.

**Vorschlag.** Suchbegriff nach der Auswahl stehen lassen.

---

### M6 — Der exakte Treffer wird zuletzt einsortiert

**Was.** Suche nach „squat" listet alphabetisch: „Bulgarian split squat", „Front squat",
„Paused Squats", „Paused safety bar squat", „Safety bar squat", „Split squat db" — und **ganz
zuletzt** „Squat" ([A29](screenshots/gh426/A29-search-squat.png)). Zusammen mit M4 landet damit
ausgerechnet der exakte Treffer hinter der Tastatur.

**Warum ein Problem.** Verletzt die Erwartung, dass die genaueste Übereinstimmung zuerst kommt.

**Vorschlag.** Ranking: exakte Treffer, dann Präfix-Treffer, dann Teilstring-Treffer.

---

### M7 — Der Löschdialog für einen **Plan** spricht von einem „training"

**Was.** „Delete plan" im Edit-Dialog eines Plans öffnet eine Rückfrage mit dem Text:
„This action will delete the **training**. The workouts done in this training will not be
deleted and are still available in the history. Are you sure you want to delete this
**training**?" ([C02](screenshots/gh426/C02-delete-plan.png)) — gelöscht wird aber ein *Plan*
mit allen darin enthaltenen Trainings.

**Warum ein Problem.** Bei einer destruktiven, unwiderruflichen Aktion beschreibt der
Bestätigungstext den falschen Gegenstand und macht eine falsche Zusicherung über den Umfang.
Genau hier muss der Text stimmen.

**Vorschlag.** Eigenen Text für das Löschen eines Plans, der Plan **und** die Zahl der
betroffenen Trainings benennt.

---

### M8 — Drei deaktivierte „Suggest based on …"-Aktionen ohne Begründung

**Was.** Ein frisch angelegter Plan zeigt oben drei Aktionen „Suggest based on last Training",
„… last planned Training", „… last Meso" in grauer Schrift
([A10](screenshots/gh426/A10-plan-opened.png)). Sie sind `enabled=false`, aber weiterhin
`clickable=true`; ein Tap bewirkt nichts und meldet nichts
([A11](screenshots/gh426/A11-tap-suggest-disabled.png)).

**Warum ein Problem.** Der Leerzustand des Plans wird von drei toten Bedienelementen dominiert.
Nirgends steht die Bedingung („braucht ein vorheriges Training"). Der Tap ist ein stummes
No-Op — der Nutzer weiß nicht, ob er falsch getippt hat oder die App klemmt.

**Vorschlag.** Bedingung als Hilfetext anzeigen oder die Aktionen im Leerzustand ganz
ausblenden und nur „Plan new Training" anbieten.

---

### M9 — Die Auswahl der ersten Übung verlässt still den „EDITING PLAN"-Modus

**Was.** „Plan new Training" öffnet einen Modus mit dem Kicker „**EDITING PLAN**" und einem
klaren „**Done**"-Knopf oben rechts ([A12](screenshots/gh426/A12-plan-new-training.png)).
Sobald die erste Übung ausgewählt ist, sind Kicker **und** „Done" verschwunden; oben rechts
steht nur noch das nicht klickbare Label „Plan" und ein ⋮
([A17](screenshots/gh426/A17-selected-bankdruecken.png)).

**Warum ein Problem.** Der Modus wechselt ohne Zutun und ohne Hinweis; die Ausstiegs-Affordanz,
die dem Nutzer gerade noch angeboten wurde, ist weg. Man weiß nicht mehr, ob die Änderungen
gespeichert sind. (Runde 1 bemängelte unter M6 dasselbe „Done" — die Ursache hat sich nur
verlagert.)

**Vorschlag.** Modus und „Done" stabil halten, bis der Nutzer sie beendet — und beim Beenden
eine kurze Bestätigung zeigen.

---

### M10 — Ein Wisch unterhalb des Pickers schließt ihn ohne Vorwarnung

**Was.** Unter dem Picker-Panel liegt eine große, optisch leere Fläche (Panel endet bei
y ≈ 988 px, Inhaltsbereich bei 1376 px). Eine **Wischgeste** dort schließt den Picker
([A14](screenshots/gh426/A14-picker-scroll-inside.png) →
[A15](screenshots/gh426/A15-deadzone-swipe.png)).

**Warum ein Problem.** Die Fläche sieht aus wie Hintergrund, nicht wie ein Schließen-Backdrop
(kein Scrim, kein Griff). Bei einem Panel, dessen Liste ohnehin zu kurz ist (M4), ist das genau
die Zone, in die der Daumen zum Scrollen rutscht. Immerhin: Bereits gewählte Übungen bleiben
erhalten ([A18](screenshots/gh426/A18-after-accidental-dismiss.png)) — es gehen **keine Daten
verloren**, weshalb das Finding „mittel" und nicht „hoch" ist.

**Vorschlag.** Nur auf explizites Tippen schließen, nicht auf Wischgesten; und das Panel höher
ziehen, damit die Fläche gar nicht erst entsteht.

---

### M11 — Satz löschen im Training: ohne Rückfrage und ohne Undo

**Was.** Der Papierkorb an einer Satzzeile löscht sofort
([B06](screenshots/gh426/B06-added-suggested-weight.png) →
[B07](screenshots/gh426/B07-delete-wrong-set.png)). Keine Rückfrage, kein „Rückgängig".

**Warum ein Problem.** Der Papierkorb ist nur 42 dp groß (M1) und sitzt direkt neben dem
Häkchen. Eine Fehlberührung zwischen zwei Sätzen löscht einen protokollierten Satz
unwiederbringlich. (Beim Löschen eines *Plans* fragt die App sehr wohl nach — die Regel ist
also inkonsistent.)

**Vorschlag.** Snackbar „Satz gelöscht – Rückgängig" für einige Sekunden.

---

### M12 — Kein Fortschritt gegen den Plan während des Trainings

**Was.** Geplant waren 3 Sätze Bankdrücken. Nach dem dritten protokollierten Satz zählt die
Kopfzeile einfach auf „Set 4", „Set 5" weiter
([B10](screenshots/gh426/B10-set4-onetap.png)); nichts zeigt an, dass das Pensum erfüllt ist.

**Warum ein Problem.** Die zentrale Frage während des Trainings — „wie viel habe ich noch vor
mir?" — beantwortet der Screen nicht. Der Zähler suggeriert eine fortlaufende Liste statt eines
Plans mit Ziel.

**Vorschlag.** „Satz 3 / 3" statt „Set 3" und die erledigten Sätze gegen den Plan markieren.

---

### N1 — Erste Übungs-Kachel klebt ohne Rand am linken Displayrand

Die Chip-Reihe beginnt bei x = 0, während der übrige Inhalt bei x ≈ 25–50 px anfängt; die erste
Kachel wirkt angeschnitten ([A12](screenshots/gh426/A12-plan-new-training.png),
[A34](screenshots/gh426/A34-squat-set1.png)). **Vorschlag:** gleiches horizontales Padding wie
für Karten.

### N2 — Die Toasts „Training started/finished!" verdecken den Header

Beide Meldungen legen sich über Plan- und Meso-Namen
([B02](screenshots/gh426/B02-training-started.png),
[B23](screenshots/gh426/B23-finish-tapped.png)). **Vorschlag:** unten einblenden.

### N3 — Blaue und grüne Häkchen sind nirgends erklärt

Geplante Sätze tragen einen blau gefüllten Kreis, protokollierte einen grünen Haken
([B10](screenshots/gh426/B10-set4-onetap.png)). Es gibt keine Legende.
**Vorschlag:** Legende oder sprechende Labels.

### N4 — Die Eingabezeile heißt „Set 3", bevor ein Satz gemacht wurde

Direkt nach dem Start steht „Set 3" über einer leeren Zeile
([B03](screenshots/gh426/B03-after-toast.png)), weil die geplanten Sätze mitgezählt werden.
**Unverändert seit Runde 1 (N3).** **Vorschlag:** „Nächster Satz" statt einer Nummer.

### N5 — „Volume −1850.00 / 1960.00" ohne Beschriftung

In der Abschlusskarte steht die rote Abweichung **über** dem eigentlichen Wert, beide ohne Label
([B23](screenshots/gh426/B23-finish-tapped.png)). **Vorschlag:** Wert prominent, Delta
kleiner darunter mit „vs. Plan".

### N6 — Die IME-Taste „OK" bestätigt den Anlegen-Dialog nicht

Im Dialog „Add New Training Plan" schließt „OK" nur die Tastatur; gespeichert wird nicht
([A08](screenshots/gh426/A08-after-ime-ok.png)). Der Nutzer muss anschließend oben rechts
„Save" treffen. **Vorschlag:** `onSubmitEditing` auf „Save" legen.

### N7 — Der Anlegen-Dialog fokussiert sein einziges Feld nicht

Nach dem Öffnen ist kein Feld fokussiert (`mInputShown=false`); erst ein zusätzlicher Tap öffnet
die Tastatur ([A05](screenshots/gh426/A05-createplan-dialog.png) →
[A06](screenshots/gh426/A06-name-field-focused.png)). **Vorschlag:** `autoFocus`.

### N8 — Der Edit-Dialog eines Plans heißt nur „Edit"

Ohne Plannamen im Titel ([C01](screenshots/gh426/C01-plan-kebab.png)) — bei einem namenlosen
Plan (H1) weiß man gar nicht mehr, was man bearbeitet. **Vorschlag:** „Edit · Audit R2".

### N9 — Zahlenfelder setzen den Cursor ans Ende statt zu selektieren

Tap auf das mit 118 vorbelegte Gewichtsfeld und Eingabe „60" ergibt „**11860**"
([A23](screenshots/gh426/A23-weight-focused.png)). Den Vorschlag zu korrigieren kostet
3 Backspaces. **Vorschlag:** Inhalt beim Fokussieren selektieren.

### N10 — „vs last training −67.0 kg" in Rot, bevor irgendetwas protokolliert wurde

Direkt nach dem Start zeigt die 1RM-Karte eine große rote Negativabweichung
([B03](screenshots/gh426/B03-after-toast.png)), die sich allein aus den geplanten Werten ergibt.
**Vorschlag:** Vergleich erst ab dem ersten protokollierten Satz zeigen.

---

## 4. Bedienbarkeit **während** des Trainierens

Bewertet für die reale Situation: 6,7-Zoll-Gerät, einhändig, zwischen zwei schweren Sätzen,
Blick nur kurz auf das Display.

### 4.1 Einhändigkeit / Reichweite

Bei 1600 px Höhe liegt die bequem erreichbare Daumenzone grob unterhalb von y ≈ 1000 px.

| Element | y-Position | einhändig erreichbar? |
|---|---|---|
| Eingabezeile Reps/RIR/Weight | 431–493 | ✗ — oberes Drittel |
| „Add" (der meistgenutzte Knopf) | 420–490 | ✗ — **oberes Drittel** |
| Übungs-Chips | 221–326 | ✗ |
| Header-Menü ⋮ (Finish/Pause/Delete) | 64–134 | ✗ — oberste Ecke |
| Rest-Timer + „Reset" | 851–966 | ✓ |
| „Finish Training" | 1016–1086 | ✓ |

**Der wichtigste Knopf der ganzen App — „Add" — sitzt im oberen Drittel.** Genau die eine
Aktion, die zwischen zwei Sätzen einhändig gedrückt werden muss, verlangt ein Umgreifen.
Umgekehrt liegt „Finish Training", das man einmal pro Einheit braucht, bequem im Daumenbereich.
Die Prioritäten sind vertauscht.

Dazu kommt M1: „Add" ist mit 40 dp Höhe zusätzlich unter der Mindestgröße.

**Vorschlag.** Die Eingabezeile samt „Add" an den unteren Rand legen (als Sticky-Leiste über der
Tab-Bar); die Satzhistorie darüber. Das löst gleichzeitig das Reichweiten- und das
Tastaturproblem.

### 4.2 Zwischen den Sätzen

**Gut:** Der Rest-Timer erscheint automatisch nach jedem Satz, ist groß (66 dp), zeigt Ziel und
Überzug und liegt in der Daumenzone. Sein Menü (Skip / Edit target / Adjust default) trifft
genau die Bedürfnisse. Der Wiederholungssatz kostet **einen** Tap. Und: Werte bleiben stehen,
die App vergisst nichts, wenn das Handy zwischendurch weggelegt oder gekillt wird.

**Schlecht:** Genau dieser Ein-Tap-Reflex ist die Gefahr — nach einem Übungswechsel (H4) oder
bei aktivem Gewichtsvorschlag (H3) protokolliert derselbe Tap falsche Zahlen. Wer eine
Fehleingabe korrigieren will, trifft neben dem 42-dp-Häkchen den gleich großen Papierkorb, der
ohne Rückfrage löscht (M11). Und pausieren kann man nicht (M2).

### 4.3 Ablesbarkeit

**Gut:** Dunkles Thema, hoher Kontrast bei Zahlen, große Ziffern im Rest-Timer, klare
Einheiten („kg"), die Trennung von protokollierten (grün) und geplanten (blau) Sätzen ist
optisch sofort erkennbar — auch wenn die Bedeutung nicht erklärt ist (N3).

**Schlecht:**
- Die Feldbeschriftungen „Reps", „RIR", „Weight" sind Material-Floating-Labels in sehr kleiner
  Schrift über den Feldern; die eigentlichen Werte sind zwar groß, die Zuordnung im
  Vorbeischauen aber nicht.
- Der wichtige Unterschied zwischen „vorgeschlagenem" (blau) und „eingegebenem" (weiß) Gewicht
  wird allein über die Textfarbe transportiert — im Halbdunkel eines Gyms und für Nutzer mit
  Farbsehschwäche ist das kein tragfähiges Signal (H3).
- Kein Fortschritt gegen den Plan (M12): Man muss die Satzzeilen zählen.

---

## 5. Vergleich mit Runde 1

> Dieser Abschnitt wurde **nach** Abschluss der eigenen Befunde geschrieben. Der Bericht aus
> Runde 1 wurde bewusst erst danach gelesen, damit die Findings oben unabhängig entstehen.
> Vorlage: `docs/ux/create-and-execute-training-audit.md` (Branch `feature/GH-399`, PR #400,
> noch nicht gemergt).

Legende: **erledigt** · **unverändert** · **verschlimmert** · **nicht erneut geprüft**

| Runde-1-Finding | Status Runde 2 | Beleg / Anmerkung |
|---|---|---|
| **H1** „Start Training" startet kein Training | **teilweise erledigt** | Der Start über den Train-Tab startet die Einheit korrekt ([B01](screenshots/gh426/B01-train-subtab.png) → [B03](screenshots/gh426/B03-after-toast.png)). Der in Runde 1 bemängelte Knopf auf der *Next-Training-Karte* wurde **nicht erneut geprüft**. |
| **H2** „Start training to begin" — Sackgasse ohne Start-Control | **erledigt** | Der Train-Tab hat jetzt einen echten Start-Knopf **mit** Erklärzeile ([B01](screenshots/gh426/B01-train-subtab.png)). |
| **H3** Picker liefert nach der ersten Auswahl eine leere Liste | **erledigt** | Nach der ersten Auswahl bleibt die Liste vollständig, „1 selected" ([A17](screenshots/gh426/A17-selected-bankdruecken.png)). |
| **H4** Laufendes Training erscheint nach Prozess-Neustart als „Next Training" | **erledigt** | Jetzt eigene Karte „Training running" mit Laufzeit, Inhaltsvorschau und „Continue Training" ([B17](screenshots/gh426/B17-resumed-hard-relaunch.png)). |
| **M1** Rest-Timer liegt unter der Falz | **erledigt** | Timer erscheint ohne Scrollen direkt nach dem Satz ([B09](screenshots/gh426/B09-set3-logged.png)). |
| **M2** Rest-Timer beschriftet Abweichung als „elapsed", zeigt negative Zeiten | **erledigt** | Jetzt „Rest / target 01:30" und Überzug als „+01:21" in Rot ([B19](screenshots/gh426/B19-continued-training.png)). |
| **M3** Analysis-Tab ist während des Trainings eine Sackgasse | **nicht erneut geprüft** | Nach dem Beenden bietet das Menü einer fertigen Einheit nur „Edit training"/„Delete" ([D03](screenshots/gh426/D03-plan-kebab-menu.png)); eine zweite laufende Einheit wurde nicht angelegt. |
| **M4** „Pause session" während des Trainings deaktiviert | **unverändert** | Weiterhin ausgegraut, Tap ohne Wirkung ([B20](screenshots/gh426/B20-header-menu.png), [B21](screenshots/gh426/B21-pause-tap.png)) → **M2 dieser Runde**. |
| **M5** Ein neuer Satz übernimmt die Werte des vorherigen nicht | **erledigt** | Beim Planen kopiert Satz 2 den Vorgänger ([A25](screenshots/gh426/A25-set2-added.png)); im Training bleibt die Zeile befüllt → Wiederholungssatz = 1 Tap ([B10](screenshots/gh426/B10-set4-onetap.png)). Genau diese Verbesserung erzeugt allerdings **H4**. |
| **M6** „Done" gibt kein Feedback, springt an sinnlose Scroll-Position | **unverändert (verlagert)** | „Done" verschwindet jetzt komplett, sobald die erste Übung gewählt ist ([A12](screenshots/gh426/A12-plan-new-training.png) → [A17](screenshots/gh426/A17-selected-bankdruecken.png)) → **M9 dieser Runde**. |
| **M7** Picker braucht zwei Stufen und zwei Affordances | **unverändert** | Weiterhin „+"-Kachel → Panel; die Kachel wechselt zu „−" ([A13](screenshots/gh426/A13-exercise-picker.png)). |
| **M8** Keine Notification für ein laufendes Training | **nicht erneut geprüft** | Benachrichtigungen wurden in dieser Runde nicht untersucht. |
| **N1** Zahlenformatierung im Analysis-Tab | **unverändert** | „Volume −1850.00 / 1960.00", Delta über Wert, ohne Label ([B23](screenshots/gh426/B23-finish-tapped.png)) → **N5**. |
| **N2** Records mit zwei Nachkommastellen | **nicht erneut geprüft** | In dieser Einheit wurde kein Record ausgelöst. |
| **N3** Eingabezeile heißt „Set 4", bevor ein Satz gemacht wurde | **unverändert** | „Set 3" vor dem ersten protokollierten Satz ([B03](screenshots/gh426/B03-after-toast.png)) → **N4**. |
| **N4** Zustands-Semantik der Satz-Häkchen | **unverändert** | Blau (geplant) vs. grün (protokolliert) weiterhin ohne Legende ([B10](screenshots/gh426/B10-set4-onetap.png)) → **N3**. |
| **N5** Satzzeilen scrollen ohne Hintergrund unter den Titel | **unverändert (anderer Ort)** | Jetzt scrollt die **Picker-Liste** ohne Hintergrund unter die Suchleiste ([A14](screenshots/gh426/A14-picker-scroll-inside.png)). |
| **N6** Neu hinzugefügte Satzzeile liegt hinter der unteren Tab-Bar | **verschlimmert** | Beim Planen liegt die **fokussierte** Zeile jetzt hinter der **Tastatur** — man tippt blind ([A36](screenshots/gh426/A36-keyboard-open-layout.png)) → **H2 dieser Runde**. |
| **N7** Tastatur wechselt nach „OK" von Ziffernblock auf QWERTY | **nicht reproduziert** | Nach „OK" schließt die Tastatur; der Ziffernblock erscheint bei Zahlenfeldern zuverlässig ([A21](screenshots/gh426/A21-reps8-after-ok.png)). |
| **N8** FAB überlagert Karteninhalt | **verschlimmert** | Der FAB verdeckt nicht nur, er **gewinnt den Tap** auf „Continue Training" ([B18](screenshots/gh426/B18-fab-overlap-tap.png)) → **H5 dieser Runde**. |

**Bilanz:** 8 erledigt (davon 3 von 4 „hoch"), 1 teilweise erledigt, 6 unverändert
(2 davon nur verlagert), 2 verschlimmert, 4 nicht erneut geprüft.

---

## 6. Gesamtaussage: Ist der Flow besser geworden?

**Ja — deutlich, aber ungleichmäßig. Der Weg *in* das Training hinein ist repariert; die
Qualität der *Daten*, die dabei entstehen, ist das neue Problem.**

Woran sich das festmacht:

1. **Die schweren Blocker von Runde 1 sind weg.** Drei der vier „hoch"-Findings sind erledigt:
   Der Train-Tab hat einen echten Start-Knopf (H2), der Picker bleibt nach der ersten Auswahl
   befüllt (H3), und ein laufendes Training wird nach Prozess-Tod als solches erkannt und mit
   „Continue Training" angeboten (H4).

2. **Messbar am Einstieg:** Runde 1 brauchte **6 Interaktionen bis zum tatsächlichen Start,
   davon 3 verlorene** durch irreführende Knöpfe und eine Sackgasse. Runde 2 braucht **3 — ohne
   eine einzige verlorene Interaktion**. Der kürzeste bekannte Weg von Runde 1 ist heute der
   normale Weg.

3. **Unterbrechen/Fortsetzen ist von „Datenrettung" zu „Feature" geworden.** Beide
   Unterbrechungen — Home-Taste und echter Prozess-Tod — waren verlustfrei, und der Wiedereinstieg
   ist jetzt beschriftet, mit Laufzeit und Inhaltsvorschau.

4. **Der Rest-Timer, in Runde 1 zweifach bemängelt, ist heute eine Stärke** (M1, M2 beide
   erledigt): sichtbar ohne Scrollen, ehrliche Überzugsanzeige, sinnvolles Menü.

**Wogegen das steht:**

5. **Zwei Runde-1-Findings sind schlechter geworden**, beide durch Layout-Überlagerung: Die
   fokussierte Eingabezeile liegt beim Planen jetzt hinter der Tastatur (N6 → H2), und der FAB
   verdeckt „Continue Training" nicht nur, sondern schluckt den Tap (N8 → H5).

6. **Die neuen „hoch"-Findings sind anderer Natur als die alten.** Runde 1 war blockiert:
   Dinge funktionierten nicht. Runde 2 funktioniert — protokolliert aber auf einen einzigen,
   eingeübten Tap hin **falsche Zahlen**: den 1RM-Vorschlag statt des eigenen Plans (H3) und
   nach einem Übungswechsel die Werte der vorherigen Übung (H4). Das ist in der Summe
   gefährlicher als ein Knopf, der nichts tut, weil es unbemerkt bleibt und die
   PR-/1RM-Statistik dauerhaft verfälscht. Ironischerweise entsteht H4 direkt aus der
   Behebung von M5 aus Runde 1.

7. **Was in beiden Runden unangetastet blieb:** „Pause session" ist weiterhin tot und es gibt
   weiterhin kein „Training abbrechen" (Runde 1 M4 = Runde 2 M2). Das ist das einzige Finding,
   das zweimal unverändert durchgeht.

**Kurz:** Runde 1 hat gefragt „komme ich überhaupt durch?" — die Antwort ist heute Ja. Runde 2
muss fragen „stimmt hinterher, was drinsteht?" — und da lautet die Antwort noch Nein.

---

## 7. Priorisierte Ticket-Vorschläge

Ein Problem = ein Vorschlag.

| # | Prio | Vorschlag | Finding |
|---|---|---|---|
| 1 | hoch | Eingabezeile im Training aus dem **geplanten Satz** vorbelegen statt aus dem 1RM; 1RM-Vorschlag nur als antippbaren Hinweis anbieten | H3 |
| 2 | hoch | Beim Übungswechsel die Eingabezeile auf die neu gewählte Übung zurücksetzen/vorbelegen | H4 |
| 3 | hoch | Fokussiertes Eingabefeld im Plan-Editor über die Tastatur scrollen (`KeyboardAvoidingView`) | H2 |
| 4 | hoch | FAB darf „Continue Training"/„Next Training" nicht überlagern (Listen-Padding oder FAB bei laufender Einheit ausblenden) | H5 |
| 5 | hoch | „Save" bei leerem Plannamen sperren bzw. Vorgabenamen vergeben | H1 |
| 6 | mittel | Trefferflächen im Trainingsscreen auf ≥ 48 dp anheben; Häkchen und Papierkorb trennen | M1 |
| 7 | mittel | Eingabezeile samt „Add" als Sticky-Leiste an den unteren Rand (Einhändigkeit) | §4.1 |
| 8 | mittel | „Pause session" aktivieren und „Training verwerfen" getrennt von „Delete" anbieten | M2 |
| 9 | mittel | Geplante, offene Sätze beim Rehydrieren nach Prozess-Neustart wiederherstellen | M3 |
| 10 | mittel | Übungs-Picker um die Tastaturhöhe einrücken | M4 |
| 11 | mittel | Suchbegriff im Picker nach der Auswahl beibehalten | M5 |
| 12 | mittel | Exakte/Präfix-Treffer in der Übungssuche zuerst einsortieren | M6 |
| 13 | mittel | Eigenen Bestätigungstext für „Plan löschen" (spricht heute von „training") | M7 |
| 14 | mittel | Bedingung für die „Suggest based on …"-Aktionen anzeigen oder sie im Leerzustand ausblenden | M8 |
| 15 | mittel | „EDITING PLAN"-Modus und „Done" stabil halten, Speicherung bestätigen | M9 |
| 16 | mittel | Picker nur auf Tippen schließen, nicht auf Wischgesten | M10 |
| 17 | mittel | „Rückgängig"-Snackbar nach dem Löschen eines Satzes | M11 |
| 18 | mittel | Satzfortschritt gegen den Plan anzeigen („Satz 3 / 3") | M12 |
| 19 | niedrig | Horizontales Padding für die Übungs-Chip-Reihe | N1 |
| 20 | niedrig | Start-/Finish-Toasts unten statt über dem Header einblenden | N2 |
| 21 | niedrig | Legende für blaue vs. grüne Satz-Häkchen | N3 |
| 22 | niedrig | „Nächster Satz" statt „Set N" vor dem ersten protokollierten Satz | N4 |
| 23 | niedrig | Volumen-Delta in der Abschlusskarte beschriften und dem Wert unterordnen | N5 |
| 24 | niedrig | IME-„OK" im Anlege-Dialog auf „Save" legen | N6 |
| 25 | niedrig | `autoFocus` auf das Namensfeld im Anlege-Dialog | N7 |
| 26 | niedrig | Plannamen in den Titel des Edit-Dialogs aufnehmen | N8 |
| 27 | niedrig | Zahlenfelder beim Fokussieren selektieren statt Cursor ans Ende setzen | N9 |
| 28 | niedrig | 1RM-Vergleich erst ab dem ersten protokollierten Satz anzeigen | N10 |

---

## 8. Methodik und Einschränkungen

**Methodik.** Experten-/Heuristik-Audit nach Nielsens Heuristiken, ergänzt um gemessene
Trefferflächen (Material/WCAG 2.5.5) und gezählte Interaktionen. Bedient wurde über
`adb shell input tap/text/keyevent` auf Koordinaten, die aus dem Accessibility-Baum
(`uiautomator dump`) bzw. aus den Screenshots abgeleitet wurden. Jeder Zustand ist als
Screenshot vom Gerät belegt.

**Das ist ausdrücklich kein Nutzertest.** Es wurden keine echten Nutzer beobachtet; alle
Aussagen über „der Nutzer erwartet …" sind Experteneinschätzungen, keine empirischen Befunde.

**Einschränkungen.**

- **Vier Runde-1-Findings wurden nicht erneut geprüft** (M3, M8, N2 und der
  Next-Training-Knopf aus H1) — siehe die entsprechenden Zeilen in §5. Für M3 hätte eine
  zweite laufende Einheit angelegt werden müssen; das wurde zugunsten der in §1 genannten
  Pflichtschritte zurückgestellt. Diese Zeilen sind als „nicht erneut geprüft" markiert und
  **nicht** als „erledigt" gewertet.
- Während einer laufenden Einheit liefert `uiautomator dump` keine Hierarchie mehr („could not
  get idle state"), weil der Sekundentimer den UI-Idle-Zustand verhindert. Die Messwerte aus M1
  stammen deshalb aus `maestro hierarchy` (`checks/train-hierarchy.json`), die Taps in dieser
  Phase aus Screenshot-Koordinaten.
- Geprüft wurde **ein** Gerät (Android 13, 720 × 1600 @ 280 dpi, dunkles Thema, deutsche
  Tastatur). Das Gerät läuft mit reduzierter Auflösung; auf einem Gerät in nativer Auflösung
  können Layout-Befunde (H2, H5, M4, N1) anders ausfallen.
- Der Audit hat Daten erzeugt: Plan „Audit R2" mit einer abgeschlossenen Einheit bleibt auf dem
  Gerät. Der bei H1 versehentlich entstandene namenlose Plan wurde wieder gelöscht
  ([C03](screenshots/gh426/C03-plan-deleted.png)). An App-Code, Reducern, Komponenten oder
  testIDs wurde nichts geändert.

---

## Anhang A — Interaktionsprotokoll Flow A

Ausgangspunkt: Training-Home mit Baseline-Daten.

| # | Interaktion | Resultat | Screenshot |
|---|---|---|---|
| 1 | Tap „+"-FAB | Dialog „Add New Training Plan" | A01 |
| — | Tap „Save" **ohne Namen** | Dialog schließt kommentarlos, **namenloser Plan angelegt** | A02 / A04 |
| 2 | Tap „+"-FAB | Dialog erneut | A05 |
| 3 | Tap Namensfeld | Tastatur öffnet (**kein** Autofokus) | A06 |
| 4 | „Audit R2" tippen (8 Anschläge) | Feld befüllt | A07 |
| — | IME-„OK" | schließt nur die Tastatur, **speichert nicht** | A08 |
| 5 | Tap „Save" | Plan „Audit R2" in der Liste | A09 |
| 6 | Tap Planzeile | Plan-Detail, Sub-Tab „Plan" | A10 |
| — | Tap „Suggest based on last Training" | **stummes No-Op** (`enabled=false`) | A11 |
| 7 | Tap „Plan new Training" | Modus „EDITING PLAN" + „Done" | A12 |
| 8 | Tap „+"-Kachel | Übungs-Picker | A13 |
| — | Wisch unterhalb des Panels | **Picker schließt sich** | A14 / A15 |
| 9 | Tap „+"-Kachel | Picker erneut | A16 |
| 10 | Tap „Bankdrücken" | „1 selected"; **„EDITING PLAN" und „Done" verschwinden** | A17 |
| 11 | Tap Suchfeld | Tastatur | A28 |
| 12 | „squat" tippen (5 Anschläge) | 7 Treffer, **exakter Treffer zuletzt und hinter der Tastatur** | A29 |
| — | Tap auf „Squat" bei offener Tastatur | **trifft nicht** — weiterhin „1 selected" | A30 |
| 13 | Tastatur schließen | „Squat" sichtbar | A31 |
| 14 | Scrollen in der Liste | „Squat" positioniert | — |
| 15 | Tap „Squat" (gleiche Koordinate) | „2 selected"; **Suchbegriff zurückgesetzt** | A32 |
| 16 | Tap „−"-Kachel | Picker zu, 2 Übungen im Training | A33 |
| 17 | Tap „Add set" (Bankdrücken) | leere Satzzeile | A19 |
| 18 | Tap „Reps" | Ziffernblock | A20 |
| 19 | „8" tippen | **Weight automatisch 118** | A21 |
| — | Tap „1RM"-Chip | Wert bleibt 118, Farbe wechselt blau → weiß | A22 |
| 20 | Tap „Weight", „60" tippen | ergibt **„11860"** (Cursor am Ende) | A23 |
| 21 | 3 × Backspace, „60" | Satz 1 = 8 / 0 / 60 | A24 |
| 22 | Tap „Add set" | **Satz 2 kopiert Satz 1** | A25 |
| 23 | Tap „Add set" | Satz 3 | A26 |
| 24 | Tap „+", Tap „Squat"-Sektion „Add set" | leere Satzzeile Squat | A34 |
| 25 | „Reps" = 5 | **Weight automatisch 193** | — |
| — | Tap „Weight" bei offener Tastatur | **trifft die Tastatur** — Eingabe landet in „Reps" | A36 |
| 26 | Tastatur schließen, „Weight" = 100 | Satz 1 = 5 / 0 / 100 | A37 |
| 27 | 2 × „Add set" | Squat 3 Sätze | A38 |

**Metriken Flow A:** 24 Touch-Interaktionen + 26 Tastenanschläge = **50 Eingaben** für
2 Übungen / 6 Sätze; **4,0 Interaktionen pro geplantem Satz**; 9 Screens/Zustände;
1 Sackgasse; 1 fehlender Abbrechen-Weg.

---

## Anhang B — Interaktionsprotokoll Flow B

| # | Interaktion | Resultat | Screenshot |
|---|---|---|---|
| 1 | Tap Sub-Tab „Train" | „Start Training" **mit Erklärzeile** | B01 |
| 2 | Tap „Start Training" | Toast „Training started!", Timer läuft, Zähler „Set 3" | B02 / B03 |
| 3 | Tap „Reps" | Ziffernblock; **Eingabezeile bleibt sichtbar** | B04 |
| 4 | „8" tippen | **Weight automatisch 113** (geplant waren 60) | B05 |
| 5 | Tap „Add" | **8 × 113 kg protokolliert**, 1RM springt 76 → 143 | B06 |
| 6 | Tap Papierkorb | Satz **ohne Rückfrage** gelöscht | B07 |
| 7 | „Weight" auf 60 korrigieren | 1RM-Chip wird inaktiv | B08 |
| 8 | Tap „Add" | Satz 3 protokolliert, Rest-Timer startet | B09 |
| 9 | Tap „Add" | **Satz 4 mit einem Tap** | B10 |
| 10 | Tap Chip „Squat" | **Eingabezeile zeigt weiter 8 / 60** (Bankdrücken) | B11 |
| 11 | „Reps" auf 5 | **Weight bleibt 60**, keine Neuberechnung | B12 |
| 12 | „Weight" 100, Tap „Add" | Squat-Satz protokolliert | B13 |
| 13 | Tap „Add" | zweiter Squat-Satz | B14 |
| — | **Unterbrechen:** Home-Taste | App im Hintergrund | B15 |
| — | **Fortsetzen:** App öffnen | **verlustfrei** — Timer 06:22, Sätze, Rest-Timer | B16 |
| — | **Härtetest:** `am force-stop` + Neustart | Home mit Karte „**Training running**", 06:52, Inhaltsvorschau | B17 |
| 14 | Tap auf „Continue Training" im FAB-Bereich | **öffnet „Add New Training Plan"** statt fortzusetzen | B18 |
| 15 | Dialog schließen, links auf „Continue Training" tippen | Einheit läuft weiter (08:15), Rest-Timer „+00:47" rot; **geplante Sätze fehlen jetzt** | B19 |
| 16 | Tap ⋮ | Finish / **Pause session (deaktiviert)** / Edit / Delete | B20 |
| 17 | Tap „Pause session" | **wirkungslos**, Timer läuft weiter | B21 |
| 18 | Tap ⋮ am Rest-Timer | Skip rest / Edit target… / Adjust default | B22 |
| 19 | Tap „Finish Training" | **ohne Rückfrage** beendet; Sprung auf „Analysis": 00:10:56, 4 Sätze, Volume 1960 | B23 |
| 20 | Back | Training-Home | B24 |

**Metriken Flow B:** 3 Interaktionen bis zum Start (0 verloren); **1 Interaktion pro
Wiederholungssatz**; 7 bei Korrektur des Vorschlags; 12 direkt nach Übungswechsel;
19 Interaktionen Start → Finish; 8 Screens/Zustände; 3 Sackgassen; 2 fehlende Abbrechen-Wege.
