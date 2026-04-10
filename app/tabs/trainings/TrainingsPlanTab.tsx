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
import TrainingHistoryCalendar from '../../components/Training/analyse/TrainingHistoryCalendar';
import {LayoutRectangle} from 'react-native';

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

  let changeTrainingsName = dispatchChangeTrainingsName();
  let theme = useTheme();

  navigation.setOptions({
    header: (props) => (
      <TrainingsPlanHeader
        trainingsPlanName={trainingsPlan.name}
        trainingName={showDone ? 'Overview' : trainingsPlan.trainingNames?.[trainingInMicro] ?? 'Training ' + trainingInMicro}
        micro={micro}
        mode={showDone ? 'Overview' : training?.state}
        drawerMenu={<IconButton icon="menu" iconColor={theme.colors.onSecondaryContainer} onPress={() => setOpen((prevOpen) => !prevOpen)}></IconButton>}
      />
    ),
  });
  const handleValueChange = (newValue: any) => {
    switch (newValue) {
      case 'micro - 1':
        setMicro(micro - 1);
        break;
      case 'micro + 1':
        setMicro(micro + 1);
        break;
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
          setOpen={setOpen}
          setShowDone={setShowDone}
          showDone={showDone}
          setShowHistory={setShowHistory}
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
            } else {
              navigation.navigate('TrainingPlan', {
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
              setIgnoreSwipe={(locations) => {
                locations && locations.length > 0 && setIgnoreSwipeLocations(locations);
              }}
            />
          )}
          determineValueByIndex={(index, micro) => micro + index}
          startValue={micro}
          onUpdateCurrentIndex={(index) => {
            setMicro(micro + index);
          }}
        />
      )}
    </Drawer>
  );
};

export type Props = NativeStackScreenProps<RootStackParamList, 'TrainingPlan'>;

export default TrainingsPlanTab;
