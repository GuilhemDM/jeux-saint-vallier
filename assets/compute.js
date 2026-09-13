// Calculs statistiques. Aucune dépendance au DOM : testable isolément.

export function filtrer(parties, { jeuId = null, joueurId = null, depuis = null } = {}) {
  return parties.filter((p) => {
    if (jeuId && p.jeuId !== jeuId) return false;
    if (joueurId && !p.joueurIds.includes(joueurId)) return false;
    if (depuis && p.date < depuis) return false;
    return true;
  });
}

// Victoires attendues d'un joueur parfaitement moyen sur cette partie.
function part(p) {
  return p.joueurIds.length ? p.gagnantIds.length / p.joueurIds.length : 0;
}

export function statsJoueurs(joueurs, parties, { seuil = 3 } = {}) {
  const chrono = [...parties].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const base = new Map(
    joueurs.map((j) => [
      j.id,
      {
        id: j.id,
        nom: j.nom,
        parties: 0,
        victoires: 0,
        defaites: 0,
        taux: 0,
        attendues: 0,
        indice: null,
        serie: 0,
        serieEnCours: 0,
        jeux: new Set(),
        derniere: null,
        parJeu: new Map(),
      },
    ])
  );
  for (const p of chrono) {
    const q = part(p);
    for (const id of p.joueurIds) {
      const s = base.get(id);
      if (!s) continue;
      const gagne = p.gagnantIds.includes(id);
      s.parties += 1;
      s.attendues += q;
      s.jeux.add(p.jeuId);
      s.derniere = p.date;
      const pj = s.parJeu.get(p.jeuId) || { parties: 0, victoires: 0 };
      pj.parties += 1;
      if (gagne) {
        s.victoires += 1;
        pj.victoires += 1;
        s.serieEnCours += 1;
        s.serie = Math.max(s.serie, s.serieEnCours);
      } else {
        s.serieEnCours = 0;
      }
      s.parJeu.set(p.jeuId, pj);
    }
  }
  const out = [...base.values()].map((s) => ({
    ...s,
    defaites: s.parties - s.victoires,
    taux: s.parties ? s.victoires / s.parties : 0,
    indice: s.attendues > 0 ? s.victoires / s.attendues : null,
    nbJeux: s.jeux.size,
    classable: s.parties >= seuil,
  }));
  out.sort((a, b) => classement(b) - classement(a) || a.nom.localeCompare(b.nom, 'fr'));
  return out;
}

// Ordre par défaut : indice de performance pour les joueurs classables,
// les autres derrière, départagés par nombre de victoires.
function classement(s) {
  if (!s.classable) return -1000 + s.victoires / 1000;
  return (s.indice ?? 0) * 100 + s.victoires / 10000;
}

export function statsJeux(jeux, parties, { seuil = 3 } = {}) {
  const map = new Map(
    jeux.map((g) => [
      g.id,
      { id: g.id, nom: g.nom, parties: 0, joueurs: new Set(), sommeJoueurs: 0, derniere: null, parJoueur: new Map() },
    ])
  );
  for (const p of parties) {
    const s = map.get(p.jeuId);
    if (!s) continue;
    s.parties += 1;
    s.sommeJoueurs += p.joueurIds.length;
    if (!s.derniere || p.date > s.derniere) s.derniere = p.date;
    for (const id of p.joueurIds) {
      s.joueurs.add(id);
      const e = s.parJoueur.get(id) || { parties: 0, victoires: 0 };
      e.parties += 1;
      if (p.gagnantIds.includes(id)) e.victoires += 1;
      s.parJoueur.set(id, e);
    }
  }
  return [...map.values()]
    .map((s) => {
      let roi = null;
      let meilleurTaux = null;
      let pireTaux = null;
      for (const [id, e] of s.parJoueur) {
        if (!roi || e.victoires > roi.victoires) roi = { id, ...e };
        if (e.parties >= seuil) {
          const t = e.victoires / e.parties;
          if (!meilleurTaux || t > meilleurTaux.taux) meilleurTaux = { id, taux: t, ...e };
          if (!pireTaux || t < pireTaux.taux) pireTaux = { id, taux: t, ...e };
        }
      }
      return {
        ...s,
        nbJoueurs: s.joueurs.size,
        moyenneJoueurs: s.parties ? s.sommeJoueurs / s.parties : 0,
        roi: roi && roi.victoires > 0 ? roi : null,
        meilleurTaux,
        pireTaux,
      };
    })
    .sort((a, b) => b.parties - a.parties || a.nom.localeCompare(b.nom, 'fr'));
}

