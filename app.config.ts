import type { ConfigContext, ExpoConfig } from 'expo/config';

// URL publique de la version web : sert aux liens d'invitation et aux universal links iOS.
const webUrl = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '') || undefined;
const webHost = webUrl ? new URL(webUrl).host : undefined;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Vadrouille',
  slug: 'vadrouille',
  description: 'Vadrouille — On part où ? Le week-end qui met tout le monde d’accord.',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'vadrouille',
  userInterfaceStyle: 'light',
  backgroundColor: '#FFF4E6',
  ios: {
    bundleIdentifier: 'com.projetlicorne.vadrouille',
    supportsTablet: false,
    // Universal links : actifs dès que EXPO_PUBLIC_WEB_URL pointe vers le domaine qui sert
    // /.well-known/apple-app-site-association (voir public/.well-known et le README).
    associatedDomains: webHost ? [`applinks:${webHost}`] : [],
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.projetlicorne.vadrouille',
    adaptiveIcon: {
      backgroundColor: '#FFF4E6',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'single',
    favicon: './assets/images/favicon.png',
    name: 'Vadrouille — On part où ?',
    shortName: 'Vadrouille',
    backgroundColor: '#FFF4E6',
    themeColor: '#FF5B3A',
  },
  plugins: [
    webUrl ? ['expo-router', { origin: webUrl }] : 'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#FFF4E6',
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
      },
    ],
  ],
  experiments: {
    reactCompiler: true,
  },
});
