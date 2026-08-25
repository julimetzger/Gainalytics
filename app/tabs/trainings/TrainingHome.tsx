import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {Card, Chip, IconButton, Text, TextInput, useTheme} from 'react-native-paper';
import {useAllTrainingsPlans} from '../../redux/Training/use/useAllTrainingsPlans';
import {RootStackParamList} from '../../routing/TrainingRouter';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useIsFocused} from '@react-navigation/native';
import {Freeze} from 'react-freeze';
import AddTrainingsPlan from '../../components/Training/add/AddTrainingsPlan';
import {TrainingsState} from '../../models/TrainingsState';
import {useTrainings} from '../../redux/Training/use/useTrainings';
import {Exercise} from '../../models/entities/Exercise';
import {Meso, TrainingsPlan} from '../../models/entities/TrainingsPlan';
import {
  getMicroFromTrainingInMicroIndex,
  getTrainingFromTrainingInMicroIndex,
  getMesoForMicro,
  getSortedMesos,
  getLocalMicro,
  trainingInMicroIndex,
} from '../../redux/Training/trainingsPlanReducer';
import {TextInput as RNTextInput} from 'react-native';
import MicroHeroCard from '../../components/Training/dashboard/MicroHeroCard';
import NextTrainingCard from '../../components/Training/dashboard/NextTrainingCard';
import MicroRecordsCard from '../../components/Training/dashboard/MicroRecordsCard';
import LastTrainingCard from '../../components/Training/dashboard/LastTrainingCard';
import {Training} from '../../models/entities/Training';

type Props = NativeStackScreenProps<RootStackParamList, 'TrainingHome'>;

interface LastDone {
  micro: number;
  training: number;
}

interface NextSession {
  isComplete: boolean;
  micro?: number;
  training?: number;
}

type PlanStatus = 'active' | 'paused' | 'draft';

interface PlanRowMeta {
  status: PlanStatus;
  metaText: string;
  currentMeso?: Meso;
  navigationMicro?: number;
}

function lastDoneFor(plan: TrainingsPlan): LastDone | undefined {
  if (!plan.lastTraining) return undefined;
  const entry = Object.entries(plan.trainings).find(([, v]) => v === plan.lastTraining);
  if (!entry) return undefined;
  return {
    micro: getMicroFromTrainingInMicroIndex(entry[0]),
    training: getTrainingFromTrainingInMicroIndex(entry[0]),
  };
}

function sortedSlotKeys(plan: TrainingsPlan): string[] {
  return Object.keys(plan.trainings).sort((a, b) => {
    const ma = getMicroFromTrainingInMicroIndex(a);
    const mb = getMicroFromTrainingInMicroIndex(b);
    if (ma !== mb) return ma - mb;
    return getTrainingFromTrainingInMicroIndex(a) - getTrainingFromTrainingInMicroIndex(b);
  });
}

function nextSessionFor(
  plan: TrainingsPlan,
  lastDone: LastDone | undefined,
  trainingsById: {[id: number]: Training},
): NextSession {
  const keys = sortedSlotKeys(plan);
  const trainingNumbers = Object.keys(plan.trainingNames ?? {})
    .map(n => parseInt(n, 10))
    .filter(n => !Number.isNaN(n))
    .sort((a, b) => a - b);

  // GH-401 (review 2): a session that is actually running owns the card, wherever it
  // sits in the plan. Starting out of order (day 3 while day 1 is still open) used to
  // leave the card on day 1 — so the card said "Next Training", its button led to the
  // untouched slot, and the running session was unreachable from the dashboard.
  const runningKey = keys.find(k => {
    const running = trainingsById[plan.trainings[k]];
    return running?.state === TrainingsState.STARTED && !running.end;
  });
  if (runningKey) {
    return {
      isComplete: false,
      micro: getMicroFromTrainingInMicroIndex(runningKey),
      training: getTrainingFromTrainingInMicroIndex(runningKey),
    };
  }

  // Find the first undone slot that comes AFTER the lastDone position.
  // Slots at or before lastDone belong to already-completed micros or were skipped
  // in a previous meso; returning them would show the wrong meso as "next".
  const firstUndone = keys.find(k => {
    if (lastDone) {
      const m = getMicroFromTrainingInMicroIndex(k);
      const t = getTrainingFromTrainingInMicroIndex(k);
      if (m < lastDone.micro || (m === lastDone.micro && t <= lastDone.training)) return false;
    }
    const tId = plan.trainings[k];
    return !trainingsById[tId]?.end;
  });
  if (firstUndone) {
    return {
      isComplete: false,
      micro: getMicroFromTrainingInMicroIndex(firstUndone),
      training: getTrainingFromTrainingInMicroIndex(firstUndone),
    };
  }

  // No undone slot exists. Synthesize the next session.
  if (lastDone && trainingNumbers.length > 0) {
    const numIdx = trainingNumbers.indexOf(lastDone.training);
    if (numIdx !== -1 && numIdx < trainingNumbers.length - 1) {
      return {
        isComplete: false,
        micro: lastDone.micro,
        training: trainingNumbers[numIdx + 1],
      };
    }
    return {
      isComplete: false,
      micro: lastDone.micro + 1,
      training: trainingNumbers[0],
    };
  }

  if (!lastDone && trainingNumbers.length > 0) {
    return {isComplete: false, micro: 1, training: trainingNumbers[0]};
  }

  return {isComplete: true};
}

