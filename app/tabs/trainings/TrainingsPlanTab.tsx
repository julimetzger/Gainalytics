import React, {useState, useCallback, useLayoutEffect} from 'react';
import {ViewMode} from './MicroOverviewTraining';
import {ExerciseSortMode} from '../../components/Training/analyse/MicroExerciseOverview';
import {BackHandler} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {Button, IconButton, useTheme} from 'react-native-paper';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/TrainingRouter';
import {Drawer} from 'react-native-drawer-layout';
import {useTrainingsPlan} from '../../redux/Training/use/useTrainingsPlan';
import {useTrainingInTrainingsPlan} from '../../redux/Training/use/useTrainingInTrainingsPlan';
import dispatchChangeTrainingsName from '../../redux/Training/dispatch/general/dispatchChangeTrainingsName';
import TrainingsPlanHeader from '../../components/Training/TrainingsPlanHeader';
import TrainingsPlanDrawer from '../../components/Training/TrainingsPlanDrawer';
import TrainingsPlanNode from '../../components/Training/TrainingsPlanNode';
import RangeSwiper from '../../components/RangeSwiper';
import TrainingHistoryCalendar from '../../components/Training/analyse/TrainingHistoryCalendar';
import {LayoutRectangle} from 'react-native';
import {clampMicroToMeso, getLocalMicro, getMesoForMicro, getSortedMesos} from '../../redux/Training/trainingsPlanReducer';
import dispatchAddMeso from '../../redux/Training/dispatch/general/dispatchAddMeso';
import dispatchEditMeso from '../../redux/Training/dispatch/general/dispatchEditMeso';
import dispatchDeleteMeso from '../../redux/Training/dispatch/general/dispatchDeleteMeso';
import {TrainingsState} from '../../models/TrainingsState';
import {PlanChromeState} from '../../components/Training/plan/PlanTab';
import {AnalysisDataMode} from '../../components/Training/analyse/AnalysisDataToggle';
import {trainingsPlanDisplayName} from '../../utils/trainings-plan-name';

const createDefaultPlanChromeState = (): PlanChromeState => ({
  mode: 'read',
  exitToRead: () => undefined,
  handleBack: () => false,
});

