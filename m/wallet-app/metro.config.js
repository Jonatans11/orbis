/**
 * Metro config — wires the @orbis/wallet-core shared package (m/core) into the
 * app bundle straight from its TypeScript source.
 *
 * m/core is a pure-TS ESM package whose published entry points at dist/, but in
 * the monorepo we bundle its src/ directly: Metro transpiles TS itself, and the
 * package's ESM-style `./x.js` relative imports are rewritten to the matching
 * `.ts` source files below.
 */
const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const config = getDefaultConfig(__dirname);

const coreRoot = path.resolve(__dirname, '..', 'core');
const coreSrc = path.join(coreRoot, 'src');

config.watchFolders = [...(config.watchFolders ?? []), coreRoot];
config.resolver.nodeModulesPaths = [
  path.join(__dirname, 'node_modules'),
  path.join(coreRoot, 'node_modules'),
];

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Bare package → m/core source entry.
  if (moduleName === '@orbis/wallet-core') {
    return { type: 'sourceFile', filePath: path.join(coreSrc, 'index.ts') };
  }
  // Deep imports → matching source module.
  if (moduleName.startsWith('@orbis/wallet-core/')) {
    const sub = moduleName
      .slice('@orbis/wallet-core/'.length)
      .replace(/\.js$/, '');
    return { type: 'sourceFile', filePath: path.join(coreSrc, `${sub}.ts`) };
  }
  // Inside m/core: ESM-style `./module.js` specifiers point at `.ts` sources.
  if (
    context.originModulePath.startsWith(coreSrc) &&
    moduleName.startsWith('.') &&
    moduleName.endsWith('.js')
  ) {
    const tsPath = path.resolve(
      path.dirname(context.originModulePath),
      moduleName.replace(/\.js$/, '.ts'),
    );
    if (fs.existsSync(tsPath)) {
      return { type: 'sourceFile', filePath: tsPath };
    }
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
