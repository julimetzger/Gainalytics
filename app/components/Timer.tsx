import {StyleSheet, View} from "react-native";
import React, {useEffect, useState} from "react";
import {Card, Text, useTheme} from "react-native-paper";

interface TimerProps {
    start: Date
}

const Timer = ({start}: TimerProps) => {
    const [date, setDate] = useState(new Date(Date.now()))
    let theme = useTheme();
    const stylesheet = StyleSheet.create({

        textstyle: {
            textAlign: 'center',
            justifyContent: 'center',

            fontSize: theme.fonts.bodyMedium.fontSize,
            fontWeight: 'bold',
        },
    });
    const update = () => {
        setDate(new Date(Date.now()))
    };
    useEffect(() => {
        setInterval(update, 1000);
    });
    useEffect(() => {
    }, [start]);
    return (
        <View>
            <Card key={Math.random()}>
                <Text style={stylesheet.textstyle}>
                    {new Date(new Date(date).getTime() - new Date(start).getTime()).toISOString().substr(11, 8)}
                </Text>
            </Card>
        </View>
    );
}


export default Timer;
