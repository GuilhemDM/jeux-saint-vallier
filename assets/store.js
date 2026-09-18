// Données de la ligue : fichier publié dans le dépôt + copie de travail locale.
const LOCAL_KEY = 'jsv:db';
const PUBLISHED_URL = new URL('../data/db.json', import.meta.url).href;

export const MAX_JOUEURS = 15;
export const MAX_GAGNANTS = 8;

const listeners = new Set();
let db = null;
let published = null;

function vide() {
  return { version: 1, publieLe: '1970-01-01T00:00:00.000Z', joueurs: [], jeux: [], parties: [] };
}

// Assainit un classement (tableau de groupes d'ex æquo) : chaque id doit être un
// joueur de la partie, n'apparaître qu'une fois au total, et les groupes vides
// sont retirés. L'ordre des groupes est conservé (1er groupe = rang 1).
function figerGroupes(groupes, joueurIds) {
  const vus = new Set();
  return (groupes || [])
    .map((grp) =>
      (grp || []).map(String).filter((id) => {
        if (!joueurIds.includes(id) || vus.has(id)) return false;
        vus.add(id);
        return true;
      })
    )
    .filter((grp) => grp.length);
}

function normalise(raw) {
  const d = Object.assign(vide(), raw || {});
  d.joueurs = (d.joueurs || []).map((j) => ({ id: String(j.id), nom: String(j.nom) }));
  d.jeux = (d.jeux || []).map((g) => ({ id: String(g.id), nom: String(g.nom) }));
  const joueurIds = new Set(d.joueurs.map((j) => j.id));
  const jeuIds = new Set(d.jeux.map((g) => g.id));
  d.parties = (d.parties || [])
    .map((p) => {
      const joueursPartie = [...new Set((p.joueurIds || []).map(String))].filter((id) => joueurIds.has(id));
      // classement = source de vérité (groupes d'ex æquo ordonnés). À défaut,
      // on le reconstruit depuis l'ancien champ gagnantIds (rétrocompatible).
      let groupes = Array.isArray(p.classement)
        ? p.classement.map((grp) => (Array.isArray(grp) ? grp.map(String) : []))
        : null;
      if (!groupes) {
        const g = (p.gagnantIds || []).map(String).filter((id) => joueursPartie.includes(id));
        groupes = g.length ? [g] : [];
      }
      const classement = figerGroupes(groupes, joueursPartie);
      return {
        id: String(p.id),
        date: String(p.date || '').slice(0, 10),
        jeuId: String(p.jeuId),
        joueurIds: joueursPartie,
        classement,
        gagnantIds: classement[0] ? [...classement[0]] : [],
      };
    })
    .filter((p) => jeuIds.has(p.jeuId) && p.joueurIds.length > 0);
  return d;
}

export function uid(prefixe) {
  return prefixe + '-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

export async function init() {
  try {
    const res = await fetch(PUBLISHED_URL, { cache: 'no-store' });
    published = normalise(res.ok ? await res.json() : null);
  } catch {
    published = vide();
  }
  let local = null;
  try {
    const brut = localStorage.getItem(LOCAL_KEY);
    if (brut) local = normalise(JSON.parse(brut));
  } catch {
    local = null;
  }
  const localPlusRecent = local && new Date(local.publieLe) > new Date(published.publieLe);
  db = localPlusRecent ? local : published;
  return db;
}

export function get() {
  return db;
}

export function aDesChangementsLocaux() {
  return !!db && !!published && db.publieLe !== published.publieLe;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function commit() {
  db.publieLe = new Date().toISOString();
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(db));
  } catch {
    /* quota plein ou navigation privée : la session reste utilisable */
  }
  listeners.forEach((fn) => fn(db));
}

export function revenirAuPublie() {
  db = normalise(JSON.parse(JSON.stringify(published)));
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch { /* rien à nettoyer */ }
  listeners.forEach((fn) => fn(db));
}

export function exporter() {
  return JSON.stringify({ ...db, publieLe: new Date().toISOString() }, null, 2);
}

export function importer(texte) {
  const d = normalise(JSON.parse(texte));
  db = d;
  commit();
}

/* ------------------------------------------------------------ lectures */

export function joueur(id) {
  return db.joueurs.find((j) => j.id === id) || null;
}

export function jeu(id) {
  return db.jeux.find((g) => g.id === id) || null;
}

export function nomJoueur(id) {
  const j = joueur(id);
  return j ? j.nom : '—';
}

export function nomJeu(id) {
  const g = jeu(id);
  return g ? g.nom : '—';
}

