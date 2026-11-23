const fs = require('node:fs');
const path = require('node:path');

// RN 0.83 ships Gradle 9 with an older Foojay resolver which references
// the removed IBM_SEMERU constant. Apply the upstream resolver fix after
// every npm install, including EAS installs. Never change unrelated settings.
// https://github.com/reactwg/react-native-releases/issues/1349
const settings = path.join(__dirname, '..', 'node_modules', '@react-native', 'gradle-plugin', 'settings.gradle.kts');
const source = fs.readFileSync(settings, 'utf8');
const old = 'id("org.gradle.toolchains.foojay-resolver-convention").version("0.5.0")';
const fixed = 'id("org.gradle.toolchains.foojay-resolver-convention").version("1.0.0")';
if (source.includes(old)) {
  fs.writeFileSync(settings, source.replace(old, fixed), 'utf8');
  console.log('React Native: applied Gradle 9 Foojay resolver compatibility fix.');
} else if (!source.includes(fixed)) {
  throw new Error('React Native Gradle settings changed. Review scripts/patch-gradle.cjs before building.');
}
