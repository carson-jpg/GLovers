export default {
  appId: 'com.galyan.glovers',
  appName: 'GLovers',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowInsecureConnections: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: "#ffffff",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#FF6B6B",
      splashFullScreen: true,
      splashImmersive: true,
      layoutName: "launch_screen",
      useDialog: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#ffffff",
    },
    HttpServerPlugin: {
      enabled: true
    }
  },
  android: {
    buildOptions: {
      keystorePath: "",
      keystorePassword: "",
      keystoreAlias: "",
      keystoreAliasPassword: "",
      releaseType: "APK",
      signingType: "apksigner",
      overrideUserAgent: "GLovers Android App",
    },
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,
    networkSecurityConfig: "@xml/network_security_config"
  }
};