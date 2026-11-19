// Compression d'une photo dans le navigateur, avant de la ranger dans db.json.
// Le site n'a pas de serveur : chaque photo voyage dans le fichier de données,
// donc on la réduit (côté le plus long ≤ 640 px) et on la ré-encode en JPEG.
// Une photo de téléphone de 3–5 Mo devient ainsi ~40–80 Ko.

const COTE_MAX = 640;
const CIBLE_OCTETS = 90 * 1024;

function charger(fichier) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Ce format d'image n'est pas lisible par le navigateur. Essayez une photo JPEG ou PNG."));
    };
    img.src = url;
  });
}

// Taille approximative en octets d'une data URL base64.
export function taille(dataUrl) {
  const i = dataUrl.indexOf(',');
  return Math.round(((dataUrl.length - i - 1) * 3) / 4);
}

export function libelleTaille(dataUrl) {
  return `${Math.max(1, Math.round(taille(dataUrl) / 1024))} Ko`;
}

export async function compresser(fichier) {
  if (!fichier || !/^image\//.test(fichier.type || 'image/')) throw new Error("Ce fichier n'est pas une image.");
  const img = await charger(fichier);
  const echelle = Math.min(1, COTE_MAX / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const l = Math.max(1, Math.round((img.naturalWidth || img.width) * echelle));
  const h = Math.max(1, Math.round((img.naturalHeight || img.height) * echelle));
  const canvas = Object.assign(document.createElement('canvas'), { width: l, height: h });
  const ctx = canvas.getContext('2d');
  // Fond blanc : un PNG transparent ne doit pas devenir noir en JPEG.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, l, h);
  ctx.drawImage(img, 0, 0, l, h);
  let qualite = 0.78;
  let url = canvas.toDataURL('image/jpeg', qualite);
  while (taille(url) > CIBLE_OCTETS && qualite > 0.45) {
    qualite -= 0.1;
    url = canvas.toDataURL('image/jpeg', qualite);
  }
  return url;
}
