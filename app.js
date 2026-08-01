import { alleles, rollTail, isTail, TRAITS } from './allele.js';
import { renderPet, petOf, PET_CSS } from './pets.js';

const s = document.createElement('style');
s.textContent = PET_CSS;
document.head.appendChild(s);

const $ = (q) => document.querySelector(q);
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

/** Every organism planted this session. Nothing persists — there is no pet row. */
const nursery = [];
let seq = 0;

async function add(tail) {
  const a = await alleles(tail);
  nursery.unshift({ tail, a, pet: petOf(a), n: ++seq });
}

function tierRank(t) {
  return ['common', 'uncommon', 'rare', 'ultra', 'mythic'].indexOf(t);
}

function draw() {
  const box = $('#nursery');
  box.innerHTML = nursery.map(o => `
    <figure class="pet ${o.pet.tier}">
      ${renderPet(o.a, { id: 'n' + o.n, size: 170 })}
      <figcaption>
        <div class="pname">${esc(o.pet.label)}</div>
        <div class="pmeta">${esc(o.pet.pattern)} · ${o.pet.period}s</div>
        <span class="tier ${o.pet.tier}">${o.pet.tier}</span>
        <div class="ptail" title="${esc(o.tail)}">${esc(o.tail.slice(0, 16))}…</div>
      </figcaption>
    </figure>`).join('');

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
      : `No shared alleles. They are unrelated in every trait — which, at these odds, is the ordinary case.`}</p>`;
});

$('#kinfill').addEventListener('click', async () => {
  while (nursery.length < 2) await add(rollTail());
  $('#kA').value = nursery[0].tail;
  $('#kB').value = nursery[1].tail;
  draw();
});

/* Open with one planted so the page is never an empty promise. */
(async () => { await add(rollTail()); draw(); })();
