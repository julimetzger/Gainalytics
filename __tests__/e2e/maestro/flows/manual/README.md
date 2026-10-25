# Manual Maestro flows

These flows check behaviour that cannot be reproduced offline on the emulator with the
baseline data. They need at least one of: a real Anthropic API key, a signed-in ChatGPT
account, a real device (physical-device layout/accessibility quirks) or the user's real
training data / on-device video analyses. Their purpose is not covered by an automated
target flow (see `../../FLOW_AUDIT.md`).

| Flow | Needs |
|---|---|
| `ai447_chat_not_stuck.yaml` | real Anthropic key; large model leaves the loading state with a real answer |
| `gh330_1rm_card_colours.yaml` | real device with real user data (PR / negative delta colours of the 1RM card) |
| `gh355_tab_order.yaml` | real device (training sub-tab strip is not in the accessibility tree; coordinate taps + screenshots) |
| `gh439_playback_velocity_live.yaml` (+ helper `gh439_open_playback_overlay.yaml`) | real device with an existing on-device analysis (`ANALYSIS_ID`) |
| `gh504_suite.yaml`, `gh504_chatgpt_provider.yaml`, `gh504_chatgpt_coach_insight.yaml` | signed-in ChatGPT account (and recent training data for the coach insight) |
| `gh515_chat_device.yaml` | real Anthropic key saved in Settings › AI Coach |

They are **not** part of `../suite.yaml`, are not run by CI or the orchestrator, and do not
count towards the "2–3 target flows per feature" rule.

## Running one manually

1. Prepare the device as described in the flow's header comment (key, sign-in, data).
   Most of these flows deliberately never `clearState`, so do not run the baseline import
   in front of them unless the header says so.
2. Run it from the repo root against the chosen device:

   ```bash
   maestro --device <serial> test __tests__/e2e/maestro/flows/manual/gh515_chat_device.yaml
   ```

   Pass parameters with `-e`, e.g. `-e ANALYSIS_ID=2` for `gh439_playback_velocity_live.yaml`.
3. Shared helpers are referenced relative to this folder (`../open_ai_chat.yaml`).
