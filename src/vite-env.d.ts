/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare global {
  interface Document {
    startViewTransition?: (callback: () => void | Promise<void>) => ViewTransition;
  }

  interface ViewTransition {
    finished: Promise<void>;
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
    skipTransition(): void;
  }

  interface DeviceOrientationEvent {
    webkitCompassHeading?: number;
    webkitCompassAccuracy?: number;
  }

  interface DeviceOrientationEventConstructor {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  }
}

export {};
