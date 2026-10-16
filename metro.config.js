const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');
 
const config = getDefaultConfig(__dirname);

// Allow Metro to bundle .tflite model assets for react-native-fast-tflite
config.resolver.assetExts.push('tflite');

module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });