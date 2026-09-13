// Graphiques SVG générés à la main : aucune librairie, rendu immédiat.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function colonnes(donnees, { hauteur = 190, titre = '' } = {}) {
  const L = 720;
  const marge = { haut: 18, bas: 30, gauche: 8, droite: 8 };
  const n = donnees.length || 1;
  const max = Math.max(1, ...donnees.map((d) => d.valeur));
  const zone = hauteur - marge.haut - marge.bas;
  const pas = (L - marge.gauche - marge.droite) / n;
  const largeur = Math.min(46, pas * 0.62);
  const barres = donnees
    .map((d, i) => {
      const h = (d.valeur / max) * zone;
      const x = marge.gauche + pas * i + (pas - largeur) / 2;
      const y = marge.haut + zone - h;
      const etiquette =
        d.valeur > 0
          ? `<text class="val" x="${x + largeur / 2}" y="${y - 5}" text-anchor="middle">${d.valeur}</text>`
          : '';
      return `<rect x="${x}" y="${y}" width="${largeur}" height="${Math.max(h, d.valeur > 0 ? 2 : 0)}"
                rx="2" fill="var(--felt)" opacity="${d.valeur ? 1 : 0.15}"></rect>
              ${etiquette}
              <text x="${x + largeur / 2}" y="${hauteur - 10}" text-anchor="middle">${esc(d.etiquette)}</text>`;
    })
    .join('');
  return `<svg class="chart" viewBox="0 0 ${L} ${hauteur}" role="img" aria-label="${esc(titre)}">
    <line x1="0" y1="${marge.haut + zone + 0.5}" x2="${L}" y2="${marge.haut + zone + 0.5}" stroke="var(--line)"></line>
    ${barres}
  </svg>`;
}

export function barres(donnees, { hauteur = 22, format = (v) => v, titre = '', couleur = 'var(--felt)' } = {}) {
  const L = 720;
  const largeurNom = 132;
  const largeurVal = 70;
  const max = Math.max(1, ...donnees.map((d) => d.valeur));
  const total = donnees.length * hauteur + 6;
  const lignes = donnees
    .map((d, i) => {
      const y = i * hauteur;
      const dispo = L - largeurNom - largeurVal;
      const w = Math.max((d.valeur / max) * dispo, d.valeur > 0 ? 3 : 0);
      return `<text x="0" y="${y + hauteur / 2 + 4}" fill="var(--ink)" font-weight="500">${esc(d.etiquette)}</text>
              <rect x="${largeurNom}" y="${y + 4}" width="${w}" height="${hauteur - 11}" rx="2"
                    fill="${d.couleur || couleur}"></rect>
              <text class="val" x="${largeurNom + w + 8}" y="${y + hauteur / 2 + 4}">${esc(format(d.valeur))}</text>`;
    })
    .join('');
  return `<svg class="chart" viewBox="0 0 ${L} ${total}" role="img" aria-label="${esc(titre)}">${lignes}</svg>`;
}

// Dégradé sable → laiton → feutre, utilisé par la matrice joueur × jeu.
export function couleurTaux(taux) {
  const arrets = [
    [0, [241, 235, 221]],
    [0.34, [232, 213, 168]],
    [0.67, [181, 130, 42]],
    [1, [16, 50, 42]],
  ];
  const t = Math.min(1, Math.max(0, taux));
  for (let i = 1; i < arrets.length; i++) {
    if (t <= arrets[i][0]) {
      const [p0, c0] = arrets[i - 1];
      const [p1, c1] = arrets[i];
      const k = (t - p0) / (p1 - p0 || 1);
      const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
      return `rgb(${c.join(',')})`;
    }
  }
  return 'rgb(16,50,42)';
}

export function texteSur(taux) {
  return taux > 0.55 ? 'var(--paper)' : 'var(--ink)';
}
