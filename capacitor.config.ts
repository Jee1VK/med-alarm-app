import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.medclock.app',
  appName: 'MedClock',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      iconColor: '#0369A1',
      sound: 'medclock_alarm.wav',
    },
  },
};

export default config;
