/**
 * GH-391 — the context assembled from the very `.gains` store that is imported
 * on the device for the Maestro evidence run.
 *
 * The unit tests next door use hand-built fixtures; this one closes the loop
 * between "what the tests assert" and "what the app shows on screen", because
 * both read the same file. Set `GH391_CONTEXT_OUT` to a directory to dump the
 * assembled context there (that is how the evidence files in the run dir are
 * produced). No API key is read, produced or written anywhere here.
 */
import fs from 'fs';
import path from 'path';
import {
  buildPlannedTrainingsContext,
  buildSelectedTrainingContext,
  buildTrainingLocators,
} from '../../../app/utils/ai/chatPlanningContext';
import {serializeTrainingsForChat} from '../../../app/utils/ai/serializeTrainingsForChat';
import {buildChatSystemPrompt, chatContextSize} from '../../../app/utils/ai/buildChatContext';
import {TrainingsState} from '../../../app/models/TrainingsState';
import {Training} from '../../../app/models/entities/Training';

const FIXTURE = path.resolve(__dirname, '../../testdata/gh391_planned_fixture.gains');
const OUT_DIR = process.env.GH391_CONTEXT_OUT;

const dump = (name: string, content: string) => {
  if (OUT_DIR) fs.writeFileSync(path.join(OUT_DIR, name), content);
};

describe('GH-391 context built from the device fixture', () => {
  const store = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const plans = store.trainingsPlan.allIds.map((id: number) => store.trainingsPlan.byId[id]);
  const trainingsById: Record<number, Training> = store.trainings.byId;
  const workoutsById = store.workouts.byId;
  const exercisesById = store.exercises.byId;

  it('contains the planned sessions of the current micro with their full plan', () => {
    const planned = buildPlannedTrainingsContext(plans, trainingsById, workoutsById, exercisesById)!;
    expect(planned).not.toBeNull();
    expect(planned.plan_name).toBe('Push pull');
    expect(planned.current_micro).toBe(7);
    expect(planned.sessions.map(s => `${s.micro},${s.position} ${s.name}`)).toEqual([
      '7,1 Push squat',
      '7,2 Pull dl ',
    ]);

    for (const session of planned.sessions) {
      expect(session.meso_name).toBeDefined();
      expect(session.micro_in_meso).toBeGreaterThan(0);
      expect(session.exercises.length).toBeGreaterThan(0);
      for (const exercise of session.exercises) {
        // a real exercise name, not the `Exercise <id>` fallback
        expect(exercise.name).not.toMatch(/^Exercise \d+$/);
        expect(exercise.sets.length).toBeGreaterThan(0);
        for (const workoutSet of exercise.sets) {
          expect(workoutSet.reps).toBeDefined();
          expect(workoutSet.weight_kg).toBeDefined();
          expect(workoutSet.rir).toBeDefined();
        }
      }
    }

    dump('context-planned.json', JSON.stringify(planned, null, 2));
  });

  it('keeps the planned ranges of the first exercise a range', () => {
    const planned = buildPlannedTrainingsContext(plans, trainingsById, workoutsById, exercisesById)!;
    const first = planned.sessions[0].exercises[0];
    expect(String(first.sets[0].reps)).toMatch(/^\d+(\.\d+)?-\d+(\.\d+)?$/);
    expect(String(first.sets[0].rir)).toMatch(/^\d+(\.\d+)?-\d+(\.\d+)?$/);
  });

  it('gives a finished session both its plan and what was performed', () => {
    const locators = buildTrainingLocators(plans, trainingsById);
    // 381 is the last finished session of the active plan (micro 6)
    const selected = buildSelectedTrainingContext(381, trainingsById, workoutsById, exercisesById, {}, locators)!;
    expect(selected.state).toBe('finished');
    expect(selected.planned.length).toBeGreaterThan(0);
    expect(selected.performed!.length).toBeGreaterThan(0);
    dump('context-selected-finished.json', JSON.stringify(selected, null, 2));
  });

  it('gives a planned session its plan and no performed block', () => {
    const locators = buildTrainingLocators(plans, trainingsById);
    const selected = buildSelectedTrainingContext(382, trainingsById, workoutsById, exercisesById, {}, locators)!;
    expect(selected.state).toBe('planned');
    expect(selected.performed).toBeUndefined();
    dump('context-selected-planned.json', JSON.stringify(selected, null, 2));
  });

  it('keeps the planning a bounded, measurable addition that switching off removes', () => {
    const finished = Object.values(trainingsById)
      .filter(t => t.state === TrainingsState.FINISHED && t.end)
      .sort((a, b) => new Date(b.end!).getTime() - new Date(a.end!).getTime())
      .slice(0, 8);
    const finishedJson = serializeTrainingsForChat(finished, workoutsById, exercisesById, {});
    const planned = buildPlannedTrainingsContext(plans, trainingsById, workoutsById, exercisesById)!;
    const plannedJson = JSON.stringify(planned);

    const withPlanning = chatContextSize({finishedJson, plannedJson, selectedJson: null});
    const withoutPlanning = chatContextSize({finishedJson, plannedJson: null, selectedJson: null});

    expect(buildChatSystemPrompt('P', {finishedJson, plannedJson: null, selectedJson: null})).not.toContain(
      'Planned trainings',
    );
    expect(withoutPlanning).toBeLessThan(withPlanning);
    // two micros, not a whole meso — the addition stays small
    expect(plannedJson.length).toBeLessThan(20000);

    dump(
      'context-size.txt',
      [
        `planned sessions: ${planned.sessions.length}`,
        `planned scope: ${planned.scope}`,
        `planned JSON characters: ${plannedJson.length}`,
        `context characters, planning ON:  ${withPlanning}`,
        `context characters, planning OFF: ${withoutPlanning}`,
        `difference: ${withPlanning - withoutPlanning}`,
        '',
      ].join('\n'),
    );
  });
});
