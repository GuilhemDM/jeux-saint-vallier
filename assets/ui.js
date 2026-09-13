export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

let minuteur = null;
export function toast(message) {
  document.querySelector('.toast')?.remove();
  const n = el(`<div class="toast" role="status">${esc(message)}</div>`);
  document.body.appendChild(n);
  clearTimeout(minuteur);
  minuteur = setTimeout(() => n.remove(), 3200);
}

// Modale générique. `corps` est un noeud ; `actions` une liste de boutons.
export function modale({ titre, corps, actions = [], surFermeture }) {
  const fond = el(`<div class="backdrop" role="dialog" aria-modal="true"></div>`);
  const boite = el(`
    <div class="modal">
      <header>
        <h3>${esc(titre)}</h3>
        <button class="icon-btn" data-fermer aria-label="Fermer">&times;</button>
      </header>
      <div class="body"></div>
      <footer></footer>
    </div>`);
  boite.querySelector('.body').appendChild(corps);
  const pied = boite.querySelector('footer');
  actions.forEach((a) => {
    const b = el(`<button class="btn ${a.classe || 'ghost'}">${esc(a.libelle)}</button>`);
    b.addEventListener('click', () => a.action(fermer));
    pied.appendChild(b);
  });
  fond.appendChild(boite);
  document.body.appendChild(fond);

  function fermer() {
    fond.remove();
    document.removeEventListener('keydown', surTouche);
    surFermeture?.();
  }
  function surTouche(e) {
    if (e.key === 'Escape') fermer();
  }
  fond.addEventListener('mousedown', (e) => {
    if (e.target === fond) fermer();
  });
  boite.querySelector('[data-fermer]').addEventListener('click', fermer);
  document.addEventListener('keydown', surTouche);
  setTimeout(() => boite.querySelector('input, select, button:not([data-fermer])')?.focus(), 30);
  return { fermer, boite };
}

export function confirmer({ titre, message, libelle = 'Supprimer' }) {
  return new Promise((resolve) => {
    let reponse = false;
    modale({
      titre,
      corps: el(`<p class="note">${esc(message)}</p>`),
      actions: [
        { libelle: 'Annuler', classe: 'ghost', action: (f) => f() },
        { libelle, classe: 'danger', action: (f) => { reponse = true; f(); } },
      ],
      surFermeture: () => resolve(reponse),
    });
  });
}

export function alerte(titre, message) {
  modale({
    titre,
    corps: el(`<p class="note">${esc(message)}</p>`),
    actions: [{ libelle: "J'ai compris", classe: 'ghost', action: (f) => f() }],
  });
}

export function telecharger(nomFichier, contenu, type = 'application/json') {
  const blob = new Blob([contenu], { type });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: nomFichier });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
