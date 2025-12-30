import { createWorker } from 'tesseract.js';

export class OCRService {
  private static worker: any = null;

  static async initialize() {
    if (!this.worker) {
      this.worker = await createWorker('fra+eng');
    }
    return this.worker;
  }

  static async extractTextFromImage(imageDataUrl: string): Promise<string> {
    const worker = await this.initialize();
    const { data: { text } } = await worker.recognize(imageDataUrl);
    return text;
  }

  static parseLabelText(text: string): {
    designation: string;
    weight?: string;
    price?: string;
    pricePerKg?: string;
    ean?: string;
  } {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    
    // Désignation : généralement les premières lignes en majuscules
    const designation = lines
      .slice(0, 3)
      .filter(line => line.length > 5 && /[A-Z]/.test(line))
      .join(' ')
      .substring(0, 100) || lines[0] || '';

    // Poids : format "500g", "1kg", "500 g", etc.
    const weightMatch = text.match(/(\d+[,\.]?\d*)\s*(g|kg|cl|l|ml)/i);
    const weight = weightMatch ? `${weightMatch[1]}${weightMatch[2].toLowerCase()}` : undefined;

    // Prix total : format "29,99 €" ou "29.99€"
    const priceMatch = text.match(/(\d+[,\.]\d{2})\s*€/i);
    const price = priceMatch ? `${priceMatch[1].replace('.', ',')} €` : undefined;

    // Prix au kg : format "59.98 €/kg"
    const pricePerKgMatch = text.match(/(\d+[,\.]\d{2})\s*€\/kg/i);
    const pricePerKg = pricePerKgMatch 
      ? `${pricePerKgMatch[1].replace('.', ',')} €/kg` 
      : undefined;

    // EAN : 13 chiffres consécutifs
    const eanMatch = text.replace(/\s/g, '').match(/\d{13}/);
    const ean = eanMatch ? eanMatch[0] : undefined;

    return {
      designation: designation.trim(),
      weight,
      price,
      pricePerKg,
      ean
    };
  }

  static async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

