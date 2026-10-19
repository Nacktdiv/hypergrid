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

// Deduplicate react and react-native for pnpm symlink resolution
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === 'react-native' ||
    moduleName.startsWith('react-native/') ||
    moduleName === 'react' ||
    moduleName.startsWith('react/')
  ) {
    try {
      return context.resolveRequest(
        {
          ...context,
          originModulePath: path.join(__dirname, 'package.json'),
        },
        moduleName,
        platform
      );
    } catch {
      // Fallback to default resolution
    }
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });