import React, {useState, useCallback} from 'react';
import {ViewMode} from './MicroOverviewTraining';
import {BackHandler} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {IconButton, useTheme} from 'react-native-paper';
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

const TrainingsPlanTab = ({navigation, route}: Props) => {
  const trainingsPlan = useTrainingsPlan(route.params.trainingsPlan.id!!);
  const [open, setOpen] = useState(false);
  const [micro, setMicro] = useState(route.params.micro ?? 1);
  const [trainingInMicro, setTrainingInMicro] = useState(route.params.training ?? 1);
  const training = useTrainingInTrainingsPlan(route.params.trainingsPlan.id!!, micro, trainingInMicro);
  const [rerender, setRerender] = useState(Math.random());
  const [overview, setOverview] = useState(true);
  let [showPlanned, setShowPlanned] = useState(false);
  let [showDone, setShowDone] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [ignoreSwipeLocations, setIgnoreSwipeLocations] = useState<LayoutRectangle[]>([]);
  const [microViewMode, setMicroViewMode] = useState<ViewMode>('gesamt');

  let changeTrainingsName = dispatchChangeTrainingsName();
  let addMeso = dispatchAddMeso();
  let editMeso = dispatchEditMeso();
  let deleteMeso = dispatchDeleteMeso();
  let theme = useTheme();

  // Android hardware back closes the calendar instead of leaving the screen.
  // Scoped to screen focus so the listener doesn't bleed into other tabs.
  useFocusEffect(
    useCallback(() => {
      if (!showHistory) return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setShowHistory(false);
        return true; // consume the event
      });
      return () => sub.remove();
    }, [showHistory]),
  );

  const [lockedMesoId, setLockedMesoId] = useState(() => getMesoForMicro(trainingsPlan.mesos, route.params.micro ?? 1)?.id);
  const lockedMeso = getSortedMesos(trainingsPlan.mesos).find((meso) => meso.id === lockedMesoId) ?? getMesoForMicro(trainingsPlan.mesos, micro);
  const currentMeso = getMesoForMicro(trainingsPlan.mesos, micro);
  const localMicro = getLocalMicro(trainingsPlan.mesos, micro);

  const getBoundedMicro = (candidateMicro: number) => clampMicroToMeso(trainingsPlan.mesos, lockedMeso, candidateMicro);

  navigation.setOptions({
    header: (props) => (
      <TrainingsPlanHeader
        trainingsPlanName={trainingsPlan.name}
        mesoName={showHistory ? undefined : currentMeso?.name}
        trainingName={showHistory ? 'History' : showDone ? 'Overview' : trainingsPlan.trainingNames?.[trainingInMicro] ?? 'Training ' + trainingInMicro}
        micro={showHistory ? undefined : micro}
        localMicro={showHistory ? undefined : localMicro}
        mode={showHistory ? 'History' : showDone ? 'Overview' : training?.state}
        drawerMenu={
          showHistory
            ? <IconButton testID="history-back-icon" icon="arrow-left" iconColor={theme.colors.onSecondaryContainer} onPress={() => setShowHistory(false)} />
            : <IconButton testID="drawer-menu-button" icon="menu" iconColor={theme.colors.onSecondaryContainer} onPress={() => setOpen((prevOpen) => !prevOpen)} />
        }
      />
    ),
  });

  const handleValueChange = (newValue: any) => {
    setShowHistory(false);
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
          setShowPlanned={setShowPlanned}
          showPlanned={showPlanned}
          setTrainingInMicro={setTrainingInMicro}
          setMicro={(m) => {
            setMicro(m);
            setLockedMesoId(getMesoForMicro(trainingsPlan.mesos, m)?.id);
            setRerender(Math.random());
          }}
          setOpen={setOpen}
          setShowDone={setShowDone}
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
          nodeFunction={(value, setRange) => (
            <TrainingsPlanNode
              trainingsPlan={trainingsPlan}
              micro={value}
              showPlanned={showPlanned}
              overview={overview}
              setOverview={setOverview}
              showDone={showDone}
              trainingInMicro={trainingInMicro}
              isActive={value === micro}
              setIgnoreSwipe={(locations) => {
                locations && locations.length > 0 && setIgnoreSwipeLocations(locations);
              }}
              microViewMode={microViewMode}
              onMicroViewModeChange={setMicroViewMode}
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
