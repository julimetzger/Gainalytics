# UI Test Coverage Plan

## Baseline

- Date measured: 2026-02-28
- Scope: `app/components/**/*.{ts,tsx}` + `app/tabs/**/*.{ts,tsx}`
- Baseline line coverage: `10.68%`

## Priority 1 (Current Execution)

### 1. AddWorkoutSet

File: `app/components/Workout/add/AddWorkoutSet.tsx`

Test scenarios:
- Validates empty required fields before submit.
- Submits full set payload for a new set.
- Auto-submits persisted sets on blur when manual save is disabled.
- Covers 1RM calculation/toggle behavior path.
- Calls delete handler with the full workout set object.

### 2. AddWorkout

File: `app/components/Workout/add/AddWorkout.tsx`

Test scenarios:
- Creates a new workout when no unfinished workout exists.
- Appends a new set index for unfinished workouts without an ID.
- Updates an existing unfinished workout.
- Verifies finalize button enabled/disabled states and finalize dispatch path.
- Verifies suggest button enabled/disabled states and suggest dispatch path.

### 3. WorkoutView

File: `app/components/Workout/show/WorkoutView.tsx`

Test scenarios:
- Enters editable mode on long press when `editable` is true.
- Deletes a workout via edit controls.
- Wires add/update set callbacks correctly.
- Restricts edit behavior when `editable` is false.

### 4. TrainingElementPicker

File: `app/components/picker/elements/TrainingElementPicker.tsx`

Test scenarios:
- Parses mixed selections into exercises, muscles, metric, and accumulation.
- Resolves metric multi-selection conflicts.
- Resolves accumulation multi-selection conflicts.
- Covers visibility and toggle behavior (internal + `onToggle`).

### 5. DatePickerModal

File: `app/components/picker/date/DatePickerModal.tsx`

Test scenarios:
- Emits single-date changes.
- Handles range start/end transitions.
- Resets range when selecting a day earlier than start.
- Covers marked date rendering behavior.

## Priority 2 (Backlog)

- `app/tabs/settings/SettingsTab.tsx`
- `app/tabs/trainings/TrainingsPlanTab.tsx`
- `app/tabs/exercises/ExerciseStatisticsTabs.tsx`

## Acceptance Criteria

- Add tests for all Priority 1 components.
- Keep existing test suites green.
- Increase UI coverage materially from baseline (`10.68%`).
