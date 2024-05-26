import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {RootStackParamList} from "../../routing/AnalyseRouter";
import React from "react";
import {Text} from "react-native";

const MetricsTab = () => {

    return (
        <Text>
            Metrics
        </Text>
    )
}

export default MetricsTab;

export type Props = NativeStackScreenProps<RootStackParamList, 'Metrics'>;
