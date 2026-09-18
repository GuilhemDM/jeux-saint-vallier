import * as store from './store.js';
import * as calc from './compute.js';
import * as g from './charts.js';
import { esc, el } from './ui.js';

const fmt = calc.fmt;

const etat = {
  jeuId: '',
  joueurId: '',
  periode: 'tout',
  seuil: 3,
  tri: { col: 'defaut', sens: -1 },
};

const COLONNES = [
  { cle: 'nom', libelle: 'Joueur', type: 'texte' },
  { cle: 'parties', libelle: 'Parties', type: 'num' },
  { cle: 'victoires', libelle: 'Victoires', type: 'num' },
  { cle: 'defaites', libelle: 'Défaites', type: 'num' },
  { cle: 'taux', libelle: 'Taux', type: 'num' },
  { cle: 'placement', libelle: 'Placement', type: 'num' },
  { cle: 'attendues', libelle: 'Attendues', type: 'num' },
  { cle: 'indice', libelle: 'Indice', type: 'num' },
  { cle: 'serie', libelle: 'Meilleure série', type: 'num' },
  { cle: 'nbJeux', libelle: 'Jeux', type: 'num' },
  { cle: 'derniere', libelle: 'Dernière partie', type: 'texte' },
];

function depuisPeriode() {
  const d = new Date();
  if (etat.periode === '12m') {
    const x = new Date(d.getFullYear(), d.getMonth() - 11, 1);
    return x.toISOString().slice(0, 10);
  }
  if (etat.periode === 'annee') return `${d.getFullYear()}-01-01`;
  return null;
}

export function rendre(hote) {
  const db = store.get();
  hote.innerHTML = '';
  hote.appendChild(enTete());
  hote.appendChild(filtres());

  const parties = calc.filtrer(db.parties, {
    jeuId: etat.jeuId || null,
    joueurId: etat.joueurId || null,
    depuis: depuisPeriode(),
  });

  if (!db.parties.length) {
    hote.appendChild(
      el(`<div class="panel"><div class="empty"><strong>Aucune partie enregistrée</strong>
        Les statistiques apparaîtront dès la première partie saisie.</div></div>`)
    );
    return;
  }
  if (!parties.length) {
    hote.appendChild(
      el(`<div class="panel"><div class="empty"><strong>Rien à afficher avec ces filtres</strong>
        Élargissez la période ou choisissez un autre jeu.</div></div>`)
    );
    return;
  }

  const sj = calc.statsJoueurs(db.joueurs, parties, { seuil: etat.seuil });
  const actifs = sj.filter((s) => s.parties > 0);
  const sg = calc.statsJeux(db.jeux, parties, { seuil: etat.seuil }).filter((s) => s.parties > 0);
  const res = calc.resume(parties);

  hote.appendChild(podium(actifs));
  hote.appendChild(kpis(res));
  hote.appendChild(classement(actifs));
  hote.appendChild(graphiques(parties, actifs, sg));
  if (etat.joueurId) hote.appendChild(profil(etat.joueurId, parties, actifs));
  hote.appendChild(tableauJeux(sg));
  hote.appendChild(matrice(actifs, sg));
}

function enTete() {
  const filtreJeu = etat.jeuId ? store.nomJeu(etat.jeuId) : null;
  const filtreJoueur = etat.joueurId ? store.nomJoueur(etat.joueurId) : null;
  let sous = 'Tout le monde, tous les jeux.';
  if (filtreJeu && filtreJoueur) sous = `Parties de ${filtreJeu} auxquelles ${filtreJoueur} a participé.`;
  else if (filtreJeu) sous = `Uniquement les parties de ${filtreJeu}.`;
  else if (filtreJoueur) sous = `Uniquement les parties où ${filtreJoueur} était à la table — les autres joueurs affichés sont ses adversaires habituels.`;
  return el(`<div class="page-head">
      <div><h2>Statistiques</h2><p>${esc(sous)}</p></div>
    </div>`);
}

