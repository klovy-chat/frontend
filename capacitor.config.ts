import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.klovy.chat",
  appName: "Klovy Chat",
  webDir: "dist",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#101114",
      showSpinner: false,
    },
    Keyboard: {
      resize: "body",
    },
  },
};

export default config;
