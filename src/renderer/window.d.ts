export {};

declare global {
  interface Window {
    orb: {
      toggleFloat: () => Promise<void>;
      floatNavigate: (url: string) => Promise<void>;
      onOpenUrl: (callback: (url: string) => void) => void;
      platform: string;
    };
  }
}
