import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {Card, Chip, IconButton, Text, TextInput} from 'react-native-paper';
import {useAllTrainingsPlans} from '../../redux/Training/use/useAllTrainingsPlans';
import {RootStackParamList} from '../../routing/TrainingRouter';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
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
  trainingInMicroIndex,
} from '../../redux/Training/trainingsPlanReducer';
import {useSettings} from '../../redux/settings/use/useSettings';
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

interface NextTraining {
  micro: number;
  training: number;
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

function nextTrainingFor(plan: TrainingsPlan, lastDone: LastDone | undefined): NextTraining | undefined {
  if (!lastDone) {
    const keys = Object.keys(plan.trainings).sort((a, b) => {
      const ma = getMicroFromTrainingInMicroIndex(a);
      const mb = getMicroFromTrainingInMicroIndex(b);
      if (ma !== mb) return ma - mb;
      return getTrainingFromTrainingInMicroIndex(a) - getTrainingFromTrainingInMicroIndex(b);
    });
    if (keys.length === 0) return undefined;
    return {
      micro: getMicroFromTrainingInMicroIndex(keys[0]),
      training: getTrainingFromTrainingInMicroIndex(keys[0]),
    };
  }

  const nextNum = lastDone.training + 1;
  if (plan.trainings[trainingInMicroIndex(lastDone.micro, nextNum)] !== undefined) {
    return {micro: lastDone.micro, training: nextNum};
  }

  const nextMicro = lastDone.micro + 1;
  if (plan.trainings[trainingInMicroIndex(nextMicro, 1)] !== undefined) {
    return {micro: nextMicro, training: 1};
  }

  return undefined;
}

const TrainingHome = ({navigation, route}: Props) => {
  const [filter, setFilter] = useState((route.params as {filter?: string} | undefined)?.filter || '');
  const [showFilter, setShowFilter] = useState(false);
  const trainingsPlans = useAllTrainingsPlans().sort((a: Exercise, b: Exercise) => a.name.localeCompare(b.name));
  const allTrainings = useTrainings();
  const settings = useSettings();
  const filterInputRef = React.useRef<RNTextInput>(null);

  const activePlan = useMemo((): TrainingsPlan | undefined => {
    if (trainingsPlans.length === 0) return undefined;

    // Prefer a plan that currently has a STARTED training
    const startedTrainingIds = new Set(allTrainings.filter((t: Training) => t.state === TrainingsState.STARTED).map((t: Training) => t.id));
    const withStarted = trainingsPlans.find(plan =>
      Object.values(plan.trainings).some(tId => startedTrainingIds.has(tId)),
    );
    if (withStarted) return withStarted;

    // Otherwise use the plan with the most recent completed training
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

  const activePlanLastDone = useMemo(() => (activePlan ? lastDoneFor(activePlan) : undefined), [activePlan]);
  const activePlanNext = useMemo(() => (activePlan ? nextTrainingFor(activePlan, activePlanLastDone) : undefined), [activePlan, activePlanLastDone]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton
          icon="magnify"
          onPress={() => {
            if (showFilter) {
              setShowFilter(false);
              setFilter('');
              filterInputRef.current?.blur();
            } else {
              setShowFilter(true);
              setTimeout(() => filterInputRef.current?.focus(), 100);
            }
          }}
        />
      ),
    });
  }, [navigation, showFilter]);

  return (
    <View style={{flex: 1}} testID="training-home-screen">
      {showFilter && <TextInput label="Filter" value={filter} onChangeText={setFilter} ref={filterInputRef} />}
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        {/* Dashboard section for active plan */}
        {activePlan && activePlanLastDone && (
          <>
            <MicroHeroCard plan={activePlan} currentMicro={activePlanLastDone.micro} />
            {activePlanNext && (
              <NextTrainingCard
                plan={activePlan}
                nextMicro={activePlanNext.micro}
                nextTrainingNum={activePlanNext.training}
                navigation={navigation}
              />
            )}
            <MicroRecordsCard plan={activePlan} currentMicro={activePlanLastDone.micro} />
            <LastTrainingCard plan={activePlan} lastDone={activePlanLastDone} />
          </>
        )}

        {/* Plans list */}
        {trainingsPlans
          .filter((p: TrainingsPlan) => p.name.toLowerCase().includes(filter.toLowerCase()))
          .map((trainingsPlan: TrainingsPlan) => {
            const lastDone = lastDoneFor(trainingsPlan);
            const currentMeso = lastDone ? getMesoForMicro(trainingsPlan.mesos, lastDone.micro) : undefined;
            const sortedMesos = getSortedMesos(trainingsPlan.mesos);
            const isActive = activePlan?.id === trainingsPlan.id;

            return (
              <Card style={[styles.planCard, isActive && styles.planCardActive]} key={trainingsPlan.id}>
                <Pressable
                  onPress={() =>
                    navigation.navigate({
                      name: 'TrainingPlan',
                      params: {
                        trainingsPlan,
                        micro: currentMeso?.startMicro ?? lastDone?.micro,
                      },
                    })
                  }
                >
                  <View style={styles.planHeader}>
                    <Text style={styles.planName}>{trainingsPlan.name}</Text>
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
          [settings.toggles?.showPlusButtonLeft ? 'left' : 'right']: 5,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  planCard: {margin: 5},
  planCardActive: {opacity: 0.85},
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {
    fontSize: 18,
    margin: 8,
    flex: 1,
  },
  mesoScroll: {paddingHorizontal: 5, paddingVertical: 4},
  mesoChip: {marginRight: 6},
});

export default TrainingHome;
