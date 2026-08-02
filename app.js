import { alleles, rollTail, isTail, TRAITS } from './allele.js';
import { renderPet, petOf, PET_CSS } from './pets.js';
import { cartridgeOf, keepsakeUrl } from './holo.js';
import { crossBreed } from './genetics.mjs';
import { verifyDescent, costOfGeneration, FUSE_ARITY,
         fuseAndBurn, spendRegistry, nullifierOf } from './fuse.js';

const s = document.createElement('style');
s.textContent = PET_CSS;
document.head.appendChild(s);

const $ = (q) => document.querySelector(q);
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

/** Every organism planted this session. Nothing persists — there is no pet row. */
const nursery = [];
let seq = 0;

async function add(tail, gen = 0) {
  const a = await alleles(tail);
  // The cartridge is the organism's real body — the 2D figure below is a
  // projection of this same genome, so the two can never disagree.
  const cart = await cartridgeOf(tail, a);
  const nul = await nullifierOf(tail);
  nursery.unshift({ tail, a, pet: petOf(a), cart, gen, nul, n: ++seq });
}

/* ── fusion ──
   Four organisms become one. See fuse.js for why this is the mechanic worth
   copying from Adopt Me, and why it can be added without inventing rarity. */
const selected = [];

/* The spend registry, backed by localStorage so a burn survives a reload.
   This is the local half of the burn: on this device a spent organism simply
   cannot be spent again. Nothing here is a claim about other devices — those
   are handled by detection, not prevention. */
const SPEND_KEY = 'rapp-pets/spent/1';
const spendStore = {
  read() { try { return JSON.parse(localStorage.getItem(SPEND_KEY) || '{}'); } catch { return {}; } },
  write(o) { try { localStorage.setItem(SPEND_KEY, JSON.stringify(o)); } catch {} },
  get(k) { return this.read()[k]; },
  set(k, v) { const o = this.read(); o[k] = v; this.write(o); },
  entries() { return Object.entries(this.read()); },
};
const registry = spendRegistry(spendStore);

function toggleSelect(tail) {
  const i = selected.indexOf(tail);
  if (i >= 0) selected.splice(i, 1);
  else if (selected.length < FUSE_ARITY) selected.push(tail);
  draw();
}

function drawSelection() {
  const box = $('#fusesel');
  if (!box) return;
  const btn = $('#fuse');
  if (btn) btn.disabled = selected.length !== FUSE_ARITY;

  if (!selected.length) {
    box.innerHTML = `<p class="sub">Click organisms in the nursery to select
      ${FUSE_ARITY} of them — or use the button above.</p>`;
    return;
  }
  const names = selected.map(t => {
    const o = nursery.find(x => x.tail === t);
    return o ? esc(o.pet.label) : esc(t.slice(0, 10));
  });
  box.innerHTML = `<p class="sub"><b>${selected.length}/${FUSE_ARITY}</b> selected:
    ${names.join(' · ')}${selected.length < FUSE_ARITY
      ? ` — ${FUSE_ARITY - selected.length} more.`
      : ' — ready.'}</p>`;
}

function tierRank(t) {
  return ['common', 'uncommon', 'rare', 'ultra', 'mythic'].indexOf(t);
}

function draw() {
  const box = $('#nursery');
  box.innerHTML = nursery.map(o => `
    <figure class="pet ${o.pet.tier}${selected.includes(o.tail) ? ' picked' : ''}${registry.isSpent(o.nul) ? ' spent' : ''}" data-tail="${esc(o.tail)}">
      ${renderPet(o.a, { id: 'n' + o.n, size: 170 })}
      <figcaption>
        <div class="pname">${esc(o.pet.label)}${o.gen ? ` <span class="gen">gen ${o.gen}</span>` : ''}</div>
        <div class="pmeta">${esc(o.pet.pattern)} · ${o.pet.period}s</div>
        <span class="tier ${o.pet.tier}">${o.pet.tier}</span>
        ${registry.isSpent(o.nul) ? '<div class="burned">spent — fused away</div>' : ''}
        <div class="ptail" title="${esc(o.tail)}">${esc(o.tail.slice(0, 16))}…</div>
        <a class="holo" href="${esc(keepsakeUrl(o.cart))}" target="_blank" rel="noopener"
           title="Opens in the hologram player. The whole organism rides in the URL fragment, which is never sent to a server.">see it in 3D →</a>
      </figcaption>
    </figure>`).join('');

  // Clicking an organism selects it for fusion — the nursery is the pen.
  box.querySelectorAll('.pet').forEach(fig => {
    fig.addEventListener('click', e => {
      if (e.target.closest('a')) return;   // let the 3D link through
      const o = nursery.find(x => x.tail === fig.dataset.tail);
      if (o && registry.isSpent(o.nul)) return;   // a spent organism is gone
      toggleSelect(fig.dataset.tail);
    });
  });

  drawSelection();

  if (!nursery.length) { $('#tally').textContent = ''; return; }

  const counts = {};
  nursery.forEach(o => counts[o.pet.tier] = (counts[o.pet.tier] || 0) + 1);
  const best = nursery.reduce((a, b) => tierRank(b.pet.tier) > tierRank(a.pet.tier) ? b : a);
  $('#tally').innerHTML =
    `<b>${nursery.length}</b> planted · ` +
    Object.entries(counts).sort((x, y) => tierRank(y[0]) - tierRank(x[0]))
      .map(([k, v]) => `${v} ${k}`).join(' · ') +
    ` · best so far: <b>${esc(best.pet.label)}</b> (${best.pet.tier})`;
}

