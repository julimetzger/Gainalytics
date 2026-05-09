import React, {useState} from 'react';
import {ScrollView, View} from 'react-native';
import AddWorkout from '../../Workout/add/AddWorkout';
import DatePicker from '../../picker/date/DatePicker';
import {Exercise} from '../../../models/entities/Exercise';
import {useNavigation} from '@react-navigation/native';

interface Props {
  exercise: Exercise;
}

const ExerciseLogTab = ({exercise}: Props) => {
  const navigation = useNavigation<any>();
  const [date, setDate] = useState(new Date(Date.now()));

  return (
    <ScrollView keyboardShouldPersistTaps="handled" testID="exercise-log-tab">
      <View style={{flexDirection: 'row', justifyContent: 'center', paddingVertical: 6}}>
        <DatePicker date={date} setDate={setDate} />
      </View>
      <AddWorkout
        exercise={exercise}
        onSubmit={() => navigation.navigate({name: 'Exercises', params: undefined})}
        suggest
        date={date}
      />
    </ScrollView>
  );
};

export default ExerciseLogTab;
