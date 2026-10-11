import React, {useCallback, useEffect, useState} from 'react';
import {BackHandler, ScrollView, StyleSheet, View} from 'react-native';
import {Button, Text, useTheme} from 'react-native-paper';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ProgramTemplate} from '../../models/ProgramTemplate';
import {PROGRAM_TEMPLATES} from '../../constants/programTemplates';
import {RirStep, WelcomeStep} from './OnboardingIntroSteps';
import {StartStep, TemplateStep} from './OnboardingStartSteps';

export interface OnboardingFlowProps {
  onSkip: () => void;
  onCreateFromTemplate: (template: ProgramTemplate) => void;
  onEmptyPlan: () => void;
  onImport: () => void;
}

/** Welcome → RIR → start choice; the template list is a sub-step of the start choice. */
const STEP_COUNT = 3;
const TEMPLATE_STEP = 3;

/**
 * GH-497: the first-start onboarding. Purely presentational — the gate decides
 * when it shows and what the final choices do.
 */
const OnboardingFlow = ({onSkip, onCreateFromTemplate, onEmptyPlan, onImport}: OnboardingFlowProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [templateId, setTemplateId] = useState(PROGRAM_TEMPLATES[0].id);

  const back = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

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

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background, paddingTop: insets.top, paddingBottom: insets.bottom}]}
      testID="onboarding-screen"
    >
      <View style={styles.header}>
        <Text variant="labelLarge" style={{color: theme.colors.onSurfaceVariant}} testID="onboarding-step-indicator">
          {step < TEMPLATE_STEP ? `Step ${step + 1} of ${STEP_COUNT}` : 'Templates'}
        </Text>
        <Button onPress={onSkip} testID="onboarding-skip">
          Skip
        </Button>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {step === 0 && <WelcomeStep />}
        {step === 1 && <RirStep />}
        {step === 2 && <StartStep onTemplate={() => setStep(TEMPLATE_STEP)} onEmptyPlan={onEmptyPlan} onImport={onImport} />}
        {step === TEMPLATE_STEP && <TemplateStep selectedId={templateId} onSelect={(t) => setTemplateId(t.id)} />}
      </ScrollView>
      <View style={styles.footer}>
        <Button onPress={back} disabled={step === 0} testID="onboarding-back" style={step === 0 && styles.hidden}>
          Back
        </Button>
        <View style={styles.dots} pointerEvents="none">
          {Array.from({length: STEP_COUNT}, (_, i) => (
            <View
              key={i}
              style={[styles.dot, {backgroundColor: i === Math.min(step, STEP_COUNT - 1) ? theme.colors.primary : theme.colors.outlineVariant}]}
            />
          ))}
        </View>
        {step < 2 && (
          <Button mode="contained" onPress={() => setStep(step + 1)} testID="onboarding-next">
            Next
          </Button>
        )}
        {step === 2 && <View style={styles.footerSpacer} />}
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
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 24, paddingRight: 8, paddingTop: 8},
  content: {paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24},
  footer: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12},
  hidden: {opacity: 0},
  // Centred on the screen, independent of the buttons left and right of it.
  dots: {...StyleSheet.absoluteFillObject, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8},
  dot: {width: 8, height: 8, borderRadius: 4},
  footerSpacer: {width: 88},
});

export default OnboardingFlow;
