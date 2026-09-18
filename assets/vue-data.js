import * as store from './store.js';
import { esc, el, modale, confirmer, toast, alerte, telecharger } from './ui.js';

export function rendre(hote) {
  hote.innerHTML = '';
  const tete = el(`<div class="page-head">
    <div><h2>Données</h2><p>Les joueurs et les jeux proposés au moment de saisir une partie.</p></div>
    <div class="spacer"></div>
    <button class="btn ghost" data-publier>Publier</button>
    <button class="btn brass" data-ajouter>Ajouter</button>
  </div>`);
  tete.querySelector('[data-ajouter]').addEventListener('click', () => editeur(null, hote));
  tete.querySelector('[data-publier]').addEventListener('click', publier);
  hote.appendChild(tete);

  hote.appendChild(
    el(`<div class="grid two">
      ${liste('joueur', 'Joueurs', store.joueursTries(), (x) => store.usageJoueur(x.id))}
      ${liste('jeu', 'Jeux', store.jeuxTries(), (x) => store.usageJeu(x.id))}
    </div>`)
  );

  hote.querySelectorAll('[data-liste]').forEach((section) => {
    section.addEventListener('click', async (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      const type = section.dataset.liste;
      const id = tr.dataset.id;
      const nom = type === 'joueur' ? store.nomJoueur(id) : store.nomJeu(id);
      if (e.target.closest('[data-edit]')) {
        editeur({ type, id, nom }, hote);
      }
      if (e.target.closest('[data-del]')) {
        const ok = await confirmer({
          titre: `Supprimer ${type === 'joueur' ? 'le joueur' : 'le jeu'}`,
          message: `${nom} sera retiré de la liste.`,
        });
        if (!ok) return;
        try {
          if (type === 'joueur') store.supprimerJoueur(id);
          else store.supprimerJeu(id);
          toast(`${nom} supprimé`);
          rendre(hote);
        } catch (err) {
          alerte('Suppression impossible', err.message);
        }
      }
    });
  });
}

function liste(type, titre, elements, usage) {
  return `<section class="panel" data-liste="${type}">
    <header><h3>${esc(titre)}</h3><span class="hint">${elements.length}</span></header>
    ${
      elements.length
        ? `<table>
      <thead><tr><th>Nom</th><th class="num">Parties</th><th style="width:90px"></th></tr></thead>
      <tbody>
        ${elements
          .map(
            (x) => `<tr data-id="${esc(x.id)}">
            <td class="name">${esc(x.nom)}</td>
            <td class="num">${usage(x)}</td>
            <td><div class="row-actions">
              <button class="icon-btn" data-edit aria-label="Renommer ${esc(x.nom)}">✎</button>
              <button class="icon-btn del" data-del aria-label="Supprimer ${esc(x.nom)}">✕</button>
            </div></td>
          </tr>`
          )
          .join('')}
      </tbody></table>`
        : `<div class="empty"><strong>Liste vide</strong>Utilisez « Ajouter » en haut de la page.</div>`
    }
  </section>`;
}

function editeur(existant, hote) {
  const corps = el(`<div class="pickers">
    <label class="field">Type
      <select data-type ${existant ? 'disabled' : ''}>
        <option value="joueur" ${existant?.type === 'joueur' ? 'selected' : ''}>Joueur</option>
        <option value="jeu" ${existant?.type === 'jeu' ? 'selected' : ''}>Jeu</option>
      </select>
    </label>
    <label class="field">Nom
      <input type="text" data-nom maxlength="60" value="${esc(existant?.nom || '')}" placeholder="Ex. : Catan">
    </label>
    <p class="note warn" data-err></p>
  </div>`);
  const err = corps.querySelector('[data-err]');

  modale({
    titre: existant ? `Renommer ${existant.nom}` : 'Ajouter',
    corps,
    actions: [
      { libelle: 'Annuler', classe: 'ghost', action: (f) => f() },
      {
        libelle: 'Enregistrer',
        classe: 'brass',
        action: (fermer) => {
          const type = corps.querySelector('[data-type]').value;
          const nom = corps.querySelector('[data-nom]').value;
          try {
            if (existant) {
              if (existant.type === 'joueur') store.renommerJoueur(existant.id, nom);
              else store.renommerJeu(existant.id, nom);
            } else if (type === 'joueur') store.ajouterJoueur(nom);
            else store.ajouterJeu(nom);
            fermer();
            toast(existant ? 'Nom modifié' : 'Ajouté');
            rendre(hote);
          } catch (e) {
            err.textContent = e.message;
          }
        },
      },
    ],
  });
}

// Les modifications vivent dans le navigateur tant qu'on ne les publie pas
// dans le dépôt : ce dialogue fournit le fichier à committer.
function publier() {
  const json = store.exporter();
  const corps = el(`<div class="pickers">
    <p class="note">Vos ajouts sont enregistrés dans ce navigateur. Pour que les invités les voient,
      remplacez <code>data/db.json</code> dans le dépôt GitHub par ce fichier.</p>
    <textarea readonly style="width:100%;height:190px;font-family:ui-monospace,Menlo,monospace;font-size:12px;
      border:1px solid var(--line);border-radius:4px;padding:10px;background:var(--surface-2);color:var(--ink)">${esc(json)}</textarea>
    <p class="note" data-etat></p>
  </div>`);
  const etat = corps.querySelector('[data-etat]');
  modale({
    titre: 'Publier les données',
    corps,
    actions: [
      {
        libelle: 'Copier',
        classe: 'ghost',
        action: async () => {
          try {
            await navigator.clipboard.writeText(json);
            etat.textContent = 'JSON copié dans le presse-papiers.';
          } catch {
            corps.querySelector('textarea').select();
            etat.textContent = 'Copie automatique refusée par le navigateur : le texte est sélectionné, faites Ctrl+C.';
          }
        },
      },
      {
        libelle: 'Télécharger db.json',
        classe: 'brass',
        action: () => {
          telecharger('db.json', json);
          etat.textContent = 'Fichier téléchargé. Remplacez data/db.json dans le dépôt, puis validez.';
        },
      },
    ],
  });
}

export { publier };
