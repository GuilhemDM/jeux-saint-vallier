// Recadrage d'une photo avant import. Le cadre a le format 4:3 des avis de
// décès : ce qui est visible dans le cadre est exactement ce qui apparaîtra
// sur la carte. On déplace la photo en la glissant (souris ou doigt), on
// zoome avec le curseur, la molette ou en pinçant, et on peut la pivoter.
// recadrer(fichier) ouvre la fenêtre et rend une data URL JPEG 640×480,
// ou null si l'on annule.
import { charger, canevas, encoder, SORTIE } from './photo.js';
import { el, modale } from './ui.js';

const RATIO = SORTIE.largeur / SORTIE.hauteur;
const SOURCE_MAX = 2000; // la source est réduite une fois pour rester fluide
const ZOOM_MAX = 4;

const borne = (x, a, b) => Math.min(b, Math.max(a, x));

function reduire(img) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const e = Math.min(1, SOURCE_MAX / Math.max(w, h));
  const c = Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.round(w * e)), height: Math.max(1, Math.round(h * e)) });
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

function pivoter(src) {
  const c = Object.assign(document.createElement('canvas'), { width: src.height, height: src.width });
  const ctx = c.getContext('2d');
  ctx.translate(c.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(src, 0, 0);
  return c;
}

export async function recadrer(fichier) {
  let src = reduire(await charger(fichier));
  // État : zoom z (1 = la photo couvre juste le cadre) et centre (cx, cy) en
  // pixels de la source.
  let z = 1;
  let cx = src.width / 2;
  let cy = src.height / 2;

  const couverture = () => (src.width / src.height > RATIO ? [src.height * RATIO, src.height] : [src.width, src.width / RATIO]);
  const visible = () => {
    const [cw, ch] = couverture();
    return [cw / z, ch / z];
  };
  function borner() {
    z = borne(z, 1, ZOOM_MAX);
    const [sw, sh] = visible();
    cx = borne(cx, sw / 2, src.width - sw / 2);
    cy = borne(cy, sh / 2, src.height - sh / 2);
  }
  function dessiner(ctx, w, h) {
    const [sw, sh] = visible();
    ctx.drawImage(src, cx - sw / 2, cy - sh / 2, sw, sh, 0, 0, w, h);
  }

  const corps = el(`<div class="recadrage">
    <div class="recadrage-cadre" data-cadre tabindex="0" aria-label="Zone de recadrage : glissez pour déplacer la photo">
      <canvas data-vue></canvas>
    </div>
    <div class="recadrage-zoom">
      <span aria-hidden="true">−</span>
      <input type="range" min="1" max="${ZOOM_MAX}" step="0.01" value="1" data-zoom aria-label="Zoom">
      <span aria-hidden="true">+</span>
    </div>
    <div class="recadrage-outils">
      <button type="button" class="btn ghost sm" data-pivoter>↻ Pivoter</button>
      <button type="button" class="btn ghost sm" data-recentrer>Recentrer</button>
    </div>
    <p class="note">Glissez la photo pour la déplacer ; zoomez avec le curseur, la molette ou en pinçant.
      Le cadre montre exactement ce qui apparaîtra sur l'avis de décès.</p>
  </div>`);

  const cadre = corps.querySelector('[data-cadre]');
  const vue = corps.querySelector('[data-vue]');
  const zoom = corps.querySelector('[data-zoom]');

  let image = null;
  function redessiner() {
    if (image) return;
    image = requestAnimationFrame(() => {
      image = null;
      const ctx = vue.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, vue.width, vue.height);
      ctx.imageSmoothingQuality = 'high';
      dessiner(ctx, vue.width, vue.height);
    });
  }
  function ajuster() {
    const l = cadre.clientWidth;
    if (!l) return;
    const dpr = window.devicePixelRatio || 1;
    vue.width = Math.round(l * dpr);
    vue.height = Math.round((l / RATIO) * dpr);
    redessiner();
  }
  // Zoom en gardant fixe le point de la photo situé en (fx, fy) du cadre (0–1).
  function zoomer(nz, fx = 0.5, fy = 0.5) {
    const [sw, sh] = visible();
    const px = cx - sw / 2 + fx * sw;
    const py = cy - sh / 2 + fy * sh;
    z = borne(nz, 1, ZOOM_MAX);
    const [nw, nh] = visible();
    cx = px - fx * nw + nw / 2;
    cy = py - fy * nh + nh / 2;
    borner();
    zoom.value = String(z);
    redessiner();
  }
  function deplacer(dx, dy) {
    const [sw, sh] = visible();
    const l = cadre.clientWidth || 1;
    cx -= (dx * sw) / l;
    cy -= (dy * sh) / (l / RATIO);
    borner();
    redessiner();
  }

  // Glisser (un pointeur) ou pincer (deux pointeurs).
  const pointeurs = new Map();
  let ecartPrecedent = 0;
  const ecart = () => {
    const [a, b] = [...pointeurs.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  cadre.addEventListener('pointerdown', (e) => {
    cadre.setPointerCapture?.(e.pointerId);
    pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointeurs.size === 2) ecartPrecedent = ecart();
  });
  cadre.addEventListener('pointermove', (e) => {
    const p = pointeurs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointeurs.size === 1) deplacer(dx, dy);
    else if (pointeurs.size === 2) {
      const d = ecart();
      if (ecartPrecedent > 0) zoomer(z * (d / ecartPrecedent));
      ecartPrecedent = d;
    }
  });
  const lacher = (e) => {
    pointeurs.delete(e.pointerId);
    ecartPrecedent = pointeurs.size === 2 ? ecart() : 0;
  };
  cadre.addEventListener('pointerup', lacher);
  cadre.addEventListener('pointercancel', lacher);
  cadre.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const r = cadre.getBoundingClientRect();
      zoomer(z * Math.exp(-e.deltaY * 0.0015), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    },
    { passive: false }
  );
  cadre.addEventListener('keydown', (e) => {
    const pas = e.shiftKey ? 40 : 10;
    const actions = {
      ArrowLeft: () => deplacer(pas, 0),
      ArrowRight: () => deplacer(-pas, 0),
      ArrowUp: () => deplacer(0, pas),
      ArrowDown: () => deplacer(0, -pas),
      '+': () => zoomer(z * 1.1),
      '=': () => zoomer(z * 1.1),
      '-': () => zoomer(z / 1.1),
    };
    if (actions[e.key]) {
      e.preventDefault();
      actions[e.key]();
    }
  });
  zoom.addEventListener('input', () => zoomer(Number(zoom.value)));
  corps.querySelector('[data-pivoter]').addEventListener('click', () => {
    src = pivoter(src);
    z = 1;
    cx = src.width / 2;
    cy = src.height / 2;
    zoom.value = '1';
    redessiner();
  });
  corps.querySelector('[data-recentrer]').addEventListener('click', () => {
    z = 1;
    cx = src.width / 2;
    cy = src.height / 2;
    zoom.value = '1';
    redessiner();
  });

  return new Promise((resolve) => {
    let observateur = null;
    modale({
      titre: 'Recadrer la photo',
      corps,
      actions: [
        { libelle: 'Annuler', classe: 'ghost', action: (f) => f() },
        {
          libelle: 'Valider le recadrage',
          classe: 'brass',
          action: (fermer) => {
            const sortie = canevas(SORTIE.largeur, SORTIE.hauteur);
            dessiner(sortie.getContext('2d'), sortie.width, sortie.height);
            resolve(encoder(sortie));
            fermer();
          },
        },
      ],
      surFermeture: () => {
        observateur?.disconnect();
        resolve(null); // sans effet si déjà validé
      },
    });
    if (window.ResizeObserver) {
      observateur = new ResizeObserver(ajuster);
      observateur.observe(cadre);
    }
    requestAnimationFrame(ajuster);
  });
}