/* ── nursery controls ── */
$('#plant').addEventListener('click', async () => { await add(rollTail()); draw(); });
$('#plant10').addEventListener('click', async () => {
  for (let i = 0; i < 10; i++) await add(rollTail());
  draw();
});
$('#wipe').addEventListener('click', () => { nursery.length = 0; seq = 0; draw(); });

$('#look').addEventListener('click', async () => {
  const t = ($('#tail').value || '').trim().toLowerCase();
  if (!isTail(t)) {
    $('#err').textContent = t
      ? `A tail is 64 hex characters — that one is ${t.length}.`
      : 'Paste a 64-hex tail first.';
    return;
  }
  $('#err').textContent = '';
  await add(t); draw();
});

/* ── kinship ──
   Two organisms sharing an allele is a verifiable relation, and neither has to
   disclose anything beyond a public tail to prove it. */
$('#kin').addEventListener('click', async () => {
  const A = ($('#kA').value || '').trim().toLowerCase();
  const B = ($('#kB').value || '').trim().toLowerCase();
  const out = $('#kinout');

  if (!isTail(A) || !isTail(B)) { out.innerHTML = `<p class="err">Both need to be 64-hex tails.</p>`; return; }
  if (A === B) { out.innerHTML = `<p class="err">Same tail — that is one organism, not two.</p>`; return; }

  const [a, b] = [await alleles(A), await alleles(B)];
  const rows = TRAITS.map(t => {
    const same = a[t.key].value === b[t.key].value;
    return `<tr class="${same ? 'same' : ''}">
      <td><code>${t.key}</code></td>
      <td>${esc(a[t.key].hex)}</td>
      <td>${esc(b[t.key].hex)}</td>
      <td>${same ? '<b>shared</b>' : '—'}</td></tr>`;
  }).join('');

  const shared = TRAITS.filter(t => a[t.key].value === b[t.key].value).map(t => t.key);
  out.innerHTML = `
    <div class="kinpets">
      ${renderPet(a, { id: 'kA', size: 130 })}
      ${renderPet(b, { id: 'kB', size: 130 })}
    </div>
    <table class="tbl">
      <thead><tr><th>trait</th><th>A</th><th>B</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="sub">${shared.length
      ? `They share <b>${shared.join(', ')}</b>. That is a real kinship — verifiable by anyone, offline, with neither organism disclosing anything private.`
      : `No shared alleles. They are unrelated in every trait — which, at these odds, is the ordinary case.`}</p>
    <div class="row"><button id="breed" class="btn">Breed these two</button></div>
    <div id="brood"></div>`;

  $('#breed').addEventListener('click', () => breed(A, B));
});

/* ── breeding ──
   Kinship says how two organisms are related. Breeding makes a third.

   The recombination is not ours: it is `crossBreed` from the cabinet's own
   genetics, vendored byte-identical, so a creature bred here is bred exactly
   the way the cabinet breeds it. That is what makes the child a real organism
   rather than a picture of one — it carries a content-addressed id the cabinet
   will re-derive and accept, and it names both parents.

   It is deterministic and order-sensitive: the same pair always yields the same
   child, and A×B is not B×A. So a bred creature can be re-derived by anyone
   holding the parents, and never has to be stored or trusted. */
