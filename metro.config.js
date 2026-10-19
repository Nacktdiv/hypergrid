const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');
 
const config = getDefaultConfig(__dirname);

// Ensure symlinks are enabled for pnpm node_modules structure
config.resolver.unstable_enableSymlinks = true;

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

// Deduplicate react/react-native and fix ./node_modules/* entry resolution under pnpm symlinks
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const runDefaultResolve = (ctx, modName, plat) => {
    if (defaultResolveRequest) {
      return defaultResolveRequest(ctx, modName, plat);
    }
    return ctx.resolveRequest(ctx, modName, plat);
  };

  // Android dev client requests "./node_modules/expo-router/entry" as a relative path,
  // which can fail on pnpm symlinked directories unless resolved as a package specifier.
  if (moduleName.startsWith('./node_modules/')) {
    const pkgSpecifier = moduleName.replace(/^\.\/node_modules\//, '');
    try {
      return runDefaultResolve(
        {
          ...context,
          originModulePath: path.join(__dirname, 'package.json'),
        },
        pkgSpecifier,
        platform
      );
    } catch {
      try {
        const realEntryPath = fs.realpathSync(
          require.resolve(pkgSpecifier, { paths: [__dirname] })
        );
        return {
          type: 'sourceFile',
          filePath: realEntryPath,
        };
      } catch {
        // Continue to standard fallback
      }
    }
  }

  if (
    moduleName === 'react-native' ||
    moduleName.startsWith('react-native/') ||
    moduleName === 'react' ||
    moduleName.startsWith('react/')
  ) {
    try {
      return runDefaultResolve(
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

  try {
    return runDefaultResolve(context, moduleName, platform);
  } catch (err) {
    // Fallback for pnpm symlinked packages not yet indexed under relative paths
    try {
      const originDir = context.originModulePath
        ? path.dirname(context.originModulePath)
        : __dirname;
      const resolved = fs.realpathSync(
        require.resolve(moduleName, { paths: [originDir, __dirname] })
      );
      return {
        type: 'sourceFile',
        filePath: resolved,
      };
    } catch {
      throw err;
    }
  }
};

module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });