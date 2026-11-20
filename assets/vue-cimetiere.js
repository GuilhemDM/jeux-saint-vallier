// Le cimetière : objets brisés de l'appartement.
//  - « Avis de décès » (tout le monde) : palmarès des casseurs, top 3 sur un
//    podium, le reste en liste ; un clic sur une personne déplie ses avis de
//    décès (photo, nom de l'objet, date), le bouton « − » les replie.
//  - « Registre » (admin) : ajout, modification et suppression des avis, avec
//    import, remplacement ou retrait de la photo.
import * as store from './store.js';
import { libelleTaille } from './photo.js';
import { recadrer } from './recadrage.js';
import { esc, el, modale, confirmer, toast, alerte } from './ui.js';

const ouverts = new Set(); // personnes dépliées (persiste entre les rendus)
let filtrePersonne = ''; // filtre du registre

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function dateLongue(iso) {
  const [a, m, j] = String(iso || '').split('-').map(Number);
  if (!a || !m || !j) return '—';
  return `${j === 1 ? '1er' : j} ${MOIS[m - 1]} ${a}`;
}

function aujourdHui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function compte(n) {
  return `${n} objet${n > 1 ? 's' : ''} brisé${n > 1 ? 's' : ''}`;
}

function vignette(avis, classe = 'photo') {
  return avis.photo
    ? `<img class="${classe}" src="${esc(avis.photo)}" alt="Photo : ${esc(avis.objet)}" loading="lazy">`
    : `<span class="${classe} sans-photo" aria-label="Pas de photo">✝</span>`;
}

/* ============================================================ Avis de décès */

function carteAvis(a) {
  return `<article class="avis">
    <div class="avis-tete">Avis de décès</div>
    <button type="button" class="avis-photo" data-agrandir="${esc(a.id)}" ${a.photo ? '' : 'disabled'}
      aria-label="${a.photo ? `Agrandir la photo : ${esc(a.objet)}` : 'Pas de photo'}">${vignette(a, 'avis-img')}</button>
    <h4 class="avis-objet">${esc(a.objet)}</h4>
    <p class="avis-date">† ${esc(dateLongue(a.date))}</p>
    <p class="avis-epitaphe">Repose en pièces.</p>
  </article>`;
}

function panneau(l) {
  return `<section class="cim-panel" data-panel="${esc(l.joueurId)}">
    <header>
      <h3>${esc(l.nom)}</h3>
      <span class="hint">${compte(l.n)}</span>
      <button type="button" class="icon-btn cim-reduire" data-reduire="${esc(l.joueurId)}"
        aria-label="Réduire les avis de ${esc(l.nom)}" title="Réduire">−</button>
    </header>
    <div class="avis-grille">${l.avis.map(carteAvis).join('')}</div>
  </section>`;
}

function rendreAvis(hote) {
  const classement = store.classementCimetiere();
  for (const id of [...ouverts]) if (!classement.some((l) => l.joueurId === id)) ouverts.delete(id);

  hote.innerHTML = '';
  hote.appendChild(
    el(`<div class="page-head">
      <div><h2>Le cimetière</h2>
      <p>Ici reposent les objets brisés de l'appartement, et voici le palmarès de leurs bourreaux.
        Cliquez sur une personne pour connaitre ses victimes.</p></div>
    </div>`)
  );

  if (!classement.length) {
    hote.appendChild(
      el(`<div class="panel"><div class="empty"><strong>Aucun objet n'a encore rendu l'âme</strong>
        Pour l'instant.</div></div>`)
    );
    return;
  }

  const total = classement.reduce((s, l) => s + l.n, 0);
  const podium = classement.slice(0, 3);
  const reste = classement.slice(3);

  const n = el(`<div class="cimetiere">
    <section class="cim-podium" aria-label="Podium des casseurs">
      ${podium
        .map(
          (l, i) => `<button type="button" class="marche m-${i + 1}" data-personne="${esc(l.joueurId)}"
            aria-expanded="${ouverts.has(l.joueurId)}">
            <span class="marche-nom">${esc(l.nom)}</span>
            <span class="marche-n"><strong>${l.n}</strong> ${l.n > 1 ? 'objets' : 'objet'}</span>
            <span class="marche-socle"><span class="marche-rang">${l.rang}</span></span>
          </button>`
        )
        .join('')}
    </section>
    <p class="cim-total">${compte(total)} au total, par ${classement.length} personne${classement.length > 1 ? 's' : ''}.</p>
    <div class="cim-ouverts">${podium.filter((l) => ouverts.has(l.joueurId)).map(panneau).join('')}</div>
    ${
      reste.length
        ? `<section class="panel cim-liste">
      <header><h3>Le reste du classement</h3></header>
      <ol class="cim-rangs">
        ${reste
          .map((l) => {
            const ouvert = ouverts.has(l.joueurId);
            return `<li>
            <button type="button" class="cim-rang" data-personne="${esc(l.joueurId)}" aria-expanded="${ouvert}">
              <span class="cim-rang-num">${l.rang}</span>
              <span class="cim-rang-nom">${esc(l.nom)}</span>
              <span class="cim-rang-n">${compte(l.n)}</span>
              <span class="cim-chevron" aria-hidden="true">${ouvert ? '▴' : '▾'}</span>
            </button>
            ${ouvert ? panneau(l) : ''}
          </li>`;
          })
          .join('')}
      </ol>
    </section>`
        : ''
    }
  </div>`);

  n.addEventListener('click', (e) => {
    const agrandir = e.target.closest('[data-agrandir]');
    if (agrandir) {
      const a = store.get().cimetiere.find((x) => x.id === agrandir.dataset.agrandir);
      if (a && a.photo) {
        modale({
          titre: a.objet,
          corps: el(`<figure class="avis-grand"><img src="${esc(a.photo)}" alt="Photo : ${esc(a.objet)}">
            <figcaption>† ${esc(dateLongue(a.date))} · brisé par ${esc(store.nomJoueur(a.joueurId))}</figcaption></figure>`),
          actions: [{ libelle: 'Fermer', classe: 'ghost', action: (f) => f() }],
        });
      }
      return;
    }
    const reduire = e.target.closest('[data-reduire]');
    if (reduire) {
      ouverts.delete(reduire.dataset.reduire);
      rendreAvis(hote);
      return;
    }
    const personne = e.target.closest('[data-personne]');
    if (personne) {
      const id = personne.dataset.personne;
      const ouvrir = !ouverts.has(id);
      if (ouvrir) ouverts.add(id);
      else ouverts.delete(id);
      rendreAvis(hote);
      if (ouvrir) hote.querySelector(`[data-panel="${CSS.escape(id)}"]`)?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    }
  });

  hote.appendChild(n);
}

