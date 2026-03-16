# Videoanalyse Squat Side (Android-first) - Aktualisierter Plan (Stand 2026-03-04)

## Kurzfassung
Ziel bleibt eine robuste, genaue und performante Squat-Bar-Analyse mit Video-Overlay.
Der aktuelle Umsetzungsgrad liegt weiterhin bei ca. 60-65%.
Die Hauptluecke bleibt die Tracking-Qualitaet: aktuell noch Motion-Centroid statt echter Plate-Detection.

## Umsetzungsgrad gegen den 10-Step-Plan

| Step | Status |
|---|---|
| Step 1 Result-Format/Statusmodell | weitgehend umgesetzt |
| Step 2 Native Bridge | weitgehend umgesetzt |
| Step 3 Bar-Path-Extraktion | teilweise umgesetzt |
| Step 4 Rep-Segmentierung | teilweise bis gut umgesetzt |
| Step 5 Metriken | umgesetzt |
| Step 6 Video-Overlay | teilweise umgesetzt |
| Step 7 Manual-Seed-Fallback | weitgehend umgesetzt |
| Step 8 Fehlerfaelle | teilweise umgesetzt |
| Step 9 Workout/Set-Linking | weitgehend umgesetzt |
| Step 10 Delete/Persistenz | teilweise umgesetzt |

## Was in diesem Branch zusaetzlich umgesetzt wurde
1. Manual-Seed End-to-End:
   1. Native API auf optionales `manualSeed` erweitert.
   2. Native `needs_manual_seed` Fehlerpfad eingefuehrt (`ERR_VIDEO_ANALYSIS_NEEDS_MANUAL_SEED`).
   3. Preview-Pfad wird bei Manual-Seed-Fehler uebergeben.
   4. Detail-Screen hat Manual-Seed-UI (Tap auf Preview + Re-Run).
2. Linking:
   1. `LINK_VIDEO_ANALYSIS_TO_WORKOUT` verarbeitet jetzt `setIndex` end-to-end.
   2. Link-UI im Detail-Screen hinzugefuegt.
3. Performance/Rerender:
   1. Native Progress Event Intervall vergroessert.
   2. Playback-Zeit im JS zusaetzlich ueber lokale Clock fortgeschrieben.
   3. Rep-Index wird nur bei Wechsel aktualisiert.
4. Status/Typen:
   1. `analysisMeta.manualSeedUsed` ergaenzt.
   2. Redux-Action fuer `manualSeedFramePath` hinzugefuegt.

## Verbindlicher Scope v2 (unveraendert)
1. Tracking-Ansatz: Plate-Tracker V2 (OpenCV-basiert, Android nativ).
2. Overlay: nativer Punkt bleibt, aus dem zeitlich naechstgelegenen `barPathSeries`-Punkt.
3. Performance: JS-Bridge entlasten, UI-Zeit und Rep-Anzeige nur bei echten Aenderungen updaten.
4. Zielgenauigkeit: Median <= 10 px, P95 <= 20 px, Rep-Grenzen <= 120 ms.
5. Plattform: Android-first, Squat Side View.
6. API-Minimum: Anhebung auf minSdk 24 ist akzeptiert, falls notwendig.

## Implementierung (entscheidungsvollstaendig)

### Phase 1: Tracking-Kern auf Plate-Tracker V2
Status: offen (nur Vorarbeit/Seed-Anker vorhanden)

1. In `VideoAnalysisModule` Motion-Centroid durch Plate-Detection + temporales Tracking ersetzen.
2. Detection-Pipeline: Vorverarbeitung, ROI, Kreis-/Ring-Kandidatensuche, Confidence-Score.
3. Tracking-Pipeline: Praediktion, Gating, Re-Detect bei Confidence-Abfall.
4. Outlier-Rejection: physikalisch unrealistische Spruenge verwerfen.
5. Fallback-Regel: bei dauerhaft schwacher Confidence Status `needs_manual_seed` statt synthetischer Pfade.

### Phase 2: Manual-Seed-Fallback
Status: weitgehend umgesetzt

