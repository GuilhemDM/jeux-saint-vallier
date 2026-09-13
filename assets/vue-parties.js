import * as store from './store.js';
import { fmt } from './compute.js';
import { esc, el, modale, confirmer, toast, alerte } from './ui.js';

export function rendre(hote) {
  hote.innerHTML = '';
  const tete = el(`<div class="page-head">
    <div><h2>Parties</h2><p>Chaque ligne est une partie. Les gagnants sont surlignés.</p></div>
    <div class="spacer"></div>
    <button class="btn brass" data-ajouter>Ajouter une partie</button>
  </div>`);
  tete.querySelector('[data-ajouter]').addEventListener('click', () => editeur(null, hote));
  hote.appendChild(tete);

  const parties = store.partiesTriees();
  if (!parties.length) {
    hote.appendChild(
      el(`<div class="panel"><div class="empty"><strong>Aucune partie pour l'instant</strong>
        Commencez par « Ajouter une partie ».</div></div>`)
    );
    return;
  }

  const table = el(`<section class="panel">
    <header><h3>${parties.length} partie${parties.length > 1 ? 's' : ''}</h3></header>
    <div class="scroll" style="max-height:none">
      <table>
        <thead><tr>
          <th style="width:110px">Date</th><th style="width:180px">Jeu</th>
          <th>Joueurs</th><th style="width:90px" class="num">Table</th><th style="width:90px"></th>
        </tr></thead>
        <tbody>
        ${parties
          .map(
            (p) => `<tr data-id="${esc(p.id)}">
            <td>${fmt.date(p.date)}</td>
            <td class="name">${esc(store.nomJeu(p.jeuId))}</td>
            <td>${p.joueurIds
              .map((id) => {
                const gagne = p.gagnantIds.includes(id);
                return `<span class="chip ${gagne ? 'win' : ''}">${gagne ? '★ ' : ''}${esc(store.nomJoueur(id))}</span>`;
              })
              .join('')}</td>
            <td class="num">${p.joueurIds.length}</td>
            <td><div class="row-actions">
              <button class="icon-btn" data-edit aria-label="Modifier la partie">✎</button>
              <button class="icon-btn del" data-del aria-label="Supprimer la partie">✕</button>
            </div></td>
          </tr>`
          )
          .join('')}
        </tbody>
      </table>
    </div>
  </section>`);

  table.addEventListener('click', async (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    const partie = store.get().parties.find((p) => p.id === tr.dataset.id);
    if (!partie) return;
    if (e.target.closest('[data-edit]')) editeur(partie, hote);
    if (e.target.closest('[data-del]')) {
      const ok = await confirmer({
        titre: 'Supprimer la partie',
        message: `${store.nomJeu(partie.jeuId)} du ${fmt.date(partie.date)} — cette partie disparaîtra des statistiques.`,
      });
      if (ok) {
        store.supprimerPartie(partie.id);
        toast('Partie supprimée');
        rendre(hote);
      }
    }
  });
  hote.appendChild(table);
}

