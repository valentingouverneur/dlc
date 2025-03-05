declare module 'react-barcode-reader' {
  interface BarcodeReaderProps {
    onScan: (data: string) => void;
    onError: (error: Error) => void;
    className?: string;
    style?: React.CSSProperties;
  }

  const BarcodeReader: React.FC<BarcodeReaderProps>;
  export default BarcodeReader;
} 