function statusForPlan(plan: TrainingsPlan, allTrainings: Training[]): PlanRowMeta {
  const trainingsById: {[id: number]: Training} = {};
  for (const t of allTrainings) {
    if (t.id !== undefined) trainingsById[t.id] = t;
  }

  const slotEntries = Object.entries(plan.trainings ?? {});
  if (slotEntries.length === 0) {
    return {status: 'draft', metaText: 'Draft · no trainings yet'};
  }

  // Find a started training in this plan → active
  const hasStarted = slotEntries.some(([, tId]) => trainingsById[tId]?.state === TrainingsState.STARTED);

  // Last finished training (by end date)
  let lastFinishedKey: string | undefined;
  let lastFinishedTime = 0;
  for (const [key, tId] of slotEntries) {
    const t = trainingsById[tId];
    if (t?.end) {
      const ts = new Date(t.end).getTime();
      if (ts > lastFinishedTime) {
        lastFinishedTime = ts;
        lastFinishedKey = key;
      }
    }
  }

  if (!lastFinishedKey && !hasStarted) {
    return {status: 'draft', metaText: 'Draft · planned, not started'};
  }

  const lastDoneMicro = lastFinishedKey ? getMicroFromTrainingInMicroIndex(lastFinishedKey) : 1;
  const lastDoneTraining = lastFinishedKey ? getTrainingFromTrainingInMicroIndex(lastFinishedKey) : 0;

  // Advance to the first undone slot after last done — same logic as nextSessionFor.
  const sortedAllKeys = Object.keys(plan.trainings).sort((a, b) => {
    const ma = getMicroFromTrainingInMicroIndex(a), mb = getMicroFromTrainingInMicroIndex(b);
    if (ma !== mb) return ma - mb;
    return getTrainingFromTrainingInMicroIndex(a) - getTrainingFromTrainingInMicroIndex(b);
  });
  const firstUndoneAfterLast = lastFinishedKey
    ? sortedAllKeys.find(k => {
        const m = getMicroFromTrainingInMicroIndex(k);
        const t = getTrainingFromTrainingInMicroIndex(k);
        if (m < lastDoneMicro || (m === lastDoneMicro && t <= lastDoneTraining)) return false;
        return !trainingsById[plan.trainings[k]]?.end;
      })
    : undefined;
  const currentMicro = firstUndoneAfterLast ? getMicroFromTrainingInMicroIndex(firstUndoneAfterLast) : lastDoneMicro;

  const localMicro = getLocalMicro(plan.mesos, currentMicro);
  const currentMeso = getMesoForMicro(plan.mesos, currentMicro);
  const navMicro = firstUndoneAfterLast ? currentMicro : lastDoneMicro;

  const microSlots = Object.keys(plan.trainings).filter(k => getMicroFromTrainingInMicroIndex(k) === currentMicro);
  const microDone = microSlots.filter(k => {
    const tId = plan.trainings[k];
    return trainingsById[tId]?.end;
  }).length;
  const trainingTypeCount = Object.keys(plan.trainingNames ?? {}).length;
  const microTotal = trainingTypeCount > 0 ? trainingTypeCount : microSlots.length;

  if (hasStarted) {
    return {
      status: 'active',
      metaText: `Active · M${localMicro} · ${microDone}/${microTotal}`,
      currentMeso,
      navigationMicro: navMicro,
    };
  }

  // Paused: had finished trainings but nothing currently in progress and last training was a while ago
  const daysSinceLast = (Date.now() - lastFinishedTime) / 86400000;
  if (daysSinceLast > 14) {
    return {
      status: 'paused',
      metaText: `Paused · last done ${Math.round(daysSinceLast)}d ago`,
      currentMeso,
      navigationMicro: navMicro,
    };
  }

  return {
    status: 'active',
    metaText: `Active · M${localMicro} · ${microDone}/${microTotal}`,
    currentMeso,
    navigationMicro: navMicro,
  };
}

