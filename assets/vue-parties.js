import * as store from './store.js';
import { fmt, variationsElo } from './compute.js';
import { esc, el, modale, confirmer, toast, alerte } from './ui.js';

// Filtre par jeu de la liste des parties (persiste entre les rendus).
let filtreJeuId = '';

// Petit badge de variation d'Elo : +N en vert (gain), -N en rouge (perte).
function deltaBadge(d) {
  if (d === undefined || d === null) return '';
  const r = Math.round(d);
  const cls = r > 0 ? 'up' : r < 0 ? 'down' : 'zero';
  return ` <span class="elo-delta ${cls}">${r > 0 ? '+' : ''}${r}</span>`;
}

// Affiche les joueurs d'une partie dans l'ordre du classement, avec la variation
// d'Elo de chacun pour cette partie ; gagnants surlignés, non-classés atténués.
function rendreClassement(p, deltas) {
  const groupes = p.classement && p.classement.length
    ? p.classement
    : p.gagnantIds && p.gagnantIds.length
      ? [p.gagnantIds]
      : [];
  const classes = new Set(groupes.flat());
  const reste = p.joueurIds.filter((id) => !classes.has(id));
  const badge = (id) => deltaBadge(deltas ? deltas.get(id) : undefined);
  const chips = [];
  let pos = 1;
  for (const grp of groupes) {
    const rang = pos;
    const gagnant = rang === 1;
    for (const id of grp) {
      chips.push(
        `<span class="chip ${gagnant ? 'win' : ''}">${rang}. ${gagnant ? '★ ' : ''}${esc(store.nomJoueur(id))}${badge(id)}</span>`
      );
    }
    pos += grp.length;
  }
  for (const id of reste) {
    chips.push(`<span class="chip" style="opacity:.6">${esc(store.nomJoueur(id))}${badge(id)}</span>`);
  }
  return chips.join('');
}

