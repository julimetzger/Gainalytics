
## Dummy task (GH-545 test run of the emulator agent)

This is a harmless test of the workflow itself, not a real ticket. Use ticket id `AGENT-RUN`.

1. Cold start the app (`tool.sh launch`). The store is empty, so the onboarding may cover the
   tabs: skip it the same way `__tests__/e2e/maestro/flows/gh497_dismiss_onboarding.yaml` does.
2. Add ONE new Maestro flow `__tests__/e2e/maestro/flows/agent_run_empty_training_home.yaml` that
   launches the app (no clearState), reuses `gh497_dismiss_onboarding.yaml`, opens the Training tab,
   waits for `training-home-screen` and asserts at least one concrete empty-state value
   (for example the text of `next-training-name` or another value visible on the empty home screen;
   look at the screen first with `tool.sh screenshot` and `adb -s <serial> shell uiautomator dump`).
3. Run the flow with `tool.sh flow` until it passes. Then take the evidence screenshot
   `tool.sh screenshot agent-run-empty-training-home` of the Training start screen in its empty state.
4. Commit the flow and the screenshot (`screenshots/AGENT-RUN/agent-run-empty-training-home.png`)
   in one commit `AGENT-RUN: empty Training home flow and screenshot`. No app code changes.
5. Write `.agent-run/pr-title.txt` and `.agent-run/pr-body.md` as described in the agent prompt.
   State clearly in the body that this is a throwaway test PR of GH-545 that must not be merged.

