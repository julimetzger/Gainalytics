import {useMemo} from 'react';
import {Training} from '../../../models/entities/Training';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import {Workout} from '../../../models/entities/Workout';
import {useAllTrainingsInMicro} from '../../../redux/Training/use/useAllTrainingsInMicro';
import {LastMatchingTraining, useLastMatchingTraining} from '../../../redux/Training/use/useMuscleInvolvement';
import {getLocalMicro, getMesoForMicro} from '../../../redux/Training/trainingsPlanReducer';
import {useWorkoutsByIds} from '../../../redux/Workout/use/useWorkoutsByIds';
import {useSettings} from '../../../redux/settings/use/useSettings';
import {dispatchSetAnalyseMuscleMapCompare, dispatchSetPlanMuscleMapCompare} from '../../../redux/settings/dispatch/dispatchSetPlanMuscleMap';
import {MuscleMapCompare} from '../../../utils/MuscleInvolvementUtils';
import {doneWorkoutIdsOf, formatTrainingDate, plannedWorkoutIdsOf, setsOf} from '../../../utils/overview-comparison';
import {CompareChipOption} from '../../analyse/CompareChips';
import {MuscleMapDetails} from '../../analyse/MuscleMapCard';

/** The position of the single training analysis — what the subject is built from. */
export type TrainingPosition = 'plan' | 'train';

/**
 * GH-526 — the references a single training can be compared against, per position:
 * Train: vs Plan (`this_training_plan`, default) · vs last <Training> (`last_training_done`) · vs Micro (`current_total_plan`)
 * Plan:  vs last <Training> (`last_training_plan`, default) · vs Micro (`current_total_plan`)
 */
export type TrainingCompare = Extract<MuscleMapCompare, 'this_training_plan' | 'last_training_done' | 'last_training_plan' | 'current_total_plan'>;

const TRAIN_COMPARES: TrainingCompare[] = ['this_training_plan', 'last_training_done', 'current_total_plan'];
const PLAN_COMPARES: TrainingCompare[] = ['last_training_plan', 'current_total_plan'];

export interface TrainingComparison {
  options: CompareChipOption<TrainingCompare>[];
  /** Undefined when no reference is selectable at all. */
  selected?: TrainingCompare;
  select: (compare: TrainingCompare) => void;
  subject: Workout[];
  reference?: Workout[];
  /** vs Micro — the deltas read as shares of the micro plan. */
  share: boolean;
  /** The one line naming both sides, e.g. `Done vs Micro 1 · Push (done) · Mon 06/10/2026`. */
  comparisonLine: string;
  subjectLabel: string;
  referenceLabel?: string;
  referenceShort?: string;
  details: MuscleMapDetails;
  /** The last done training at this position, when it is the reference — its duration is the Duration KPI's reference. */
  durationReference?: Training;
  /** GH-645: the last trained training at this position ("vs last"), whatever is selected. */
  lastDone?: LastMatchingTraining;
}

export const trainingNameFor = (trainingsPlan: TrainingsPlan, trainingInMicro: number): string => {
  const explicit = trainingsPlan.trainingNames?.[trainingInMicro];
  return explicit && explicit.trim().length > 0 ? explicit : `Training ${trainingInMicro}`;
};

/**
 * `Micro 3` — local to its meso. A last matching training from the previous
 * meso carries the meso's name, so it never reads as a micro of this one.
 */
export const microNameFor = (trainingsPlan: TrainingsPlan, micro: number, currentMicro: number): string => {
  const local = `Micro ${getLocalMicro(trainingsPlan.mesos, micro)}`;
  const meso = getMesoForMicro(trainingsPlan.mesos, micro);
  const currentMeso = getMesoForMicro(trainingsPlan.mesos, currentMicro);
  return meso && currentMeso && meso.id !== currentMeso.id && meso.name ? `${meso.name} · ${local}` : local;
};

const shortMicro = (trainingsPlan: TrainingsPlan, match: LastMatchingTraining | undefined) => (match ? `M${getLocalMicro(trainingsPlan.mesos, match.micro)}` : '–');

/**
 * GH-526 — everything the single training analysis compares: the chip options
 * of the position, the persisted choice, the two workout lists and the labels.
 * The KPI cards, the muscle map and the Muscle Overview / Exercises tables all
 * read from the same `subject` / `reference`, so they can never disagree on
 * what is compared.
 */
