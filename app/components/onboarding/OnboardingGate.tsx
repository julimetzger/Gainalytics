import React, {useCallback} from 'react';
import {NavigationContainerRefWithCurrent} from '@react-navigation/native';
import {ProgramTemplate} from '../../models/ProgramTemplate';
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

  const handleTemplate = useCallback(
    (template: ProgramTemplate) => {
      const plan = createPlanFromTemplate(template);
      completeOnboarding();
      if (plan && navigationRef.isReady()) {
        navigationRef.navigate('Training', {
          screen: 'TrainingPlan',
          initial: false,
          params: {trainingsPlan: plan, micro: 1, training: 1, subTab: 'train'},
        });
      }
    },
    [completeOnboarding, createPlanFromTemplate, navigationRef],
  );

  const handleEmptyPlan = useCallback(() => {
    completeOnboarding();
    if (navigationRef.isReady()) {
      navigationRef.navigate('Training', {screen: 'TrainingHome', params: {openNewPlan: true}});
    }
  }, [completeOnboarding, navigationRef]);

  const handleImport = useCallback(() => {
    completeOnboarding();
    if (navigationRef.isReady()) {
      navigationRef.navigate('Settings', {screen: 'Settings', params: {openImport: true}});
    }
  }, [completeOnboarding, navigationRef]);

  if (!visible) return null;
  return <OnboardingFlow onSkip={completeOnboarding} onCreateFromTemplate={handleTemplate} onEmptyPlan={handleEmptyPlan} onImport={handleImport} />;
};

export default OnboardingGate;
