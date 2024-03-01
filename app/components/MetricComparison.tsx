import {View} from "react-native";
import {Text} from "react-native-paper";
import React from "react";
import {Comparison} from "./WorkoutSetOverview";

interface MetricComparisonProps {
    comparison: Comparison
}

const MetricView = ({comparison}: MetricComparisonProps) => {
    const greater = comparison.difference!! >= 0;
    return <View style={{display: 'flex', alignItems: 'flex-end'}}>
        {comparison?.difference !== undefined &&
            <Text
                style={{color: greater ? '#558b2f' : '#b22222'}}>
                {(greater ? "+" : "") + comparison.difference!!.toFixed(2)}
            </Text>
        }


        <Text>{comparison?.value?.toFixed(2)}</Text>
    </View>;
}

export default MetricView;
