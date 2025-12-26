import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

admin.initializeApp();

// Configuration de l'email via les variables d'environnement Firebase
const getEmailConfig = () => {
  const config = functions.config().email;
  if (!config) {
    throw new Error('Email configuration not found. Run: firebase functions:config:set email.user="..." email.password="..." email.to="..."');
  }
  return config;
};

// Créer le transporteur email
const createTransporter = () => {
  const emailConfig = getEmailConfig();
  
  return nodemailer.createTransport({
    service: 'gmail', // Vous pouvez changer pour 'outlook', 'yahoo', etc.
    auth: {
      user: emailConfig.user,
      pass: emailConfig.password // Utiliser un mot de passe d'application Gmail
    }
  });
};

// Normaliser une date Firebase
const normalizeDate = (date: any): Date => {
  if (date && date.toDate) {
    return date.toDate();
  }
  if (date && date.seconds) {
    return new Date(date.seconds * 1000);
  }
  if (date instanceof Date) {
    return date;
  }
  return new Date(date);
};

// Fonction planifiée qui vérifie les produits expirants et envoie un email
export const checkExpiringProducts = functions.pubsub
  .schedule('0 6 * * *') // Tous les jours à 6h00 (UTC)
  .timeZone('Europe/Paris')
  .onRun(async (context) => {
    console.log('Démarrage de la vérification des produits expirants...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    try {
      // Récupérer tous les produits
      const productsRef = admin.firestore().collection('products');
      const snapshot = await productsRef.get();
      
      const expiringProducts: Array<{
        name: string;
        brand: string;
        expiryDate: string;
        daysUntilExpiry: number;
      }> = [];
      
      snapshot.forEach((doc) => {
        const product = doc.data();
        const expiryDate = normalizeDate(product.expiryDate);
        expiryDate.setHours(0, 0, 0, 0);
        
        const daysUntilExpiry = Math.floor(
          (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        // Produits expirant aujourd'hui ou dans les 3 prochains jours
        if (daysUntilExpiry >= -1 && daysUntilExpiry <= 3) {
          expiringProducts.push({
            name: product.name || 'Produit sans nom',
            brand: product.brand || 'Marque inconnue',
            expiryDate: expiryDate.toISOString().split('T')[0],
            daysUntilExpiry
          });
        }
      });
      
      // Si des produits expirent, envoyer un email
      if (expiringProducts.length > 0) {
        const emailConfig = getEmailConfig();
        const transporter = createTransporter();
        
        const productListHtml = expiringProducts.map(p => {
          const status = p.daysUntilExpiry < 0 
            ? '<span style="color: red; font-weight: bold;">PÉRIMÉ</span>' 
            : p.daysUntilExpiry === 0 
            ? '<span style="color: orange; font-weight: bold;">AUJOURD\'HUI</span>'
            : `<span style="color: orange;">Dans ${p.daysUntilExpiry} jour(s)</span>`;
          
          return `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">
                <strong>${p.name}</strong><br>
                <small style="color: #666;">${p.brand}</small>
              </td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">
                ${p.expiryDate}
              </td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">
                ${status}
              </td>
            </tr>
          `;
        }).join('');
        
        const mailOptions = {
          from: `"DLC Watcher" <${emailConfig.user}>`,
          to: emailConfig.to,
          subject: `DLC Watcher - ${expiringProducts.length} produit(s) à consommer`,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="UTF-8">
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background-color: #000; color: white; padding: 20px; text-align: center; }
                  .content { background-color: #f9f9f9; padding: 20px; }
                  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                  th { background-color: #000; color: white; padding: 12px; text-align: left; }
                  .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                  .button { display: inline-block; padding: 12px 24px; background-color: #000; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>DLC Watcher</h1>
                  </div>
                  <div class="content">
                    <h2>Produits à consommer</h2>
                    <p>Vous avez <strong>${expiringProducts.length}</strong> produit(s) qui expire(nt) bientôt :</p>
                    
                    <table>
                      <thead>
                        <tr>
                          <th>Produit</th>
                          <th>Date d'expiration</th>
                          <th>Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${productListHtml}
                      </tbody>
                    </table>
                    
                    <div style="text-align: center;">
                      <a href="https://dlc-watcher.vercel.app" class="button">Voir dans l'application</a>
                    </div>
                  </div>
                  <div class="footer">
                    <p>Cet email a été envoyé automatiquement par DLC Watcher</p>
                    <p>Vous recevez cet email car vous avez des produits qui expirent dans les prochains jours.</p>
                  </div>
                </div>
              </body>
            </html>
          `,
          text: `
DLC Watcher - Produits à consommer

Vous avez ${expiringProducts.length} produit(s) qui expire(nt) bientôt :

${expiringProducts.map(p => {
  const status = p.daysUntilExpiry < 0 
    ? 'PÉRIMÉ' 
    : p.daysUntilExpiry === 0 
    ? 'AUJOURD\'HUI'
    : `Dans ${p.daysUntilExpiry} jour(s)`;
  return `- ${p.name} (${p.brand}) - Expire le ${p.expiryDate} - ${status}`;
}).join('\n')}

Voir dans l'application: https://dlc-watcher.vercel.app
          `
        };
        
        await transporter.sendMail(mailOptions);
        console.log(`✅ Email envoyé avec succès pour ${expiringProducts.length} produit(s)`);
        
        return {
          success: true,
          productsCount: expiringProducts.length,
          message: `Email envoyé pour ${expiringProducts.length} produit(s)`
        };
      } else {
        console.log('ℹ️ Aucun produit n\'expire dans les prochains jours');
        return {
          success: true,
          productsCount: 0,
          message: 'Aucun produit à notifier'
        };
      }
    } catch (error: any) {
      console.error('❌ Erreur lors de la vérification des produits:', error);
      throw new functions.https.HttpsError(
        'internal',
        `Erreur lors de l'envoi de l'email: ${error.message}`
      );
    }
  });

// Fonction HTTP pour tester manuellement
export const testEmail = functions.https.onRequest(async (req, res) => {
  console.log('Test d\'envoi d\'email...');
  
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const productsRef = admin.firestore().collection('products');
    const snapshot = await productsRef.get();
    
    const expiringProducts: Array<{
      name: string;
      brand: string;
      expiryDate: string;
      daysUntilExpiry: number;
    }> = [];
    
    snapshot.forEach((doc) => {
      const product = doc.data();
      const expiryDate = normalizeDate(product.expiryDate);
      expiryDate.setHours(0, 0, 0, 0);
      
      const daysUntilExpiry = Math.floor(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysUntilExpiry >= -1 && daysUntilExpiry <= 3) {
        expiringProducts.push({
          name: product.name || 'Produit sans nom',
          brand: product.brand || 'Marque inconnue',
          expiryDate: expiryDate.toISOString().split('T')[0],
          daysUntilExpiry
        });
      }
    });
    
    if (expiringProducts.length > 0) {
      const emailConfig = getEmailConfig();
      const transporter = createTransporter();
      
      const mailOptions = {
        from: `"DLC Watcher" <${emailConfig.user}>`,
        to: emailConfig.to,
        subject: `[TEST] DLC Watcher - ${expiringProducts.length} produit(s) à consommer`,
        html: `<h2>Test d'email</h2><p>${expiringProducts.length} produit(s) trouvé(s)</p>`,
        text: `Test: ${expiringProducts.length} produit(s) trouvé(s)`
      };
      
      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: 'Email de test envoyé', productsCount: expiringProducts.length });
    } else {
      res.json({ success: true, message: 'Aucun produit expirant trouvé', productsCount: 0 });
    }
  } catch (error: any) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

