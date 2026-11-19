// Page de choix affichée après l'accueil : chaque tuile mène à une section du
// site de l'appartement. Ajouter une section = ajouter une tuile ici et ses
// routes dans app.js.
import * as store from './store.js';
import { esc, el } from './ui.js';

const ICONES = {
  jeux: `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="7" width="34" height="34" rx="7" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="17" cy="17" r="3.2" fill="currentColor"/><circle cx="31" cy="17" r="3.2" fill="currentColor"/><circle cx="24" cy="24" r="3.2" fill="currentColor"/><circle cx="17" cy="31" r="3.2" fill="currentColor"/><circle cx="31" cy="31" r="3.2" fill="currentColor"/></svg>`,
  cimetiere: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 42V20a12 12 0 0 1 24 0v22" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M6 42h36" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M24 17v14M18.5 22h11" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
};

function pluriel(n, mot) {
  return `${n} ${mot}${n > 1 ? 's' : ''}`;
}

export function rendre(hote) {
  const db = store.get();
  const nbBrises = db.cimetiere.length;
  const tuiles = [
    {
      href: '#/stats',
      icone: ICONES.jeux,
      titre: 'Jeux de société',
      texte: 'Parties, classement Elo, podium et statistiques par jeu.',
      chiffre: pluriel(db.parties.length, 'partie'),
    },
    {
      href: '#/cimetiere',
      icone: ICONES.cimetiere,
      titre: 'Le cimetière',
      texte: "Avis de décès des objets tombés au combat, et le palmarès de ceux qui les ont brisés.",
      chiffre: nbBrises ? `${nbBrises} objet${nbBrises > 1 ? 's' : ''} brisé${nbBrises > 1 ? 's' : ''}` : 'Aucune victime',
    },
  ];
  hote.innerHTML = '';
  hote.appendChild(
    el(`<div class="page-head">
      <div><h2>Bienvenue à l'appart</h2><p>Choisissez une section.</p></div>
    </div>`)
  );
  hote.appendChild(
    el(`<nav class="tuiles" aria-label="Sections du site">
      ${tuiles
        .map(
          (t) => `<a class="tuile" href="${t.href}">
          <span class="tuile-icone">${t.icone}</span>
          <span class="tuile-corps">
            <strong>${esc(t.titre)}</strong>
            <span>${esc(t.texte)}</span>
          </span>
          <span class="tuile-chiffre">${esc(t.chiffre)}</span>
        </a>`
        )
        .join('')}
    </nav>`)
  );
}
