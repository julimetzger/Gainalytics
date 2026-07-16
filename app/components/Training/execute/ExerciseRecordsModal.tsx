import React from 'react';
import {Exercise} from '../../../models/entities/Exercise';
import ExerciseOneRmRecordsTable from '../../exercise/show/ExerciseOneRmRecordsTable';
import EditDialogScaffold from '../../common/EditDialogScaffold';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  exercise: Exercise;
}

const ExerciseRecordsModal = ({visible, onDismiss, exercise}: Props) => {
  return (
    <EditDialogScaffold
      visible={visible}
      onDismiss={onDismiss}
      title={`Records: ${exercise.name}`}
      testID="exercise-records-modal"
      dismissTestID="exercise-records-close"
      scrollable
      maxHeightRatio={0.7}
    >
      <ExerciseOneRmRecordsTable exercise={exercise} emptyTestID="exercise-records-empty" />
    </EditDialogScaffold>
  );
};

export default ExerciseRecordsModal;
