import {Muscles} from '../models/Muscles';
import {ProgramTemplate, TemplateExercise, TemplateExerciseDefinition, TemplateMicroStep} from '../models/ProgramTemplate';

/**
 * GH-497: generic, self-written program templates. They deliberately use the
 * default exercise names (Squat, Bench Press, …) so a fresh install reuses its
 * own exercises; only the two below are created when missing.
 */
export const TEMPLATE_EXTRA_EXERCISES: TemplateExerciseDefinition[] = [
  {
    name: 'Romanian Deadlift',
    muscles: [
      {muscle: Muscles.HAMSTRINGS, percent: 100},
      {muscle: Muscles.GLUTES, percent: 70},
      {muscle: Muscles.BACK, percent: 30},
    ],
  },
  {
    name: 'Incline Dumbbell Press',
    muscles: [
      {muscle: Muscles.CHEST, percent: 100},
      {muscle: Muscles.SHOULDERS, percent: 40},
      {muscle: Muscles.TRICEPS, percent: 40},
    ],
  },
];

const ex = (exercise: string, sets: number, reps: number, rir: number, repsMax?: number): TemplateExercise =>
  repsMax === undefined ? {exercise, sets, reps, rir} : {exercise, sets, reps, repsMax, rir};

/** RIR 3 → 2 → 1, then a deload micro. */
const RAMP_WITH_DELOAD: TemplateMicroStep[] = [{rirDelta: 0}, {rirDelta: -1}, {rirDelta: -2}, {rirDelta: 0, deload: true}];

const STRENGTH_BLOCK: ProgramTemplate = {
  id: 'strength-block',
  name: 'Strength Block',
  summary: 'Squat, bench & deadlift focus · 3 days/week',
  description:
    'Two 4-week mesos for the competition lifts: a volume meso with sets of 5–8, then a strength meso with heavier sets of 3–5. RIR drops from 3 to 1 across each meso, the 4th week is a deload.',
  dayNames: ['Squat & Bench', 'Deadlift & Press', 'Bench & Squat Volume'],
  mesos: [
    {
      name: 'Volume',
      micros: RAMP_WITH_DELOAD,
      days: [
        [ex('Squat', 4, 6, 3), ex('Bench Press', 4, 6, 3), ex('Leg Curls', 3, 10, 3, 12), ex('Row', 3, 8, 3, 10)],
        [ex('Deadlift', 3, 5, 3), ex('Overhead Press', 3, 8, 3), ex('Lat Pulldown', 3, 10, 3, 12), ex('Hyperextensions', 3, 12, 3, 15)],
        [ex('Bench Press', 4, 8, 3), ex('Squat', 3, 8, 3), ex('Romanian Deadlift', 3, 8, 3, 10), ex('Facepulls', 3, 15, 3, 20)],
      ],
    },
    {
      name: 'Strength',
      micros: RAMP_WITH_DELOAD,
      days: [
        [ex('Squat', 4, 3, 3), ex('Bench Press', 4, 3, 3), ex('Leg Curls', 3, 8, 3, 10), ex('Row', 3, 6, 3, 8)],
        [ex('Deadlift', 3, 3, 3), ex('Overhead Press', 4, 5, 3), ex('Lat Pulldown', 3, 8, 3, 10), ex('Hyperextensions', 3, 10, 3, 12)],
        [ex('Bench Press', 4, 5, 3), ex('Squat', 3, 5, 3), ex('Romanian Deadlift', 3, 6, 3, 8), ex('Facepulls', 3, 12, 3, 15)],
      ],
    },
  ],
};

const HYPERTROPHY_BLOCK: ProgramTemplate = {
  id: 'hypertrophy-block',
  name: 'Hypertrophy Block',
  summary: 'Upper/lower split for muscle growth · 4 days/week',
  description:
    'One 5-week meso with moderate weights and rep ranges of 8–15. RIR goes 3 → 2 → 2 → 1 over four weeks, the 5th week is a deload.',
  dayNames: ['Upper A', 'Lower A', 'Upper B', 'Lower B'],
  mesos: [
    {
      name: 'Hypertrophy',
      micros: [{rirDelta: 0}, {rirDelta: -1}, {rirDelta: -1}, {rirDelta: -2}, {rirDelta: 0, deload: true}],
      days: [
        [
          ex('Bench Press', 3, 8, 3, 10),
          ex('Row', 3, 10, 3, 12),
          ex('Overhead Press', 3, 8, 3, 10),
          ex('Lat Pulldown', 3, 10, 3, 12),
          ex('Lateral Raise', 3, 12, 3, 15),
          ex('Cable Pushdowns', 2, 12, 3, 15),
        ],
        [
          ex('Squat', 3, 8, 3, 10),
          ex('Romanian Deadlift', 3, 10, 3, 12),
          ex('Leg Extensions', 3, 12, 3, 15),
          ex('Leg Curls', 3, 12, 3, 15),
          ex('Hip Adduction', 2, 15, 3, 20),
        ],
        [
          ex('Incline Dumbbell Press', 3, 10, 3, 12),
          ex('Pull-Up', 3, 6, 3, 10),
          ex('Butterfly', 3, 12, 3, 15),
          ex('Facepulls', 3, 15, 3, 20),
          ex('Biceps Curls', 3, 10, 3, 12),
          ex('Dips', 2, 8, 3, 12),
        ],
        [
          ex('Deadlift', 3, 6, 3, 8),
          ex('Leg Press', 3, 10, 3, 12),
          ex('Hip Thrusts', 3, 10, 3, 12),
          ex('Leg Curls', 3, 12, 3, 15),
          ex('Hyperextensions', 2, 12, 3, 15),
        ],
      ],
    },
  ],
};

const FULL_BODY_STARTER: ProgramTemplate = {
  id: 'full-body-starter',
  name: 'Full Body Starter',
  summary: 'Simple entry program · 3 full-body days/week',
  description:
    'One 4-week meso with three full-body sessions built around the basic lifts. RIR stays at 3 for two weeks, then 2 — plenty of room to learn the movements.',
  dayNames: ['Full Body A', 'Full Body B', 'Full Body C'],
  mesos: [
    {
      name: 'Foundation',
      micros: [{rirDelta: 0}, {rirDelta: 0}, {rirDelta: -1}, {rirDelta: -1}],
      days: [
        [ex('Squat', 3, 5, 3, 8), ex('Bench Press', 3, 6, 3, 8), ex('Row', 3, 8, 3, 10), ex('Leg Curls', 2, 10, 3, 12)],
        [ex('Deadlift', 3, 5, 3), ex('Overhead Press', 3, 6, 3, 8), ex('Lat Pulldown', 3, 8, 3, 10), ex('Hip Thrusts', 2, 10, 3, 12)],
        [ex('Leg Press', 3, 8, 3, 10), ex('Bench Press', 3, 8, 3, 10), ex('Pull-Up', 3, 5, 3, 8), ex('Biceps Curls', 2, 10, 3, 12)],
      ],
    },
  ],
};

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [STRENGTH_BLOCK, HYPERTROPHY_BLOCK, FULL_BODY_STARTER];

export const findProgramTemplate = (templateId: string | undefined): ProgramTemplate | undefined =>
  PROGRAM_TEMPLATES.find((template) => template.id === templateId);