function editeur(partie, hote) {
  const db = store.get();
  if (!db.jeux.length || !db.joueurs.length) {
    alerte(
      'Il manque des données',
      "Ajoutez au moins un jeu et un joueur dans la page Données avant d'enregistrer une partie."
    );
    return;
  }

  const brouillon = {
    date: partie ? partie.date : new Date().toISOString().slice(0, 10),
    jeuId: partie ? partie.jeuId : db.jeux[0].id,
    joueurIds: partie ? [...partie.joueurIds] : [],
    gagnantIds: partie ? [...partie.gagnantIds] : [],
  };

  const corps = el(`<div class="pickers">
    <div class="picker-row">
      <label class="field" style="flex:0 0 170px">Date
        <input type="date" data-date value="${esc(brouillon.date)}">
      </label>
      <label class="field" style="flex:1">Jeu
        <select data-jeu>
          ${store
            .jeuxTries()
            .map((x) => `<option value="${esc(x.id)}" ${x.id === brouillon.jeuId ? 'selected' : ''}>${esc(x.nom)}</option>`)
            .join('')}
        </select>
      </label>
    </div>
    <label class="field">Ajouter un joueur
      <select data-ajout><option value="">Choisir…</option></select>
    </label>
    <div class="chips-box" data-chips></div>
    <p class="note" data-compte></p>
    <p class="note warn" data-err></p>
  </div>`);

  const selAjout = corps.querySelector('[data-ajout]');
  const chips = corps.querySelector('[data-chips]');
  const compte = corps.querySelector('[data-compte]');
  const err = corps.querySelector('[data-err]');

  function majAjout() {
    const dispo = store.joueursTries().filter((j) => !brouillon.joueurIds.includes(j.id));
    const plein = brouillon.joueurIds.length >= store.MAX_JOUEURS;
    selAjout.innerHTML =
      `<option value="">${plein ? `Table complète (${store.MAX_JOUEURS})` : 'Choisir…'}</option>` +
      dispo.map((j) => `<option value="${esc(j.id)}">${esc(j.nom)}</option>`).join('');
    selAjout.disabled = plein || !dispo.length;
  }

  function majChips() {
    chips.innerHTML = brouillon.joueurIds.length
      ? brouillon.joueurIds
          .map((id) => {
            const gagnant = brouillon.gagnantIds.includes(id);
            return `<span class="chip-btn" role="button" tabindex="0" aria-pressed="${gagnant}" data-id="${esc(id)}"
                     title="Cliquez pour désigner ${esc(store.nomJoueur(id))} comme gagnant">
                <span class="crown">★</span>${esc(store.nomJoueur(id))}
                <button class="x" data-retirer aria-label="Retirer ${esc(store.nomJoueur(id))}">×</button>
              </span>`;
          })
          .join('')
      : `<span class="note">Ajoutez les joueurs, puis cliquez sur un nom pour le désigner gagnant.</span>`;
    majCompte();
    majAjout();
  }

  function majCompte() {
    compte.textContent = `${brouillon.joueurIds.length}/${store.MAX_JOUEURS} joueurs · ${brouillon.gagnantIds.length}/${store.MAX_GAGNANTS} gagnants`;
  }

  selAjout.addEventListener('change', () => {
    const id = selAjout.value;
    if (!id) return;
    if (brouillon.joueurIds.length >= store.MAX_JOUEURS) return;
    brouillon.joueurIds.push(id);
    err.textContent = '';
    majChips();
  });

  // On ne retouche que la puce cliquée : le focus clavier reste en place.
  function basculer(id, chip) {
    const i = brouillon.gagnantIds.indexOf(id);
    if (i >= 0) brouillon.gagnantIds.splice(i, 1);
    else if (brouillon.gagnantIds.length >= store.MAX_GAGNANTS) {
      err.textContent = `Maximum ${store.MAX_GAGNANTS} gagnants par partie.`;
      return;
    } else brouillon.gagnantIds.push(id);
    err.textContent = '';
    chip.setAttribute('aria-pressed', String(brouillon.gagnantIds.includes(id)));
    majCompte();
  }

  chips.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-id]');
    if (!chip) return;
    const id = chip.dataset.id;
    if (e.target.closest('[data-retirer]')) {
      brouillon.joueurIds = brouillon.joueurIds.filter((x) => x !== id);
      brouillon.gagnantIds = brouillon.gagnantIds.filter((x) => x !== id);
      majChips();
      return;
    }
    basculer(id, chip);
  });
  chips.addEventListener('keydown', (e) => {
    const chip = e.target.closest('[data-id]');
    if (chip && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      basculer(chip.dataset.id, chip);
    }
  });

  majChips();

  modale({
    titre: partie ? 'Modifier la partie' : 'Ajouter une partie',
    corps,
    actions: [
      { libelle: 'Annuler', classe: 'ghost', action: (f) => f() },
      {
        libelle: 'Enregistrer',
        classe: 'brass',
        action: (fermer) => {
          brouillon.date = corps.querySelector('[data-date]').value;
          brouillon.jeuId = corps.querySelector('[data-jeu]').value;
          try {
            if (partie) store.modifierPartie(partie.id, brouillon);
            else store.ajouterPartie(brouillon);
            fermer();
            toast(partie ? 'Partie modifiée' : 'Partie ajoutée');
            rendre(hote);
          } catch (e) {
            err.textContent = e.message;
          }
        },
      },
    ],
  });
}