const TrainingsPlanTab = ({navigation, route}: Props) => {
  const trainingsPlan = useTrainingsPlan(route.params.trainingsPlan.id!!);
  const [open, setOpen] = useState(false);
  const [micro, setMicro] = useState(route.params.micro ?? 1);
  const [trainingInMicro, setTrainingInMicro] = useState(route.params.training ?? 1);
  const training = useTrainingInTrainingsPlan(route.params.trainingsPlan.id!!, micro, trainingInMicro);
  const [rerender, setRerender] = useState(Math.random());
  let [showDone, setShowDone] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [ignoreSwipeLocations, setIgnoreSwipeLocations] = useState<LayoutRectangle[]>([]);
  const [microViewMode, setMicroViewMode] = useState<ViewMode>('exercise');
  const [microSortMode, setMicroSortMode] = useState<ExerciseSortMode>('plan');
  // GH-417: owned here, not in the swiper panes — those are remounted on every
  // micro change (RangeSwiper `key`), which would reset the choice.
  const [analysisDataMode, setAnalysisDataMode] = useState<AnalysisDataMode>('train');
  const handleSetShowDone = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof value === 'function' ? value(false) : value;
    setShowDone(next);
    if (next) setMicroViewMode('exercise');
  }, []);
  const [overflowVisible, setOverflowVisible] = useState(false);
  const [planChromeState, setPlanChromeState] = useState<PlanChromeState>(createDefaultPlanChromeState);

  let changeTrainingsName = dispatchChangeTrainingsName();
  let addMeso = dispatchAddMeso();
  let editMeso = dispatchEditMeso();
  let deleteMeso = dispatchDeleteMeso();
  let theme = useTheme();

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (showHistory) {
          setShowHistory(false);
          return true;
        }
        return planChromeState.handleBack();
      });
      return () => sub.remove();
    }, [planChromeState, showHistory]),
  );

  useFocusEffect(
    useCallback(() => {
      return navigation.addListener('beforeRemove', (event) => {
        if (showHistory) {
          event.preventDefault();
          setShowHistory(false);
          return;
        }
        if (planChromeState.handleBack()) {
          event.preventDefault();
        }
      });
    }, [navigation, planChromeState, showHistory]),
  );

  const [lockedMesoId, setLockedMesoId] = useState(() => getMesoForMicro(trainingsPlan.mesos, route.params.micro ?? 1)?.id);
  const lockedMeso = getSortedMesos(trainingsPlan.mesos).find((meso) => meso.id === lockedMesoId) ?? getMesoForMicro(trainingsPlan.mesos, micro);
  const currentMeso = getMesoForMicro(trainingsPlan.mesos, micro);
  const localMicro = getLocalMicro(trainingsPlan.mesos, micro);

  const getBoundedMicro = (candidateMicro: number) => clampMicroToMeso(trainingsPlan.mesos, lockedMeso, candidateMicro);
  const showPlanEditingChrome = !showHistory && !showDone && planChromeState.mode === 'fullEdit';

  useLayoutEffect(() => {
    navigation.setOptions({
      header: (props) => (
        <TrainingsPlanHeader
          trainingsPlanName={trainingsPlanDisplayName(trainingsPlan.name)}
          mesoName={showHistory ? undefined : currentMeso?.name}
          trainingName={showHistory ? 'History' : showDone ? 'Overview' : trainingsPlan.trainingNames?.[trainingInMicro] ?? 'Training ' + trainingInMicro}
          micro={showHistory ? undefined : micro}
          localMicro={showHistory ? undefined : localMicro}
          trainingState={showHistory ? undefined : showDone ? undefined : training?.state}
          trainingStart={training?.start as any}
          trainingEnd={training?.state === TrainingsState.FINISHED ? (training?.end as any) : undefined}
          planMode={showPlanEditingChrome ? planChromeState.mode : 'read'}
          drawerMenu={
            showHistory
              ? <IconButton testID="history-back-icon" icon="arrow-left" iconColor={theme.colors.onSecondaryContainer} onPress={() => setShowHistory(false)} />
              : <IconButton testID="drawer-menu-button" icon="menu" iconColor={theme.colors.onSecondaryContainer} onPress={() => setOpen((prevOpen) => !prevOpen)} />
          }
          overflowButton={
            showPlanEditingChrome
              ? (
                <Button
                  mode="contained"
                  compact
                  testID="header-plan-done-button"
                  onPress={planChromeState.exitToRead}
                  contentStyle={{paddingHorizontal: 9}}
                  labelStyle={{fontSize: 13, fontWeight: '600'}}
                >
                  Done
                </Button>
              )
              : !showHistory && !showDone && training !== undefined
              ? <IconButton testID="header-overflow-icon" icon="dots-vertical" iconColor={overflowVisible ? theme.colors.primary : theme.colors.onSecondaryContainer} onPress={() => setOverflowVisible(true)} />
              : null
          }
        />
      ),
    });
  });

  const handleValueChange = (newValue: any) => {
    setShowHistory(false);
    setPlanChromeState(createDefaultPlanChromeState());
    switch (newValue) {
      case 'micro - 1': {
        setMicro((prev) => getBoundedMicro(prev - 1));
        break;
      }
      case 'micro + 1': {
        setMicro((prev) => getBoundedMicro(prev + 1));
        break;
      }
      default:
        break;
    }
    setRerender(Math.random());
  };

  return (
    <Drawer
      drawerStyle={{backgroundColor: theme.colors.background}}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      drawerType={'front'}
      swipeEnabled={!showHistory}
      renderDrawerContent={() => (
        <TrainingsPlanDrawer
          trainingsPlan={trainingsPlan}
          micro={micro}
          changeTrainingsName={changeTrainingsName}
          theme={theme}
          handleValueChange={handleValueChange}
          setTrainingInMicro={setTrainingInMicro}
          setMicro={(m) => {
            setMicro(m);
            setLockedMesoId(getMesoForMicro(trainingsPlan.mesos, m)?.id);
            setRerender(Math.random());
          }}
          setOpen={setOpen}
          setShowDone={handleSetShowDone}
          showDone={showDone}
          setShowHistory={setShowHistory}
          onAddMeso={() => addMeso(trainingsPlan.id!!, trainingsPlan)}
          onEditMeso={(mesoId, name) => editMeso(trainingsPlan.id!!, mesoId, name)}
          onDeleteMeso={(mesoId) => deleteMeso(trainingsPlan.id!!, mesoId)}
        />
      )}
    >
      {showHistory ? (
        <TrainingHistoryCalendar
          currentPlan={trainingsPlan}
          onNavigateToTraining={(targetPlan, targetMicro, targetTrainingInMicro) => {
            setShowHistory(false);
            if (targetPlan.id === trainingsPlan.id) {
              setMicro(targetMicro);
              setTrainingInMicro(targetTrainingInMicro);
              setShowDone(false);
              setRerender(Math.random());
            } else {
              navigation.push('TrainingPlan', {
                trainingsPlan: targetPlan,
                micro: targetMicro,
                training: targetTrainingInMicro,
              });
            }
          }}
        />
      ) : (
        <RangeSwiper
          key={rerender}
          ignoreSwipe={ignoreSwipeLocations}
          fillViewport
          nodeFunction={(value, setRange) => (
            <TrainingsPlanNode
              trainingsPlan={trainingsPlan}
              micro={value}
              showDone={showDone}
              trainingInMicro={trainingInMicro}
              isActive={value === micro}
              setIgnoreSwipe={(locations) => {
                locations && locations.length > 0 && setIgnoreSwipeLocations(locations);
              }}
              microViewMode={microViewMode}
              onMicroViewModeChange={setMicroViewMode}
              microSortMode={microSortMode}
              onMicroSortModeChange={setMicroSortMode}
              analysisDataMode={analysisDataMode}
              onAnalysisDataModeChange={setAnalysisDataMode}
              overflowVisible={overflowVisible && value === micro}
              onCloseOverflow={() => setOverflowVisible(false)}
              onPlanChromeChange={value === micro ? setPlanChromeState : undefined}
              requestedSubTab={value === micro ? route.params.subTab : undefined}
            />
          )}
          determineValueByIndex={(index, currentMicro) => {
            return getBoundedMicro(currentMicro + index);
          }}
          startValue={micro}
          onUpdateCurrentIndex={(index) => {
            setMicro((currentMicro) => getBoundedMicro(currentMicro + index));
          }}
        />
      )}
    </Drawer>
  );
};

export type Props = NativeStackScreenProps<RootStackParamList, 'TrainingPlan'>;

export default TrainingsPlanTab;
