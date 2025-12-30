import { createWorker } from 'tesseract.js';

export class OCRService {
  private static worker: any = null;

  static async initialize() {
    if (!this.worker) {
      this.worker = await createWorker('fra+eng');
      // Configurer l'OCR pour une meilleure précision
      await this.worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ€.,/-: ',
        tessedit_pageseg_mode: '6', // Assume a single uniform block of text
      });
    }
    return this.worker;
  }

  // Améliorer l'image avant OCR (contraste, netteté, niveaux de gris)
  static preprocessImage(imageDataUrl: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageDataUrl);
          return;
        }

        // Augmenter la résolution pour une meilleure précision
        const scale = 2;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Obtenir les données de l'image
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Améliorer le contraste et la netteté
        for (let i = 0; i < data.length; i += 4) {
          // Convertir en niveaux de gris
          const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
          
          // Augmenter le contraste
          const contrast = 1.5;
          const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
          let newGray = factor * (gray - 128) + 128;
          
          // Normaliser
          newGray = Math.max(0, Math.min(255, newGray));
          
          // Appliquer un filtre de netteté (unsharp mask simplifié)
          data[i] = newGray;     // R
          data[i + 1] = newGray; // G
          data[i + 2] = newGray; // B
          // Alpha reste inchangé
        }
        
        // Remettre les données modifiées
        ctx.putImageData(imageData, 0, 0);
        
        // Retourner l'image améliorée
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.onerror = () => resolve(imageDataUrl);
      img.src = imageDataUrl;
    });
  }

  static async extractTextFromImage(imageDataUrl: string): Promise<string> {
    const worker = await this.initialize();
    
    // Pré-traiter l'image pour améliorer la précision
    const processedImage = await this.preprocessImage(imageDataUrl);
    
    // Utiliser une meilleure configuration pour l'OCR
    const { data: { text } } = await worker.recognize(processedImage, {
      rectangle: undefined, // Analyser toute l'image
    });
    
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

    // EAN : 13 chiffres consécutifs (chercher dans tout le texte)
    const cleanText = text.replace(/\s/g, '');
    const eanMatch = cleanText.match(/\d{13}/);
    // Si pas trouvé, chercher aussi des séquences de 12-14 chiffres (tolérance OCR)
    const eanMatch2 = !eanMatch ? cleanText.match(/\d{12,14}/) : null;
    const ean = eanMatch 
      ? eanMatch[0] 
      : (eanMatch2 && eanMatch2[0].length === 13 ? eanMatch2[0] : undefined);

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

