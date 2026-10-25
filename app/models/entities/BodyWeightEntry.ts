export interface BodyWeightEntry {
  id: number;
  /** Local start of the day (epoch ms) the weight was measured on. */
  date: number;
  weightKg: number;
  note?: string;
}