const TrainingHomeContent = ({navigation, route}: Props) => {
  const theme = useTheme();
  const [filter, setFilter] = useState((route.params as {filter?: string} | undefined)?.filter || '');
  const [selectedPlanId, setSelectedPlanId] = useState<number | undefined>(undefined);
  const trainingsPlans = useAllTrainingsPlans().sort((a: Exercise, b: Exercise) => a.name.localeCompare(b.name));
  const allTrainings = useTrainings();
  const filterInputRef = React.useRef<RNTextInput>(null);

  const autoActivePlan = useMemo((): TrainingsPlan | undefined => {
    if (trainingsPlans.length === 0) return undefined;

    const startedTrainingIds = new Set(
      allTrainings.filter((t: Training) => t.state === TrainingsState.STARTED).map((t: Training) => t.id),
    );
    const withStarted = trainingsPlans.find(plan =>
      Object.values(plan.trainings).some(tId => startedTrainingIds.has(tId)),
    );
    if (withStarted) return withStarted;

    let bestPlan: TrainingsPlan | undefined;
    let bestTime = 0;
    for (const plan of trainingsPlans) {
      if (!plan.lastTraining) continue;
      const t = allTrainings.find((tr: Training) => tr.id === plan.lastTraining);
      if (t?.end) {
        const ts = new Date(t.end).getTime();
        if (ts > bestTime) {
          bestTime = ts;
          bestPlan = plan;
        }
      }
    }
    return bestPlan;
  }, [trainingsPlans, allTrainings]);

  const activePlan = useMemo((): TrainingsPlan | undefined => {
    if (selectedPlanId !== undefined) {
      const manual = trainingsPlans.find(p => p.id === selectedPlanId);
      if (manual) return manual;
    }
    return autoActivePlan;
  }, [selectedPlanId, trainingsPlans, autoActivePlan]);

  const activePlanLastDone = useMemo(() => (activePlan ? lastDoneFor(activePlan) : undefined), [activePlan]);
  const trainingsById = useMemo(() => {
    const m: {[id: number]: Training} = {};
    for (const t of allTrainings) {
      if (t.id !== undefined) m[t.id] = t;
    }
    return m;
  }, [allTrainings]);
  const activePlanNext = useMemo<NextSession | undefined>(
    () => (activePlan ? nextSessionFor(activePlan, activePlanLastDone, trainingsById) : undefined),
    [activePlan, activePlanLastDone, trainingsById],
  );

  // Hero current micro: prefer the next session's micro (the one actively being worked on).
  // Fall back to last done micro only when the plan is complete (no next session).
  const heroCurrentMicro = useMemo(() => {
    if (activePlanNext?.micro !== undefined) return activePlanNext.micro;
    if (activePlanLastDone) return activePlanLastDone.micro;
    return 1;
  }, [activePlanLastDone, activePlanNext]);

  const planMetas = useMemo(() => {
    const map: {[id: number]: PlanRowMeta} = {};
    for (const plan of trainingsPlans) {
      if (plan.id === undefined) continue;
      map[plan.id] = statusForPlan(plan, allTrainings);
    }
    return map;
  }, [trainingsPlans, allTrainings]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton
          icon="magnify"
          onPress={() => {
            filterInputRef.current?.focus();
          }}
        />
      ),
    });
  }, [navigation]);

  const filteredPlans = trainingsPlans.filter((p: TrainingsPlan) => p.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <View style={{flex: 1}} testID="training-home-screen">
      {/* paddingBottom just clears the add-plan FAB (size-40 IconButton ≈ 65px + 5px offset)
          so the last plan card stays tappable without creating dead scroll space. */}
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{paddingBottom: 80}}>
        {/* Dashboard section for active plan */}
        {activePlan && (
          <>
            <MicroHeroCard plan={activePlan} currentMicro={heroCurrentMicro} navigation={navigation} />
            {activePlanNext && (
              <NextTrainingCard
                plan={activePlan}
                nextMicro={activePlanNext.micro}
                nextTrainingNum={activePlanNext.training}
                isComplete={activePlanNext.isComplete}
                navigation={navigation}
              />
            )}
            {activePlanLastDone && (
              <>
                <MicroRecordsCard plan={activePlan} currentMicro={activePlanLastDone.micro} />
                <LastTrainingCard plan={activePlan} lastDone={activePlanLastDone} navigation={navigation} />
              </>
            )}
          </>
        )}

        {/* Plans list with visible search + status dots */}
        <View style={styles.plansHeader}>
          <Text variant="titleMedium" style={styles.plansTitle}>
            Plans
          </Text>
          <TextInput
            mode="outlined"
            dense
            placeholder="Search plans"
            value={filter}
            onChangeText={setFilter}
            ref={filterInputRef}
            style={styles.searchField}
            left={<TextInput.Icon icon="magnify" />}
            testID="plans-search-field"
          />
        </View>

        {filteredPlans.map((trainingsPlan: TrainingsPlan) => {
          const meta = trainingsPlan.id !== undefined ? planMetas[trainingsPlan.id] : undefined;
          const lastDone = lastDoneFor(trainingsPlan);
          const currentMeso = meta?.currentMeso ?? (lastDone ? getMesoForMicro(trainingsPlan.mesos, lastDone.micro) : undefined);
          const sortedMesos = getSortedMesos(trainingsPlan.mesos);
          const isActive = activePlan?.id === trainingsPlan.id;
          const status = meta?.status ?? 'draft';
          const dotColor =
            status === 'active' ? theme.colors.primary : status === 'paused' ? theme.colors.tertiary ?? theme.colors.error : theme.colors.onSurfaceVariant;

          return (
            <Card style={[styles.planCard, isActive && styles.planCardActive]} key={trainingsPlan.id}>
              <Pressable
                onPress={() =>
                  navigation.navigate({
                    name: 'TrainingPlan',
                    params: {
                      trainingsPlan,
                      micro: meta?.navigationMicro ?? currentMeso?.startMicro ?? lastDone?.micro,
                    },
                  })
                }
              >
                <View style={styles.planHeader}>
                  <View
                    testID={`plan-status-dot-${trainingsPlan.id}-${status}`}
                    style={[styles.statusDot, {backgroundColor: dotColor}]}
                  />
                  <View style={styles.planTitleBlock}>
                    <Text style={styles.planName} numberOfLines={1}>
                      {trainingsPlan.name}
                    </Text>
                    <Text variant="bodySmall" style={[styles.planMeta, {color: theme.colors.onSurfaceVariant}]} testID={`plan-meta-${trainingsPlan.id}`}>
                      {meta?.metaText ?? 'Draft'}
                    </Text>
                  </View>
                  <IconButton
                    icon={isActive ? 'star' : 'star-outline'}
                    iconColor={isActive ? theme.colors.primary : theme.colors.onSurfaceVariant}
                    size={20}
                    testID={`plan-select-${trainingsPlan.id}`}
                    onPress={() => setSelectedPlanId(isActive ? undefined : trainingsPlan.id)}
                  />
                  <AddTrainingsPlan trainingsId={trainingsPlan.id} />
                </View>
                {sortedMesos.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mesoScroll}>
                    {sortedMesos.map((meso: Meso) => (
                      <Chip
                        key={meso.id}
                        testID={`meso-card-${trainingsPlan.id}-${meso.id}`}
                        selected={currentMeso?.id === meso.id}
                        style={styles.mesoChip}
                        onPress={() =>
                          navigation.navigate({
                            name: 'TrainingPlan',
                            params: {trainingsPlan, micro: meso.startMicro},
                          })
                        }
                      >
                        {meso.name}
                      </Chip>
                    ))}
                  </ScrollView>
                )}
              </Pressable>
            </Card>
          );
        })}
      </ScrollView>
      <AddTrainingsPlan
        style={{
          position: 'absolute',
          bottom: 5,
          right: 5,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  plansHeader: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plansTitle: {fontWeight: '700'},
  searchField: {flex: 1, height: 40},
  planCard: {marginHorizontal: 8, marginVertical: 4},
  planCardActive: {opacity: 0.95},
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  planTitleBlock: {flex: 1},
  planName: {
    fontSize: 16,
    fontWeight: '600',
  },
  planMeta: {marginTop: 2},
  mesoScroll: {paddingHorizontal: 5, paddingVertical: 4},
  mesoChip: {marginRight: 6},
});

// GH-284 background-render guard.
// TrainingHome stays mounted in the native stack behind TrainingPlan /
// ExecuteTraining during a workout session (and behind the other bottom tabs).
// Its selectors — notably useTrainings(), which builds a fresh array on every
// store tick — re-rendered the whole dashboard subtree on every
// ADD_OR_UPDATE_SET_IN_WORKOUT dispatch (~90 ms of work) even though the screen
// is invisible. <Freeze> suspends the subtree whenever the screen is not
// focused, so no selector or memo work runs while it is off-screen; it resumes
// with fresh Redux data the moment focus returns, so the visible behaviour is
// unchanged.
const TrainingHome = (props: Props) => {
  const isFocused = useIsFocused();
  return (
    <Freeze freeze={!isFocused}>
      <TrainingHomeContent {...props} />
    </Freeze>
  );
};

export default TrainingHome;
