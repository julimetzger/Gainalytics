import {View} from "react-native";
import {Text, useTheme} from "react-native-paper";
import React from "react";
import {Comparison} from "./WorkoutSetOverview";

interface MetricComparisonProps {
    comparison: Comparison
}

const MetricView = ({comparison}: MetricComparisonProps) => {
    const greater = comparison.difference!! >= 0;
    const theme=useTheme()
    return <View style={{display: 'flex', alignItems: 'flex-end'}}>
        {comparison?.difference !== undefined &&
            <Text
                style={{color: comparison.difference!! === 0
                    ? theme.colors.onSurface
                    : greater
                    ? '#558b2f' // green
                    : theme.colors.error
              }}>
              {(greater ? '+' : '') + comparison.difference!!.toFixed(2)}
            </Text>
        }
        <Text>{comparison?.value?.toFixed(2)}</Text>
    </View>;
}

export default MetricView;
