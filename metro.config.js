const path = require('path');
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');
 
const config = getDefaultConfig(__dirname);

// Allow Metro to bundle .tflite model assets for react-native-fast-tflite
config.resolver.assetExts.push('tflite');

let hasFastTflite = false;
try {
  require.resolve('react-native-fast-tflite');
  hasFastTflite = true;
} catch {}

if (!hasFastTflite) {
  config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    'react-native-fast-tflite': path.resolve(__dirname, 'edge-ai/fast-tflite-mock.ts'),
  };
}

module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });