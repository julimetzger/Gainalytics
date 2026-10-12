import React, {useCallback} from 'react';
import {CommonActions, NavigationContainerRefWithCurrent} from '@react-navigation/native';
import {ProgramTemplate} from '../../models/ProgramTemplate';
import {TrainingsPlan} from '../../models/entities/TrainingsPlan';
import {useShouldShowOnboarding} from '../../redux/settings/use/useShouldShowOnboarding';
import {dispatchCompleteOnboarding} from '../../redux/settings/dispatch/dispatchOnboarding';
import {dispatchCreatePlanFromTemplate} from '../../redux/Training/dispatch/general/dispatchCreatePlanFromTemplate';
import OnboardingFlow from './OnboardingFlow';

interface OnboardingGateProps {
  navigationRef: NavigationContainerRefWithCurrent<any>;
}

/**
 * GH-497: shows the onboarding over the whole app on a first start without data
 * (or when reopened from the Settings) and routes its final choices into the
 * existing flows: a template opens the new plan's first training, "empty plan"
 * the add-plan dialog, "import" the Settings import.
 */
const OnboardingGate = ({navigationRef}: OnboardingGateProps) => {
  const visible = useShouldShowOnboarding();
  const completeOnboarding = dispatchCompleteOnboarding();
  const createPlanFromTemplate = dispatchCreatePlanFromTemplate();

  // Addressed to the bottom tabs explicitly: the Settings tab's stack has a screen
  // named "Settings" too, and while it is focused a plain navigate('Settings', …)
  // would be handled by that stack and hand it the nested params object as-is.
  const navigateInTab = useCallback(
    (tab: string, screen: string, params: object, initial = true) => {
      const root = navigationRef.isReady() ? navigationRef.getRootState() : undefined;
      if (!root) return;
      navigationRef.dispatch({...CommonActions.navigate(tab, {screen, params, initial}), target: root.key});
    },
    [navigationRef],
  );

  const handleTemplate = useCallback(
    (template: ProgramTemplate) => {
      const planId = createPlanFromTemplate(template);
      completeOnboarding();
      // The plan screen reads the plan from the store by this id.
      const trainingsPlan = {id: planId} as TrainingsPlan;
      navigateInTab('Training', 'TrainingPlan', {trainingsPlan, micro: 1, training: 1, subTab: 'train'}, false);
    },
    [completeOnboarding, createPlanFromTemplate, navigateInTab],
  );

  const handleEmptyPlan = useCallback(() => {
    completeOnboarding();
    navigateInTab('Training', 'TrainingHome', {openNewPlan: true});
  }, [completeOnboarding, navigateInTab]);

  const handleImport = useCallback(() => {
    completeOnboarding();
    navigateInTab('Settings', 'Settings', {openImport: true});
  }, [completeOnboarding, navigateInTab]);

  if (!visible) return null;
  return <OnboardingFlow onSkip={completeOnboarding} onCreateFromTemplate={handleTemplate} onEmptyPlan={handleEmptyPlan} onImport={handleImport} />;
};

export default OnboardingGate;
