declare module 'react-native-fast-tflite' {
  export type TensorflowModelDelegate = 'default' | 'metal' | 'core-ml' | 'nnapi';

  export interface TensorflowModel {
    run: (inputs: ArrayBuffer[]) => Promise<ArrayBuffer[]>;
    runSync?: (inputs: ArrayBuffer[]) => ArrayBuffer[];
  }

  export interface UseTensorflowModelResult {
    state: 'loading' | 'loaded' | 'error';
    model: TensorflowModel | null;
    error?: Error;
  }

  export function useTensorflowModel(
    source: number | { uri: string },
    delegates?: TensorflowModelDelegate[]
  ): UseTensorflowModelResult;

  export function loadTensorflowModel(
    source: number | { uri: string },
    delegate?: TensorflowModelDelegate
  ): Promise<TensorflowModel>;
}