function filtres() {
  const jeux = store.jeuxTries();
  const joueurs = store.joueursTries();
  const n = el(`<div class="filters">
    <label class="field">Jeu
      <select data-f="jeuId">
        <option value="">Tous les jeux</option>
        ${jeux.map((x) => `<option value="${esc(x.id)}" ${x.id === etat.jeuId ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}
      </select>
    </label>
    <label class="field">Joueur
      <select data-f="joueurId">
        <option value="">Tous les joueurs</option>
        ${joueurs.map((x) => `<option value="${esc(x.id)}" ${x.id === etat.joueurId ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}
      </select>
    </label>
    <label class="field">Période
      <select data-f="periode">
        <option value="tout" ${etat.periode === 'tout' ? 'selected' : ''}>Depuis le début</option>
        <option value="12m" ${etat.periode === '12m' ? 'selected' : ''}>12 derniers mois</option>
        <option value="annee" ${etat.periode === 'annee' ? 'selected' : ''}>Année en cours</option>
      </select>
    </label>
    <label class="field">Minimum de parties pour les classements de taux
      <input type="number" min="1" max="50" step="1" value="${etat.seuil}" data-f="seuil">
    </label>
    <button class="btn ghost" data-raz>Réinitialiser</button>
  </div>`);
  n.addEventListener('change', (e) => {
    const champ = e.target.dataset.f;
    if (!champ) return;
    etat[champ] = champ === 'seuil' ? Math.max(1, Number(e.target.value) || 1) : e.target.value;
    rendre(document.querySelector('#vue'));
  });
  n.querySelector('[data-raz]').addEventListener('click', () => {
    Object.assign(etat, { jeuId: '', joueurId: '', periode: 'tout', seuil: 3 });
    rendre(document.querySelector('#vue'));
  });
  return n;
}

function podium(stats) {
  const trois = stats.slice(0, 3);
  if (trois.length < 3) return el('<div></div>');
  const places = ['1<sup>re</sup> place', '2<sup>e</sup> place', '3<sup>e</sup> place'];
  return el(`<div class="podium">
    ${trois
      .map(
        (s, i) => `<div class="seat ${i === 0 ? 'first' : ''}">
        <div class="rank">${places[i]}</div>
        <div class="name">${esc(s.nom)}</div>
        <div class="idx">${s.placement !== null ? fmt.pct(s.placement) : fmt.pct(s.taux)}</div>
        <div class="sub">${
          s.classable
            ? `score de placement · ${s.victoires} victoire${s.victoires > 1 ? 's' : ''} en ${s.parties} parties`
            : `score de placement · seulement ${s.parties} partie${s.parties > 1 ? 's' : ''}`
        }</div>
      </div>`
      )
      .join('')}
  </div>`);
}

function kpis(r) {
  const cases = [
    [r.parties, 'parties'],
    [r.joueurs, 'joueurs'],
    [r.jeux, 'jeux joués'],
    [fmt.nb(r.moyenneJoueurs), 'joueurs par partie'],
    [fmt.nb(r.moyenneGagnants, 2), 'gagnants par partie'],
    [fmt.date(r.derniere), 'dernière partie'],
  ];
  return el(`<div class="kpis">
    ${cases.map(([v, k]) => `<div class="kpi"><div class="v">${esc(v)}</div><div class="k">${esc(k)}</div></div>`).join('')}
  </div>`);
}

function trier(stats) {
  const { col, sens } = etat.tri;
  if (col === 'defaut') return stats;
  const copie = [...stats];
  copie.sort((a, b) => {
    const x = a[col];
    const y = b[col];
    if (typeof x === 'string' || x === null || y === null) {
      return String(x ?? '').localeCompare(String(y ?? ''), 'fr') * sens;
    }
    return (x - y) * sens;
  });
  return copie;
}

function classement(stats) {
  const lignes = trier(stats);
  const maxTaux = Math.max(0.0001, ...stats.map((s) => s.taux));
  const maxPlac = Math.max(0.0001, ...stats.map((s) => s.placement ?? 0));
  const n = el(`<section class="panel" style="margin-bottom:18px">
    <header>
      <h3>Classement</h3>
      <span class="hint">Trié par score de placement : la position moyenne dans les parties, ramenée sur 0–100 % (1<sup>er</sup> = 100 %, dernier = 0 %). Récompense les bonnes places, pas seulement les victoires. Les joueurs sous ${etat.seuil} parties passent en fin de tableau.</span>
    </header>
    <div class="scroll">
      <table>
        <thead><tr>
          <th class="rank">#</th>
          ${COLONNES.map(
            (c) =>
              `<th class="sortable ${c.type === 'num' ? 'num' : ''}" data-col="${c.cle}">${esc(c.libelle)}${
                etat.tri.col === c.cle ? ` <span class="dir">${etat.tri.sens === 1 ? '▲' : '▼'}</span>` : ''
              }</th>`
          ).join('')}
        </tr></thead>
        <tbody>
        ${lignes
          .map(
            (s, i) => `<tr class="${i === 0 && etat.tri.col === 'defaut' ? 'leader' : ''}">
            <td class="rank">${i + 1}</td>
            <td class="name">${esc(s.nom)}</td>
            <td class="num">${s.parties}</td>
            <td class="num">${s.victoires}</td>
            <td class="num">${s.defaites}</td>
            <td class="num">
              <div style="display:flex;align-items:center;gap:8px;justify-content:flex-end">
                <div class="bar" style="width:56px"><i style="width:${(s.taux / maxTaux) * 100}%"></i></div>
                ${fmt.pct(s.taux)}
              </div>
            </td>
            <td class="num">${
              s.placement === null
                ? '<span style="color:var(--ink-soft)">—</span>'
                : `<div style="display:flex;align-items:center;gap:8px;justify-content:flex-end">
                <div class="bar" style="width:56px"><i style="width:${(s.placement / maxPlac) * 100}%;background:var(--accent)"></i></div>
                ${fmt.pct(s.placement)}
              </div>`
            }</td>
            <td class="num">${fmt.nb(s.attendues, 2)}</td>
            <td class="num">${s.classable ? fmt.indice(s.indice) : '<span style="color:var(--ink-soft)">—</span>'}</td>
            <td class="num">${s.serie}</td>
            <td class="num">${s.nbJeux}</td>
            <td>${fmt.date(s.derniere)}</td>
          </tr>`
          )
          .join('')}
        </tbody>
      </table>
    </div>
  </section>`);
  n.querySelectorAll('th.sortable').forEach((th) =>
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (etat.tri.col === col) etat.tri.sens *= -1;
      else etat.tri = { col, sens: col === 'nom' ? 1 : -1 };
      rendre(document.querySelector('#vue'));
    })
  );
  return n;
}

