const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

function androidEnvironment() {
  if (process.platform !== 'win32') return process.env;
  const env = { ...process.env };
  const sdkCandidates = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT,
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Android', 'Sdk'),
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Android', 'Android', 'Sdk')];
  const sdk = sdkCandidates.find(p => p && fs.existsSync(path.join(p, 'platform-tools', 'adb.exe')));
  if (!sdk) throw new Error('Android SDK bulunamadı. Android Studio kurulumunda SDK ve Platform Tools bileşenlerini yükle.');
  const studios = [];
  try {
    const command = "Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' -ErrorAction SilentlyContinue | Where-Object DisplayName -EQ 'Android Studio' | ForEach-Object { $_.DisplayIcon } | ConvertTo-Json -Compress";
    const raw = execFileSync('powershell.exe', ['-NoProfile', '-Command', command], { encoding: 'utf8', windowsHide: true }).trim();
    if (raw) for (const icon of [JSON.parse(raw)].flat()) {
      if (typeof icon === 'string') studios.push(path.dirname(path.dirname(icon.replace(/,\s*-?\d+$/, '').replace(/^"|"$/g, ''))));
    }
  } catch { /* Standard paths remain available if registry access is unavailable. */ }
  const javaCandidates = [env.JAVA_HOME, ...studios.map(p => path.join(p, 'jbr')),
    path.join(path.parse(root).root, 'android studio', 'jbr'),
    path.join(path.parse(root).root, 'Android Studio', 'jbr'),
    env.ProgramFiles && path.join(env.ProgramFiles, 'Android', 'Android Studio', 'jbr'),
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs', 'Android Studio', 'jbr')];
  const java = javaCandidates.find(p => p && fs.existsSync(path.join(p, 'bin', 'javac.exe')));
  if (!java) throw new Error('JDK bulunamadı. Android Studio içindeki jbr klasörünü JAVA_HOME olarak ayarla veya JDK 17+ kur.');
  env.ANDROID_HOME = sdk; env.ANDROID_SDK_ROOT = sdk; env.JAVA_HOME = java;
  env.PATH = [path.join(java, 'bin'), path.join(sdk, 'platform-tools'), path.join(sdk, 'emulator'), env.PATH || env.Path].join(path.delimiter);
  env.GRADLE_USER_HOME ||= path.join(root, '.tools', 'gradle');
  env.ANDROID_USER_HOME ||= path.join(root, '.android-home');
  return env;
}

function run(binary, args, env) {
  const result = spawnSync(binary, args, { cwd: root, env, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

try {
  require('./patch-gradle.cjs');
  const env = androidEnvironment();
  if (process.argv.includes('--doctor')) {
    console.log(`Android SDK: ${env.ANDROID_HOME || '(system)'}`);
    console.log(`Java: ${env.JAVA_HOME || '(system)'}`);
    const platforms = env.ANDROID_HOME && path.join(env.ANDROID_HOME, 'platforms');
    if (platforms && fs.existsSync(platforms)) console.log(`SDK platformları: ${fs.readdirSync(platforms).join(', ')}`);
    console.log('Bu proje derleme için Android SDK 36 kullanır.');
    process.exit(0);
  }
  const preview = process.argv.includes('--preview');
  if (preview) env.NODE_ENV = 'production';
  if (process.argv.includes('--build-only') || preview) {
    run(process.execPath, [path.join(root, 'node_modules', 'expo', 'bin', 'cli'), 'prebuild', '--platform', 'android', '--no-install'], env);
    // Invoke the generated wrapper without constructing a shell command from paths.
    if (process.platform === 'win32') {
      run('powershell.exe', ['-NoProfile', '-Command', preview
        ? "& './android/gradlew.bat' '-p' './android' ':app:assembleRelease' '--no-daemon' '--max-workers=2' '-PreactNativeArchitectures=arm64-v8a'; exit $LASTEXITCODE"
        : "& './android/gradlew.bat' '-p' './android' ':app:assembleDebug' '--no-daemon' '--max-workers=2' '-PreactNativeArchitectures=arm64-v8a,x86_64'; exit $LASTEXITCODE"], env);
    } else {
      run(path.join(root, 'android', 'gradlew'), ['-p', path.join(root, 'android'), preview ? ':app:assembleRelease' : ':app:assembleDebug', '--no-daemon', '--max-workers=2', preview ? '-PreactNativeArchitectures=arm64-v8a' : '-PreactNativeArchitectures=arm64-v8a,x86_64'], env);
    }
    const apk = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', preview ? 'release' : 'debug', preview ? 'app-release.apk' : 'app-debug.apk');
    if (preview) {
      const artifacts = path.join(root, 'artifacts'); fs.mkdirSync(artifacts, { recursive: true });
      const target = path.join(artifacts, 'acb-atolyesi-preview.apk'); fs.copyFileSync(apk, target);
      const hash = require('node:crypto').createHash('sha256').update(fs.readFileSync(target)).digest('hex');
      fs.writeFileSync(`${target}.sha256`, `${hash}  acb-atolyesi-preview.apk\n`);
      console.log(`Metro gerektirmeyen ARM64 deneme APK'sı (geliştirme imzası): ${target}\nSHA256: ${hash}`);
    } else console.log(`Android APK: ${apk}`);
  } else {
    // Reapply .env-based network settings before installing the development app.
    run(process.execPath, [path.join(root, 'node_modules', 'expo', 'bin', 'cli'), 'prebuild', '--platform', 'android', '--no-install'], env);
    run(process.execPath, [path.join(root, 'node_modules', 'expo', 'bin', 'cli'), 'run:android', ...process.argv.slice(2)], env);
  }
} catch (error) { console.error(`Android başlatılamadı: ${error.message}`); process.exit(1); }