export const useTrainingComparison = (trainingsPlan: TrainingsPlan, micro: number, trainingInMicro: number, position: TrainingPosition, training: Training | undefined): TrainingComparison => {
  const settings = useSettings();
  const setPlanCompare = dispatchSetPlanMuscleMapCompare();
  const setAnalyseCompare = dispatchSetAnalyseMuscleMapCompare();
  const planId = trainingsPlan.id!!;

  const lastPlan = useLastMatchingTraining(planId, trainingInMicro, micro, 'plan');
  const lastDone = useLastMatchingTraining(planId, trainingInMicro, micro, 'done');
  const microTrainings = useAllTrainingsInMicro(planId, micro);

  const planCur = useWorkoutsByIds(useMemo(() => plannedWorkoutIdsOf([training]), [training]));
  const doneCur = useWorkoutsByIds(useMemo(() => doneWorkoutIdsOf([training]), [training]));
  const planPrev = useWorkoutsByIds(useMemo(() => plannedWorkoutIdsOf([lastPlan?.training]), [lastPlan?.training]));
  const donePrev = useWorkoutsByIds(useMemo(() => doneWorkoutIdsOf([lastDone?.training]), [lastDone?.training]));
  const microPlan = useWorkoutsByIds(useMemo(() => plannedWorkoutIdsOf(microTrainings), [microTrainings]));
  const microDone = useWorkoutsByIds(useMemo(() => doneWorkoutIdsOf(microTrainings), [microTrainings]));

  const trainingName = trainingNameFor(trainingsPlan, trainingInMicro);
  const currentMicroName = `Micro ${getLocalMicro(trainingsPlan.mesos, micro)}`;
  const lastPlanName = lastPlan ? `${microNameFor(trainingsPlan, lastPlan.micro, micro)} · ${trainingName}` : undefined;
  const lastDoneName = lastDone ? `${microNameFor(trainingsPlan, lastDone.micro, micro)} · ${trainingName}` : undefined;

  const available: Record<TrainingCompare, boolean> = {
    this_training_plan: setsOf(planCur) > 0,
    last_training_done: lastDone !== undefined && setsOf(donePrev) > 0,
    last_training_plan: lastPlan !== undefined && setsOf(planPrev) > 0,
    current_total_plan: setsOf(microPlan) > 0,
  };
  const labels: Record<TrainingCompare, string> = {
    this_training_plan: 'vs Plan',
    last_training_done: `vs last ${trainingName}`,
    last_training_plan: `vs last ${trainingName}`,
    current_total_plan: 'vs Micro',
  };

  const compares = position === 'train' ? TRAIN_COMPARES : PLAN_COMPARES;
  const options = compares.map((value) => ({value, label: labels[value], disabled: !available[value]}));

  const persisted = position === 'train' ? settings?.muscleMapCompareSelectionAnalyse : settings?.muscleMapCompareSelectionPlan;
  const persistedCompare = compares.find((compare) => compare === persisted && available[compare]);
  const selected = persistedCompare ?? compares.find((compare) => available[compare]);
  const select = position === 'train' ? setAnalyseCompare : setPlanCompare;

  const subject = position === 'train' ? doneCur : planCur;
  const subjectLabel = position === 'train' ? 'Done' : 'Plan';
  const share = selected === 'current_total_plan';

  let reference: Workout[] | undefined;
  let comparisonLine = `${subjectLabel} of this training · no reference available`;
  let referenceLabel: string | undefined;
  let referenceShort: string | undefined;
  if (selected === 'this_training_plan') {
    reference = planCur;
    comparisonLine = 'Done vs plan of this training';
    referenceLabel = 'Plan';
    referenceShort = 'Plan';
  } else if (selected === 'last_training_done') {
    reference = donePrev;
    const date = formatTrainingDate(lastDone?.training.start);
    comparisonLine = `Done vs ${lastDoneName} (done)${date ? ` · ${date}` : ''}`;
    referenceLabel = lastDoneName;
    referenceShort = shortMicro(trainingsPlan, lastDone);
  } else if (selected === 'last_training_plan') {
    reference = planPrev;
    comparisonLine = `Plan vs ${lastPlanName} (plan)`;
    referenceLabel = lastPlanName;
    referenceShort = shortMicro(trainingsPlan, lastPlan);
  } else if (selected === 'current_total_plan') {
    reference = microPlan;
    comparisonLine = `${subjectLabel} vs plan of all trainings in ${currentMicroName}`;
    referenceLabel = `${currentMicroName} plan`;
    referenceShort = `${currentMicroName} plan`;
  }

  const currentShort = `M${getLocalMicro(trainingsPlan.mesos, micro)}`;
  const lastPlanShort = shortMicro(trainingsPlan, lastPlan);
  const lastDoneShort = shortMicro(trainingsPlan, lastDone);
  const hasLastPlan = lastPlan !== undefined;
  const hasLastDone = lastDone !== undefined;
  const details = useMemo<MuscleMapDetails>(
    () =>
      share
        ? {labels: ['This plan', 'This done', 'Micro plan', 'Micro done'], workouts: [planCur, doneCur, microPlan, microDone]}
        : {
            labels: [`Plan ${lastPlanShort}`, `Plan ${currentShort}`, `Done ${lastDoneShort}`, `Done ${currentShort}`],
            workouts: [hasLastPlan ? planPrev : undefined, planCur, hasLastDone ? donePrev : undefined, doneCur],
          },
    [share, planCur, doneCur, microPlan, microDone, planPrev, donePrev, lastPlanShort, lastDoneShort, currentShort, hasLastPlan, hasLastDone],
  );

  return {
    options,
    selected,
    select,
    subject,
    reference,
    share,
    comparisonLine,
    subjectLabel,
    referenceLabel,
    referenceShort,
    details,
    durationReference: selected === 'last_training_done' ? lastDone?.training : undefined,
    lastDone,
  };
};