export function rendre(hote) {
  hote.innerHTML = '';
  const toutes = store.partiesTriees();
  const tete = el(`<div class="page-head">
    <div><h2>Parties</h2><p>Joueurs dans l'ordre du classement ; la variation d'Elo de chacun suit son nom.</p></div>
    ${
      toutes.length
        ? `<label class="field" style="margin-left:auto"><span>Jeu</span>
      <select data-filtre-jeu>
        <option value="">Tous les jeux</option>
        ${store.jeuxTries().map((x) => `<option value="${esc(x.id)}" ${x.id === filtreJeuId ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}
      </select></label>`
        : '<div class="spacer"></div>'
    }
    <button class="btn brass" data-ajouter>Ajouter une partie</button>
  </div>`);
  tete.querySelector('[data-ajouter]').addEventListener('click', () => editeur(null, hote));
  const filtre = tete.querySelector('[data-filtre-jeu]');
  if (filtre) {
    filtre.addEventListener('change', () => {
      filtreJeuId = filtre.value;
      rendre(hote);
    });
  }
  hote.appendChild(tete);

  if (!toutes.length) {
    hote.appendChild(
      el(`<div class="panel"><div class="empty"><strong>Aucune partie pour l'instant</strong>
        Commencez par « Ajouter une partie ».</div></div>`)
    );
    return;
  }

  // Variations d'Elo calculées sur TOUT l'historique (l'ordre chronologique
  // complet), puis affichées partie par partie même si la liste est filtrée.
  const variations = variationsElo(store.get().parties);
  const parties = filtreJeuId ? toutes.filter((p) => p.jeuId === filtreJeuId) : toutes;

  if (!parties.length) {
    hote.appendChild(
      el(`<div class="panel"><div class="empty"><strong>Aucune partie pour ce jeu</strong>
        Choisissez un autre jeu ou « Tous les jeux ».</div></div>`)
    );
    return;
  }

  const table = el(`<section class="panel">
    <header><h3>${parties.length} partie${parties.length > 1 ? 's' : ''}${filtreJeuId ? ` · ${esc(store.nomJeu(filtreJeuId))}` : ''}</h3></header>
    <div class="scroll" style="max-height:none">
      <table>
        <thead><tr>
          <th style="width:110px">Date</th><th style="width:180px">Jeu</th>
          <th>Classement</th><th style="width:90px" class="num">Table</th><th style="width:90px"></th>
        </tr></thead>
        <tbody>
        ${parties
          .map(
            (p) => `<tr data-id="${esc(p.id)}">
            <td>${fmt.date(p.date)}</td>
            <td class="name">${esc(store.nomJeu(p.jeuId))}</td>
            <td>${rendreClassement(p, variations.get(p.id))}</td>
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

// ordre = liste ordonnée d'entrées { id, exaequo } (1er en haut ; exaequo = à
// égalité avec l'entrée juste au-dessus). nonClasses = joueurs sans rang.
function groupesDe(ordre) {
  const groupes = [];
  ordre.forEach((e) => {
    if (!e.exaequo || !groupes.length) groupes.push([e.id]);
    else groupes[groupes.length - 1].push(e.id);
  });
  return groupes;
}

function rangsDe(ordre) {
  const rangs = [];
  let cur = 1;
  ordre.forEach((e, i) => {
    if (i === 0 || !e.exaequo) cur = i + 1;
    rangs.push(cur);
  });
  return rangs;
}

function depuisPartie(partie) {
  const groupes =
    partie && partie.classement && partie.classement.length
      ? partie.classement
      : partie && partie.gagnantIds && partie.gagnantIds.length
        ? [partie.gagnantIds]
        : [];
  const ordre = [];
  for (const grp of groupes) grp.forEach((id, i) => ordre.push({ id, exaequo: i > 0 }));
  const classes = new Set(ordre.map((e) => e.id));
  const nonClasses = partie ? partie.joueurIds.filter((id) => !classes.has(id)) : [];
  return { ordre, nonClasses };
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

  const initial = depuisPartie(partie);
  const brouillon = {
    date: partie ? partie.date : new Date().toISOString().slice(0, 10),
    jeuId: partie ? partie.jeuId : db.jeux[0].id,
    ordre: initial.ordre,
    nonClasses: initial.nonClasses,
  };

  const joueurIdsDe = () => [...brouillon.ordre.map((e) => e.id), ...brouillon.nonClasses];

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
    <div data-zone>
      <div class="rang-liste" data-classement></div>
      <div class="rang-reste" data-nonclasses></div>
    </div>
    <p class="note">Le 1<sup>er</sup> est en haut. « = » met à égalité avec le joueur au-dessus ; « ⤓ » laisse un joueur sans rang.</p>
    <p class="note" data-compte></p>
    <p class="note warn" data-err></p>
  </div>`);

  const selAjout = corps.querySelector('[data-ajout]');
  const zone = corps.querySelector('[data-zone]');
  const listeClass = corps.querySelector('[data-classement]');
  const resteZone = corps.querySelector('[data-nonclasses]');
  const compte = corps.querySelector('[data-compte]');
  const err = corps.querySelector('[data-err]');

  function majAjout() {
    const pris = joueurIdsDe();
    const dispo = store.joueursTries().filter((j) => !pris.includes(j.id));
    const plein = pris.length >= store.MAX_JOUEURS;
    selAjout.innerHTML =
      `<option value="">${plein ? `Table complète (${store.MAX_JOUEURS})` : 'Choisir…'}</option>` +
      dispo.map((j) => `<option value="${esc(j.id)}">${esc(j.nom)}</option>`).join('');
    selAjout.disabled = plein || !dispo.length;
  }

  function maj() {
    const rangs = rangsDe(brouillon.ordre);
    listeClass.innerHTML = brouillon.ordre.length
      ? brouillon.ordre
          .map((e, i) => {
            const rang = rangs[i];
            const gagnant = rang === 1;
            const nom = esc(store.nomJoueur(e.id));
            const dernier = i === brouillon.ordre.length - 1;
            return `<div class="rang-row ${gagnant ? 'gagnant' : ''}" data-idx="${i}" data-id="${esc(e.id)}">
              <span class="rang-badge">${rang}</span>
              <span class="rang-nom">${gagnant ? '★ ' : ''}${nom}</span>
              <span class="rang-ctrl">
                <button type="button" class="icon-btn" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Monter ${nom}">▲</button>
                <button type="button" class="icon-btn" data-act="down" ${dernier ? 'disabled' : ''} aria-label="Descendre ${nom}">▼</button>
                <button type="button" class="icon-btn" data-act="tie" ${i === 0 ? 'disabled' : ''} aria-pressed="${e.exaequo}" title="Ex æquo avec le joueur au-dessus" aria-label="Mettre ${nom} ex æquo">=</button>
                <button type="button" class="icon-btn" data-act="unrank" title="Laisser sans rang" aria-label="Retirer ${nom} du classement">⤓</button>
                <button type="button" class="icon-btn del" data-act="remove" title="Retirer de la partie" aria-label="Retirer ${nom} de la partie">✕</button>
              </span>
            </div>`;
          })
          .join('')
      : `<p class="note">Ajoutez des joueurs, puis ordonnez-les.</p>`;

    resteZone.innerHTML = brouillon.nonClasses.length
      ? `<span class="note">Sans rang :</span>` +
        brouillon.nonClasses
          .map((id) => {
            const nom = esc(store.nomJoueur(id));
            return `<span class="chip" data-id="${esc(id)}">${nom}
              <button type="button" data-act="rank" title="Classer" aria-label="Classer ${nom}">⤒</button>
              <button type="button" data-act="remove" title="Retirer" aria-label="Retirer ${nom}">×</button>
            </span>`;
          })
          .join('')
      : '';

    compte.textContent = `${joueurIdsDe().length}/${store.MAX_JOUEURS} joueurs`;
    majAjout();
  }

  function assainir() {
    if (brouillon.ordre[0]) brouillon.ordre[0].exaequo = false;
  }

  selAjout.addEventListener('change', () => {
    const id = selAjout.value;
    if (!id) return;
    if (joueurIdsDe().length >= store.MAX_JOUEURS) return;
    brouillon.ordre.push({ id, exaequo: false });
    err.textContent = '';
    maj();
  });

  zone.addEventListener('click', (e) => {
    const bouton = e.target.closest('[data-act]');
    if (!bouton) return;
    const act = bouton.dataset.act;
    const rangee = bouton.closest('[data-idx]');
    err.textContent = '';

    if (rangee) {
      const i = Number(rangee.dataset.idx);
      const o = brouillon.ordre;
      if (act === 'up' && i > 0) {
        [o[i - 1], o[i]] = [o[i], o[i - 1]];
        assainir();
      } else if (act === 'down' && i < o.length - 1) {
        [o[i + 1], o[i]] = [o[i], o[i + 1]];
        assainir();
      } else if (act === 'tie') {
        o[i].exaequo = !o[i].exaequo;
      } else if (act === 'unrank') {
        brouillon.nonClasses.push(o[i].id);
        o.splice(i, 1);
        assainir();
      } else if (act === 'remove') {
        o.splice(i, 1);
        assainir();
      }
      maj();
      return;
    }

    const chip = e.target.closest('[data-id]');
    if (!chip) return;
    const id = chip.dataset.id;
    if (act === 'rank') {
      brouillon.nonClasses = brouillon.nonClasses.filter((x) => x !== id);
      brouillon.ordre.push({ id, exaequo: false });
    } else if (act === 'remove') {
      brouillon.nonClasses = brouillon.nonClasses.filter((x) => x !== id);
    }
    maj();
  });

  maj();

  modale({
    titre: partie ? 'Modifier la partie' : 'Ajouter une partie',
    corps,
    actions: [
      { libelle: 'Annuler', classe: 'ghost', action: (f) => f() },
      {
        libelle: 'Enregistrer',
        classe: 'brass',
        action: (fermer) => {
          const donnees = {
            date: corps.querySelector('[data-date]').value,
            jeuId: corps.querySelector('[data-jeu]').value,
            joueurIds: joueurIdsDe(),
            classement: groupesDe(brouillon.ordre),
          };
          try {
            if (partie) store.modifierPartie(partie.id, donnees);
            else store.ajouterPartie(donnees);
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
