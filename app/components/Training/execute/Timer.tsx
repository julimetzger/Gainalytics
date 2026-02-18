import {StyleSheet, View} from 'react-native';
import React, {useEffect, useState} from 'react';
import {Card, Text, useTheme} from 'react-native-paper';
import {Exercise} from '../../../models/entities/Exercise';

interface TimerProps {
  start: Date;
  label?: string;
  reset?: boolean;
  exercise?: Exercise;
  children?: ((elapasedTimeInSeconds: number) => void)[];
  onReset?: (() => void)[];
}

const Timer = ({start, label, reset = false, children, onReset}: TimerProps) => {
  const [sarted, setSarted] = useState(start);
  const [date, setDate] = useState(new Date(Date.now()));
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
    setDate(new Date(Date.now()));
  };
  useEffect(() => {
    let interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setSarted(start);
    setDate(start);
  }, [start]);

  children && children.forEach((func) => func(new Date(new Date(date).getTime() - new Date(sarted).getTime()).getTime() / 1000));
  return (
    <View>
      <Card
        key={Math.random()}
        onPress={() => {
          if (reset) {
            setSarted(new Date(Date.now()));
            setDate(new Date(Date.now()));
            onReset && onReset.forEach((func) => func());
          }
        }}
      >
        <Card.Content>
          {label && <Text style={{fontSize: theme.fonts.labelSmall.fontSize}}>{label}</Text>}
          <Text style={stylesheet.textstyle}>{new Date(new Date(date).getTime() - new Date(sarted).getTime()).toISOString().substring(11, 19)}</Text>
        </Card.Content>
      </Card>
    </View>
  );
};

export default Timer;
