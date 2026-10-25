# Security Policy

## Supported versions

Gainalytics is developed on a single branch. Security fixes go into `master` and ship with the next
release. Only the latest released version receives fixes; please update before reporting.

| Version | Supported |
|---|---|
| Latest release | Yes |
| Older releases | No |

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's
[Private Vulnerability Reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability):

1. Open the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Describe the issue, the affected version, and steps to reproduce. A proof of concept helps.

Do not open a public issue, pull request or discussion for a vulnerability before it is fixed.

What to expect:

- We aim to acknowledge a report within 7 days.
- We will keep you informed about the assessment and the fix, and agree on a disclosure date with
  you. We aim to release a fix within 90 days.
- With your consent, we credit you in the release notes and the security advisory.

This is a volunteer project without a bug bounty.

## Scope

In scope: the Gainalytics Android app and the code in this repository, for example

- leaks of training data, backups or AI chat history to other apps or the network,
- exposure of stored credentials (Anthropic API key, ChatGPT session),
- vulnerabilities in the backup/plan import or in the ChatGPT sign-in flow,
- exported Android components that can be abused by other apps.

Out of scope: vulnerabilities in third-party services (Anthropic, OpenAI) or in dependencies that are
already publicly known; please report those upstream. Findings that require a rooted or otherwise
compromised device are generally out of scope.

## Data handling, for context

Gainalytics stores all data on the device. API keys are entered by the user in the app and stored
encrypted with a key from the Android Keystore; no key is built into the app. The only network
traffic is HTTPS to the AI provider the user configured, and only when the user uses an AI feature.
