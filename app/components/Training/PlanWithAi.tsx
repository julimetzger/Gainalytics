import React, {useCallback, useEffect, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, HelperText, Text, TextInput, useTheme} from 'react-native-paper';
import Toast from 'react-native-toast-message';
import {usePlanFromAi} from '../../redux/Training/dispatch/plan/usePlanFromAi';
import {useAlleExercises} from '../../redux/Exercises/use/useAllExercises';
import {useAiProvider} from '../../redux/settings/use/useAiProvider';
import {useAnthropicModel} from '../../redux/settings/use/useAnthropicModel';
import {useChatGptModel} from '../../redux/settings/use/useChatGptModel';
import {secureStorage} from '../../utils/secureStorage';
import {buildAiPlanContext, buildAiPlanPrompt} from '../../utils/ai/planTraining/aiPlanContext';
import {describeAiPlan, parseAiPlanAnswer} from '../../utils/ai/planTraining/aiPlanResult';
import {describeAiPlanError, requestAiPlan} from '../../utils/ai/planTraining/requestAiPlan';
import {MULTILINE_INFO_TOAST, MultilineInfoToastProps} from '../common/toastConfig';

interface PlanWithAiProps {
  trainingsPlanId: number;
  trainingInMicro: number;
  micro: number;
}

function readAnthropicKey(): string | undefined {
  try {
    return secureStorage.getAnthropicApiKey();
  } catch {
    return undefined;
  }
}

/**
 * GH-544: "Plan with AI" — the user describes today's changes to the last training at this
 * position in free text; the AI's result is planned directly (like the suggest buttons).
 */
const PlanWithAi = ({trainingsPlanId, trainingInMicro, micro}: PlanWithAiProps) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const {base, planTraining} = usePlanFromAi(trainingsPlanId, trainingInMicro, micro);
  const theme = useTheme();
  const exercises = useAlleExercises();
  const provider = useAiProvider();
  const anthropicModel = useAnthropicModel();
  const chatgptModel = useChatGptModel();

  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);

  const handleChangeText = useCallback((value: string) => {
    setText(value);
    setError(undefined);
  }, []);

  const handlePlan = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(undefined);

    const prompt = buildAiPlanPrompt(buildAiPlanContext(base, exercises, text));
    const result = await requestAiPlan(
      {provider, anthropicApiKey: readAnthropicKey(), anthropicModel, chatgptModel},
      prompt,
      text,
      controller.signal,
    );
    if (controller.signal.aborted) return;
    requestRef.current = null;
    setLoading(false);

    if (!result.ok) {
      setError(describeAiPlanError(result.error));
      return;
    }
    const parsed = parseAiPlanAnswer(result.text, exercises);
    if (!parsed.ok) {
      setError([parsed.error, ...parsed.dropped].join('\n'));
      return;
    }
    planTraining(parsed.plan.exercises);
    Toast.show({
      type: MULTILINE_INFO_TOAST,
      text1: 'Planned with AI',
      text2: describeAiPlan(parsed.plan),
      position: 'top',
      visibilityTime: 8000,
      props: {accentColor: theme.colors.primary} satisfies MultilineInfoToastProps,
    });
  }, [anthropicModel, base, chatgptModel, exercises, planTraining, provider, text, theme.colors.primary]);

  const hasBase = base.length > 0;

  return (
    <View style={styles.container} testID="plan-with-ai">
      <Text variant="titleSmall">Plan with AI</Text>
      <TextInput
        mode="outlined"
        label="Changes for today"
        placeholder="e.g. RIR −1 on everything"
        value={text}
        onChangeText={handleChangeText}
        multiline
        disabled={!hasBase || loading}
        testID="plan-with-ai-input"
      />
      <Button
        mode="outlined"
        icon="creation"
        onPress={handlePlan}
        loading={loading}
        disabled={!hasBase || loading || text.trim() === ''}
        testID="plan-with-ai-button"
      >
        {loading ? 'Planning…' : 'Plan with AI'}
      </Button>
      {!hasBase && (
        <HelperText type="info" testID="plan-with-ai-no-base">
          No previous training at this position to start from.
        </HelperText>
      )}
      {error !== undefined && (
        <HelperText type="error" testID="plan-with-ai-error">
          {error}
        </HelperText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
});

export default PlanWithAi;
