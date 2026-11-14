import React, {useCallback, useEffect, useState} from 'react';
import {BackHandler, ScrollView, StyleSheet, View} from 'react-native';
import {Button, Text, useTheme} from 'react-native-paper';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ProgramTemplate} from '../../models/ProgramTemplate';
import {PROGRAM_TEMPLATES} from '../../constants/programTemplates';
import {NavigationStep, OptionalStep, WelcomeStep} from './OnboardingIntroSteps';
import {StartStep, TemplateStep} from './OnboardingStartSteps';
import OnboardingPager from './OnboardingPager';

export interface OnboardingFlowProps {
  onSkip: () => void;
  onCreateFromTemplate: (template: ProgramTemplate) => void;
  onEmptyPlan: () => void;
  onImport: () => void;
}

/** Welcome → navigation → optional extras → start choice; the template list is a sub-step of the start choice. */
const STEP_COUNT = 4;
const START_STEP = 3;
const TEMPLATE_STEP = 4;

/**
 * GH-497 / GH-693: the first-start onboarding. Purely presentational — the gate decides
 * when it shows and what the final choices do. The four steps are swipeable cards.
 */
const OnboardingFlow = ({onSkip, onCreateFromTemplate, onEmptyPlan, onImport}: OnboardingFlowProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [templateId, setTemplateId] = useState(PROGRAM_TEMPLATES[0].id);

  const back = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);
  const next = useCallback(() => setStep((s) => Math.min(START_STEP, s + 1)), []);
  const openTemplates = useCallback(() => setStep(TEMPLATE_STEP), []);

  // Hardware back walks the steps; on the first one it does nothing, so the
  // screens behind the onboarding never navigate unseen.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => subscription.remove();
  }, [back]);

  const createPlan = () => {
    const template = PROGRAM_TEMPLATES.find((t) => t.id === templateId);
    if (template) onCreateFromTemplate(template);
  };

  const isStart = step === START_STEP;
  const activeDot = Math.min(step, STEP_COUNT - 1);

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background, paddingTop: insets.top, paddingBottom: insets.bottom}]}
      testID="onboarding-screen"
    >
      <View style={styles.header}>
        <Text variant="labelLarge" style={{color: theme.colors.onSurfaceVariant}} testID="onboarding-step-indicator">
          {step < TEMPLATE_STEP ? `Step ${step + 1} of ${STEP_COUNT}` : 'Templates'}
        </Text>
        {/* On the start choice Skip moves into the footer as the highlighted button. */}
        {!isStart && (
          <Button onPress={onSkip} testID="onboarding-skip">
            Skip
          </Button>
        )}
      </View>
      {step === TEMPLATE_STEP ? (
        <ScrollView contentContainerStyle={styles.content}>
          <TemplateStep selectedId={templateId} onSelect={(t) => setTemplateId(t.id)} />
        </ScrollView>
      ) : (
        <OnboardingPager page={step} onPageChange={setStep}>
          {[
            <WelcomeStep key="welcome" />,
            <NavigationStep key="navigation" />,
            <OptionalStep key="optional" />,
            <StartStep key="start" onTemplate={openTemplates} onEmptyPlan={onEmptyPlan} onImport={onImport} />,
          ]}
        </OnboardingPager>
      )}
      <View style={styles.footer}>
        <Button onPress={back} disabled={step === 0} testID="onboarding-back" style={step === 0 && styles.hidden}>
          Back
        </Button>
        <View style={styles.dots} pointerEvents="none">
          {Array.from({length: STEP_COUNT}, (_, i) => (
            <View
              key={i}
              testID={`onboarding-dot-${i}`}
              accessibilityState={{selected: i === activeDot}}
              style={[styles.dot, {backgroundColor: i === activeDot ? theme.colors.primary : theme.colors.outlineVariant}]}
            />
          ))}
        </View>
        {step < START_STEP && (
          <Button mode="contained" onPress={next} testID="onboarding-next">
            Next
          </Button>
        )}
        {isStart && (
          <Button mode="contained" icon="arrow-right" contentStyle={styles.skipContent} onPress={onSkip} testID="onboarding-skip">
            Skip
          </Button>
        )}
        {step === TEMPLATE_STEP && (
          <Button mode="contained" onPress={createPlan} testID="onboarding-create-plan">
            Create plan
          </Button>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {...StyleSheet.absoluteFillObject, zIndex: 10, elevation: 10},
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, paddingLeft: 24, paddingRight: 8, paddingTop: 8},
  content: {paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24},
  footer: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12},
  hidden: {opacity: 0},
  // Centred on the screen, independent of the buttons left and right of it.
  dots: {...StyleSheet.absoluteFillObject, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8},
  dot: {width: 8, height: 8, borderRadius: 4},
  // Icon after the label: "Skip →".
  skipContent: {flexDirection: 'row-reverse'},
});

export default OnboardingFlow;
