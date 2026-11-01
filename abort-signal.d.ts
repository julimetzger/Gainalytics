/**
 * `@types/node` (pulled in transitively by the jest types) declares a minimal `AbortSignal`
 * carrying only `aborted`, and it wins over the fuller declaration in react-native's own
 * `src/types/globals.d.ts` (which `fetch`'s `RequestInit.signal` uses). At runtime React Native
 * polyfills `AbortSignal` with the `abort-controller` package, whose signal is a real
 * EventTarget — so these members do exist. Merge them back into the global interface instead
 * of casting at every call site.
 */
interface AbortSignal {
  onabort: (event: AbortEvent) => void;
  addEventListener(
    type: 'abort',
    listener: (this: AbortSignal, event: any) => any,
    options?: boolean | {capture?: boolean; once?: boolean; passive?: boolean},
  ): void;
  removeEventListener(
    type: 'abort',
    listener: (this: AbortSignal, event: any) => any,
    options?: boolean | {capture?: boolean},
  ): void;
  dispatchEvent(event: Event): boolean;
}
