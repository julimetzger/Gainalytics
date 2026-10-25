# Analyse + PoC: AI-Chat mit ChatGPT-Abo statt API-Key („Sign in with ChatGPT“)

Ticket: [GH-504](https://github.com/julimetzger/Gainalytics/issues/504) · Stand: 12.10.2026 · Alle Quellen am **12.10.2026** abgerufen (Abrufdatum gilt für jede Quelle unten, sofern nicht anders angegeben).

## TL;DR

- **Update Phase 2 (12.10.2026):** Der Owner hat entschieden, Gainalytics als Open Source zu veröffentlichen. Damit fällt die App unter den Self-Service-Weg von OpenAI („available to all open-source partners“ [Q2]). Der PoC ist zum Feature ausgebaut: Anbieterwahl **Claude (API key) / ChatGPT (Sign in)** in den Settings; AI-Chat und Coach Insights laufen mit beiden Anbietern gleich. Verifiziert im **Release-Build ohne Metro** auf `emulator-5554` (Ist-Stand im Abschnitt [Phase 2](#phase-2--ist-stand-nach-dem-ausbau-12102026)). Die folgenden Punkte beschreiben den Stand **vor** dieser Entscheidung.
- **Es gibt das wirklich, und offiziell dokumentiert:** „Sign in with ChatGPT“ kann neben dem reinen Login optional **„ChatGPT plan usage“** – die App schickt Anfragen an die normale Responses API (`api.openai.com/v1/responses`) mit einem OAuth-Token des Nutzers, abgerechnet über dessen ChatGPT-Abo. [Q1][Q2]
- **Darf Gainalytics das heute im Play Store nutzen? → Nein, nicht ohne Freigabe.** Self-Service gibt es nur für **Open-Source-Projekte, lokal laufende Privatprojekte und ausgewählte private Clients**. Für eine „paid or remotely hosted“ App bzw. als kommerzieller Partner verlangt OpenAI das **Interest-Formular / Warteliste**. [Q2][Q3][Q4] Gainalytics ist ein privates Repo ohne Lizenz (also nicht Open Source) und wird an Dritte verteilt. Damit passt es in keine Self-Service-Kategorie (Details in Frage 1).
- **Technisch geht es ohne eigenen Server.** Es ist ein öffentlicher OAuth-Client mit PKCE, ohne Client-Secret, mit dynamischer Client-Registrierung. Der einzige dokumentierte Redirect ist `http://127.0.0.1:<port>/auth/callback`. Der PoC zeigt, dass das auf Android funktioniert: Die App lauscht selbst auf 127.0.0.1. [Q5]
- **PoC-Stand: läuft Ende-zu-Ende.** Auf dem Emulator mit dem ChatGPT-Konto des Owners: echter Login mit Zustimmung „Use your ChatGPT plan“, verbundener Zustand („Using ChatGPT plan“), `/v1/models` liefert die Modellliste, und `/v1/responses` liefert eine echte Antwort. Der Login hing zunächst, weil **Android die App im Hintergrund einfriert** (Cached-App-Freezer), während der Browser vorne ist. Behoben im PoC mit einem Foreground-Service während des Logins (Details im Abschnitt [PoC](#proof-of-concept)). Für ein Produkt ist das eine harte Anforderung.
- **Empfehlung:** Umsetzen, aber gestuft. Zuerst die Freigabe klären: Interest-Formular absenden oder sich für Open Source entscheiden (Entscheidung beim Owner). Parallel schon die Provider-Abstraktion bauen, die sich auch ohne OpenAI lohnt. Erst nach der Freigabe kommen ChatGPT-Login und UI in den Release.

---

## Frage 1 – Stand & Zugang

### Was bietet „Sign in with ChatGPT“ laut offizieller Doku?

| Fähigkeit | Was es ist | Wer darf | Quelle |
|---|---|---|---|
| **Sign-in (Identität)** | OIDC-Login mit `openid profile email`; die App erhält eine stabile Account-ID, Name, E-Mail und Bild, aber keinen Zugriff auf Konversationen oder API | „currently available to selected commercial partners through a limited trial“; Client-ID nur über Warteliste | [Q1][Q4][Q6] |
| **ChatGPT plan usage** | Optional: Der Nutzer erlaubt der App, „eligible Responses API requests“ über sein ChatGPT-Abo laufen zu lassen. Laut Doku „does not grant access to their ChatGPT conversations or other account context“ | „available to all open-source partners and selected private clients“; das Cookbook nennt außerdem „personal projects that run locally“. Für „paid or remotely hosted“ Apps: Interest-Formular | [Q1][Q2][Q3] |

Es geht also **nicht nur um Login**, sondern tatsächlich um die Nutzung des Abo-Kontingents. Die Behauptung im Ticket stimmt in diesem Punkt.

### Welche Pläne?

- Laut Help-Center-Artikel „Using your ChatGPT plan in other apps and sites“ ist das Einloggen mit jedem Konto möglich. Die **Plan-Nutzung in teilnehmenden Apps gibt es aber nur mit Go, Plus und Pro**. [Q7] *Einschränkung:* Die Seite blockiert automatischen Abruf (HTTP 403). Die Aussage stammt aus dem Suchindex-Auszug der Seite und sollte einmal manuell im Browser bestätigt werden.
- Die Entwickler-Doku nennt keine Pläne. Sie kennt nur den Fehler `subscription_sharing_user_not_eligible`: Plan-Nutzung ist für den Nutzer, den Workspace oder die Policy nicht verfügbar. [Q8]
- Nutzer können pro App ein **wöchentliches Nutzungslimit** setzen und die Nutzung je App einsehen (ChatGPT → Settings → Usage). Das Limit ist eine Obergrenze, kein zusätzliches Kontingent. Ist das Plan-Limit erreicht, stoppt die App, außer der Nutzer hat Credits für Apps freigegeben. [Q7][Q9]

### Darf eine Play-Store-App (kostenlos/kommerziell) das nutzen?

- Die offizielle Doku unterscheidet nur: **Open Source / lokal gehostet / lokale Privatprojekte → Self-Service** und **„paid or remotely hosted“ → Interest-Formular**. Zum Sign-in für kommerzielle Partner heißt es „limited trial“ mit Warteliste. [Q2][Q3][Q4]
- **Nicht** geregelt sind in der Doku: die Definition von „Open Source“ (z. B. eine Lizenzpflicht), App-Store-Verteilung und mobile/native Apps. Das Cookbook sagt ausdrücklich nur, dass man die Lizenz des DevKits prüfen soll. [Q3]
- **Einordnung für Gainalytics:**
  - Das Repo ist privat und hat keine Lizenz (`gh api repos/julimetzger/Gainalytics` → `private: true`, `license: null`), es ist also **kein Open-Source-Projekt**.
  - Die App läuft zwar lokal ohne Server, wird aber an fremde Nutzer verteilt (Release-Skript für den Store).
  - Unter „personal projects that run locally“ fällt höchstens der **Eigengebrauch des Entwicklers**, also genau dieser PoC auf dem eigenen Emulator.
- **Klare Aussage: Gainalytics darf „ChatGPT plan usage“ heute nicht im Store-Release anbieten**, solange OpenAI das nicht freigegeben hat. Für den internen PoC bzw. Eigengebrauch ist der Self-Service-Weg nach dem Wortlaut der Doku zulässig.
- **Nachtrag 12.10.2026 (Owner-Entscheidung):** Gainalytics wird Open Source. Sobald das Repo öffentlich und lizenziert ist, gilt der Self-Service-Weg für Open-Source-Partner [Q2][Q3]. Ein Formular ist dafür nicht nötig. Weiter offen, weil die Doku es nicht regelt: ob eine Store-Verteilung des Open-Source-Builds abgedeckt ist. Eine Rückfrage per Interest-Formular bleibt sinnvoll, bevor das Feature in den Play Store geht.

### Was genau muss beantragt werden? (nötige Schritte)

1. **Interest-Formular absenden:** <https://openai.com/form/sign-in-with-chatgpt-interest/> [Q2][Q4]. Die Felder ließen sich nicht automatisch auslesen (HTTP 403), und laut Ticket-Constraint wurde nichts abgesendet. Erwartbar sind App-Beschreibung, Nutzerzahlen und Kontakt. **Das muss der Owner selbst tun.**
2. Die Freigabe abwarten. Möglicher Ausgang: Plan usage für die App freigeschaltet, ggf. mit eigener Client-ID bzw. eigenem Redirect statt dynamischer Registrierung. Die Doku erwähnt z. B., dass `force_reconsent=true` „only after OpenAI confirms deployment for your integration“ gilt. [Q8]
3. Die UI-Vorgaben einhalten: Button-Text „Continue with ChatGPT“, Welcome-Modal beim ersten Login, Hinweis „Using ChatGPT plan“ am Composer und „Manage usage“-Link. Auf Preisseiten muss klar sein, dass die Plan-Nutzung von eigenen Kosten der App getrennt ist. [Q10]
4. *Alternative:* Gainalytics unter eine Open-Source-Lizenz stellen. Dann passt der Self-Service-Weg dem Wortlaut nach. Ob das für Store-Verteilung reicht, sagt die Doku nicht, deshalb wäre auch hier eine Rückfrage per Formular sinnvoll.

### Abgleich mit den Drittquellen aus dem Ticket

| Behauptung (Drittquellen) | Offiziell belegt? |
|---|---|
| Apps können Anfragen gegen das Abo-Kontingent laufen lassen | **Ja** [Q1][Q2] |
| Frei für Open-Source-/lokale Privatprojekte, kommerzielle Apps müssen sich bewerben | **Ja**, sinngemäß: „paid or remotely hosted“ → Interest-Formular [Q2][Q3] |
| Wochenlimit pro App | **Ja**, vom Nutzer setzbar [Q7] |
| `store: false` + `stream: true` Pflicht, keine `temperature`/`max_output_tokens` | **Ja** [Q11][Q12] |
| Abmelden in der App trennt die Verbindung nicht | **Teilweise:** Revocation beendet die Refresh-Session, löscht aber den registrierten Client nicht. Komplett trennen kann der Nutzer in den ChatGPT-Einstellungen. [Q13] |
| DevDay 29.09.2026, 16 Launch-Partner | **Nicht offiziell gefunden:** kein openai.com-Blogpost im Index; nur Drittquellen [D1][D2][D3] |

---

## Frage 2 – Technik

### Login-Flow (nativ Android / React Native) – laut Doku [Q5][Q3]

1. Die App erzeugt einmalig eine stabile **Host-ID** (`urn:uuid:…`) und speichert sie. Sie wird als `ext_agent_host_id` mitgeschickt. [Q5][Q13]
2. Die App startet einen **Loopback-Listener** auf `127.0.0.1` (Beispiel-Port 1455) **vor** dem Öffnen des Browsers. [Q5]
3. Danach öffnet sie den System-Browser mit `GET https://auth.openai.com/api/accounts/authorize` und diesen Parametern:
   - `client_id=dynamic_agent_client` beim ersten Mal, danach die ausgegebene `oaiapp_…`-ID
   - `agent_name_hint` (nur bei der Erstregistrierung) und `ext_agent_host_id`
   - `response_type=code` und `redirect_uri=http://127.0.0.1:<port>/auth/callback`
   - `scope=openid profile email offline_access resource.invoke chatgpt.tokens.use.direct` und `resource=https://api.openai.com/v1`
   - `state`, `nonce`, `code_challenge_method=S256` und `code_challenge`
4. Der Nutzer loggt sich ein, wählt den Workspace und stimmt der Plan-Nutzung zu. Dabei **registriert OpenAI den Client dynamisch**. Der Callback liefert `code`, `state`, `scope` und bei Neuregistrierung die ausgegebene `client_id`. [Q5]
5. Token-Tausch: `POST https://auth.openai.com/api/accounts/oauth/token` (form-encoded) mit `grant_type=authorization_code`, `client_id`, `code`, `code_verifier`, gleicher `redirect_uri` und gleicher `resource`. Es gibt **kein Client-Secret**. [Q5] Laut Discovery-Dokument ist `token_endpoint_auth_methods_supported` u. a. `none`. [Q14]
6. Das ID-Token prüfen (Signatur gegen JWKS `https://auth.openai.com/.well-known/jwks.json`, `iss`, `aud == client_id`, `exp`, `nonce`) und kontrollieren, ob `chatgpt.tokens.use.direct` in den gewährten Scopes steht. Ein gültiges ID-Token allein erlaubt noch keine Plan-Nutzung. [Q5][Q14]

**Redirect auf Android:** Dokumentiert ist **nur** der HTTP-Loopback auf `127.0.0.1`, ausdrücklich nicht `localhost`. Custom Schemes und App Links erwähnt die Doku nicht. [Q5] Browser und App teilen sich auf Android das Loopback-Interface, also kann die App den Redirect mit einem eigenen `ServerSocket` empfangen. **Das hat der PoC auf dem Emulator nachgewiesen** (Screenshot 05/06). **Wichtig – im echten Login gefunden:** Android friert eine App ~10 s nach dem Wechsel in den Hintergrund ein (Cached-App-Freezer, `freeze_debounce_timeout=10000`). Der Browser verbindet sich dann zwar mit `127.0.0.1:1455`, aber kein App-Thread liest die Anfrage, und der Browser lädt endlos. Die App muss deshalb während des Logins **und** des Token-Tauschs einen Foreground-Service laufen lassen (der PoC nutzt `dataSync`, für ein Produkt Typ und Play-Richtlinie prüfen). Zurück in die App führt im PoC ein Link mit eigenem Debug-Scheme auf der Callback-Seite. Für ein Produkt wären Custom Tabs angenehmer.

### Token-Speicherung und -Erneuerung

- Access-Token gilt **1 h**, Refresh-Token **30 Tage**. Refresh-Tokens **rotieren** bei jedem Refresh. Antwortfelder: `access_token`, `refresh_token` (nur mit `offline_access`), `id_token`, `expires_in`, `scope`, `earliest_refresh_at`. [Q15]
- Den Refresh macht `grant_type=refresh_token` mit der gespeicherten `client_id`, nicht mit `dynamic_agent_client`. Refreshes pro Session serialisieren. Access-Token, Refresh-Token und neue Ablaufzeit gemeinsam ersetzen. [Q13][Q5]
- Abmelden heißt: Refresh-Token am `revocation_endpoint` widerrufen (`https://auth.openai.com/api/accounts/oauth/revoke` [Q14]) und lokal löschen. Der registrierte Client bleibt bestehen. Wenn der Widerruf nicht bestätigt ist, muss der Nutzer darauf hingewiesen werden. [Q13]
- Speicherung: Die Doku verlangt „protected record“ mit Dateirechten 0600, niemals loggen oder committen. [Q5] In Gainalytics: verschlüsseltes MMKV mit Schlüssel im Android Keystore (`app/utils/secureStorage.ts`), wie heute beim Claude-Key.
- OpenAI informiert die App **nicht**, wenn der Nutzer sie in ChatGPT trennt. Das zeigt sich erst bei Refresh- oder 401-Fehlern. [Q8]

### Geht das ohne eigenen Server?

**Ja.** Der Client ist öffentlich (PKCE, kein Secret), die Registrierung läuft dynamisch über den Authorize-Request, und die Inferenz geht direkt an `api.openai.com`. [Q2][Q5] Das gilt für den Open-Source-/Lokal-Weg. Ob OpenAI einer freigegebenen kommerziellen App andere Bedingungen auferlegt (z. B. feste Client-ID mit HTTPS-Redirect), ist offen. Der Website-Flow für kommerzielle Partner beschreibt ein Backend für Session- und Transaktions-State, erlaubt aber auch öffentliche Clients. [Q6]

### Modelle, Endpunkte, Einschränkungen

- **Endpunkte:** nur `POST https://api.openai.com/v1/responses` mit `Authorization: Bearer <access_token>` und `GET /v1/models` (nur Einträge mit `visibility: "list"`, `slug` als Modellname). **Nicht** die `backend-api` von ChatGPT verwenden. [Q11]
- **Modelle:** Welche verfügbar sind, hängt vom Konto ab und kommt aus `/v1/models`. Das Doku-Beispiel nennt `gpt-6.1-sol`. [Q11]
- **Pflicht:** `store: false` und `stream: true` bei jeder Anfrage. `instructions` bzw. Developer-Message statt `system`-Item. Die ganze Historie gehört in `input`, kein `previous_response_id`. [Q12]
- **Verboten:** `background`, `conversation`, `max_output_tokens`, `max_tool_calls`, `metadata`, `moderation`, `prompt`, `prompt_cache_retention`, `safety_identifier`, `temperature`, `top_logprobs`, `top_p`, `truncation`, `user`. Dazu kommen nicht unterstützte Tools: Image Generation, File Search, Code Interpreter, Computer Use, hosted MCP und `tool_search`. Function/Custom Tools gehen. [Q12]
- **Streaming:** Pflicht. Das Ergebnis gilt erst mit `response.completed` als erfolgreich, Text kommt über `response.output_text.delta`. [Q11] RN-`fetch` kann den Body nicht inkrementell lesen. Der PoC liest den vollständigen SSE-Body nach Stream-Ende. Für echtes Live-Streaming bräuchte es XHR `onprogress` oder eine SSE-Bibliothek.
- **Kontextlänge / Rate-Limits:** **nicht dokumentiert.** Es gibt nur die Fehlercodes `subscription_sharing_usage_limit_exceeded` (429), bei dem „an app-specific limit can also apply“, sowie `subscription_sharing_usage_unavailable` (503), `subscription_sharing_unsupported_capability` (400) usw. [Q8]
- **Konsequenz für Gainalytics:** Coach Insights setzen heute `max_tokens: 1024`, der Chat `4096`. Beides ist im ChatGPT-Pfad **verboten**, die Antwortlänge lässt sich nur über die Instructions steuern.

---

## Frage 3 – Passung zum Leitbild (offline-first, kein Konto, kein eigener Server)

- **Kein eigener Server:** passt, siehe Frage 2.
- **Kein Konto:** Gainalytics selbst braucht weiterhin kein Konto. Der ChatGPT-Login ist, wie heute der Claude-Key, ein **optionaler** Zugang zu einem externen Dienst, den nur nutzt, wer die AI-Funktionen will. Alle übrigen Funktionen bleiben offline und ohne Konto.
- **Offline-first:** AI-Chat und Coach Insights sind schon heute online-only. Neu ist ein Token-Refresh im Hintergrund, kein Dauer-Online-Zwang. Die Sitzung läuft 30 Tage ohne Nutzung ab, danach ist ein erneuter Login nötig. [Q15]
- **Was an OpenAI geht:**
  - **Inhalte:** System-Prompt, aufbereiteter Trainings-Kontext (Übungen, Gewichte, Wiederholungen, Daten), Chat-Verlauf und Nutzerfragen. Das ist inhaltlich dasselbe, was heute an Anthropic geht.
  - **Identität:** Durch den Login weiß OpenAI, *welches ChatGPT-Konto* die Anfrage stellt, und ordnet die Nutzung der App „Gainalytics“ zu (sichtbar in ChatGPT → Settings → Usage). [Q7][Q13] Heute mit API-Key ist das ein anonymer Key des Nutzers.
  - **Rückfluss an die App:** Die App erhält per ID-Token `sub`, E-Mail, Name und Profilbild (Scopes `openid profile email`). Das bleibt nur lokal auf dem Gerät.
  - `store: false` heißt: keine Speicherung der Response zum späteren Abruf über die API. Das ist keine Aussage über OpenAIs sonstige Datenverarbeitung, für die die Datenschutzerklärung von OpenAI bzw. die ChatGPT-Bedingungen des Nutzers gelten.
- **Datenschutzerklärung (neu aufzunehmen):**
  - OpenAI als Empfänger, wenn der Nutzer den ChatGPT-Login aktiviert, mit Übermittlung in die USA.
  - Datenkategorien: Trainingsdaten-Auszüge, Chat-Inhalte, Konto-Kennung und E-Mail.
  - Zweck und Rechtsgrundlage: Einwilligung bzw. Vertrag, auf Nutzerinitiative.
  - Lokale Speicherung der Tokens (verschlüsselt).
  - Widerruf: in der App abmelden und in ChatGPT → Settings die App trennen.
  - Link auf die Datenschutzhinweise von OpenAI.
  - Hinweis, dass die Nutzung das eigene ChatGPT-Kontingent verbraucht.
  - Analog sollte der bestehende Anthropic-Abschnitt geprüft werden. Im Repo wurde keine Datenschutzerklärung gefunden. *Keine Rechtsberatung, vor dem Release prüfen lassen.*

---

## Frage 4 – Mehrere Anbieter (Claude per Key **oder** ChatGPT per Login)

**Ist-Zustand (Code):**

- Es gibt zwei unabhängige, duplizierte Anthropic-`fetch`-Implementierungen: `app/utils/llmApi.ts` (Coach Insights, `callAnthropicClaude`) und `app/utils/ai/sendChatMessage.ts` (Chat).
- Beide sind fest verdrahtet: Anthropic-URL und -Header, Anthropic-Content-Blocks, `stop_reason`, Fehlertypen wie `not_found_error`.
- Auch die Namen sind Anthropic-spezifisch: `getAnthropicApiKey`, `useAnthropicModel`, `SET_ANTHROPIC_MODEL`, UI-Text „Anthropic API Key“.
- Wiederverwendbar sind der Typ `LlmResult`/`LlmError`, `ChatMessage {role, content}` und die Prompts als reine Strings (`app/constants/aiPrompts.ts`).

**Nötig:**

1. **Provider-Interface** `LlmProvider { id; isConfigured(); send({system, messages, maxTokensHint, signal, timeoutMs}): Promise<LlmResult> }` mit diesen Implementierungen:
   - `AnthropicApiKeyProvider`: die zwei bestehenden fetch-Pfade zusammengeführt, Verhalten unverändert
   - `ChatGptPlanProvider`: Responses API, `instructions` aus dem System-Prompt, `input` aus der Historie, kein `max_output_tokens`, SSE-Parsing
2. **Fehler-Mapping:** `LlmError` erweitern um `usage_limit` (429 `subscription_sharing_usage_limit_exceeded` → „Manage usage“-Link), `not_eligible`, `reauth_required` (Refresh-Fehler / 401) und `unsupported`.
3. **Settings / Redux:**
   - `settings.aiProvider: 'anthropic' | 'chatgpt'`
   - pro Anbieter ein eigenes Modellfeld (`anthropicModel` bleibt, dazu `openaiModel`)
   - Modellauswahl für ChatGPT als Dropdown aus `/v1/models`
   - Migration: Default `anthropic`, damit bestehende Nutzer nichts merken
4. **Settings-UI:** Die Sektion „AI Coach“ zeigt eine Anbieter-Auswahl. Bei Claude erscheint das bisherige Key-Feld unverändert. Bei ChatGPT erscheinen „Continue with ChatGPT“, „Verbunden als …“, Abmelden und „Manage usage“. Dazu kommen Welcome-Modal und der Hinweis „Using ChatGPT plan“ im Chat. [Q10]
5. **Aufrufer:** `CoachInsightCard` und `AIChatTab` bekommen den aktiven Provider statt Key und Modell. Der Hinweis „Kein Key gesetzt“ wird zu „Kein AI-Anbieter verbunden“.
6. **Antwortlänge:** Coach Insights brauchen kurze Antworten. Bei ChatGPT geht das nur per Prompt-Anweisung, nicht per Token-Limit. Truncation-Handling (`truncatedText.ts`) wird damit providerabhängig, weil es kein `stop_reason: max_tokens` gibt.
7. **Tests:** Provider-Unit-Tests mit gemocktem fetch und SSE, Maestro gegen einen lokalen Mock-Server. Das Muster `ANTHROPIC_MESSAGES_URL` existiert schon und lässt sich auf OpenAI übertragen.

---

## Frage 5 – Empfehlung

**Umsetzen: ja, aber gestuft und an die Freigabe gekoppelt.** Der Nutzen ist hoch, weil die meisten Nutzer ein Abo haben, aber keinen API-Key. Technisch ist es machbar, ohne Server und passend zum Leitbild. Rechtlich ist es heute für den Store **nicht freigegeben**.

### Reihenfolge und priorisierte Ticket-Vorschläge

| Prio | Ticket-Vorschlag | Inhalt | Aufwand | Abhängigkeit |
|---|---|---|---|---|
| P0 | **Freigabe bei OpenAI klären** (Owner, kein Worker) | Interest-Formular absenden oder Open-Source-Entscheidung treffen. Fragen: Store-Verteilung, mobile App, Loopback-Redirect auf Android, Branding | ~1 h + Wartezeit | – |
| P1 | **LLM-Provider-Abstraktion** (reines Refactoring) | Die zwei Anthropic-Pfade hinter `LlmProvider` zusammenführen, `LlmError` erweitern, Settings-Feld `aiProvider` (Default `anthropic`), kein UI-Unterschied | M (1–2 Tage) | – (lohnt sich auch ohne OpenAI) |
| P2 | **ChatGPT-Provider produktiv** | Session-Store, Refresh mit Serialisierung, Revoke, **JWKS-Signaturprüfung**, Fehler-Mapping, Re-Login-Flow, Loopback-Robustheit (**Foreground-Service gegen den App-Freezer** inkl. Play-Deklaration, Port-Fallback, Prozess-Tod, Custom Tabs) | M–L (3–4 Tage) | P0-Freigabe, Provider-Abstraktion |
| P2 | **Settings-UI Anbieterwahl + ChatGPT-Login** | Auswahl Claude/ChatGPT, „Continue with ChatGPT“, Verbunden-als/Abmelden, Modell-Dropdown aus `/v1/models`, Welcome-Modal, „Using ChatGPT plan“ + Manage usage | M (2 Tage) | ChatGPT-Provider |
| P3 | **Streaming im AI-Chat** | Antworten live per XHR/SSE anzeigen (für ChatGPT Pflicht, für Claude ein Komfortgewinn) | S–M (1 Tag) | Provider-Abstraktion |
| P3 | **Datenschutzerklärung + Store-Listing** | OpenAI als Empfänger, Datenkategorien, Widerruf; Anthropic-Abschnitt prüfen | S (½ Tag) | vor Release |
| P3 | **E2E für den ChatGPT-Pfad** | Lokaler Mock für auth/token/responses (SSE), Maestro-Flow Login → Antwort → Abmelden | S (1 Tag) | ChatGPT-Provider |

Gesamt nach Freigabe: grob **8–11 Personentage**.

### Ausblick: andere Anbieter

- **Anthropic / Claude:** Ausdrücklich **nicht erlaubt**. „Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, or Max plan credentials on behalf of their users.“ [Q16]
- **Google Gemini:** **Kein offizielles Gegenstück** gefunden. „Sign in with Google“ ist reine Identität. OAuth bei der Gemini API dient der Zugriffskontrolle in einem Google-Cloud-Projekt und sagt nichts über die Abrechnung über Google-AI-Pro/Ultra-Abos. [G1] Eine Drittquelle berichtet sogar, Google habe das Weiterreichen von Gemini-CLI-Abo-Tokens an Fremd-Tools im Februar 2026 unterbunden und Konten gesperrt (nicht offiziell bestätigt). [D4]
- Damit ist OpenAI derzeit der **einzige** große Anbieter mit einem offiziellen „bring your subscription“-Weg.

---

## Proof of Concept

### Was gebaut wurde (Branch `feature/GH-504`)

> Stand Runde 1/2. In Phase 2 wurde der PoC-Screen durch das Feature in den Settings ersetzt, der Long-Press-Einstieg entfernt und `chatgptPoc/` nach `app/utils/ai/chatgpt/` verschoben, siehe [Phase 2](#phase-2--ist-stand-nach-dem-ausbau-12102026).

| Datei | Inhalt |
|---|---|
| `android/.../ChatGptLoopbackModule.kt` (+ Package, Registrierung in `MainApplication.kt`) | Nativer Loopback-Listener auf `127.0.0.1:1455` (Fallback: freier Port), wartet auf `GET /auth/callback` (Lese-Timeout gegen leere Chrome-Preconnects), antwortet mit einer „Sign-in received“-Seite plus Link zurück in die App; dazu PKCE (S256) und Zufallswerte per `SecureRandom` |
| `android/.../ChatGptSignInService.kt` + `src/debug/AndroidManifest.xml` | Foreground-Service (stille Benachrichtigung) von „Continue with ChatGPT“ bis zum Ende des Token-Tauschs, damit Android die App nicht einfriert; Rücksprung-Scheme `gainalytics-poc://chatgpt-signin`. **Nur im Debug-Manifest deklariert** |
| `app/utils/ai/chatgptPoc/chatgptAuth.ts` | Authorize-URL (dynamische Registrierung, Scopes, `resource`), Callback-Parsing mit State- und Client-ID-Prüfung, Token-Tausch, Refresh, Revoke, ID-Token-Prüfung (iss/aud/nonce; **ohne** Signaturprüfung, nur PoC) |
| `app/utils/ai/chatgptPoc/chatgptResponses.ts` | `/v1/models`, Responses-Request (`store:false`, `stream:true`, `instructions`, keine verbotenen Felder), SSE-Parsing inkl. `response.failed`- und Fehlercodes |
| `app/utils/ai/chatgptPoc/chatgptSession.ts` | Ablauf Login → Callback → Tausch, Session im verschlüsselten Secure Store (getrennter Key), Refresh, Abmelden mit Revoke |
| `app/tabs/settings/ChatGptPocScreen.tsx` | PoC-Screen: „Continue with ChatGPT“, Status, Modell und Testfrage, Antwort, Manage usage, Abmelden |
| `app/routing/SettingsRouter.tsx`, `SettingsTab.tsx` | Screen **nur in `__DEV__`** registriert; Einstieg per **Long-Press auf „Version …“** am Ende der Settings, ebenfalls nur `__DEV__` |

**Abgrenzung zum normalen Nutzerablauf:** Im Release-Build gibt es weder Screen noch Long-Press-Handler. Im Debug-Build ist nichts sichtbar, der Long-Press ist versteckt. Der Claude-Pfad (`llmApi.ts`, `sendChatMessage.ts`, Key-Speicherung) ist **unverändert**. `secureStorage.ts` bekommt nur einen zusätzlichen Getter `getSecureStore()`.

### Verifiziert auf `emulator-5554` (mit importiertem Baseline-Fixture)

| # | Schritt | Ergebnis | Beleg |
|---|---|---|---|
| 1 | Settings ohne sichtbaren Unterschied, Claude-Key-Feld unverändert | ✅ | Screenshot `01_settings_no_chatgpt_entry.png`, Maestro (PoC-Flow, inzwischen entfernt) |
| 2 | Long-Press auf Version öffnet den PoC-Screen („Not connected“) | ✅ | `02_poc_screen_not_connected.png`, Maestro |
| 3 | „Continue with ChatGPT“ startet den Listener (`127.0.0.1:1455 LISTEN`) und öffnet den Authorize-Request; **OpenAI akzeptiert `dynamic_agent_client` und zeigt den Login-Dialog** | ✅ | `03_openai_login_dialog.png` (auth.openai.com/log-in, „Welcome back“), Maestro (Status „Waiting for sign-in in the browser…“) |
| 4 | Redirect auf `http://127.0.0.1:1455/auth/callback` wird vom Browser an die App zugestellt | ✅ (simuliert: der Callback wurde mit dem echten `state` per Chrome-VIEW-Intent geöffnet) | `05_loopback_callback_page.png` |
| 5 | State-Prüfung ok, App ruft den echten Token-Endpunkt von OpenAI auf. Der Fake-Code wird korrekt mit `invalid_grant` abgelehnt, also ist der Endpunkt aus der App erreichbar (kein Cloudflare-Block) | ✅ | `06_app_after_simulated_callback.png` |
| 6 | Echter Login (Konto des Owners) und Zustimmungsdialog „Connect Gainalytics to ChatGPT – Use your ChatGPT plan“ | ✅ | `screenshots/GH-504/07_consent_dialog.png` |
| 7 | Verbundener Zustand (ID-Token geprüft, Scope `chatgpt.tokens.use.direct` gewährt → „Using ChatGPT plan“) | ✅ | `screenshots/GH-504/09_connected_models_loaded.png` (Run-Dir: `r2_01_app_after_thaw.png`, `r2_06_connected_after_fix.png`) |
| 8 | `/v1/models` (7 Modelle, z. B. `gpt-6.1-sol`) und echte Antwort aus `/v1/responses` | ✅ | `screenshots/GH-504/09_connected_models_loaded.png`, `screenshots/GH-504/10_real_chatgpt_answer.png` |

Die dynamische Registrierung wurde für die App akzeptiert, der Consent-Dialog zeigt aber den Hinweis „OpenAI has not verified this agent or its name“. Ohne Freigabe sehen Nutzer also eine Warnung.

### Runde 2: Login hing nach der Anmeldung – Ursache und Fix

- **Befund auf dem Gerät** (vor jeder Änderung festgehalten): Chrome zeigte den Consent-Dialog mit drehendem Spinner auf „Continue“. Auf dem Gerät gab es eine offene TCP-Verbindung Chrome → `127.0.0.1:1455` mit **932 ungelesenen Bytes** (die Callback-Anfrage) und 2 Verbindungen in der Accept-Queue. **Alle Threads der App standen in `do_freezer_trap`**: Android hatte den App-Prozess eingefroren, weil er im Hintergrund lag (Cached-App-Freezer, Android 14+, 10 s Debounce).
- **Bestätigung:** Die App nur in den Vordergrund holen taut sie auf. Der Listener las sofort die wartende Anfrage, Chrome bekam die Antwort, und der Token-Tausch lief durch → „Connected“. Damit war der Login des Owners ohne erneute Anmeldung gerettet.
- **Fix im PoC:**
  1. Foreground-Service (`ChatGptSignInService`, stille Benachrichtigung) ab „Continue with ChatGPT“ **bis nach dem Token-Tausch** (nicht schon beim Callback stoppen, sonst friert die App mitten im Tausch wieder ein).
  2. Lese-Timeout auf angenommene Verbindungen, damit ein leerer Chrome-Preconnect den Listener nicht blockiert.
  3. Rücksprung-Link per eigenem Debug-Scheme. Der alte `intent://`-Link landete im Play Store, weil Chrome `CATEGORY_BROWSABLE` setzt und der Launcher-Filter das nicht akzeptiert.
  4. „Reconnect“-Knopf im PoC-Screen: Neu-Login ohne Abmelden. Die Session wird erst bei Erfolg ersetzt.
- **Verifiziert:** Mit dem Fix kam der Callback, während Chrome vorne lag und die App im Hintergrund war, ohne Rückkehr in die App: Chrome zeigte sofort „Sign-in received“ (`screenshots/GH-504/08_callback_received_in_background.png`). Der Service lief (`isForeground=true`), die App-Threads waren nicht eingefroren. „Back to Gainalytics“ öffnet die App, die direkt „Connected“ zeigt (Run-Dir: `r2_06_connected_after_fix.png`).
- **Restpunkt (für das Produkt-Ticket):** Den Token-Tausch selbst schließt die App erst ab, wenn sie wieder vorne ist (im Test ~2 s nach „Back to Gainalytics“). Grund: React Native pausiert JS-Timer im Hintergrund (`JavaTimerManager.onHostPause`), und RN-`fetch` (whatwg-fetch) löst sein Promise per `setTimeout(…, 0)` auf. Kehrt der Nutzer erst nach Ablauf des Autorisierungscodes zurück, scheitert der Tausch. Produktiv daher den Tausch nativ (OkHttp im Loopback-Modul), per rohem `XMLHttpRequest` oder als Headless-JS-Task ausführen.

---

## Phase 2 – Ist-Stand nach dem Ausbau (12.10.2026)

### Was der Nutzer sieht

- **Settings → AI Coach → AI Configuration → „AI Provider“:** Auswahl **Claude (API key)** oder **ChatGPT (Sign in)**.
  - Ohne Auswahl bleibt jeder bei Claude. Das gilt auch für alle bestehenden Nutzer, denn es gibt keine Migration und keinen Default-Wechsel.
  - Der Claude-Teil (Key-Feld, Test Key, Claude Model) ist unverändert.
  - Die Prompts gelten für beide Anbieter.
- **ChatGPT:**
  - „Continue with ChatGPT“ öffnet den Consent-Dialog im Browser.
  - Danach zeigt die App „Connected as …“ und die Modelle des Abos als Auswahl (ohne Auswahl wird das erste Modell genutzt).
  - Dazu „Reconnect“ (neu anmelden ohne vorher abzumelden), „Sign out“ und „Check usage on chatgpt.com“.
- **AI-Chat und Coach Insights** nutzen den gewählten Anbieter. Gleich wie bei Claude bleiben:
  - Kontext (Trainingsdaten, Planung, gewähltes Training)
  - Lade-Zähler, Stop-Knopf und Timeout (Chat 180 s, Insight 90 s)
  - Rückrollen der unbeantworteten Nachricht
  - Insight-Cache und „Ask AI“
- Der versteckte Debug-Eintrag ist entfernt. Foreground-Service und Rücksprung-Link (`gainalytics://chatgpt-signin`) stehen jetzt im Haupt-Manifest, funktionieren also im Release-Build.

### Technik (Kurzfassung)

| Teil | Datei | Inhalt |
|---|---|---|
| Sitzung | `app/utils/ai/chatgpt/chatgptSession.ts` | Registrierung (Client-ID, Konto) und Tokens **getrennt** im verschlüsselten Secure Store. Ablauf: <ul><li>Client-ID wird **vor** dem Code-Tausch gespeichert</li><li>Refresh ist serialisiert (ein laufender Refresh für alle Aufrufer)</li><li>bei endgültigen Refresh-Fehlern werden die Tokens gelöscht → Neu-Anmeldung</li><li>Abmelden löscht nur die Tokens</li><li>Doppeltipp schließt sich der laufenden Anmeldung an</li><li>PoC-Sitzungen werden übernommen</li></ul> [Q8][Q13] |
| Anfragen | `chatgptChat.ts`, `chatgptResponses.ts` | `/v1/responses` mit `store:false`, `stream:true`, `instructions`; Verlauf als `input` (User `input_text`, Assistant `output_text`). Bei 401 einmal Refresh und Wiederholung. Ohne Modellwahl wird das erste Modell aus `/v1/models` genutzt. [Q11][Q12] |
| Fehler | `chatgptErrors.ts` | Verständliche Meldungen für: <ul><li>Limit erreicht (`subscription_sharing_usage_limit_exceeded`, 429), mit Hinweis auf ChatGPT → Settings → Usage</li><li>Nutzung nicht prüfbar (503)</li><li>Anmeldung abgelaufen/ungültig</li><li>Plan-Nutzung nicht erlaubt</li><li>nicht angemeldet</li><li>ungültiges Modell</li><li>Netzwerk, Timeout, Abbruch</li></ul> [Q8] |
| UI | `AiProviderSelector.tsx`, `ChatGptAccountSection.tsx`, `useChatGptAccount.ts` | Anbieterwahl und ChatGPT-Bereich; Redux-Felder `aiProvider`, `chatgptModel` (fehlend = Claude bzw. erstes Modell) |
| Nativ | `ChatGptLoopbackModule.kt`, `ChatGptSignInService.kt`, `AndroidManifest.xml` | wie im PoC, jetzt für alle Build-Typen |

### Verifiziert (Release-Build ohne Metro, `emulator-5554`, 12.10.2026)

| # | Prüfung | Ergebnis |
|---|---|---|
| 1 | Update über die PoC-Debug-App (`adb install -r`, gleiche Signatur): Daten und **ChatGPT-Anmeldung des Owners bleiben erhalten**, Anbieter steht weiter auf Claude | ✅ `11_settings_default_claude.png`, `12_settings_chatgpt_connected.png` |
| 2 | ChatGPT gewählt: „Connected as …“, 7 Modelle des Abos | ✅ Maestro `__tests__/e2e/maestro/flows/manual/gh504_chatgpt_provider.yaml` |
| 3 | Login im Release-Build über „Reconnect“: <ul><li>Consent „Connect Gainalytics to ChatGPT – Use your ChatGPT plan“</li><li>„Sign-in received“ kommt, während Chrome vorne ist (Foreground-Service aktiv)</li><li>„Back to Gainalytics“ → verbunden, Service beendet</li></ul> | ✅ `13_release_consent_dialog.png` |
| 4 | AI-Chat mit Meso-Kontext: zwei Nachrichten, die zweite nur mit Verlauf lösbar („REST=5 min“ → „BENCH=4 min“); kein „No context“-Hinweis; Stop bricht ab und stellt die Frage wieder her | ✅ `14_release_chat_two_answers_stop.png`, Maestro |
| 5 | Coach Insight mit echter ChatGPT-Antwort, kurz und vollständig (kein Kürzungshinweis) | ✅ `15_release_coach_insight_chatgpt.png`, Maestro `__tests__/e2e/maestro/flows/manual/gh504_chatgpt_coach_insight.yaml` |
| 6 | App-Neustart (Maestro `launchApp` stoppt die App) und Neuinstallation: Anmeldung bleibt | ✅ |
| 7 | Abmelden, abgelaufene Sitzung, Refresh-Fehler, Limit, ungültige Anmeldung, kein Anbieter, Netzwerk | ✅ Unit-Tests (`chatgptSession.spec.ts`, `chatgptChat.spec.ts`, `ChatGptAccountSection.spec.tsx`). Auf dem Gerät **bewusst nicht** abgemeldet, um die Anmeldung des Owners zu erhalten |

Hinweis zu den Testdaten: Das Baseline-Fixture ist Monate alt, und Coach Insights werten nur die letzten 28 Tage aus. Für Nr. 5 wurde deshalb eine Kopie mit auf heute verschobenen Datumswerten über Settings → Import Data eingespielt. Dieser Import behält die Anmeldung.

### Nachbesserungen aus dem Review (Runde 4)

| Befund | Lösung | Beleg |
|---|---|---|
| Abmelden während einer laufenden Token-Erneuerung konnte die alte Anmeldung zurückbringen | Sitzungs-Generation: Abmelden, neue Anmeldung und endgültige Refresh-Fehler erhöhen sie. Ein Refresh aus einer älteren Generation schreibt nichts zurück und widerruft das neu ausgestellte Refresh-Token. Abmelden löscht die Tokens **vor** dem Widerruf. | `chatgptSession.spec.ts` |
| 401 auf `/v1/models` scheiterte sofort, obwohl ein gültiges Refresh-Token da war | Einmal erzwungener Refresh und Wiederholung, wie bei `/v1/responses` | `chatgptChat.spec.ts` |
| Coach Insight zeigte nach Anbieterwechsel oder Abmelden die zwischengespeicherte Insight des anderen Anbieters | ChatGPT-Insights liegen unter eigenem Cache-Schlüssel (`chatgpt:<ids>`), Claude-Schlüssel bleiben unverändert. Bei ChatGPT ohne Anmeldung bleibt die Karte leer, auch mit Cache-Eintrag. | `CoachInsightCard.spec.tsx` |
| iOS bot ChatGPT an, obwohl es dort kein Login-Modul gibt | Option deaktiviert, mit Hinweis „Sign in with ChatGPT is only available on Android for now.“ | `AiProviderSelector.spec.tsx` |

Danach wurden die Release-APKs neu gebaut und auf `emulator-5554` per Update installiert. Die Anmeldung blieb erhalten. Erneut belegt im Release-Build:
- verbunden mit den Modellen des Abos
- Chat mit zwei Antworten und Stop (`16_r4_release_chat_two_answers_then_stop.png`)
- Coach Insight von ChatGPT (`17_r4_release_coach_insight_chatgpt.png`)

Abmelden wurde nur per Unit-Test geprüft, damit die Anmeldung des Owners auf dem Gerät erhalten bleibt.

### Bekannte Grenzen

- **Token-Tausch erst nach Rückkehr in die App** (siehe Runde 2): Der Tausch schließt etwa 1–2 s nach „Back to Gainalytics“ ab. Bleibt der Nutzer sehr lange im Browser, kann der Autorisierungscode verfallen; dann erscheint „Sign-in expired before it finished. Try again.“. Abhilfe wäre ein nativer Tausch (Folgeticket).
- **Keine Live-Anzeige** der Antwort. Das Feature ist bewusst ohne Streaming umgesetzt (Ticket „Nicht im Umfang“). Die SSE-Antwort wird am Ende komplett gelesen.
- **ID-Token:** iss/aud/nonce werden geprüft, die JWKS-Signatur nicht. Das Token kommt direkt per TLS vom Token-Endpunkt.
- Der Consent-Dialog zeigt weiter „OpenAI has not verified this agent or its name“, weil die Registrierung dynamisch erfolgt.
- Datenschutzerklärung, Store-Listing und die Veröffentlichung des Repos sind nicht im Umfang (Owner).

### Offene Ticket-Vorschläge nach Phase 2

| Prio | Vorschlag | Aufwand |
|---|---|---|
| P1 | Repo öffentlich + Lizenz; vor Store-Release Rückfrage bei OpenAI, ob Store-Verteilung abgedeckt ist (Owner) | ~1 h |
| P2 | Token-Tausch nativ im Loopback-Modul, damit der Login auch ohne Rückkehr in die App abschließt | S (½–1 Tag) |
| P2 | Datenschutzerklärung/Store-Listing um OpenAI ergänzen | S (½ Tag) |
| P3 | Streaming im AI-Chat (beide Anbieter) | S–M (1 Tag) |
| P3 | JWKS-Signaturprüfung des ID-Tokens | S (½ Tag) |
| P3 | E2E mit lokalem Mock für auth/token/responses, damit der ChatGPT-Pfad ohne echtes Konto in CI läuft | S (1 Tag) |

---

## Quellen (alle abgerufen am 12.10.2026)

Offiziell OpenAI:

- [Q1] Sign in with ChatGPT – Quickstart: <https://developers.openai.com/siwc/quickstart>
- [Q2] ChatGPT plan usage – Overview (open source / locally hosted): <https://developers.openai.com/siwc/token-sharing-open-source>
- [Q3] Cookbook: Integrating Sign in with ChatGPT in your Opensource App: <https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt>
- [Q4] Request a client ID: <https://developers.openai.com/siwc/request-client-id> · Interest-Formular: <https://openai.com/form/sign-in-with-chatgpt-interest/> (Inhalt nicht automatisch abrufbar, HTTP 403)
- [Q5] Registration and sign-in: <https://developers.openai.com/siwc/token-sharing-open-source/sign-in>
- [Q6] On your website (Identity-Flow für kommerzielle Partner): <https://developers.openai.com/siwc/website>
- [Q7] Help Center – Using your ChatGPT plan in other apps and sites: <https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites> (automatischer Abruf mit HTTP 403 blockiert; Aussagen aus dem Suchindex-Auszug)
- [Q8] Errors and recovery: <https://developers.openai.com/siwc/token-sharing-open-source/errors-and-recovery>
- [Q9] Accounts and sessions (Usage-Verwaltung, Trennen): <https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions>
- [Q10] UI/UX guidelines: <https://developers.openai.com/siwc/ui-ux-guidelines>
- [Q11] Models and inference: <https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference>
- [Q12] Preview limitations: <https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations>
- [Q13] Accounts and sessions (Abmelden/Revocation, Host-ID, Refresh): <https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions>
- [Q14] OpenID-Discovery: <https://auth.openai.com/.well-known/openid-configuration>
- [Q15] Token reference: <https://developers.openai.com/siwc/token-sharing-open-source/token-reference>

Andere Anbieter:

- [Q16] Anthropic – Claude Code Legal and compliance, „Authentication and credential use“: <https://code.claude.com/docs/en/legal-and-compliance>
- [G1] Google – Gemini API OAuth quickstart: <https://ai.google.dev/gemini-api/docs/oauth>

Drittquellen (nur zum Abgleich, nicht als Beleg verwendet):

- [D1] DEV Community – Sign in with ChatGPT for developers: <https://dev.to/hassann/sign-in-with-chatgpt-for-developers-the-oauth-flow-plan-usage-and-what-it-means-for-your-api-bill-48f7>
- [D2] explainx.ai – Sign in with ChatGPT: Official Plus Usage in 16 Apps: <https://explainx.ai/blog/openai-sign-in-with-chatgpt-devday-2026>
- [D3] eesel.ai – Sign in with ChatGPT: how it works, partner apps, and limits: <https://www.eesel.ai/blog/sign-in-with-chatgpt>
- [D4] Puter – Gemini OAuth tutorial: <https://developer.puter.com/tutorials/gemini-oauth/>
