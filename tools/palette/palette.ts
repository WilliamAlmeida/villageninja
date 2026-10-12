// Paleta do cenário: grade com todas as artes de cenário (prédios, decorações, objetos, enfeites, região); o autor marca
// as preferidas e a paleta única sai delas (scripts/palette-from-favorites.py). As marcas ficam em
// docs/design/arte-iso/paleta-favoritos.json (GET/PUT /api/palette em scripts/editor.ts).

/** Pastas de src/art que são cenário (ver scripts/artpaths.py). */
const DIRS = ['buildings', 'buildings/deco', 'scenery', 'props', 'region'];
const LABEL: Record<string, string> = { buildings: 'Prédios', 'buildings/deco': 'Decoração', scenery: 'Objetos e locais', props: 'Enfeites', region: 'Região' };

const $ = (id: string) => document.getElementById(id)!;
let files: string[] = [];
let picked = new Set<string>();
let dir = 'todos';

const folderOf = (f: string) => f.slice(0, f.lastIndexOf('/'));

async function load() {
  const art = await fetch('/api/art').then((r) => r.json());
  files = (art.files as string[]).filter((f) => DIRS.includes(folderOf(f)));
  const fav = await fetch('/api/palette').then((r) => (r.ok ? r.json() : { picked: [] }));
  picked = new Set<string>((fav.picked as string[]).filter((f) => files.includes(f)));
  render();
}

let saving = 0;
async function save() {
  const n = ++saving;
  await fetch('/api/palette', { method: 'PUT', body: JSON.stringify({ picked: [...picked].sort() }) });
  if (n === saving) $('saved').textContent = `salvo ${new Date().toLocaleTimeString().slice(0, 5)}`;
}

function render() {
  const dirs = $('dirs');
  dirs.innerHTML = '';
  for (const d of ['todos', ...DIRS]) {
    const b = document.createElement('button');
    const n = d === 'todos' ? files.length : files.filter((f) => folderOf(f) === d).length;
    b.textContent = `${d === 'todos' ? 'Todos' : LABEL[d]} (${n})`;
    b.className = d === dir ? 'on' : '';
    b.onclick = () => {
      dir = d;
      render();
    };
    dirs.appendChild(b);
  }
  $('count').textContent = `${picked.size} marcadas`;
  const grid = $('grid');
  grid.innerHTML = '';
  for (const f of files) {
    if (dir !== 'todos' && folderOf(f) !== dir) continue;
    const card = document.createElement('div');
    card.className = `card${picked.has(f) ? ' on' : ''}`;
    card.innerHTML = `<div class="pic"><img loading="lazy" src="/art/${f}" alt=""></div><span class="nm">${f.slice(f.lastIndexOf('/') + 1, -4)}</span><span class="ok">✓</span>`;
    card.onclick = () => {
      if (picked.has(f)) picked.delete(f);
      else picked.add(f);
      card.classList.toggle('on', picked.has(f));
      $('count').textContent = `${picked.size} marcadas`;
      void save();
    };
    grid.appendChild(card);
  }
}

$('none').onclick = () => {
  if (!picked.size) return;
  picked.clear();
  render();
  void save();
};

void load();
