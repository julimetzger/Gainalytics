import React from 'react';
import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {RootStackParamList} from "../../routing/AnalyseRouter";
import {Text} from "react-native";

const GraphsTab = () => {
    return (
        <Text>
            Graphs
        </Text>
    )
}

export default GraphsTab;

export type Props = NativeStackScreenProps<RootStackParamList, 'Graphs'>;
