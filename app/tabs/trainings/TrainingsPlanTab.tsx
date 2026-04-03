import React, {useState} from 'react';
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
import {LayoutRectangle} from 'react-native';
import {getMesoForMicro, getLocalMicro, getMesoEndMicro} from '../../redux/Training/trainingsPlanReducer';
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
  const [ignoreSwipeLocations, setIgnoreSwipeLocations] = useState<LayoutRectangle[]>([]);

  let changeTrainingsName = dispatchChangeTrainingsName();
  let addMeso = dispatchAddMeso();
  let editMeso = dispatchEditMeso();
  let deleteMeso = dispatchDeleteMeso();
  let theme = useTheme();

  const [lockedMeso, setLockedMeso] = useState(() => getMesoForMicro(trainingsPlan.mesos, route.params.micro ?? 1));
  const mesoEndMicro = getMesoEndMicro(trainingsPlan.mesos, lockedMeso);
  const currentMeso = getMesoForMicro(trainingsPlan.mesos, micro);
  const localMicro = getLocalMicro(trainingsPlan.mesos, micro);

  navigation.setOptions({
    header: (props) => (
      <TrainingsPlanHeader
        trainingsPlanName={trainingsPlan.name}
        mesoName={currentMeso?.name}
        trainingName={showDone ? 'Overview' : trainingsPlan.trainingNames?.[trainingInMicro] ?? 'Training ' + trainingInMicro}
        micro={micro}
        localMicro={localMicro}
        mode={showDone ? 'Overview' : training?.state}
        drawerMenu={<IconButton testID="icon-menu" icon="menu" iconColor={theme.colors.onSecondaryContainer} onPress={() => setOpen((prevOpen) => !prevOpen)}></IconButton>}
      />
    ),
  });

  const handleValueChange = (newValue: any) => {
    switch (newValue) {
      case 'micro - 1': {
        const prev = micro - 1;
        if (!lockedMeso || prev >= lockedMeso.startMicro) setMicro(prev);
        break;
      }
      case 'micro + 1': {
        const next = micro + 1;
        if (!lockedMeso || mesoEndMicro === undefined || next <= mesoEndMicro) setMicro(next);
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
            setLockedMeso(getMesoForMicro(trainingsPlan.mesos, m));
            setRerender(Math.random());
          }}
          setOpen={setOpen}
          setShowDone={setShowDone}
          showDone={showDone}
          onAddMeso={() => addMeso(trainingsPlan.id!!, trainingsPlan)}
          onEditMeso={(mesoId, name) => editMeso(trainingsPlan.id!!, mesoId, name)}
          onDeleteMeso={(mesoId) => deleteMeso(trainingsPlan.id!!, mesoId)}
        />
      )}
    >
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
            setIgnoreSwipe={(locations) => {
              locations && locations.length > 0 && setIgnoreSwipeLocations(locations);
            }}
          />
        )}
        determineValueByIndex={(index, currentMicro) => {
          const next = currentMicro + index;
          if (lockedMeso) {
            if (next < lockedMeso.startMicro) return lockedMeso.startMicro;
            if (mesoEndMicro !== undefined && next > mesoEndMicro) return mesoEndMicro;
          }
          return next;
        }}
        startValue={micro}
        onUpdateCurrentIndex={(index) => {
          setMicro(micro + index);
        }}
      />
    </Drawer>
  );
};

export type Props = NativeStackScreenProps<RootStackParamList, 'TrainingPlan'>;

export default TrainingsPlanTab;
