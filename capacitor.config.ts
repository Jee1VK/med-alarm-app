import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.medclock.app',
  appName: 'MedClock',
  webDir: 'dist',
  server: {
    // Loads the live GitHub Pages app so UI/logic updates arrive seamlessly without reinstalling the APK
    url: 'https://jee1vk.github.io/med-alarm-app/',
    cleartext: false,
  },
  plugins: {
    LocalNotifications: {
      iconColor: '#0369A1',
      sound: 'medclock_alarm.wav',
    },
  },
};

export default config;
