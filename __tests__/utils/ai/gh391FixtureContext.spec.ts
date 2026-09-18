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
  listChatSelectableTrainings,
  selectActivePlan,
} from '../../../app/utils/ai/chatPlanningContext';
import {serializeTrainingsForChat} from '../../../app/utils/ai/serializeTrainingsForChat';
import {buildChatSystemPrompt, chatContextSize} from '../../../app/utils/ai/buildChatContext';
import {TrainingsState} from '../../../app/models/TrainingsState';
import {Training} from '../../../app/models/entities/Training';

const FIXTURE = path.resolve(__dirname, '../../testdata/gh391_planned_fixture.gains');
/** Same store, but plan 5 is left fully trained and a never-touched plan is added. */
const NEW_PLAN_FIXTURE = path.resolve(__dirname, '../../testdata/gh391_newplan_fixture.gains');
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

/**
 * GH-391 review, misbehaviour 1 — the same store, but the user has finished the
 * plan they were in ("Push pull", its last session is the most recent one in the
 * whole store) and created a new one they have not touched. Until the fix the
 * finished plan won and the chat saw no planning at all.
 */
describe('GH-391 context built from the new-plan device fixture', () => {
  const store = JSON.parse(fs.readFileSync(NEW_PLAN_FIXTURE, 'utf8'));
  const plans = store.trainingsPlan.allIds.map((id: number) => store.trainingsPlan.byId[id]);
  const trainingsById: Record<number, Training> = store.trainings.byId;
  const workoutsById = store.workouts.byId;
  const exercisesById = store.exercises.byId;

  it('talks about the new plan, not about the most recently trained one', () => {
    const active = selectActivePlan(plans, trainingsById)!;
    expect(active.name).toBe('New block 2026');

    // the plan that used to win: trained yesterday, but nothing left to do in it
    const lastTrained = store.trainingsPlan.byId[5];
    const open = Object.values(lastTrained.trainings as Record<string, number>).filter(
      id => trainingsById[id]?.state !== TrainingsState.FINISHED,
    );
    expect(open).toHaveLength(0);
  });

  it('carries the untouched plan’s sessions, their placement and their ranges', () => {
    const planned = buildPlannedTrainingsContext(plans, trainingsById, workoutsById, exercisesById)!;
    expect(planned.plan_name).toBe('New block 2026');
    expect(planned.current_micro).toBe(1);
    expect(planned.sessions.map(s => `${s.micro},${s.position} ${s.name}`)).toEqual([
      '1,1 Squat day',
      '1,2 Bench day',
      '2,1 Squat day',
    ]);
    expect(planned.sessions.every(s => s.meso_name === 'Prep')).toBe(true);
    expect(planned.sessions.every(s => s.state === 'planned')).toBe(true);

    const firstSet = planned.sessions[0].exercises[0].sets[0];
    expect(String(firstSet.reps)).toMatch(/^\d+(\.\d+)?-\d+(\.\d+)?$/);
    expect(String(firstSet.rir)).toMatch(/^\d+(\.\d+)?-\d+(\.\d+)?$/);

    const json = JSON.stringify(planned);
    // still bounded to two micros — nothing of the old plan, nothing beyond micro 2
    expect(json).not.toContain('Push squat');
    expect(json.length).toBeLessThan(20000);

    dump('context-planned-newplan.json', JSON.stringify(planned, null, 2));
    dump(
      'context-size-newplan.txt',
      [
        `active plan: ${planned.plan_name}`,
        `planned sessions: ${planned.sessions.length}`,
        `planned scope: ${planned.scope}`,
        `planned JSON characters: ${json.length}`,
        '',
      ].join('\n'),
    );
  });

  it('offers the untouched plan’s sessions as a subject, before the finished ones', () => {
    const selectable = listChatSelectableTrainings(plans, trainingsById);
    const planned = selectable.filter(t => t.state === 'planned');
    expect(planned.map(t => t.id)).toEqual([382, 383, 384]);
    expect(planned[0].label).toBe('Micro 1 · Squat day');
    // the finished history stays selectable, and comes after the planned ones
    expect(selectable.findIndex(t => t.state === 'finished')).toBe(planned.length);

    dump('context-selectable-newplan.json', JSON.stringify(selectable.slice(0, 8), null, 2));
  });

  it('gives a session of the new plan its full detail and no performed block', () => {
    const locators = buildTrainingLocators(plans, trainingsById);
    const selected = buildSelectedTrainingContext(382, trainingsById, workoutsById, exercisesById, {}, locators)!;
    expect(selected).toMatchObject({
      training_id: 382,
      name: 'Squat day',
      plan_name: 'New block 2026',
      meso_name: 'Prep',
      micro: 1,
      state: 'planned',
    });
    expect(selected.planned.length).toBeGreaterThan(0);
    expect(selected.performed).toBeUndefined();
    dump('context-selected-newplan.json', JSON.stringify(selected, null, 2));
  });
});
