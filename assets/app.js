import * as store from './store.js';
import { esc, el, toast } from './ui.js';
import * as theme from './theme.js';
import * as charts from './charts.js';
import * as vueStats from './vue-stats.js';
import * as vueParties from './vue-parties.js';
import * as vueData from './vue-data.js';

theme.init();

const IDENTIFIANT = 'Admin';
const MOT_DE_PASSE = 'JeuxDeSociete';
const CLE_ROLE = 'jsv:role';

const racine = document.querySelector('#app');

const role = {
  get: () => sessionStorage.getItem(CLE_ROLE),
  set: (r) => sessionStorage.setItem(CLE_ROLE, r),
  effacer: () => sessionStorage.removeItem(CLE_ROLE),
};

const ROUTES = {
  '#/stats': { titre: 'Statistiques', vue: vueStats, admin: false },
  '#/parties': { titre: 'Parties', vue: vueParties, admin: true },
  '#/data': { titre: 'Données', vue: vueData, admin: true },
};

function router() {
  const hash = location.hash || '#/';
  if (hash === '#/' || !ROUTES[hash]) return accueil();
  if (!role.get()) return (location.hash = '#/');
  if (ROUTES[hash].admin && role.get() !== 'admin') return (location.hash = '#/stats');
  page(hash);
}

/* ------------------------------------------------------------- accueil */

function accueil() {
  role.effacer();
  document.body.classList.add('gate-body');
  racine.innerHTML = '';
  const n = el(`<div class="gate">
    <div class="gate-card">
      <h1>Jeux de société<span class="of">de Saint-Vallier</span></h1>
      <div class="pips" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="gate-actions">
        <button class="btn light" data-admin>Admin</button>
        <button class="btn light" data-invite>Invité</button>
      </div>
      <div data-zone></div>
      <p class="gate-note">Les invités consultent les statistiques. L'admin tient le registre des parties.</p>
      <div class="gate-theme" data-theme-slot></div>
    </div>
  </div>`);

  n.querySelector('[data-theme-slot]').appendChild(theme.palette());

  const zone = n.querySelector('[data-zone]');
  n.querySelector('[data-invite]').addEventListener('click', () => {
    role.set('invite');
    location.hash = '#/stats';
  });
  n.querySelector('[data-admin]').addEventListener('click', () => {
    if (zone.firstChild) return zone.querySelector('input')?.focus();
    const f = el(`<form class="login" novalidate>
      <label>Nom d'utilisateur<input type="text" name="u" autocomplete="username" autocapitalize="off"></label>
      <label>Mot de passe<input type="password" name="p" autocomplete="current-password"></label>
      <p class="err" data-err></p>
      <button class="btn brass" type="submit">Se connecter</button>
    </form>`);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const u = f.elements.u.value.trim();
      const p = f.elements.p.value;
      if (u === IDENTIFIANT && p === MOT_DE_PASSE) {
        role.set('admin');
        location.hash = '#/stats';
      } else {
        f.querySelector('[data-err]').textContent = 'Identifiants refusés. Réessayez.';
        f.elements.p.value = '';
        f.elements.p.focus();
      }
    });
    zone.appendChild(f);
    setTimeout(() => f.elements.u.focus(), 30);
  });

  racine.appendChild(n);
}

/* ---------------------------------------------------------------- pages */

function page(hash) {
  document.body.classList.remove('gate-body');
  const admin = role.get() === 'admin';
  racine.innerHTML = '';
  racine.appendChild(barre(hash, admin));
  const main = el('<main><div id="vue"></div></main>');
  racine.appendChild(main);
  ROUTES[hash].vue.rendre(main.querySelector('#vue'));
  document.title = `${ROUTES[hash].titre} — Jeux de société de Saint-Vallier`;
  window.scrollTo(0, 0);
}

function barre(hash, admin) {
  const liens = [['#/stats', 'Statistiques']];
  if (admin) liens.push(['#/parties', 'Gestion des parties'], ['#/data', 'Données']);
  const enAttente = admin && store.aDesChangementsLocaux();
  const n = el(`<header class="topbar">
    <div class="topbar-in">
      <div class="brand">Jeux de société<small>de Saint-Vallier</small></div>
      <nav class="nav">
        ${liens.map(([h, t]) => `<a href="${h}" class="${h === hash ? 'on' : ''}">${esc(t)}</a>`).join('')}
      </nav>
      <div class="who">
        ${enAttente ? '<button class="btn sm on-felt" data-publier>Modifications à publier</button>' : ''}
        <span>${admin ? 'Admin' : 'Invité'}</span>
        <button class="btn sm on-felt" data-sortir>Quitter</button>
      </div>
    </div>
  </header>`);
  n.querySelector('.who').prepend(theme.palette());
  n.querySelector('[data-sortir]').addEventListener('click', () => {
    role.effacer();
    location.hash = '#/';
  });
  n.querySelector('[data-publier]')?.addEventListener('click', () => vueData.publier());
  return n;
}

/* ------------------------------------------------------------ démarrage */

window.addEventListener('hashchange', router);
store.subscribe(() => {
  const b = document.querySelector('.topbar');
  if (b) b.replaceWith(barre(location.hash, role.get() === 'admin'));
});

// Un changement de thème modifie des couleurs calculées en JS (la matrice) :
// on vide leur cache et on re-rend la vue affichée pour qu'elles se mettent à jour.
theme.surChangement(() => {
  charts.rafraichir();
  const vue = document.querySelector('#vue');
  const route = ROUTES[location.hash];
  if (vue && route) route.vue.rendre(vue);
});

store
  .init()
  .then(router)
  .catch((e) => {
    racine.innerHTML = `<main><div class="panel"><div class="empty">
      <strong>Les données n'ont pas pu être chargées</strong>${esc(e.message)}</div></div></main>`;
  });

// Raccourci discret : Maj+I pour réimporter un db.json depuis l'ordinateur.
document.addEventListener('keydown', (e) => {
  if (e.key === 'I' && e.shiftKey && role.get() === 'admin') {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json' });
    input.addEventListener('change', async () => {
      const f = input.files[0];
      if (!f) return;
      try {
        store.importer(await f.text());
        toast('Données importées');
        router();
      } catch (err) {
        toast('Fichier illisible : ' + err.message);
      }
    });
    input.click();
  }
});
