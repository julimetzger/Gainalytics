import React, {useState} from 'react';
import {IconButton, useTheme} from 'react-native-paper';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../routing/TrainingRouter';
import {Drawer} from 'react-native-drawer-layout';
import {useTrainingsPlan} from '../../redux/Training/useTrainingsPlan';
import {useTrainingInTrainingsPlan} from '../../redux/Training/useTrainingInTrainingsPlan';
import dispatchChangeTrainingsName from '../../redux/Training/dispatchChangeTrainingsName';
import TrainingsPlanHeader from "../../components/TrainingsPlanHeader";
import TrainingsPlanDrawer from "../../components/TrainingsPlanDrawer";
import TrainingsPlanNode from "../../components/TrainingsPlanNode";
import RangeSwiper from "../../components/RangeSwiper";
import {tr} from "react-native-paper-dates";
import {LayoutRectangle} from "react-native";


const TrainingsPlanTab = ({navigation, route}: Props) => {
    const trainingsPlan = useTrainingsPlan(route.params.trainingsPlan.id!!);
    const [open, setOpen] = useState(false);
    const [micro, setMicro] = useState(route.params.micro ?? 1);
    const [trainingInMicro, setTrainingInMicro] = useState(route.params.training ?? 1);
    const training = useTrainingInTrainingsPlan(route.params.trainingsPlan.id!!, micro, trainingInMicro);
    const [rerender, setRerender] = useState(Math.random())
    const [overview, setOverview] = useState(true);
    let [showPlanned, setShowPlanned] = useState(false);
    let [showDone, setShowDone] = useState(false);
    const [ignoreSwipeLocations, setIgnoreSwipeLocations] = useState<LayoutRectangle[]>([])

    let changeTrainingsName = dispatchChangeTrainingsName();
    let theme = useTheme();

    navigation.setOptions({
        header: (props) =>
            <TrainingsPlanHeader trainingsPlanName={trainingsPlan.name}
                                 trainingName={showDone ? 'Overview' : trainingsPlan.trainingNames?.[trainingInMicro] ?? 'Training ' + trainingInMicro}
                                 micro={micro}
                                 mode={showDone ? 'Overview' : training?.state}
                                 drawerMenu={<IconButton
                                     icon="menu"
                                     iconColor={theme.colors.onSecondaryContainer}
                                     onPress={() => setOpen((prevOpen) => !prevOpen)}>
                                 </IconButton>}/>
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
            drawerType={"front"}
            renderDrawerContent={() =>
                <TrainingsPlanDrawer trainingsPlan={trainingsPlan}
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
                />
            }
        >
            <RangeSwiper key={rerender}
                         ignoreSwipe={ignoreSwipeLocations}
                         nodeFunction={(value, setRange) => <TrainingsPlanNode trainingsPlan={trainingsPlan}
                                                                               micro={value}
                                                                               showPlanned={showPlanned}
                                                                               overview={overview}
                                                                               setOverview={setOverview}
                                                                               showDone={showDone}
                                                                               trainingInMicro={trainingInMicro}
                                                                               setIgnoreSwipe={
                                                                                   (locations) => setIgnoreSwipeLocations(locations)
                                                                               }
                         />}
                         determineValueByIndex={(index, micro) => micro + index} startValue={micro}
                         onUpdateCurrentIndex={(index) => {
                             setMicro(micro + index)
                         }}/>
        </Drawer>
    );
};

export type Props = NativeStackScreenProps<RootStackParamList, 'Training'>;

export default TrainingsPlanTab;
