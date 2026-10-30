import {describeAiPlan, parseAiPlanAnswer} from '../../../app/utils/ai/planTraining/aiPlanResult';
import {Exercise} from '../../../app/models/entities/Exercise';

const exercises = [
  {id: 1, name: 'Bench Press'},
  {id: 2, name: 'Squat'},
  {id: 3, name: 'Dumbbell Bench Press'},
  {id: 4, name: 'Row'},
] satisfies Exercise[];

describe('parseAiPlanAnswer (GH-544)', () => {
  it('accepts a valid result, with ranges in the app format', () => {
    const answer = JSON.stringify({
      explanation: 'RIR -1 on everything.',
      not_found: [],
      exercises: [
        {exercise_id: 2, name: 'Squat', sets: [{reps: 5, weight: 170, rir: 0}]},
        {exercise_id: 1, sets: [{reps: '8-12', weight: 100, rir: '0.5-1.5'}]},
      ],
    });

    expect(parseAiPlanAnswer(answer, exercises)).toEqual({
      ok: true,
      plan: {
        explanation: 'RIR -1 on everything.',
        notFound: [],
        exercises: [
          {exerciseId: 2, sets: [{index: 1, reps: 5, weight: 170, rir: 0}]},
          {exerciseId: 1, sets: [{index: 1, reps: 8, repsMax: 12, weight: 100, rir: 0.5, rirMax: 1.5}]},
        ],
        dropped: [],
        rirClamped: [],
      },
    });
  });

  it('reads the fenced json block of a text answer (ChatGPT path)', () => {
    const answer = 'Sure, here is the plan:\n```json\n{"explanation":"Swapped.","exercises":[{"exercise_id":3,"sets":[{"reps":10,"weight":30,"rir":2}]}]}\n```\nEnjoy!';

    expect(parseAiPlanAnswer(answer, exercises)).toEqual({
      ok: true,
      plan: {
        explanation: 'Swapped.',
        notFound: [],
        exercises: [{exerciseId: 3, sets: [{index: 1, reps: 10, weight: 30, rir: 2}]}],
        dropped: [],
        rirClamped: [],
      },
    });
  });

  it('drops and names an unknown exercise, keeps the rest, and passes not_found on', () => {
    const answer = JSON.stringify({
      explanation: 'Cable fly does not exist, kept the rest.',
      not_found: ['Cable Fly'],
      exercises: [
        {exercise_id: 2, sets: [{reps: 5, weight: 170, rir: 1}]},
        {exercise_id: 99, name: 'Dumbbell Fly', sets: [{reps: 12, weight: 20, rir: 1}]},
        {exercise_id: 2, sets: [{reps: 3, weight: 180, rir: 1}]},
      ],
    });

    expect(parseAiPlanAnswer(answer, exercises)).toEqual({
      ok: true,
      plan: {
        explanation: 'Cable fly does not exist, kept the rest.',
        notFound: ['Cable Fly'],
        exercises: [{exerciseId: 2, sets: [{index: 1, reps: 5, weight: 170, rir: 1}]}],
        dropped: ['Dumbbell Fly: not found in your exercises', 'Squat: listed twice'],
        rirClamped: [],
      },
    });
  });

  it.each([
    ['broken JSON', '{"explanation": "x", "exercises": [', 'The AI answer contained no readable plan (no valid JSON).'],
    ['no JSON at all', 'I cannot help with that.', 'The AI answer contained no readable plan (no valid JSON).'],
    ['an empty answer', '', 'The AI answer contained no readable plan (no valid JSON).'],
    ['a JSON array', '[1, 2]', 'The AI answer contained no readable plan (no valid JSON).'],
    ['JSON without exercises', '{"explanation": "done"}', 'The AI answer does not match the plan format (no "exercises" list).'],
  ])('fails with %s', (_case, answer, error) => {
    expect(parseAiPlanAnswer(answer, exercises)).toEqual({ok: false, error, dropped: []});
  });

  it('drops sets with wrong number types and names them', () => {
    const answer = JSON.stringify({
      explanation: '',
      exercises: [
        {
          exercise_id: 1,
          sets: [
            {reps: 'eight', weight: 100, rir: 1},
            {reps: 0, weight: 100, rir: 1},
            {reps: 8, weight: -5, rir: 1},
            {reps: 8, weight: 100, rir: 11},
            {reps: 8, weight: null, rir: 1},
            {reps: 8, weight: 100, rir: true},
            {reps: '12-8', weight: 100, rir: 1},
            {reps: '8', weight: '102,5', rir: 1},
          ],
        },
        {exercise_id: '2', sets: [{reps: 5, weight: 170, rir: 1}]},
        {exercise_id: 4, sets: 'three sets'},
      ],
    });

    expect(parseAiPlanAnswer(answer, exercises)).toEqual({
      ok: true,
      plan: {
        explanation: '',
        notFound: [],
        exercises: [
          {
            exerciseId: 1,
            sets: [
              // set 4: RIR 11 is a number, kept at the bound 10
              {index: 1, reps: 8, weight: 100, rir: 10},
              {index: 2, reps: 8, weight: 102.5, rir: 1},
            ],
          },
        ],
        dropped: [
          'Bench Press set 1: reps must be a number above 0',
          'Bench Press set 2: reps must be a number above 0',
          'Bench Press set 3: weight must be a number of at least 0',
          'Bench Press set 5: weight must be a number of at least 0',
          'Bench Press set 6: RIR must be a number',
          'Bench Press set 7: reps must be a number above 0',
          'Exercise 2: no valid exercise id',
          'Row: no sets',
        ],
        rirClamped: ['Bench Press'],
      },
    });
  });

  it('keeps sets whose RIR went below 0 at RIR 0 and names the exercise (real model answer)', () => {
    // "RIR -1 on everything" on a base already at RIR 0 came back as rir -1 from Claude.
    const answer = JSON.stringify({
      explanation: 'Reduced RIR by 1 on all exercises.',
      exercises: [
        {exercise_id: 2, sets: [{reps: 5, weight: 170, rir: 0}]},
        {exercise_id: 4, sets: [{reps: 12, weight: 60, rir: -1}, {reps: 12, weight: 60, rir: '-0.5'}]},
        {exercise_id: 1, sets: [{reps: 8, weight: 100, rir: -1}]},
      ],
    });

    expect(parseAiPlanAnswer(answer, exercises)).toEqual({
      ok: true,
      plan: {
        explanation: 'Reduced RIR by 1 on all exercises.',
        notFound: [],
        exercises: [
          {exerciseId: 2, sets: [{index: 1, reps: 5, weight: 170, rir: 0}]},
          {exerciseId: 4, sets: [{index: 1, reps: 12, weight: 60, rir: 0}]},
          {exerciseId: 1, sets: [{index: 1, reps: 8, weight: 100, rir: 0}]},
        ],
        // a negative RIR as a STRING is not in the app format and stays dropped
        dropped: ['Row set 2: RIR must be a number'],
        rirClamped: ['Row', 'Bench Press'],
      },
    });
  });

  it('collapses a range that is clamped to one value', () => {
    const answer = JSON.stringify({explanation: '', exercises: [{exercise_id: 2, sets: [{reps: 5, weight: 170, rir: '11-12'}]}]});

    expect(parseAiPlanAnswer(answer, exercises)).toEqual({
      ok: true,
      plan: {
        explanation: '',
        notFound: [],
        exercises: [{exerciseId: 2, sets: [{index: 1, reps: 5, weight: 170, rir: 10}]}],
        dropped: [],
        rirClamped: ['Squat'],
      },
    });
  });

  it('fails when nothing usable is left, and names what was dropped', () => {
    const answer = JSON.stringify({
      explanation: 'x',
      exercises: [{exercise_id: 2, sets: [{reps: -1, weight: 170, rir: 1}]}],
    });

    expect(parseAiPlanAnswer(answer, exercises)).toEqual({
      ok: false,
      error: 'The AI answer contained no usable exercises.',
      dropped: ['Squat set 1: reps must be a number above 0', 'Squat: no usable sets'],
    });
  });

  it('keeps added and removed sets, numbered in the returned order', () => {
    const answer = JSON.stringify({
      explanation: 'One set less on squats, one more set of rows.',
      exercises: [
        {exercise_id: 2, sets: [{reps: 5, weight: 170, rir: 1}]},
        {
          exercise_id: 4,
          sets: [
            {reps: 10, weight: 60, rir: 2},
            {reps: 10, weight: 60, rir: 2},
            {reps: 10, weight: 60, rir: 1},
          ],
        },
      ],
    });

    expect(parseAiPlanAnswer(answer, exercises)).toEqual({
      ok: true,
      plan: {
        explanation: 'One set less on squats, one more set of rows.',
        notFound: [],
        exercises: [
          {exerciseId: 2, sets: [{index: 1, reps: 5, weight: 170, rir: 1}]},
          {
            exerciseId: 4,
            sets: [
              {index: 1, reps: 10, weight: 60, rir: 2},
              {index: 2, reps: 10, weight: 60, rir: 2},
              {index: 3, reps: 10, weight: 60, rir: 1},
            ],
          },
        ],
        dropped: [],
        rirClamped: [],
      },
    });
  });
});

describe('describeAiPlan (GH-544)', () => {
  it('lists the explanation, missing exercises, adjusted and ignored parts', () => {
    expect(
      describeAiPlan({
        explanation: 'RIR -1 on everything.',
        notFound: ['Dumbbell Bench Press'],
        exercises: [],
        dropped: ['Row set 2: reps must be a number above 0'],
        rirClamped: ['Squat', 'Row'],
      }),
    ).toBe(
      'RIR -1 on everything.\nDumbbell Bench Press not found in your exercises.\nRIR kept within 0–10: Squat, Row.\nIgnored: Row set 2: reps must be a number above 0.',
    );
  });
});