1. Native API erweitert: `analyzeSquatVideo(localVideoPath, analysisId, manualSeed?)`.
2. Detail-Screen: Seed-UI auf Preview-Frame (Tap auf Plate-Center).
3. Re-Run derselben Analysis mit Seed.
4. Ergebniskennzeichnung in `analysisMeta` und `qualityFlags`.

### Phase 3: Rep-Segmentierung und Metriken stabilisieren
Status: offen

1. Segmentierung auf gefiltertem, confidence-gewichteten Y-Signal.
2. Top/Bottom-Erkennung mit Hysterese und Mindestdauer.
3. Bei inkonsistenter Segmentierung klarer Qualitaetsflag statt stiller Fallback-Segmente.
4. Metriken nur aus validierten Rep-Segmenten berechnen.

### Phase 4: Bridge-Last und Re-Renders minimieren
Status: teilweise umgesetzt

1. Overlay-Position vollstaendig nativ aus Player-Zeit berechnen.
2. `onProgress` nur fuer Textanzeige mit grober Frequenz und Aenderungsfilter.
3. Rep-Index nur bei Wechsel aktualisieren.
4. JS-State-Updates bei identischem Wert unterdruecken.

### Phase 5: Workout/Set-Linking vollstaendig machen
Status: weitgehend umgesetzt

1. `LINK_VIDEO_ANALYSIS_TO_WORKOUT` inkl. `setIndex` in Action, Reducer, Dispatch.
2. Link-UI im Detailscreen: Workout + Set auswaehlbar/speicherbar.
3. Link-Daten in Redux und Persistenz verifizieren.

### Phase 6: E2E-Haertung abschliessen
Status: offen

1. Fehlende Maestro-Flows ergaenzen: 08 bis 14.
2. Suite aktualisieren, sodass alle Step-Flows verpflichtend laufen.
3. Retry-Szenario bei Analyze-Fehler explizit testen.
4. Persistenz nach App-Restart und Delete-Artefakte testen.

## Oeffentliche API-/Typaenderungen
1. `VideoAnalysisModule.analyzeSquatVideo` hat optionales `manualSeed`.
2. `VideoAnalysis` nutzt aktiv `setIndex` und `manualSeedFramePath`.
3. `analysisMeta` enthaelt aktuell `manualSeedUsed`; weitere Tracker-Qualitaetsfelder sind noch offen (`trackerVersion`, `lostFrameRatio`, `medianConfidence`).
4. `LINK_VIDEO_ANALYSIS_TO_WORKOUT` verarbeitet `setIndex` end-to-end.

## Testfaelle und Szenarien
1. Unit: Reducer fuer `setIndex`, `needs_manual_seed`, Fehler-/Retry-Transitions.
2. Unit: Segmentierung/Metriken mit deterministischen Signalen.
3. Unit: Overlay-Mapping und nearest-point-Auswahl ueber Zeit.
4. Native: Golden-Videos mit manueller Referenzspur fuer Pixel-Fehler.
5. E2E: kompletter 14-Step-Flow inklusive Manual-Seed, Linking, Delete, Persistenz.
6. Geraetetest: mindestens ein physisches Android-Geraet fuer Bridge-/UI-Latenz.

## Definition of Done
1. Plate-Tracking liefert auf Referenzvideos Zielgenauigkeit (Median/P95).
2. Overlay laeuft synchron und ohne Nachlauf auf physischem Geraet.
3. Rep-Erkennung ist stabil und zeitlich im Zielbereich.
4. Manual-Seed funktioniert inklusive Re-Analyse.
5. Workout/Set-Linking inklusive `setIndex` funktioniert.
6. Delete entfernt Redux + Dateien; Persistenz ueber Restart ist korrekt.
7. Jest + Maestro-Suite (alle 14 Steps) sind gruen.

## Annahmen und Defaults
1. v1-Einheit bleibt `px/s`.
2. Keine automatische Migration alter Analyseergebnisse.
3. Bei schlechter Qualitaet wird transparent `needs_manual_seed` gesetzt.
4. Android-first bleibt bestehen; iOS ist nicht Teil dieses Schritts.
