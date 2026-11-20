// Compression d'une photo dans le navigateur, avant de la ranger dans db.json.
// Le site n'a pas de serveur : chaque photo voyage dans le fichier de données,
// donc on la réduit et on la ré-encode en JPEG. Une photo de téléphone de
// 3–5 Mo devient ainsi ~40–80 Ko. Le recadrage (recadrage.js) passe par ici.

export const SORTIE = { largeur: 640, hauteur: 480 }; // format 4:3 des avis de décès
const COTE_MAX = 640;
const CIBLE_OCTETS = 90 * 1024;

export function charger(fichier) {
  if (!fichier || !/^image\//.test(fichier.type || 'image/')) return Promise.reject(new Error("Ce fichier n'est pas une image."));
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

// Nouveau canevas sur fond blanc (un PNG transparent ne doit pas devenir noir en JPEG).
export function canevas(l, h) {
  const c = Object.assign(document.createElement('canvas'), { width: l, height: h });
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, l, h);
  ctx.imageSmoothingQuality = 'high';
  return c;
}

// Encode un canevas en JPEG, en baissant la qualité jusqu'à passer sous la cible.
export function encoder(c) {
  let qualite = 0.78;
  let url = c.toDataURL('image/jpeg', qualite);
  while (taille(url) > CIBLE_OCTETS && qualite > 0.45) {
    qualite -= 0.1;
    url = c.toDataURL('image/jpeg', qualite);
  }
  return url;
}

// Compression sans recadrage : photo entière, côté le plus long ≤ 640 px.
export async function compresser(fichier) {
  const img = await charger(fichier);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const echelle = Math.min(1, COTE_MAX / Math.max(w, h));
  const c = canevas(Math.max(1, Math.round(w * echelle)), Math.max(1, Math.round(h * echelle)));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return encoder(c);
}
