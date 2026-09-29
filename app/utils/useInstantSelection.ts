import {useCallback, useOptimistic, useTransition} from 'react';

/**
 * PERF-003: makes a selection control answer a tap at once, however long the content
 * below it takes to follow.
 *
 * The tapped value is shown right away (optimistic state, committed on its own, before
 * anything heavy), while the real change — usually a state update up in a screen that
 * re-renders a lot — runs as a transition right behind it. When the transition has
 * landed, `value` carries the same selection and the optimistic layer disappears; if the
 * owner refuses or changes the value the control falls back to what the owner says.
 *
 * Keep the hook in a small component that holds only the control — the optimistic render
 * re-renders that component, and it must not drag the slow content along.
 */
export function useInstantSelection<T>(value: T, onChange: (next: T) => void): [T, (next: T) => void] {
  const [shown, setShown] = useOptimistic(value);
  const [, startTransition] = useTransition();
  const select = useCallback(
    (next: T) => {
      startTransition(() => {
        setShown(next);
        onChange(next);
      });
    },
    [onChange, setShown],
  );
  return [shown, select];
}
