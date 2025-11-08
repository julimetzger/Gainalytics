# Setup

Der Agent braucht einen Api key von chat gpt. Dieser muss als environment variable `OPENAI_API_KEY` verfügbar sein.
Am besten dazu eine .env Datei im root vom agent anlegen mit

**Datei:** `.env`

```{.env}
OPENAI_API_KEY=key
```

Bei mir muss noch die env variable gesetzt werden weil npm komisch installiert ist in windows

```bash
Set-Alias npm  "C:\tools\nodejs\npm.cmd"
```

Der agent kann dann ausgeführt werden mit der TRN-Number aus dem backlog

```
npm run agent run {TRN-Number}
```
