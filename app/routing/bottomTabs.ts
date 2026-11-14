/**
 * GH-693: label and icon of every bottom tab. The tab navigator and the onboarding's
 * "find your way around" card both read them from here, so the intro always shows the
 * same icons as the nav bar.
 */
export interface BottomTabMeta {
  label: string;
  icon: string;
}

export const BOTTOM_TABS = {
  training: {label: 'Training', icon: 'book-open-variant'},
  exercises: {label: 'Exercises', icon: 'weight-lifter'},
  analyse: {label: 'Analysis', icon: 'trending-up'},
  settings: {label: 'Settings', icon: 'cog'},
} satisfies Record<string, BottomTabMeta>;
