# Health Connect, Garmin und Withings – Analyse + Proof of Concept (GH-502)

Stand: 12.10.2026 · Ticket: GH-502 · Herkunft: Marktanalyse GH-492 (Abschnitt 7, Vorschlag #10 Health Connect)

**Belegregel:** Aussagen über APIs, Richtlinien und Hersteller tragen einen Link und das Abrufdatum. Alle Web-Quellen wurden am **11.10.2026** abgerufen (einige Abrufe liefen über Mitternacht, also am frühen 12.10.2026). Aussagen, die auf dem **Testgerät** gemessen wurden (Samsung Galaxy S20+, Android 13, Health Connect App `2026.09.03.00.release`), sind mit **[Gerät]** markiert; die Belege liegen im PR als Screenshots und Maestro-Logs vor. Eigene Schlussfolgerungen sind als *Bewertung* gekennzeichnet. Was nicht geprüft werden konnte, steht ausdrücklich als **nicht verifiziert** da.

---

## 0. Kurzfassung

- **Empfehlung: Health Connect als einziger, lokaler Hub.** Damit schreibt Gainalytics beendete Trainings als Krafttraining und liest das Körpergewicht – ohne Konto, ohne Server und ohne Herstellerverträge. Das passt zum Offline-first-Leitbild.
- **Der PoC läuft auf dem Testgerät (Android 13):** Berechtigungsdialog, gelesenes Körpergewicht in der App und ein geschriebenes Training mit 8 Übungs-Segmenten in Health Connect. Alles ist mit Screenshots belegt (Abschnitt 7).
- **Was verloren geht:** Mit der stabilen Bibliothek (connect-client 1.1.0) kennt Health Connect pro Übung nur Typ, Zeitspanne und Wiederholungen. **Satzgewicht und RIR gehen verloren.** Sie überleben im PoC nur als Text in den Notizen. Satzgewicht, Satzindex und RPE pro Segment gibt es erst in connect-client **1.2.0-alpha**, und dort nur hinter einem Feature-Flag (Abschnitt 2.3).
- **Garmin:** Garmin Connect schreibt nur **nach** Health Connect, liest aber nichts. Auf diesem Android-13-Gerät taucht Garmin Connect 5.30.1 in Health Connect gar nicht auf, weil die App nur den Android-14-Einstieg mitbringt **[Gerät]**. Ein Training gelangt über Health Connect also nie zu Garmin.
- **Withings:** Die Withings-App exportiert laut Hersteller nach Health Connect. Auf dem Testgerät ist die Withings-App aber nicht installiert und es gibt kein Konto. Dieser Weg ist deshalb **nicht verifiziert**.
- **Direkte Withings- und Garmin-APIs** brauchen ein `client_secret`, eine Redirect-URI und Webhooks. Garmin verlangt zusätzlich einen Business-Antrag. Beides geht nur mit einem eigenen Backend. *Bewertung:* Für Gainalytics ist das derzeit nicht sinnvoll.

---

## 1. Ausgangslage

Gainalytics ist eine React-Native-App (bare, Android-Fokus), offline-first, ohne Benutzerkonto und ohne eigenen Server. Das Datenmodell (`app/models/entities`) kennt:

- **Training:** Start, Ende, Status, Notizen, Übungs-IDs und je Übung ein Workout.
- **Workout:** Übung, optionaler Start und optionales Ende, Sätze.
- **Satz:** Wiederholungen, Gewicht (kg), RIR, bei geplanten Sätzen optional Bereiche (`repsMax`, `rirMax`, `weightMax`).

Ein Körpergewicht gibt es im Modell bisher nicht.

---

## 2. Frage 1 – Health Connect

### 2.1 Verfügbarkeit: Android 13 vs. Android 14+

| Aussage | Quelle |
|---|---|
| Ab Android 14 (API 34) ist Health Connect Teil des Frameworks. Bis Android 13 braucht man die Health-Connect-App aus dem Play Store (`com.google.android.apps.healthdata`). | https://developer.android.com/health-and-fitness/guides/health-connect/develop/get-started (abgerufen 11.10.2026) |
| Das SDK unterstützt Android 8 (API 26) und höher. Die Health-Connect-App selbst läuft erst ab Android 9 (API 28). | ebd. |
| `getSdkStatus` liefert `SDK_AVAILABLE`, `SDK_UNAVAILABLE` oder `SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED` (Provider fehlt oder ist zu alt). | https://raw.githubusercontent.com/androidx/androidx/androidx-main/health/connect/connect-client/src/main/java/androidx/health/connect/client/HealthConnectClient.kt (abgerufen 11.10.2026) |
| Stabil ist connect-client **1.1.0** (08.10.2025), die neueste Version **1.2.0-alpha06** (26.08.2026). Ab 1.2.0-alpha05 sinkt minSdk auf **24**. | https://developer.android.com/jetpack/androidx/releases/health-connect (abgerufen 11.10.2026) |
| Health Connect verlangt eine Bildschirmsperre (PIN, Muster oder Passwort). | https://developer.android.com/codelabs/health-connect (abgerufen 11.10.2026) |

**[Gerät]** Auf dem Testgerät war Health Connect zunächst nicht installiert. Nach der Installation aus dem Play Store (kostenlos, vorhandenes Google-Konto) meldete der PoC `SDK status: AVAILABLE`. Beim ersten Berechtigungsdialog zeigt Health Connect einmalig ein eigenes Onboarding („Erste Schritte mit Health Connect").

**Folge für Gainalytics:** Die App hat `minSdkVersion 24`, connect-client 1.1.0 verlangt aber 26. Der PoC löst das mit `tools:overrideLibrary` und einer Laufzeitprüfung (API ≥ 26). Ein produktives Feature braucht eine von zwei Lösungen:
- `minSdk` auf 26 anheben, oder
- auf connect-client 1.2.x warten, das minSdk 24 unterstützt.

### 2.2 Passende Datentypen

| Zweck | Health-Connect-Record | Berechtigung | Quelle |
|---|---|---|---|
| Training schreiben | `ExerciseSessionRecord` mit `exerciseType = EXERCISE_TYPE_STRENGTH_TRAINING` (70) bzw. `WEIGHTLIFTING` (81), `title`, `notes`, `segments`, `laps` | `READ_EXERCISE` / `WRITE_EXERCISE` | https://raw.githubusercontent.com/androidx/androidx/androidx-main/health/connect/connect-client/src/main/java/androidx/health/connect/client/records/ExerciseSessionRecord.kt (abgerufen 11.10.2026) |
| Übungen in einem Training | `ExerciseSegment` mit `segmentType`, Start/Ende, `repetitions`; ab 1.2.0-alpha03 zusätzlich `weight`, `setIndex`, `rateOfPerceivedExertion` | (Teil von EXERCISE) | https://raw.githubusercontent.com/androidx/androidx/androidx-main/health/connect/connect-client/src/main/java/androidx/health/connect/client/records/ExerciseSegment.kt (abgerufen 11.10.2026) |
| Geplante Trainings | `PlannedExerciseSessionRecord` mit Blöcken und Steps, `RepetitionsGoal`, `WeightTarget`, `RateOfPerceivedExertionTarget` (Int 0–10); nur mit `FEATURE_PLANNED_EXERCISE` | `READ_/WRITE_PLANNED_EXERCISE` | https://developer.android.com/health-and-fitness/health-connect/features/training-plans (abgerufen 11.10.2026) |
| Körpergewicht | `WeightRecord` | `READ_WEIGHT` / `WRITE_WEIGHT` | https://developer.android.com/health-and-fitness/guides/health-connect/plan/data-types (abgerufen 11.10.2026) |
| Körperfett, Magermasse, Größe | `BodyFatRecord`, `LeanBodyMassRecord`, `HeightRecord` | `READ_BODY_FAT` usw. | ebd. |
| Herzfrequenz | `HeartRateRecord` | `READ_HEART_RATE` | ebd. |
| Kalorien | `ActiveCaloriesBurnedRecord`, `TotalCaloriesBurnedRecord` | `READ_/WRITE_…_CALORIES_BURNED` | ebd. |

**Segment- und Session-Typen müssen zusammenpassen.**
- Für `STRENGTH_TRAINING` und `WEIGHTLIFTING` ist die gesamte Kraftliste erlaubt, u. a. `SQUAT`, `BENCH_PRESS`, `DEADLIFT`, `BARBELL_SHOULDER_PRESS`, `LAT_PULL_DOWN`, `LEG_PRESS`, `HIP_THRUST`, `PULL_UP` und `WEIGHTLIFTING`.
- `REST`, `PAUSE`, `STRETCHING`, `OTHER_WORKOUT` und `UNKNOWN` sind in jeder Session erlaubt.
- Segmente müssen innerhalb der Session liegen und dürfen sich nicht überlappen. Bei einem unpassenden Typ wirft der Client „segmentType and sessionType is not compatible."

Quelle: ExerciseSegment.kt und ExerciseSessionRecord.kt (Links oben, abgerufen 11.10.2026).

**Satzgewicht pro Segment:** Die Felder `weight`, `setIndex` und `rateOfPerceivedExertion` (Float 0–10) sind an `FEATURE_EXERCISE_SESSION_IMPROVEMENTS` gebunden. Sie kamen mit 1.2.0-alpha03 am 25.03.2026. Quellen:
- https://raw.githubusercontent.com/androidx/androidx/androidx-main/health/connect/connect-client/src/main/java/androidx/health/connect/client/HealthConnectFeatures.kt (abgerufen 11.10.2026)
- Release Notes (Link oben)

**Nicht verifiziert:** Welche Geräte bzw. Provider-Versionen dieses Feature als verfügbar melden. Der PoC nutzt bewusst die stabile Version 1.1.0, die diese Felder nicht hat.

### 2.3 Mapping-Tabelle Gainalytics ↔ Health Connect

Legende: ✅ geht · ⚠️ geht teilweise / mit Verlust · ❌ geht nicht. Die Spalte „PoC" zeigt, was der PoC tatsächlich schreibt (connect-client 1.1.0).

| Gainalytics | Health Connect | Status | Was geht verloren / Hinweis | PoC |
|---|---|---|---|---|
| Training: Start/Ende | `ExerciseSessionRecord.startTime/endTime` (+ Zeitzonen-Offset) | ✅ | – | ✅ |
| Training: Status `FINISHED` | — (nur beendete Trainings werden geschrieben) | ✅ | Geplante oder laufende Trainings erscheinen nicht | ✅ |
| Trainingsart (Powerlifting) | `exerciseType = STRENGTH_TRAINING` | ✅ | Keine Unterscheidung Powerlifting/Hypertrophie | ✅ |
| Titel | `title` | ✅ | Gainalytics hat keinen Trainingstitel; der PoC erzeugt „Gainalytics: Übung1, Übung2, Übung3 +N" | ✅ |
| Trainingsnotizen | `notes` | ✅ | Der PoC belegt `notes` mit dem Satz-Protokoll. Ein Produkt müsste Notiz und Protokoll zusammenführen | ⚠️ |
| Übung (Name, frei wählbar) | `ExerciseSegment.segmentType` (68 feste Typen) | ⚠️ | Nur grobe Zuordnung per Namensregeln. Varianten (Pausen-Bankdrücken, Sumo, Low Bar) verlieren ihre Variante; Übungen ohne Typ (z. B. Langhantelrudern, Trizeps-Extension über Kopf) fallen auf `WEIGHTLIFTING` zurück. Der Freitextname geht verloren | ✅ (Regeln in `healthConnectMapping.ts`) |
| Workout: Start/Ende | Segment-Start/-Ende | ⚠️ | Die Gainalytics-Zeitstempel je Workout sind ungenau (siehe 7.4). Der PoC stellt sicher, dass die Segmente nicht überlappen und keine Übung wegfällt | ✅ |
| Satz: Wiederholungen | `ExerciseSegment.repetitions` | ⚠️ | 1.1.0: ein Segment je Übung mit der Summe der Wdh. Mit 1.2.0-alpha + Feature-Flag ist ein Segment je Satz mit `setIndex` möglich | ✅ (Summe) |
| Satz: Gewicht (kg) | 1.1.0: — · 1.2.0-alpha: `ExerciseSegment.weight` | ❌ / ⚠️ | **Geht mit der stabilen Version verloren**; im PoC nur als Text in `notes` | Text |
| Satz: RIR | — (1.2.0-alpha: `rateOfPerceivedExertion` 0–10 als Float) | ❌ / ⚠️ | Es gibt kein RIR-Feld. Eine Umrechnung RPE ≈ 10 − RIR wäre möglich, ist aber eine Interpretation | Text |
| Pausen zwischen Sätzen | `REST`- bzw. `PAUSE`-Segment | ✅ | Gainalytics speichert keine Pausenzeiten je Satz, also nur grob ableitbar | – |
| Wiederholungs-, RIR- und Gewichtsbereiche (`repsMax` usw., nur Planung) | — | ❌ | Ausgeführte Sätze haben keine Bereiche. Für Pläne käme `PlannedExerciseSessionRecord` in Frage, das aber keine Bereiche kennt | – |
| Trainingsplan / Meso / Micro | `PlannedExerciseSessionRecord` (einzelne geplante Einheiten) | ⚠️ | Keine Periodisierungsstruktur. RPE-Target nur ganzzahlig, RIR fehlt | – |
| 1RM, Rekorde, Volumen, Muskelverteilung | — | ❌ | Abgeleitete Kennzahlen; bleiben in Gainalytics | – |
| Videoanalyse, Velocity Loss | — | ❌ | Kein Health-Connect-Typ | – |
| Training-ID | `metadata.clientRecordId` + `clientRecordVersion` | ✅ | Erneutes Schreiben ersetzt den Datensatz statt ihn zu duplizieren **[Gerät]** | ✅ |
| *(neu)* Körpergewicht | `WeightRecord` lesen | ✅ | Gainalytics hat kein Gewichtsfeld; lesen ohne Migration möglich | ✅ |
| *(neu)* Herzfrequenz, Kalorien während des Trainings | `HeartRateRecord`, `…CaloriesBurnedRecord` im Zeitraum der Session lesen | ✅ | Nur wenn eine Uhr nach Health Connect schreibt (Garmin erst ab Android 14, siehe 4.1) | – |

### 2.4 Berechtigungen, Manifest und die 30-Tage-Regel

- Berechtigungen werden als `<uses-permission android:name="android.permission.health.…"/>` deklariert und über `PermissionController.createRequestPermissionResultContract()` angefragt. Sie können jederzeit widerrufen werden; die App muss sie vor jeder Nutzung prüfen. Bis Android 13 ist eine Activity mit `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` Pflicht. Ab Android 14 braucht es einen `activity-alias` mit `VIEW_PERMISSION_USAGE` und `HEALTH_PERMISSIONS`. Diese Activity muss dieselbe Datenschutzerklärung zeigen wie die Play Console. Außerdem ist ein `<queries>`-Eintrag für `com.google.android.apps.healthdata` nötig. (https://developer.android.com/health-and-fitness/guides/health-connect/develop/get-started, abgerufen 11.10.2026)
- „Write permission also provides you read access to records you have written using that permission." (https://developer.android.com/health-and-fitness/health-connect/features/training-plans, abgerufen 11.10.2026)
- Standardmäßig kann eine App Daten nur bis 30 Tage vor der ersten Berechtigung lesen. Für ältere Daten gibt es `PERMISSION_READ_HEALTH_DATA_HISTORY` (Feature `FEATURE_READ_HEALTH_DATA_HISTORY`). Laut Doku gilt ab Android 14 für eigene Daten kein Zeitlimit. Hintergrund-Lesen braucht `READ_HEALTH_DATA_IN_BACKGROUND`. (https://developer.android.com/health-and-fitness/guides/health-connect/develop/read-data, abgerufen 11.10.2026)

**Befunde aus dem PoC [Gerät]:**

1. **Rationale-Activity:** Der PoC deklariert beide Varianten (Android 13 und Android 14+). Damit erschien der Dialog sofort. Eine Gegenprobe ohne diese Activity wurde **nicht** gemacht; dass sie Pflicht ist, stützt sich auf die Doku oben. Die Dialoge selbst sind deutsch und listen die angefragten Typen („Sport", „Gewicht") getrennt nach Lesen und Schreiben (Screenshot `03_permission_all_allowed.png`).
2. **Die 30-Tage-Regel gilt auf Android 13 auch für eigene Daten.** Das zuletzt beendete Baseline-Training (28.02.2026) wurde erfolgreich geschrieben. Das anschließende Lesen der eigenen Session lieferte aber eine **leere Liste ohne Fehler**. Erst nach Erteilung von `READ_HEALTH_DATA_HISTORY` kam die Session zurück. Health Connect fragt diese Berechtigung in einem eigenen Dialog an („… auf Daten zugreifen, die vor dem 12. September 2026 hinzugefügt wurden", Screenshot `02c_permission_dialog_history.png`).
3. **Der Dialog liefert nur die in diesem Dialog erteilten Rechte.** Beim zweiten Aufruf (nur `WRITE_WEIGHT` neu) lieferte der Contract nur `WRITE_WEIGHT`. Der PoC liest danach die vollständigen Rechte per `getGrantedPermissions()` nach.

### 2.5 Google-Play-Anforderungen

- **Health apps declaration (Play Console → Policy → App content → Health apps):** Pflicht für alle Apps auf Google Play, seit dem 31.08.2024 auch für Apps ohne Health-Funktionen. Für Gainalytics passt die Kategorie „Activity and Fitness". (https://support.google.com/googleplay/android-developer/answer/14738291, abgerufen 11.10.2026)
- **Health-Connect-Zugriff:**
  - Je Datentyp ist eine Begründung nötig: „Only request permissions and access data types that support the specific, user-facing health features you offer."
  - Der Data-safety-Abschnitt muss ausgefüllt sein.
  - Die Datenschutzerklärung im Play Store muss identisch mit der in Health Connect verlinkten sein.
  - Bei neuen Datentypen muss erneut eingereicht werden; die Freigabe gilt pro Paketname.

  (https://developer.android.com/health-and-fitness/health-connect/publish, abgerufen 11.10.2026)
- **Richtlinie:**
  - Erlaubt sind u. a. „Fitness, wellness, and coaching".
  - Verboten sind Weitergabe oder Verkauf an Werbeplattformen, Werbung auf Basis von Gesundheitsdaten und Weitergabe ohne ausdrückliche Einwilligung.
  - „All access requests … will be subject to review." Vage Begründungen werden abgelehnt.

  (https://support.google.com/googleplay/android-developer/answer/12991134, abgerufen 11.10.2026)
- Dauer der Prüfung laut README der RN-Bibliothek: bis zu 7 Tage, der Health-Connect-Zugriff zusätzlich 5–7 Werktage. (https://github.com/matinzd/react-native-health-connect, abgerufen 11.10.2026). In der Google-Doku ist das **nicht verifiziert**.
- *Bewertung:* Die bestehende Datenschutzerklärung (`index.html` im Repo) sagt, dass keine personenbezogenen Daten verarbeitet werden. Für Health Connect muss sie einen Abschnitt zu Gesundheitsdaten bekommen, und genau sie muss in der Rationale-Activity angezeigt werden. Das ist die größte nicht-technische Voraussetzung (Ticket-Vorschlag T4).

### 2.6 React-Native-Bibliotheken und ihr Zustand

| Option | Zustand | Abdeckung | Quelle |
|---|---|---|---|
| `react-native-health-connect` (matinzd) | v4.1.3 vom 06.08.2026, MIT, alte und neue Architektur, Expo-Plugin, minSdk 26, nutzt connect-client 1.1.0 stabil | 40 Record-Typen inkl. `ExerciseSession` und `Weight`. **Kein** `PlannedExerciseSession`. Segmente haben nur `repetitions`, kein Gewicht, keinen `setIndex`, keine RPE | https://registry.npmjs.org/react-native-health-connect, https://github.com/matinzd/react-native-health-connect/releases, https://raw.githubusercontent.com/matinzd/react-native-health-connect/main/src/types/base.types.ts (abgerufen 11.10.2026) |
| `@kingstinct/react-native-healthkit`, `react-native-health` | Nur iOS/HealthKit | – | https://registry.npmjs.org/@kingstinct/react-native-healthkit/latest, https://registry.npmjs.org/react-native-health/latest (abgerufen 11.10.2026) |
| **Eigenes Kotlin-Modul (wie im PoC)** | ca. 300 Zeilen Kotlin, direkte Nutzung von connect-client | Alles, was der Jetpack-Client kann. Ein Wechsel auf 1.2.x (Satzgewicht/RPE) ist ohne Fremd-Release möglich | dieser PoC |

Eine weitere gepflegte Android-Health-Connect-Bibliothek für React Native wurde nicht gefunden (**nicht verifiziert**, nur Suchergebnis).

*Bewertung:* Für Gainalytics ist ein **eigenes kleines Native-Modul** die bessere Wahl. Dafür gibt es drei Gründe:
- Der Mehrwert (Satzgewicht/RPE in 1.2.x, geplante Trainings) liegt genau dort, wo die Bibliothek nichts anbietet.
- Das Repo patcht bereits mehrere Fremdbibliotheken; eine weitere vergrößert das Patch-Risiko (siehe `docs/memory/agent/builds-and-deps.md`).
- Der PoC zeigt, dass der Aufwand für das Modul klein ist.

---

## 3. Frage 2 – Withings

### 3.1 Synchronisiert die Withings-App das Körpergewicht nach Health Connect?

- Withings beschreibt offiziell einen **Export** von Withings-Daten nach Health Connect: Kategorien wählen und einzelne Daten ein- oder ausschalten. Ebenso gibt es einen **Import** aus Health Connect. (https://support.withings.com/hc/en-us/articles/27322856325905-Partner-Apps-Health-Connect-Exporting-Withings-data-into-Health-Connect; Import: https://support.withings.com/api/v2/help_center/en-us/articles/47487495293585.json; beide abgerufen 11.10.2026)
- **Welche Datentypen genau** exportiert werden (Gewicht, Körperfett, Muskelmasse …), nennt keiner der gelesenen offiziellen Artikel. Das ist **nicht verifiziert**.
- **[Gerät] Nicht verifizierbar:** Auf dem Testgerät ist weder die Withings-App installiert noch ein Withings-Konto vorhanden. Das Ticket verbietet, Konten anzulegen. Ob ein `WeightRecord` mit der Herkunft `com.withings.wiscale2` ankommt, konnte daher **nicht geprüft** werden.
- *Bewertung:* Wenn der Export funktioniert, reicht er für Gainalytics völlig aus. Der PoC liest jedes `WeightRecord` unabhängig von der Quelle und zeigt die Herkunft (Paketname) an. Eine Withings-Waage würde also ohne weiteren Code erscheinen. Prüfschritt für einen Nutzer mit Withings-Konto: Withings-App → Health Connect → Gewicht freigeben, dann im PoC „Read body weight".

### 3.2 Entwurf: direkte Withings-API (nicht umgesetzt)

| Baustein | Inhalt | Quelle |
|---|---|---|
| Zugang | App im Withings Developer Dashboard anlegen → `client_id` + `client_secret`; „no prerequisites, and free access" | https://developer.withings.com/developer-guide/v3/integration-guide/public-health-data-api/developer-account/create-your-accesses-no-medical-cloud/ (abgerufen 11.10.2026) |
| Auth-Flow | OAuth 2: `https://account.withings.com/oauth2_user/authorize2?response_type=code&client_id=…&scope=user.metrics&redirect_uri=…&state=…`. Der Code ist **nur 30 Sekunden** gültig | https://developer.withings.com/developer-guide/v3/integration-guide/public-health-data-api/get-access/oauth-authorization-url/ (abgerufen 11.10.2026) |
| Token | `POST https://wbsapi.withings.net/v2/oauth2`, `action=requesttoken`, **mit `client_secret`**. Access-Token 3 h, Refresh-Token 1 Jahr (rotierend) | https://developer.withings.com/llms.md (abgerufen 11.10.2026) |
| Gewicht lesen | `POST https://wbsapi.withings.net/measure`, `action=getmeas`, `meastypes=1` (Gewicht kg; 6 = Fett %, 76 = Muskelmasse); Wert = `value × 10^unit`; Paging bis `more = 0` | ebd. |
| Push | `POST /notify`, `action=subscribe`, `callbackurl` (öffentlich erreichbar), `appli=1`. Pollen höchstens alle 10 min je Nutzer; Fehler 601 = Rate Limit (ohne Zahl, **nicht verifiziert**) | ebd. |
| Kosten/Grenzen | Plan „Start for Free": 10 Nutzer, mehr nach App-Review. **Ab 12.10.2026 brauchen neu angelegte Withings-Konten eine Withings+-Mitgliedschaft**, um Daten mit Free-Plan-Apps zu teilen. Enterprise: individuell bepreist | https://static.withings.com/content/api/plans/plans.html (abgerufen 11.10.2026) |

**Benötigte Schlüssel** (es wurden keine angelegt, keine erfunden):
- Withings `client_id` und `client_secret`
- eine registrierte Redirect-URI
- für Push eine HTTPS-Callback-URL

*Bewertung:* Das `client_secret` darf nicht in die App. Der Token-Tausch braucht deshalb einen eigenen Server, Webhooks ebenso. Dazu kommen die Nutzer-Grenze und die Withings+-Pflicht für neue Konten. Für Gainalytics ohne Server ist die direkte API nicht sinnvoll.

---

## 4. Frage 3 – Garmin

### 4.1 Was synchronisiert Garmin Connect nach Health Connect?

- Garmins eigene Hilfeseite („Sharing Your Garmin Connect Data With Google Health Connect", https://support.garmin.com/en-US/?faq=JToBEy0jfe6pIygark2Ui5) lieferte beim Abruf **HTTP 403** und konnte nicht gelesen werden (abgerufen 11.10.2026).
- Sekundärquellen, die auf diese Seite verweisen:
  - Laut Android Police (01.07.2025) teilt Garmin Kalorien, Distanz, Höhenmeter, Stockwerke, **Herzfrequenz**, Geschwindigkeit, Schritte, Schwimmzüge, **Körperfett**, Schlaf und **Gewicht**. Es ist ein **Einweg-Sync**: „Garmin won't receive any data from Health Connect." Krafttraining wird nicht erwähnt. (https://www.androidpolice.com/garmin-data-sharing-google-health-connect-details/, abgerufen 11.10.2026)
  - „This is a one-way sync. Garmin will act as a sender only." (https://gadgetsandwearables.com/2025/07/08/garmin-google-health-connect-launch/, abgerufen 11.10.2026)

**[Gerät] Befund am Testgerät** (Garmin Connect 5.30.1, angemeldet, Uhr gekoppelt):

1. Garmin Connect deklariert ausschließlich **Schreib**-Berechtigungen für Health Connect. Gefunden per `dumpsys package com.garmin.android.apps.connectmobile`: `WRITE_ACTIVE_CALORIES_BURNED, WRITE_BODY_FAT, WRITE_DISTANCE, WRITE_ELEVATION_GAINED, WRITE_EXERCISE, WRITE_FLOORS_CLIMBED, WRITE_HEART_RATE, WRITE_RESTING_HEART_RATE, WRITE_SLEEP, WRITE_SPEED, WRITE_STEPS, WRITE_TOTAL_CALORIES_BURNED, WRITE_WEIGHT`. **Kein einziges `READ_*`.** Damit ist der Einweg-Sync aus dem Manifest bestätigt.
2. Garmin Connect hat nur den Android-14-Einstieg (`VIEW_PERMISSION_USAGE` → `.settings.thirdparty.impl.ViewPermissionUsageActivity`), aber **keine** Activity für `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`, die Android 13 und älter brauchen. Health Connect listet Garmin Connect auf diesem Android-13-Gerät deshalb gar nicht unter „App-Berechtigungen". Die Liste enthält Gainalytics, Fddb, Fitify, GAINSFIRE, Samsung Health und Strong, aber kein Garmin (Screenshot `05_hc_app_permissions.png`). In den Garmin-Einstellungen („Verknüpfte Apps") gab es ebenfalls keinen Health-Connect-Eintrag.
3. Damit gilt: **Auf Android 13 kommen Garmin-Daten nicht nach Health Connect.** Auf Android 14+ ist der Weg laut obigen Quellen möglich, auf einem solchen Gerät aber **nicht verifiziert**.

*Bewertung:* Ab Android 14 kann Gainalytics Gewicht, Körperfett und Herzfrequenz einer Garmin-Uhr über Health Connect lesen. Ein Gainalytics-Training gelangt über Health Connect **nie** zu Garmin Connect.

Nebenbefund **[Gerät]**: Auch Samsung Health deklariert Health-Connect-Lese- und Schreibrechte, u. a. für Gewicht und Training. Es verlangt aber eine Anmeldung mit einem Samsung-Konto. Das ist auf dem Testgerät nicht der Fall und durfte nicht angelegt werden. Die Konkurrenz-Apps **Strong** und **GAINSFIRE** integrieren Health Connect bereits (sie stehen in der Liste aus Punkt 2).

### 4.2 Was bietet die Garmin-API direkt?

| Baustein | Inhalt | Quelle |
|---|---|---|
| Programm | Garmin Connect Developer Program: Health API, Activity API und Women's Health API (Daten empfangen); Training API und Courses API (Inhalte senden). „cloud-to-cloud based integrations" | https://developer.garmin.com/gc-developer-program/overview/ (abgerufen 11.10.2026) |
| Zugang | „available for enterprise use", „only for business use"; Antrag mit Rückmeldung binnen 2 Werktagen; keine Lizenzgebühr, aber einzelne Metriken kommerziell lizenzpflichtig; „All APIs in the Developer Program use OAUTH 2.0." | https://developer.garmin.com/gc-developer-program/program-faq/ (abgerufen 11.10.2026) |
| Health API | Herzfrequenz, Schritte, Kalorien, Schlaf, Atmung, **Körperzusammensetzung**, Stress, Pulsoximetrie; Ping/Pull- oder Push-Architektur; „Commercial use requires a license fee payment." | https://developer.garmin.com/gc-developer-program/health-api/ (abgerufen 11.10.2026) |
| Activity API | Aktivitätsdateien (FIT/GPX/TCX), Beispiele inkl. Strength Training; Ping/Pull oder Push | https://developer.garmin.com/gc-developer-program/activity-api/ (abgerufen 11.10.2026) |
| Training API | „publish workouts and training plans to the Garmin Connect calendar", danach Sync auf kompatible Uhren; Zustimmung des Nutzers nötig. Ob Kraft-Workouts mit Sätzen, Wdh und Gewicht unterstützt sind, steht dort **nicht** | https://developer.garmin.com/gc-developer-program/training-api/ (abgerufen 11.10.2026) |
| OAuth 2.0 PKCE | Endpunkte `https://connect.garmin.com/oauth2Confirm` und `https://connectapi.garmin.com/di-oauth2-service/oauth/token`; Details (Secret, Laufzeiten) im PDF nicht lesbar → **nicht verifiziert** | https://developerportal.garmin.com/sites/default/files/OAuth2PKCE.pdf (abgerufen 11.10.2026) |

**Kann man Trainings an Garmin senden?**
- **Ja, über die Training API**, als geplante Workouts im Garmin-Kalender, die auf die Uhr synchronisiert werden. Laut der Drittquelle Terra nimmt Garmin bei `strength`-Workouts Übungsnamen aus einem Katalog an (49 Kategorien und 1.624 Übungen, z. B. `BARBELL_BENCH_PRESS`), mit Gewicht pro Step. (https://docs.tryterra.co/planned-workouts-api/garmin-exercise-reference, abgerufen 11.10.2026) Die offizielle Spezifikation liegt hinter dem Developer-Login und ist **nicht verifiziert**.
- **Serverlose Alternative:** Gainalytics exportiert eine **FIT-Datei**, die der Nutzer selbst in Garmin Connect importiert.
  - Laut Garmin können FIT-Workout-Dateien auch Krafttraining beschreiben. (https://developer.garmin.com/fit/articles/file-types/workout.html, abgerufen 11.10.2026)
  - Für Aktivitäten mit Sätzen (Übung, Wdh, Gewicht) gibt es nur Community-Beispiele, keine offizielle Anleitung. (https://forums.garmin.com/developer/fit-sdk/f/discussion/270009/examples-for-encoding-strength-training-activity-files, abgerufen 11.10.2026)

**Entwurf direkte Anbindung (nicht umgesetzt, keine Konten angelegt):**
1. Business-Antrag beim Garmin Connect Developer Program stellen → Consumer Key/Secret (OAuth 2.0 PKCE).
2. Eigenes Backend:
   - OAuth-Callback-Endpunkt
   - Token-Speicher je Nutzer
   - Ping/Push-Webhook für Health- und Activity-Daten
   - Training-API-Client, um Gainalytics-Pläne als `strength`-Workouts in den Garmin-Kalender zu schreiben
3. Die App verbindet sich per Browser-OAuth mit dem Backend und braucht dafür ein Gainalytics-Konto, damit Token und Nutzer zusammengehören.

**Benötigt:** Firmenangaben für den Antrag, Consumer Key und Secret, eine öffentliche HTTPS-Domain und ggf. eine Lizenz für kommerzielle Metriken.

*Bewertung:* Das widerspricht dem Leitbild „kein Konto, kein Server" grundsätzlich.

---

## 5. Frage 4 – Architektur, Leitbild und Datenschutz

### 5.1 Vergleich der Varianten

| Kriterium | **Health Connect** (lokal) | **Withings-API** (Cloud) | **Garmin-API** (Cloud) |
|---|---|---|---|
| Aufwand (grob) | **M:** Native-Modul (PoC vorhanden), Einstellungen-UI, Schreib-/Lese-Logik, Play-Deklaration | **L:** OAuth-Flow, Backend für Token-Tausch und Webhooks, Betrieb | **XL:** Business-Antrag, Backend, Webhooks, Training-API-Mapping, Lizenzfragen |
| Voraussetzungen | Android 9+; bis Android 13 die Health-Connect-App aus dem Play Store; Bildschirmsperre; Play-Health-Deklaration und Datenschutzerklärung | Withings-Dev-Konto, `client_secret`, Redirect-URI, HTTPS-Callback; Free-Plan max. 10 Nutzer, ab 12.10.2026 Withings+ für neue Konten | Freigabe als Business-Partner, OAuth-Schlüssel, Server mit Ping/Push, ggf. Lizenzgebühr |
| Datenfluss | Gerät ↔ Gerät, keine Cloud von Google oder Gainalytics | Withings-Cloud → Gainalytics-Server → App | Garmin-Cloud ↔ Gainalytics-Server ↔ App |
| Datenschutz | Daten bleiben auf dem Gerät, verschlüsselt; Rechte pro App und pro Datentyp | Gesundheitsdaten (Art. 9 DSGVO) auf eigenem Server → Auftragsverarbeitung, TOMs, Einwilligung, Löschkonzept | wie Withings, plus Garmin-Lizenzbedingungen |
| Offline-first-Passung | **Hoch:** funktioniert offline, kein Konto | **Niedrig:** braucht Netz, Konto und Server | **Niedrig:** braucht Netz, Konto und Server |
| Training an Garmin senden | ❌ (Garmin liest nicht aus Health Connect) | – | ✅ über Training API (Strength-Details nicht offiziell verifiziert) |
| Gewicht einer Waage lesen | ✅, sofern die Hersteller-App nach Health Connect exportiert (Withings: lt. Hersteller ja, Typen nicht verifiziert; Garmin: ab Android 14) | ✅ direkt | ✅ über die Health API |

Quellen zu Health Connect und Datenschutz:
- „Health Connect is a database that's stored on your device." und „Google doesn't use the cloud to store data that's sent to Health Connect by connected applications." (https://support.google.com/android/answer/13770320, abgerufen 11.10.2026)
- „The data in Health Connect is stored on-device and encrypted." (https://developer.android.com/codelabs/health-connect, abgerufen 11.10.2026)
- Rechte pro App: https://developer.android.com/health-and-fitness/guides/health-connect/plan/architecture (abgerufen 11.10.2026)

### 5.2 Datenschutz-Folgen

- Gesundheitsdaten fallen unter Art. 9 Abs. 1 DSGVO. Die Verarbeitung ist grundsätzlich untersagt, außer z. B. mit ausdrücklicher Einwilligung nach Abs. 2 lit. a. (https://gdpr-info.eu/art-9-gdpr/, abgerufen 11.10.2026)
- *Bewertung (keine Rechtsberatung):*
  - **Health Connect:** Gainalytics verarbeitet die Daten nur lokal. Die Einwilligung holt der System-Dialog von Health Connect je Datentyp ein. Pflicht bleibt eine Datenschutzerklärung, die die Health-Connect-Nutzung beschreibt; Google Play verlangt sie (Abschnitt 2.5).
  - **Direkte Cloud-APIs:** Gainalytics würde Gesundheitsdaten auf einem eigenen Server verarbeiten, mit allen DSGVO-Pflichten (Rechtsgrundlage, Verzeichnis, Löschung, Sicherheit, ggf. Datenschutz-Folgenabschätzung).
  - Auch vom Datenschutz her spricht das klar für Health Connect.

---

## 6. Frage 5 – Empfehlung und Ticket-Vorschläge

**Empfehlung:**
- **Health Connect als einziger Hub, in dieser Reihenfolge:**
  1. Training schreiben
  2. Körpergewicht lesen
  3. reichere Satzdaten, sobald connect-client 1.2 stabil ist
- **Keine direkten Withings- oder Garmin-Anbindungen**, solange Gainalytics keinen Server hat.
- Für „Training auf die Garmin-Uhr" ist höchstens ein **FIT-Datei-Export** als Experiment sinnvoll.

Aufwand: S ≈ 1–2 Tage, M ≈ 3–5 Tage, L ≈ 1–2 Wochen, XL > 2 Wochen (jeweils inkl. Tests und Geräteprüfung).

| Prio | Ticket-Vorschlag | Inhalt | Aufwand |
|---|---|---|---|
| 1 | **T1 – Health-Connect-Grundlage produktiv machen** | PoC-Modul in den Main-Source-Set übernehmen. minSdk-Frage lösen (26 oder connect-client 1.2.x). Rationale-Activity mit echter Datenschutzerklärung. Einstellungen-Eintrag „Health Connect verbinden" mit SDK-Status, Installationshinweis (Play-Store-Link bis Android 13) und Rechteverwaltung | M |
| 1 | **T2 – Beendete Trainings nach Health Connect schreiben** | Opt-in; beim Beenden schreiben (Upsert per `clientRecordId`). Bei Bearbeiten erneut schreiben, bei Löschen in Health Connect löschen. Mapping aus dem PoC (`healthConnectMapping.ts`) inkl. Übungstyp-Regeln, erweiterbar durch eine Zuordnung je Übung im Übungseditor | M |
| 2 | **T3 – Körpergewicht aus Health Connect lesen** | Aktuelles Gewicht und Verlauf anzeigen (Analyse), relative Kraft (1RM / Körpergewicht). Herkunft (App) anzeigen; `READ_HEALTH_DATA_HISTORY` für den Verlauf anfragen. Ohne Datenmodell-Migration: nur lesen und im Speicher halten oder in einem neuen, optionalen Slice | M |
| 2 | **T4 – Play-Console und Datenschutz** | Datenschutzerklärung (`index.html`) um einen Health-Connect-Abschnitt erweitern, Health apps declaration, Data safety, Begründung je Datentyp; Review-Zeit einplanen | S (+ Wartezeit) |
| 3 | **T5 – Workout-Zeitstempel verbessern** | Start und Ende je Workout zuverlässig setzen (erster und letzter geloggter Satz), damit Segmente der Realität entsprechen (siehe 7.4) | S |
| 3 | **T6 – Satzgewicht, Satzindex und RPE (connect-client 1.2)** | Sobald 1.2 stabil ist: ein Segment je Satz mit `weight` und `setIndex` und ggf. `rateOfPerceivedExertion` (RIR → RPE dokumentieren), nur wenn `FEATURE_EXERCISE_SESSION_IMPROVEMENTS` verfügbar ist, sonst Fallback wie heute | S–M |
| 4 | **T7 – Herzfrequenz und Kalorien zum Training anzeigen** | `HeartRateRecord` und `ActiveCaloriesBurnedRecord` im Zeitraum eines Trainings lesen (z. B. von einer Garmin-Uhr ab Android 14) und im Trainingsrückblick zeigen | M |
| 5 | **T8 – (Experiment) FIT-Export für Garmin** | Beendetes Training als FIT-Aktivität mit Set-Messages exportieren und teilen; manueller Import in Garmin Connect; nur Spike, da schlecht dokumentiert | L |
| – | *Nicht empfohlen:* direkte Withings- und Garmin-Cloud-Anbindung | erst wenn Gainalytics ohnehin ein Backend und Konten bekommt | L / XL |

---

## 7. Proof of Concept

### 7.1 Was gebaut wurde

| Datei | Zweck |
|---|---|
| `android/app/src/debug/java/com/powerliftingworkoutplanner/healthconnectpoc/HealthConnectPocModule.kt` | Native-Modul `HealthConnectPoc`: SDK-Status, Rechte anfragen und lesen, Verlauf-Feature prüfen, `WeightRecord` lesen, Test-Gewicht schreiben, `ExerciseSessionRecord` schreiben und lesen, Health Connect öffnen |
| `…/healthconnectpoc/HealthConnectPocPackage.kt`, `HealthConnectRationaleActivity.kt` | Paket-Registrierung und die für den Dialog nötige Rationale-Activity |
| `android/app/src/debug/AndroidManifest.xml` | Health-Rechte, `<queries>`, Rationale-Activity (Android 13) und `activity-alias` (Android 14+), `overrideLibrary` |
| `android/app/build.gradle` | `debugImplementation` für connect-client 1.1.0 und Coroutines |
| `android/app/src/main/.../MainApplication.kt` | Registriert das Paket per Reflection, nur bei `BuildConfig.DEBUG` und nur, wenn die Klasse existiert |
| `app/debug/healthConnectPoc/healthConnectMapping.ts` | Reines Mapping Training → Session/Segmente (getestet) |
| `app/debug/healthConnectPoc/healthConnectPocNative.ts`, `HealthConnectPocScreen.tsx` | Typisierter Zugriff und Debug-Screen |
| `app/routing/SettingsRouter.tsx`, `app/tabs/settings/SettingsTab.tsx` | Route und Einstieg nur, wenn das Modul existiert |

### 7.2 Trennung vom normalen Nutzerablauf

- Alles Native (Bibliothek, Rechte, Activities, Modul) liegt im **`debug`-Source-Set**. Release-Builds enthalten weder die Health-Connect-Bibliothek noch Health-Rechte noch das Modul.
- Ohne Modul wird die Route `HealthConnectPoc` nicht registriert, und die Versionszeile in den Einstellungen bekommt keinen `onLongPress`.
- **Einstieg (nur Debug):** Einstellungen → ganz nach unten → **lange auf „Version …" drücken**. Sichtbar ändert sich auch im Debug-Build nichts (Maestro prüft, dass auf dem Einstellungs-Screen kein „Health Connect" steht).
- Unit-Tests belegen beide Fälle (mit und ohne Modul).
- Am Datenmodell ändert sich nichts, es gibt keine Migration.

### 7.3 Ergebnisse auf dem Testgerät

Vorbedingung: Baseline-Daten importiert (`00_import_baseline.yaml`). Das zuletzt beendete Training ist vom 28.02.2026, 15:36–17:23, mit 8 Übungen.

1. **Berechtigungsdialog:** „Gainalytics Zugriff auf Health Connect erlauben?" mit Lesen (Sport, Gewicht) und Schreiben (Sport). Danach zeigt der PoC `Granted: READ_EXERCISE, READ_HEALTH_DATA_HISTORY, READ_WEIGHT, WRITE_EXERCISE, WRITE_WEIGHT`.
2. **Training geschrieben:** „Written to Health Connect: 1 session".
   - In Health Connect (Daten und Zugriff → Aktivität → Sport → 28. Februar 2026) erscheint der Eintrag „15:36 – 17:23 • Gainalytics", Titel mit „Krafttraining", die Notizen mit dem Satz-Protokoll und unter „Trainingssegmente" die Übungen mit deutschen Namen und Wiederholungen (z. B. „Klimmzug: 11 Wdh.", „Kreuzheben: 22 Wdh.").
   - Erneutes Schreiben ersetzt den Eintrag. Zurückgelesen wird genau 1 Session mit 8 Segmenten und 158 Wdh.
3. **Körpergewicht gelesen:** „Current body weight: 82.5 kg", Zeile „12.10.2026 00:35 · 82.5 kg · com.powerliftingworkoutplanner".
   - **Einschränkung:** Auf dem Testgerät ließ sich **keine externe Gewichtsquelle** anbinden: Withings nicht installiert, Garmin auf Android 13 nicht Health-Connect-fähig, Samsung Health ohne Anmeldung. Der PoC schreibt deshalb über „Write test weight (82.5 kg)" einen deutlich gekennzeichneten Testwert nach Health Connect und liest ihn danach über denselben Lesepfad, der auch Withings- oder Garmin-Werte liefern würde.
   - Die Quelle wird angezeigt. Ein Withings-Wert hätte die Herkunft `com.withings.wiscale2`, das ist **nicht verifiziert**.

Screenshots (im PR unter `screenshots/GH-502/`):
- `03_permission_all_allowed.png`: Berechtigungsdialog
- `06b_hc_session_detail.png`: Training in Health Connect mit Segmenten
- `07_poc_weight_read.png`: gelesenes Körpergewicht in der App
- `08_poc_written_and_read_back.png`: Schreiben und Zurücklesen
- `05_hc_app_permissions.png`: Health Connect ohne Garmin auf Android 13

### 7.4 Erkenntnisse aus dem PoC

- **Workout-Zeitstempel sind ungenau.** Im Baseline-Training reicht z. B. „Hyperextension" von 16:31 bis zum Trainingsende 17:23. Die folgenden Übungen bekommen deshalb nur Mindest-Segmente von 1 s. Eine erste Mapping-Version hat solche Übungen sogar **verworfen** (6 statt 8 Segmente). Das ist behoben und durch einen Unit-Test gesichert. Für ein Produkt lohnt T5.
- **Übungsnamen sind Freitext.** Die Typ-Zuordnung per Regeln (`leg press` vor `press`, `split squat` vor `squat`) trifft gängige Namen. Rudern, Trizeps und Varianten landen auf `WEIGHTLIFTING`, Health Connect zeigt sie als „Gewichtheben". Für ein Produkt ist eine optionale Zuordnung je Übung sinnvoll (Teil von T2).
- **Die 30-Tage-Regel** und der Dialog, der nur die neu erteilten Rechte liefert, sind in 2.4 beschrieben.

---

## 8. Quellen (alle abgerufen am 11.10.2026)

1. https://developer.android.com/health-and-fitness/guides/health-connect/develop/get-started
2. https://developer.android.com/health-and-fitness/guides/health-connect/develop/read-data
3. https://developer.android.com/health-and-fitness/guides/health-connect/plan/data-types
4. https://developer.android.com/health-and-fitness/guides/health-connect/plan/architecture
5. https://developer.android.com/health-and-fitness/health-connect/features/training-plans
6. https://developer.android.com/health-and-fitness/health-connect/publish
7. https://developer.android.com/jetpack/androidx/releases/health-connect
8. https://developer.android.com/codelabs/health-connect
9. https://raw.githubusercontent.com/androidx/androidx/androidx-main/health/connect/connect-client/src/main/java/androidx/health/connect/client/records/ExerciseSessionRecord.kt
10. https://raw.githubusercontent.com/androidx/androidx/androidx-main/health/connect/connect-client/src/main/java/androidx/health/connect/client/records/ExerciseSegment.kt
11. https://raw.githubusercontent.com/androidx/androidx/androidx-main/health/connect/connect-client/src/main/java/androidx/health/connect/client/HealthConnectFeatures.kt
12. https://raw.githubusercontent.com/androidx/androidx/androidx-main/health/connect/connect-client/src/main/java/androidx/health/connect/client/HealthConnectClient.kt
13. https://support.google.com/googleplay/android-developer/answer/14738291
14. https://support.google.com/googleplay/android-developer/answer/12991134
15. https://support.google.com/android/answer/13770320
16. https://registry.npmjs.org/react-native-health-connect
17. https://github.com/matinzd/react-native-health-connect (inkl. /releases)
18. https://raw.githubusercontent.com/matinzd/react-native-health-connect/main/src/types/base.types.ts
19. https://registry.npmjs.org/@kingstinct/react-native-healthkit/latest
20. https://registry.npmjs.org/react-native-health/latest
21. https://support.withings.com/hc/en-us/articles/27322856325905-Partner-Apps-Health-Connect-Exporting-Withings-data-into-Health-Connect
22. https://support.withings.com/api/v2/help_center/en-us/articles/47487495293585.json
23. https://developer.withings.com/developer-guide/v3/integration-guide/public-health-data-api/developer-account/create-your-accesses-no-medical-cloud/
24. https://developer.withings.com/developer-guide/v3/integration-guide/public-health-data-api/get-access/oauth-authorization-url/
25. https://developer.withings.com/llms.md
26. https://static.withings.com/content/api/plans/plans.html
27. https://support.garmin.com/en-US/?faq=JToBEy0jfe6pIygark2Ui5 (HTTP 403, nicht lesbar)
28. https://www.androidpolice.com/garmin-data-sharing-google-health-connect-details/
29. https://gadgetsandwearables.com/2025/07/08/garmin-google-health-connect-launch/
30. https://developer.garmin.com/gc-developer-program/overview/
31. https://developer.garmin.com/gc-developer-program/program-faq/
32. https://developer.garmin.com/gc-developer-program/health-api/
33. https://developer.garmin.com/gc-developer-program/activity-api/
34. https://developer.garmin.com/gc-developer-program/training-api/
35. https://developerportal.garmin.com/sites/default/files/OAuth2PKCE.pdf
36. https://docs.tryterra.co/planned-workouts-api/garmin-exercise-reference
37. https://developer.garmin.com/fit/articles/file-types/workout.html
38. https://forums.garmin.com/developer/fit-sdk/f/discussion/270009/examples-for-encoding-strength-training-activity-files
39. https://gdpr-info.eu/art-9-gdpr/