function graphiques(parties, stats, statsJeux) {
  const mois = calc.parMois(parties, 12).map((m) => ({ etiquette: fmt.mois(m.date), valeur: m.valeur }));
  const top = [...stats].sort((a, b) => b.victoires - a.victoires).slice(0, 8);
  const jeuxTop = [...statsJeux].slice(0, 8);
  return el(`<div class="grid two" style="margin-bottom:18px">
    <section class="panel">
      <header><h3>Rythme des 12 derniers mois</h3></header>
      <div class="body">${g.colonnes(mois, { titre: 'Parties par mois' })}</div>
    </section>
    <section class="panel">
      <header><h3>Victoires</h3><span class="hint">8 premiers</span></header>
      <div class="body">${g.barres(
        top.map((s) => ({ etiquette: s.nom, valeur: s.victoires, couleur: 'var(--accent)' })),
        { titre: 'Victoires par joueur' }
      )}</div>
    </section>
    <section class="panel">
      <header><h3>Jeux les plus joués</h3></header>
      <div class="body">${g.barres(
        jeuxTop.map((s) => ({ etiquette: s.nom, valeur: s.parties })),
        { titre: 'Parties par jeu' }
      )}</div>
    </section>
    <section class="panel">
      <header><h3>Taux de victoire</h3><span class="hint">au moins ${etat.seuil} parties</span></header>
      <div class="body">${
        stats.filter((s) => s.classable).length
          ? g.barres(
              [...stats.filter((s) => s.classable)]
                .sort((a, b) => b.taux - a.taux)
                .slice(0, 8)
                .map((s) => ({ etiquette: s.nom, valeur: s.taux, couleur: g.couleurTaux(s.taux) })),
              { format: (v) => fmt.pct(v), titre: 'Taux de victoire' }
            )
          : `<p class="note">Personne n'atteint encore ${etat.seuil} parties avec ces filtres.</p>`
      }</div>
    </section>
  </div>`);
}

function profil(joueurId, parties, stats) {
  const moi = stats.find((s) => s.id === joueurId);
  if (!moi) return el('<div></div>');
  const d = calc.duels(joueurId, parties, store.nomJoueur).slice(0, 10);
  const meilleurJeu = [...moi.parJeu.entries()]
    .filter(([, e]) => e.parties >= etat.seuil)
    .sort((a, b) => b[1].victoires / b[1].parties - a[1].victoires / a[1].parties)[0];
  const plusJoue = [...moi.parJeu.entries()].sort((a, b) => b[1].parties - a[1].parties)[0];
  return el(`<section class="panel" style="margin-bottom:18px">
    <header>
      <h3>${esc(moi.nom)}</h3>
      <span class="hint">${moi.victoires} victoire${moi.victoires > 1 ? 's' : ''} en ${moi.parties} parties ·
        meilleure série de ${moi.serie} · ${
          plusJoue ? `joue surtout à ${esc(store.nomJeu(plusJoue[0]))}` : ''
        }${meilleurJeu ? ` · règne sur ${esc(store.nomJeu(meilleurJeu[0]))} (${fmt.pct(meilleurJeu[1].victoires / meilleurJeu[1].parties)})` : ''}</span>
    </header>
    <div class="body">
      ${
        d.length
          ? `<table>
        <thead><tr>
          <th>Adversaire</th><th class="num">Parties ensemble</th>
          <th class="num">Mes victoires</th><th class="num">Les siennes</th><th class="num">Écart</th>
        </tr></thead>
        <tbody>${d
          .map(
            (x) => `<tr>
            <td class="name">${esc(x.nom)}</td>
            <td class="num">${x.ensemble}</td>
            <td class="num">${x.mesVictoires}</td>
            <td class="num">${x.sesVictoires}</td>
            <td class="num" style="color:${x.ecart > 0 ? 'var(--brand)' : x.ecart < 0 ? 'var(--danger)' : 'var(--ink-soft)'};font-weight:600">
              ${x.ecart > 0 ? '+' : ''}${x.ecart}
            </td>
          </tr>`
          )
          .join('')}</tbody>
      </table>`
          : `<p class="note">Aucun adversaire enregistré sur cette sélection.</p>`
      }
    </div>
  </section>`);
}

function tableauJeux(stats) {
  return el(`<section class="panel" style="margin-bottom:18px">
    <header><h3>Par jeu</h3><span class="hint">« taux » calculé sur au moins ${etat.seuil} parties du jeu</span></header>
    <div class="scroll">
      <table>
        <thead><tr>
          <th>Jeu</th><th class="num">Parties</th><th class="num">Joueurs</th><th class="num">Table moyenne</th>
          <th>Roi du jeu</th><th>Meilleur taux</th><th>Pire taux</th><th>Dernière fois</th>
        </tr></thead>
        <tbody>
        ${stats
          .map(
            (s) => `<tr>
            <td class="name">${esc(s.nom)}</td>
            <td class="num">${s.parties}</td>
            <td class="num">${s.nbJoueurs}</td>
            <td class="num">${fmt.nb(s.moyenneJoueurs)}</td>
            <td>${s.roi ? `${esc(store.nomJoueur(s.roi.id))} <span class="note">(${s.roi.victoires})</span>` : '—'}</td>
            <td>${
              s.meilleurTaux
                ? `${esc(store.nomJoueur(s.meilleurTaux.id))} <span class="note">(${fmt.pct(s.meilleurTaux.taux)})</span>`
                : '—'
            }</td>
            <td>${
              s.pireTaux
                ? `${esc(store.nomJoueur(s.pireTaux.id))} <span class="note">(${fmt.pct(s.pireTaux.taux)})</span>`
                : '—'
            }</td>
            <td>${fmt.date(s.derniere)}</td>
          </tr>`
          )
          .join('')}
        </tbody>
      </table>
    </div>
  </section>`);
}

function matrice(stats, statsJeux) {
  const jeux = statsJeux.map((s) => ({ id: s.id, nom: s.nom }));
  const m = calc.matrice(stats, jeux);
  if (!m.colonnes.length || !m.lignes.length) return el('<div></div>');
  return el(`<section class="panel">
    <header>
      <h3>Qui gagne à quoi</h3>
      <span class="hint">Taux de victoire par joueur et par jeu. Case vide : jamais joué. Survolez pour le détail.</span>
    </header>
    <div class="body matrix-wrap">
      <table class="matrix">
        <thead><tr><th class="row"></th>${m.colonnes.map((c) => `<th class="col">${esc(c.nom)}</th>`).join('')}</tr></thead>
        <tbody>
          ${m.lignes
            .map(
              (l) => `<tr><th class="row">${esc(l.nom)}</th>${l.cases
                .map((c) =>
                  c
                    ? `<td><span title="${esc(l.nom)} — ${c.victoires}/${c.parties}"
                         style="background:${g.couleurTaux(c.taux)};color:${g.texteSur(c.taux)}">${Math.round(c.taux * 100)}</span></td>`
                    : '<td><span style="color:var(--line)">·</span></td>'
                )
                .join('')}</tr>`
            )
            .join('')}
        </tbody>
      </table>
      <div class="legend">
        <span><i style="background:${g.couleurTaux(0)}"></i> 0 %</span>
        <span><i style="background:${g.couleurTaux(0.34)}"></i> 34 %</span>
        <span><i style="background:${g.couleurTaux(0.67)}"></i> 67 %</span>
        <span><i style="background:${g.couleurTaux(1)}"></i> 100 %</span>
      </div>
    </div>
  </section>`);
}