export function joueursTries() {
  return [...db.joueurs].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

export function jeuxTries() {
  return [...db.jeux].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

export function partiesTriees() {
  return [...db.parties].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function usageJoueur(id) {
  return db.parties.filter((p) => p.joueurIds.includes(id)).length;
}

export function usageJeu(id) {
  return db.parties.filter((p) => p.jeuId === id).length;
}

/* ------------------------------------------------------------ écritures */

export function ajouterJoueur(nom) {
  const propre = nom.trim();
  if (!propre) throw new Error('Le nom ne peut pas être vide.');
  if (db.joueurs.some((j) => j.nom.toLowerCase() === propre.toLowerCase()))
    throw new Error(`${propre} est déjà dans la liste des joueurs.`);
  db.joueurs.push({ id: uid('j'), nom: propre });
  commit();
}

export function ajouterJeu(nom) {
  const propre = nom.trim();
  if (!propre) throw new Error('Le nom ne peut pas être vide.');
  if (db.jeux.some((g) => g.nom.toLowerCase() === propre.toLowerCase()))
    throw new Error(`${propre} est déjà dans la liste des jeux.`);
  db.jeux.push({ id: uid('g'), nom: propre });
  commit();
}

export function renommerJoueur(id, nom) {
  const propre = nom.trim();
  if (!propre) throw new Error('Le nom ne peut pas être vide.');
  if (db.joueurs.some((j) => j.id !== id && j.nom.toLowerCase() === propre.toLowerCase()))
    throw new Error(`${propre} est déjà dans la liste des joueurs.`);
  const j = joueur(id);
  if (j) { j.nom = propre; commit(); }
}

export function renommerJeu(id, nom) {
  const propre = nom.trim();
  if (!propre) throw new Error('Le nom ne peut pas être vide.');
  if (db.jeux.some((g) => g.id !== id && g.nom.toLowerCase() === propre.toLowerCase()))
    throw new Error(`${propre} est déjà dans la liste des jeux.`);
  const g = jeu(id);
  if (g) { g.nom = propre; commit(); }
}

export function supprimerJoueur(id) {
  const n = usageJoueur(id);
  if (n > 0)
    throw new Error(
      `${nomJoueur(id)} figure dans ${n} partie${n > 1 ? 's' : ''}. Retirez-le de ces parties avant de le supprimer.`
    );
  db.joueurs = db.joueurs.filter((j) => j.id !== id);
  commit();
}

export function supprimerJeu(id) {
  const n = usageJeu(id);
  if (n > 0)
    throw new Error(
      `${nomJeu(id)} compte ${n} partie${n > 1 ? 's' : ''} enregistrée${n > 1 ? 's' : ''}. Supprimez ces parties avant de supprimer le jeu.`
    );
  db.jeux = db.jeux.filter((g) => g.id !== id);
  commit();
}

function valider(partie) {
  if (!partie.date) throw new Error('Choisissez une date.');
  if (!jeu(partie.jeuId)) throw new Error('Choisissez un jeu.');
  const joueurIds = partie.joueurIds || [];
  if (joueurIds.length < 1) throw new Error('Ajoutez au moins un joueur.');
  if (joueurIds.length > MAX_JOUEURS) throw new Error(`Maximum ${MAX_JOUEURS} joueurs par partie.`);
  const vus = new Set();
  for (const grp of partie.classement || []) {
    for (const id of grp) {
      if (!joueurIds.includes(id)) throw new Error('Un joueur classé doit faire partie de la partie.');
      if (vus.has(id)) throw new Error('Un joueur ne peut apparaître qu\'une fois dans le classement.');
      vus.add(id);
    }
  }
}

export function ajouterPartie(partie) {
  valider(partie);
  const classement = figerGroupes(partie.classement, partie.joueurIds);
  db.parties.push({
    id: uid('p'),
    date: partie.date,
    jeuId: partie.jeuId,
    joueurIds: [...partie.joueurIds],
    classement,
    gagnantIds: classement[0] ? [...classement[0]] : [],
  });
  commit();
}

export function modifierPartie(id, partie) {
  valider(partie);
  const p = db.parties.find((x) => x.id === id);
  if (!p) throw new Error('Partie introuvable.');
  const classement = figerGroupes(partie.classement, partie.joueurIds);
  Object.assign(p, {
    date: partie.date,
    jeuId: partie.jeuId,
    joueurIds: [...partie.joueurIds],
    classement,
    gagnantIds: classement[0] ? [...classement[0]] : [],
  });
  commit();
}

export function supprimerPartie(id) {
  db.parties = db.parties.filter((p) => p.id !== id);
  commit();
}