export function resume(parties) {
  const joueurs = new Set();
  const jeux = new Set();
  let sommeJoueurs = 0;
  let sommeGagnants = 0;
  let multiples = 0;
  let derniere = null;
  for (const p of parties) {
    p.joueurIds.forEach((id) => joueurs.add(id));
    jeux.add(p.jeuId);
    sommeJoueurs += p.joueurIds.length;
    sommeGagnants += p.gagnantIds.length;
    if (p.gagnantIds.length > 1) multiples += 1;
    if (!derniere || p.date > derniere) derniere = p.date;
  }
  const n = parties.length;
  return {
    parties: n,
    joueurs: joueurs.size,
    jeux: jeux.size,
    moyenneJoueurs: n ? sommeJoueurs / n : 0,
    moyenneGagnants: n ? sommeGagnants / n : 0,
    partMultiples: n ? multiples / n : 0,
    derniere,
  };
}

export function parMois(parties, nb = 12) {
  const fin = new Date();
  const cases = [];
  const index = new Map();
  for (let i = nb - 1; i >= 0; i--) {
    const d = new Date(fin.getFullYear(), fin.getMonth() - i, 1);
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    index.set(cle, cases.length);
    cases.push({ cle, date: d, valeur: 0 });
  }
  for (const p of parties) {
    const i = index.get(p.date.slice(0, 7));
    if (i !== undefined) cases[i].valeur += 1;
  }
  return cases;
}

export function matrice(statsJ, jeux, { min = 1 } = {}) {
  const colonnes = jeux.filter((g) => statsJ.some((s) => (s.parJeu.get(g.id) || { parties: 0 }).parties >= min));
  const lignes = statsJ.filter((s) => s.parties > 0);
  return {
    colonnes,
    lignes: lignes.map((s) => ({
      nom: s.nom,
      cases: colonnes.map((g) => {
        const e = s.parJeu.get(g.id);
        return e && e.parties ? { parties: e.parties, victoires: e.victoires, taux: e.victoires / e.parties } : null;
      }),
    })),
  };
}

// Avec qui et contre qui : coéquipiers de table et confrontations directes.
export function duels(joueurId, parties, nomDe) {
  const map = new Map();
  for (const p of parties) {
    if (!p.joueurIds.includes(joueurId)) continue;
    const jeGagne = p.gagnantIds.includes(joueurId);
    for (const autre of p.joueurIds) {
      if (autre === joueurId) continue;
      const e = map.get(autre) || { id: autre, nom: nomDe(autre), ensemble: 0, mesVictoires: 0, sesVictoires: 0 };
      e.ensemble += 1;
      if (jeGagne) e.mesVictoires += 1;
      if (p.gagnantIds.includes(autre)) e.sesVictoires += 1;
      map.set(autre, e);
    }
  }
  return [...map.values()]
    .map((e) => ({ ...e, ecart: e.mesVictoires - e.sesVictoires }))
    .sort((a, b) => b.ensemble - a.ensemble);
}

export const fmt = {
  pct: (x) => (x === null || x === undefined ? '—' : (x * 100).toFixed(1).replace('.', ',') + ' %'),
  nb: (x, d = 1) => (x === null || x === undefined ? '—' : x.toFixed(d).replace('.', ',')),
  indice: (x) => (x === null || x === undefined ? '—' : x.toFixed(2).replace('.', ',')),
  date: (iso) => {
    if (!iso) return '—';
    const [a, m, j] = iso.split('-');
    return `${j}/${m}/${a}`;
  },
  mois: (d) => d.toLocaleDateString('fr-CA', { month: 'short' }).replace('.', ''),
};
