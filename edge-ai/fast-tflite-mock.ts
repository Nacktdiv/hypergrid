export type TensorflowModelDelegate = 'default' | 'metal' | 'core-ml' | 'nnapi';

/**
 * Fallback mock when react-native-fast-tflite native module is not installed
 * (e.g. running in Expo Go or development environment without dev-client build).
 */
export function useTensorflowModel() {
  return {
    state: 'error' as const,
    model: null,
    error: new Error(
      'react-native-fast-tflite requires a development build (expo run:android / expo run:ios) and is not available in Expo Go. The app will use the calibrated Z-peak sensor detection pipeline.'
    ),
  };
}
