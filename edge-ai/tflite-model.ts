import {
  useTensorflowModel,
  type TensorflowModelDelegate,
} from 'react-native-fast-tflite';
import { EDGE_AI_CONFIG, getConfidenceTier } from './model-config';

const CPU_DELEGATES: TensorflowModelDelegate[] = [];

/**
 * Hook untuk memuat model hg_model_v2.tflite dan menjalankan inferensi.
 * Model ini diload sekali dan di-cache oleh react-native-fast-tflite.
 *
 * Input : Float32Array panjang 47 (dari feature-extractor.ts)
 * Output: float32 [1,1] → probabilitas pothole (0–1)
 */
export function useTfliteModel() {
  const model = useTensorflowModel(
    require('@/assets/models/hg_model_v2.tflite'),
    CPU_DELEGATES
  );

  const isReady = model.state === 'loaded' && model.model != null;
  const isLoading = model.state === 'loading';

  /**
   * Menjalankan inferensi satu kali pada 47 fitur yang sudah diekstraksi.
   * Pastikan `features` adalah Float32Array dengan panjang tepat 47.
   */
  const predict = async (
    features: Float32Array
  ): Promise<{
    isPothole: boolean;
    probability: number;
    confidence: number;
    confidenceTier: 'HIGH' | 'MEDIUM' | 'LOW';
  }> => {
    if (!isReady || !model.model) {
      throw new Error('[TFLite] Model belum dimuat — tunggu isReady = true.');
    }
    if (features.length !== 47) {
      throw new Error(
        `[TFLite] Input harus tepat 47 fitur, diterima ${features.length}.`
      );
    }

    // Jalankan inferensi — input mengharapkan ArrayBuffer[] berukuran tepat 47 * 4 byte
    const inputBuffer = features.buffer.slice(
      features.byteOffset,
      features.byteOffset + features.byteLength
    ) as ArrayBuffer;
    const outputs = await model.model.run([inputBuffer]);

    // Parse output buffer float32 (dukung ArrayBuffer maupun TypedArray view)
    const rawOutput = outputs?.[0] as ArrayBuffer | Float32Array | undefined;
    const outputFloats = !rawOutput
      ? new Float32Array(0)
      : ArrayBuffer.isView(rawOutput)
      ? new Float32Array(
          rawOutput.buffer,
          rawOutput.byteOffset,
          Math.floor(rawOutput.byteLength / 4)
        )
      : new Float32Array(rawOutput);
    const probability = outputFloats[0] ?? 0;

    const isPothole = probability >= EDGE_AI_CONFIG.optimalThreshold;
    const { confidenceScore, confidenceTier } = getConfidenceTier(probability);

    return {
      isPothole,
      probability,
      confidence: confidenceScore,
      confidenceTier,
    };
  };

  return {
    predict,
    isReady,
    isLoading,
    error: model.state === 'error' ? model.error : undefined,
    modelState: model.state,
  };
}
