// Choix du thème de couleur, propre à chaque visiteur (rangé dans son
// navigateur). Feutre est le défaut : il n'ajoute aucun attribut sur <html>.
// Un petit script en tête de index.html applique le thème avant le premier
// rendu pour éviter tout clignotement ; ce module reste la source de vérité.
import { el } from './ui.js';

const CLE = 'jsv:theme';
const DEFAUT = 'feutre';

// apercu = [surface foncée, accent] — sert uniquement à peindre la pastille.
export const THEMES = [
  { id: 'feutre', nom: 'Feutre', apercu: ['#10322a', '#b5822a'] },
  { id: 'nuit', nom: 'Nuit', apercu: ['#0f1512', '#d9a441'] },
  { id: 'ardoise', nom: 'Ardoise', apercu: ['#223142', '#2f6f9f'] },
  { id: 'bordeaux', nom: 'Bordeaux', apercu: ['#5a1e2b', '#c99a3a'] },
  { id: 'sarcelle', nom: 'Sarcelle', apercu: ['#0f3f3f', '#e07a52'] },
];

const listeners = new Set();

export function courant() {
  try {
    const t = localStorage.getItem(CLE);
    return THEMES.some((x) => x.id === t) ? t : DEFAUT;
  } catch {
    return DEFAUT;
  }
}

export function appliquer(id, { persister = true } = {}) {
  const valide = THEMES.some((t) => t.id === id) ? id : DEFAUT;
  if (valide === DEFAUT) document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = valide;
  if (persister) {
    try {
      localStorage.setItem(CLE, valide);
    } catch {
      /* navigation privée / quota : le thème reste appliqué pour la session */
    }
  }
  listeners.forEach((fn) => fn(valide));
}

export function init() {
  appliquer(courant(), { persister: false });
}

// Prévenu à chaque changement de thème (pour rafraîchir les couleurs calculées
// en JS, comme la matrice, et re-rendre la vue courante).
export function surChangement(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Rangée de pastilles à deux tons. Se pose sur le bandeau ou l'accueil (fonds
// foncés). Met à jour son propre état actif ; le reste passe par les listeners.
export function palette() {
  const actuel = courant();
  const n = el(`<div class="theme-picker" role="group" aria-label="Thème de couleur"></div>`);
  for (const t of THEMES) {
    const b = el(`<button type="button" class="swatch${t.id === actuel ? ' on' : ''}"
        data-theme="${t.id}" title="Thème ${t.nom}" aria-label="Thème ${t.nom}"
        aria-pressed="${t.id === actuel}">
        <span style="background:${t.apercu[0]}"></span><span style="background:${t.apercu[1]}"></span>
      </button>`);
    n.appendChild(b);
  }
  n.addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme]');
    if (!b) return;
    appliquer(b.dataset.theme);
    n.querySelectorAll('.swatch').forEach((s) => {
      const on = s === b;
      s.classList.toggle('on', on);
      s.setAttribute('aria-pressed', String(on));
    });
  });
  return n;
}
