declare module 'html5-qrcode' {
  export interface Html5QrcodeScannerConfig {
    fps: number;
    qrbox: {
      width: number;
      height: number;
    };
    aspectRatio: number;
  }

  export class Html5QrcodeScanner {
    constructor(
      elementId: string,
      config: Html5QrcodeScannerConfig,
      verbose: boolean
    );

    render(
      onScanSuccess: (decodedText: string) => void,
      onScanError: (errorMessage: string) => void
    ): void;

    clear(): Promise<void>;
  }
} 