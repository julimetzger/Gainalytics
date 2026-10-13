import React, {useCallback, useMemo, useState} from 'react';
import {NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {Card, Chip, IconButton, Searchbar, Snackbar, Text, Tooltip, useTheme} from 'react-native-paper';
import {useSelector} from 'react-redux';
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
import MicroHeroCard from '../../components/Training/dashboard/MicroHeroCard';
import NextTrainingCard from '../../components/Training/dashboard/NextTrainingCard';
import MicroRecordsCard from '../../components/Training/dashboard/MicroRecordsCard';
import LastTrainingCard from '../../components/Training/dashboard/LastTrainingCard';
import {Training} from '../../models/entities/Training';
import {trainingsPlanDisplayName} from '../../utils/trainings-plan-name';
import {GlobalState} from '../../redux/rootReducer';
import {dispatchSetCurrentTrainingsPlan} from '../../redux/settings/dispatch/dispatchSetCurrentTrainingsPlan';

type Props = NativeStackScreenProps<RootStackParamList, 'TrainingHome'>;

interface LastDone {
  micro: number;
  training: number;
}

interface NextSession {
  isComplete: boolean;
  /** GH-518: the plan has no planned training yet (e.g. it was just created). */
  isEmpty?: boolean;
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

/**
 * GH-467: `plan.lastTraining` is only written on finish and never cleared, so deleting the last finished training
 * leaves it pointing at nothing — the plan then lost its "Last Training" card and its claim to be the active plan.
 * Fall back to the plan's most recently finished training that still exists.
 */
function lastTrainingIdFor(plan: TrainingsPlan, trainingsById: {[id: number]: Training}): number | undefined {
  if (plan.lastTraining === undefined || trainingsById[plan.lastTraining] !== undefined) return plan.lastTraining;
  let latestId: number | undefined;
  let latestEnd = 0;
  for (const tId of Object.values(plan.trainings)) {
    const end = trainingsById[tId]?.end;
    if (trainingsById[tId]?.state !== TrainingsState.FINISHED || !end) continue;
    const ts = new Date(end).getTime();
    if (ts > latestEnd) {
      latestEnd = ts;
      latestId = tId;
    }
  }
  return latestId;
}

function lastDoneFor(plan: TrainingsPlan, trainingsById: {[id: number]: Training}): LastDone | undefined {
  const lastTraining = lastTrainingIdFor(plan, trainingsById);
  if (lastTraining === undefined) return undefined;
  const entry = Object.entries(plan.trainings).find(([, v]) => v === lastTraining);
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

  // GH-518: a plan without a single planned training is not "complete" — it has not begun.
  if (keys.length === 0) {
    return {isComplete: false, isEmpty: true};
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
  // GH-518: the current (starred) plan is persisted; it was component state and got lost on every remount.
  const currentPlanId = useSelector((state: GlobalState) => state.settings?.currentTrainingsPlanId);
  const setCurrentPlan = dispatchSetCurrentTrainingsPlan();
  const [snackbar, setSnackbar] = useState<{message: string; undoPlanId?: number | null} | undefined>(undefined);
  // GH-518: the FAB shows its label only while the list rests at the top.
  const [fabExtended, setFabExtended] = useState(true);
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setFabExtended(e.nativeEvent.contentOffset.y <= 0);
  }, []);
  const trainingsPlans = useAllTrainingsPlans().sort((a: Exercise, b: Exercise) => a.name.localeCompare(b.name));
  const allTrainings = useTrainings();

  const trainingsById = useMemo(() => {
    const m: {[id: number]: Training} = {};
    for (const t of allTrainings) {
      if (t.id !== undefined) m[t.id] = t;
    }
    return m;
  }, [allTrainings]);

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
      const lastTraining = lastTrainingIdFor(plan, trainingsById);
      const t = lastTraining !== undefined ? trainingsById[lastTraining] : undefined;
      if (t?.end) {
        const ts = new Date(t.end).getTime();
        if (ts > bestTime) {
          bestTime = ts;
          bestPlan = plan;
        }
      }
    }
    if (bestPlan) return bestPlan;

    // GH-497: nothing trained yet (e.g. a plan just created from a template) — the
    // newest plan with planned trainings drives the dashboard, so its first
    // training is one tap away instead of an empty home screen.
    return trainingsPlans
      .filter(plan => Object.keys(plan.trainings ?? {}).length > 0)
      .reduce<TrainingsPlan | undefined>((newest, plan) => (newest === undefined || (plan.id ?? 0) > (newest.id ?? 0) ? plan : newest), undefined);
  }, [trainingsPlans, allTrainings, trainingsById]);

  const openNewPlanRequested = route.params?.openNewPlan === true;
  const handleNewPlanRequestHandled = useCallback(() => navigation.setParams({openNewPlan: undefined}), [navigation]);

  // GH-518: the stored current plan wins. Installs from before GH-518 have none and
  // keep the automatic choice until a plan is created or starred.
  const activePlan = useMemo((): TrainingsPlan | undefined => {
    if (currentPlanId !== undefined) {
      const current = trainingsPlans.find(p => p.id === currentPlanId);
      if (current) return current;
    }
    return autoActivePlan;
  }, [currentPlanId, trainingsPlans, autoActivePlan]);

  const handlePlanCreated = useCallback(
    // `null` = there was no stored current plan; Undo then restores the automatic choice.
    (name: string) => setSnackbar({message: `${name} is now your current plan`, undoPlanId: currentPlanId ?? null}),
    [currentPlanId],
  );

  const activePlanLastDone = useMemo(() => (activePlan ? lastDoneFor(activePlan, trainingsById) : undefined), [activePlan, trainingsById]);
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

  // GH-428 (H1): searching has to match what the row actually shows. A legacy
  // plan without a name displays the fallback label, so typing that label must
  // find it — filtering on the raw name would hide the very row the user reads.
  const filteredPlans = trainingsPlans.filter((p: TrainingsPlan) => trainingsPlanDisplayName(p.name).toLowerCase().includes(filter.toLowerCase()));

  return (
    <View style={{flex: 1}} testID="training-home-screen">
      {/* GH-518: the list ends above the FAB's own strip (see fabBar), so the FAB never lies over a
          card — not over the Next Training button, nor the star / menu of the last plan — in any scroll position. */}
      <ScrollView
        style={styles.list}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.listContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        testID="training-home-list"
      >
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
                isEmpty={activePlanNext.isEmpty}
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

        {/* Plans list with visible search + status dots.
            GH-412: the search uses the same full-width Paper <Searchbar> as the
            Exercises tab, so both tabs share one look (filled pill, no outline,
            leading magnify icon) instead of the old dense outlined field. */}
        <View style={styles.plansHeader}>
          <Text variant="titleMedium" style={styles.plansTitle}>
            Plans
          </Text>
        </View>
        <Searchbar
          placeholder="Search plans"
          value={filter}
          onChangeText={setFilter}
          style={styles.searchbar}
          testID="plans-search-field"
        />

        {filteredPlans.map((trainingsPlan: TrainingsPlan) => {
          const meta = trainingsPlan.id !== undefined ? planMetas[trainingsPlan.id] : undefined;
          const lastDone = lastDoneFor(trainingsPlan, trainingsById);
          const currentMeso = meta?.currentMeso ?? (lastDone ? getMesoForMicro(trainingsPlan.mesos, lastDone.micro) : undefined);
          const sortedMesos = getSortedMesos(trainingsPlan.mesos);
          const isActive = activePlan?.id === trainingsPlan.id;
          const status = meta?.status ?? 'draft';
          // GH-428 (H1): without an explicit label the row announces only its
          // meta line, so a plan created before the name validation existed is
          // indistinguishable from every other draft for screenreader users.
          const displayName = trainingsPlanDisplayName(trainingsPlan.name);
          const rowAccessibilityLabel = `${displayName}, ${meta?.metaText ?? 'Draft'}`;
          const dotColor =
            status === 'active' ? theme.colors.primary : status === 'paused' ? theme.colors.tertiary ?? theme.colors.error : theme.colors.onSurfaceVariant;

          return (
            <Card style={[styles.planCard, isActive && styles.planCardActive]} key={trainingsPlan.id}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={rowAccessibilityLabel}
                testID={`plan-row-${trainingsPlan.id}`}
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
                    <Text style={styles.planName} numberOfLines={1} testID={`plan-name-${trainingsPlan.id}`}>
                      {displayName}
                    </Text>
                    <Text variant="bodySmall" style={[styles.planMeta, {color: theme.colors.onSurfaceVariant}]} testID={`plan-meta-${trainingsPlan.id}`}>
                      {meta?.metaText ?? 'Draft'}
                    </Text>
                    {isActive && (
                      <Text variant="labelSmall" style={[styles.currentLabel, {color: theme.colors.primary}]} testID={`plan-current-label-${trainingsPlan.id}`}>
                        Current plan
                      </Text>
                    )}
                  </View>
                  {/* GH-518: the star means "current plan" — say so (tooltip on long press,
                      screen-reader label) and confirm a switch instead of changing silently. */}
                  <Tooltip title={isActive ? 'Current plan' : 'Set as current plan'}>
                    <IconButton
                      icon={isActive ? 'star' : 'star-outline'}
                      iconColor={isActive ? theme.colors.primary : theme.colors.onSurfaceVariant}
                      size={20}
                      testID={`plan-select-${trainingsPlan.id}`}
                      accessibilityLabel={isActive ? `Current plan: ${displayName}` : `Set ${displayName} as current plan`}
                      accessibilityState={{selected: isActive}}
                      onPress={() => {
                        if (isActive) {
                          setSnackbar({message: `${displayName} is your current plan`});
                          return;
                        }
                        setCurrentPlan(trainingsPlan.id);
                        setSnackbar({message: `${displayName} is now your current plan`});
                      }}
                    />
                  </Tooltip>
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
        style={styles.fabBar}
        extended={fabExtended}
        openRequested={openNewPlanRequested}
        onOpenRequestHandled={handleNewPlanRequestHandled}
        onCreated={handlePlanCreated}
      />
      <Snackbar
        visible={snackbar !== undefined}
        onDismiss={() => setSnackbar(undefined)}
        duration={3000}
        // Above the FAB strip, so the confirmation never hides the FAB.
        wrapperStyle={styles.snackbar}
        testID="current-plan-snackbar"
        action={
          snackbar?.undoPlanId !== undefined
            ? {
                label: 'Undo',
                testID: 'current-plan-snackbar-undo',
                onPress: () => setCurrentPlan(snackbar.undoPlanId ?? undefined),
              }
            : undefined
        }
      >
        {snackbar?.message ?? ''}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  list: {flex: 1},
  listContent: {paddingBottom: 8},
  // GH-518: the FAB's own strip below the list: FAB height 56 + 8 above and below.
  fabBar: {height: 72},
  snackbar: {bottom: 72},
  plansHeader: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
  },
  plansTitle: {fontWeight: '700'},
  // Same insets as the Exercises tab searchbar so both fields align identically.
  searchbar: {margin: 8},
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
  currentLabel: {marginTop: 2, fontWeight: '700'},
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
