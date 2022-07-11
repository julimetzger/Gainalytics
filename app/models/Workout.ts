type Workout = {
  id?: number
  sets: WorkoutSet[];
  notes: String;
  exerciseId: number;
  start?: Date;
  end?: Date;
};