export const avis = { rendre: rendreAvis };

/* ================================================================ Registre */

function rendreRegistre(hote) {
  const tous = store.avisTries();
  const personnes = store.joueursTries();
  if (filtrePersonne && !personnes.some((p) => p.id === filtrePersonne)) filtrePersonne = '';
  const lignes = filtrePersonne ? tous.filter((a) => a.joueurId === filtrePersonne) : tous;

  hote.innerHTML = '';
  const tete = el(`<div class="page-head">
    <div><h2>Registre du cimetière</h2>
    <p>Ajoutez, corrigez ou retirez des avis de décès. Les personnes viennent de la liste des joueurs
      (Jeux de société → Données).</p></div>
    <label class="field" style="margin-left:auto"><span>Personne</span>
      <select data-filtre>
        <option value="">Tout le monde</option>
        ${personnes.map((p) => `<option value="${esc(p.id)}" ${p.id === filtrePersonne ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}
      </select>
    </label>
    <button class="btn brass" data-ajouter>Ajouter un avis de décès</button>
  </div>`);
  tete.querySelector('[data-filtre]').addEventListener('change', (e) => {
    filtrePersonne = e.target.value;
    rendreRegistre(hote);
  });
  tete.querySelector('[data-ajouter]').addEventListener('click', () => editeur(null, hote));
  hote.appendChild(tete);

  if (!lignes.length) {
    hote.appendChild(
      el(`<div class="panel"><div class="empty"><strong>${tous.length ? 'Aucun avis pour cette personne' : 'Le registre est vide'}</strong>
        Utilisez « Ajouter un avis de décès » pour enregistrer un objet brisé.</div></div>`)
    );
    return;
  }

  const table = el(`<section class="panel">
    <header><h3>${lignes.length} avis de décès</h3>
      ${filtrePersonne ? `<span class="hint">${esc(store.nomJoueur(filtrePersonne))}</span>` : ''}</header>
    <div class="scroll" style="max-height:none">
      <table>
        <thead><tr>
          <th style="width:76px">Photo</th><th>Objet</th><th>Personne</th>
          <th style="width:150px">Date</th><th style="width:90px"></th>
        </tr></thead>
        <tbody>
        ${lignes
          .map(
            (a) => `<tr data-id="${esc(a.id)}">
            <td>${vignette(a, 'registre-img')}</td>
            <td class="name">${esc(a.objet)}</td>
            <td>${esc(store.nomJoueur(a.joueurId))}</td>
            <td>${esc(dateLongue(a.date))}</td>
            <td><div class="row-actions">
              <button class="icon-btn" data-edit aria-label="Modifier l'avis : ${esc(a.objet)}">✎</button>
              <button class="icon-btn del" data-del aria-label="Supprimer l'avis : ${esc(a.objet)}">✕</button>
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
    const a = store.get().cimetiere.find((x) => x.id === tr.dataset.id);
    if (!a) return;
    if (e.target.closest('[data-edit]')) editeur(a, hote);
    if (e.target.closest('[data-del]')) {
      const ok = await confirmer({
        titre: "Supprimer l'avis de décès",
        message: `${a.objet} (${store.nomJoueur(a.joueurId)}, ${dateLongue(a.date)}) disparaîtra du cimetière, photo comprise.`,
      });
      if (ok) {
        store.supprimerAvis(a.id);
        toast('Avis supprimé');
        rendreRegistre(hote);
      }
    }
  });
  hote.appendChild(table);
}

function editeur(existant, hote) {
  const personnes = store.joueursTries();
  if (!personnes.length) {
    alerte('Aucune personne', "Ajoutez d'abord des personnes dans Jeux de société → Données.");
    return;
  }
  const brouillon = {
    joueurId: existant ? existant.joueurId : filtrePersonne || personnes[0].id,
    objet: existant ? existant.objet : '',
    date: existant ? existant.date : aujourdHui(),
    photo: existant ? existant.photo : '',
  };
  let enCours = false;

  const corps = el(`<div class="pickers">
    <label class="field">Personne
      <select data-personne>
        ${personnes.map((p) => `<option value="${esc(p.id)}" ${p.id === brouillon.joueurId ? 'selected' : ''}>${esc(p.nom)}</option>`).join('')}
      </select>
    </label>
    <div class="picker-row">
      <label class="field" style="flex:1">Objet
        <input type="text" data-objet maxlength="80" value="${esc(brouillon.objet)}" placeholder="Ex. : coupe à vin">
      </label>
      <label class="field" style="flex:0 0 170px">Date
        <input type="date" data-date value="${esc(brouillon.date)}">
      </label>
    </div>
    <div class="field"><span>Photo</span>
      <div class="photo-edit">
        <div class="photo-apercu" data-apercu></div>
        <div class="photo-actions">
          <button type="button" class="btn ghost sm" data-importer></button>
          <button type="button" class="btn ghost sm" data-recadrer hidden>Recadrer</button>
          <button type="button" class="btn danger sm" data-retirer>Retirer la photo</button>
          <p class="note" data-photo-etat></p>
        </div>
      </div>
      <input type="file" accept="image/*" data-fichier hidden>
    </div>
    <p class="note warn" data-err></p>
  </div>`);

  const apercu = corps.querySelector('[data-apercu]');
  const importer = corps.querySelector('[data-importer]');
  const recadrerBtn = corps.querySelector('[data-recadrer]');
  const retirer = corps.querySelector('[data-retirer]');
  const fichier = corps.querySelector('[data-fichier]');
  const etat = corps.querySelector('[data-photo-etat]');
  const err = corps.querySelector('[data-err]');
  // Fichier original importé pendant cette édition : permet de reprendre le
  // recadrage en pleine résolution (une photo déjà enregistrée n'a plus que
  // sa version 640×480, il faut la réimporter pour la recadrer).
  let original = null;

  function majPhoto() {
    apercu.innerHTML = brouillon.photo
      ? `<img src="${esc(brouillon.photo)}" alt="Aperçu de la photo">`
      : `<span class="sans-photo">Aucune photo</span>`;
    importer.textContent = brouillon.photo ? 'Remplacer la photo' : 'Importer une photo';
    recadrerBtn.hidden = !(brouillon.photo && original);
    retirer.hidden = !brouillon.photo;
    if (!enCours) etat.textContent = brouillon.photo ? `Photo recadrée et compressée · ${libelleTaille(brouillon.photo)}` : '';
  }

  async function ouvrirRecadrage(f) {
    enCours = true;
    importer.disabled = recadrerBtn.disabled = true;
    etat.textContent = 'Recadrage en cours…';
    err.textContent = '';
    try {
      const url = await recadrer(f);
      if (url) {
        brouillon.photo = url;
        original = f;
      }
    } catch (e) {
      err.textContent = e.message;
    } finally {
      enCours = false;
      importer.disabled = recadrerBtn.disabled = false;
      majPhoto();
    }
  }

  importer.addEventListener('click', () => fichier.click());
  recadrerBtn.addEventListener('click', () => original && ouvrirRecadrage(original));
  retirer.addEventListener('click', () => {
    brouillon.photo = '';
    original = null;
    majPhoto();
  });
  fichier.addEventListener('change', () => {
    const f = fichier.files[0];
    fichier.value = '';
    if (f) ouvrirRecadrage(f);
  });
  majPhoto();

  modale({
    titre: existant ? `Modifier l'avis : ${existant.objet}` : 'Nouvel avis de décès',
    corps,
    actions: [
      { libelle: 'Annuler', classe: 'ghost', action: (f) => f() },
      {
        libelle: 'Enregistrer',
        classe: 'brass',
        action: (fermer) => {
          if (enCours) {
            err.textContent = 'Patientez, la photo est encore en traitement.';
            return;
          }
          const donnees = {
            joueurId: corps.querySelector('[data-personne]').value,
            objet: corps.querySelector('[data-objet]').value,
            date: corps.querySelector('[data-date]').value,
            photo: brouillon.photo,
          };
          try {
            if (existant) store.modifierAvis(existant.id, donnees);
            else store.ajouterAvis(donnees);
            fermer();
            toast(existant ? 'Avis modifié' : 'Avis de décès ajouté');
            rendreRegistre(hote);
          } catch (e) {
            err.textContent = e.message;
          }
        },
      },
    ],
  });
}

export const registre = { rendre: rendreRegistre };
