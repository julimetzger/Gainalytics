/**
 * `@types/node` (pulled in transitively by the jest types) declares a minimal `AbortSignal`
 * carrying only `aborted`, and it wins over the fuller declaration in `@types/react-native`.
 * At runtime React Native polyfills `AbortSignal` with the `abort-controller` package, whose
 * signal is a real EventTarget — so these listeners do exist. Merge them back into the
 * global interface instead of casting at every call site.
 */
interface AbortSignal {
  addEventListener(type: 'abort', listener: () => void): void;
  removeEventListener(type: 'abort', listener: () => void): void;
}