async function breed(tailA, tailB) {
  const box = $('#brood');
  box.innerHTML = `<p class="sub">breeding…</p>`;

  const [cA, cB] = [
    await cartridgeOf(tailA, await alleles(tailA)),
    await cartridgeOf(tailB, await alleles(tailB)),
  ];
  const child = await crossBreed(cA, cB);

  const [form, surface] = child.genome.layers;
  box.innerHTML = `
    <div class="child">
      <div class="pname">${esc(child.title)}</div>
      <div class="pmeta">${esc(form.shape)} · ${esc(surface.pattern)} · ${form.limbs} limbs</div>
      <div class="swatches">${surface.palette
        .map(c => `<i style="background:${esc(c)}" title="${esc(c)}"></i>`).join('')}</div>
      <div class="ptail">id <code>${esc(child.id)}</code> — derived from the genome,
        so anyone can re-derive this exact child from these two parents.</div>
      <div class="ptail">parents <code>${esc(child.parents.join(' × '))}</code></div>
      <a class="holo" href="${esc(keepsakeUrl(child))}" target="_blank" rel="noopener">see the child in 3D →</a>
    </div>`;
}

$('#kinfill').addEventListener('click', async () => {
  while (nursery.length < 2) await add(rollTail());
  $('#kA').value = nursery[0].tail;
  $('#kB').value = nursery[1].tail;
  draw();
});

/* ── fusion controls ── */
$('#fusefill').addEventListener('click', async () => {
  while (nursery.length < FUSE_ARITY) await add(rollTail());
  selected.length = 0;
  nursery.slice(0, FUSE_ARITY).forEach(o => selected.push(o.tail));
  draw();
});

$('#fuseclear').addEventListener('click', () => { selected.length = 0; draw(); });

$('#fuse').addEventListener('click', async () => {
  const out = $('#fuseout');
  const parents = selected.slice();
  if (parents.length !== FUSE_ARITY) return;

  out.innerHTML = `<p class="sub">fusing…</p>`;

  // fuseAndBurn refuses parents this device has already consumed, so the burn
  // is enforced rather than merely described.
  let childTail, spent;
  try {
    ({ child: childTail, spent } = await fuseAndBurn(parents, registry));
  } catch (e) {
    out.innerHTML = `<p class="err">${esc(e.message)}</p>
      <p class="sub">A spent organism is gone. That is what makes the cost real.</p>`;
    selected.length = 0;
    draw();
    return;
  }

  // Never take our own word for it — recompute the descent the way a stranger
  // would, and show the result either way.
  const proven = await verifyDescent(childTail, parents);

  // The child's generation is one deeper than its deepest parent, so cost
  // compounds honestly: gen 2 really did take sixteen minted identities.
  const gen = 1 + Math.max(...parents.map(t => (nursery.find(o => o.tail === t) || {}).gen || 0));

  await add(childTail, gen);
  const kid = nursery[0];

  const names = parents.map(t => {
    const o = nursery.find(x => x.tail === t);
    return o ? o.pet.label : t.slice(0, 10);
  });

  out.innerHTML = `
    <div class="child">
      <div class="pname">${esc(kid.pet.label)} <span class="gen">gen ${gen}</span></div>
      <div class="pmeta">${esc(kid.pet.pattern)} · ${kid.pet.period}s ·
        <span class="tier ${kid.pet.tier}">${kid.pet.tier}</span></div>
      <div class="ptail">from ${esc(names.join(' + '))}</div>
      <div class="ptail">child tail <code>${esc(childTail.slice(0, 24))}…</code></div>
      <div class="ptail">${proven
        ? `descent <b>verified</b> — recomputed from the four parents, offline.`
        : `descent could not be verified.`}</div>
      <div class="ptail">burned <b>${spent.length}</b> organisms · nullifier
        <code>${esc(spent[0].slice(0, 16))}…</code> — those four cannot be spent
        again here, and if they are spent anywhere else the collision proves it.</div>
      <div class="ptail">a gen ${gen} organism costs
        <b>${costOfGeneration(gen)}</b> minted identities.
        Its tier is whatever the ordinary odds gave it — fusion does not uplift.</div>
      <a class="holo" href="${esc(keepsakeUrl(kid.cart))}" target="_blank" rel="noopener">see it in 3D →</a>
    </div>`;

  selected.length = 0;
  draw();
  out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

/* Open with one planted so the page is never an empty promise. */
(async () => { await add(rollTail()); draw(); })();
