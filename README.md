# rapp-pets

> **Alleles are to this ecosystem what pets are to Adopt Me.**

**→ https://kody-w.github.io/rapp-pets/**

A pet is **not a record**. It is your alleles drawn — and an allele is derived
from a rappid's mint-once tail, so the pet cannot be re-rolled, faked, or
edited. Same tail, same pet, on every machine, forever.

## Why the naive copy fails

Adopt Me works because the pet is *yours specifically*: it hatched a certain
way, it is a certain rarity, and everyone can see it. Rarity creates
attachment; attachment creates a culture.

But Adopt Me's rarity is **server-authoritative** — a server rolls, records, and
is trusted because it is the only writer. RAPP has no server. It is local-first
and content-addressed, so anyone can write anything into their own files. A
rarity stored as a *field* — `{"rarity": "legendary"}` — is worth nothing,
because I can type that.

> **Any design where rareness is asserted is a design where rareness is free,
> and a currency that is free to mint is not a currency.**

## The move: derive it from the identity

A rappid's 64-hex tail is minted exactly once (RAPP/1 §6.2) and is then
immutable. So the allele is derived from the tail, domain-separated per §5:

```
allele(trait, rappid) = first bits of H("rapp/1:allele:" + trait, rappid_tail)
```

|                        | Adopt Me            | rapp-pets                          |
| ---------------------- | ------------------- | ---------------------------------- |
| who decides rarity     | the server          | the hash                           |
| can the owner fake it  | no (server)         | no (mint-once)                     |
| can anyone verify      | no (trust the server) | **yes, offline, no keys**        |
| what makes it scarce   | drop tables         | the cost of minting until one lands |

Rarity becomes **honest work**: to get a rare allele you mint identities until
one lands, exactly like a vanity address. The scarcity is real because the
electricity was real.

## Trait → anatomy

| trait   | bits | drives the pet's&hellip;                  |
| ------- | ---- | ----------------------------------------- |
| `coat`  | 8    | colourway and pattern                     |
| `tempo` | 8    | bob speed — how eagerly it acts           |
| `voice` | 8    | species silhouette, ear lift, tail curl   |
| `glow`  | 16   | the aura — the one tiered slot            |

**Only `glow` is tiered**, because the spec's bands are defined over 16 bits.
`coat`, `tempo` and `voice` are 8-bit *variety* — they colour the pet, they do
not rank it. Calling an 8-bit value "mythic" would be inventing rarity the spec
does not define.

Bands are **exclusive**, so the odds are the band widths:

| tier     | band            | odds        |
| -------- | --------------- | ----------- |
| common   | `< 0xC000`      | 3 in 4      |
| uncommon | `0xC000–0xEFFF` | ~1 in 5     |
| rare     | `0xF000–0xFEFF` | ~1 in 17    |
| ultra    | `0xFF00–0xFFFE` | ~1 in 257   |
| mythic   | `0xFFFF`        | 1 in 65,536 |

Measured here over 20,000 mints: **75.0 / 18.7 / 5.9 / 0.35 / 0** — matching the
spec's own measured column.

## Kinship

Two organisms may carry the **same allele**, and that is a real relation between
them — one anyone can verify offline, with **neither organism disclosing
anything** beyond a public tail. The site has a comparator for exactly this.

## What this must never become

- **Not a token.** No transfer, no balance, no price. An allele is a property of
  an identity, and identity is mint-once — there is nothing to detach and sell.
  You *have* an allele; you never trade it.
- **Not a gate.** An allele never affects what an organism may *do*. Capability
  comes from the mandate (Art. LVI), never from cosmetics. A mythic coat buys
  you a mythic coat.
- **Not private.** Alleles are computed from the public tail — pure DOG,
  bones-side by construction. Nothing here can leak.
- **Not inherited numerically.** An organism planted from another is a *new
  mint*: fresh tail, fresh alleles. Heritable-by-copy would let one lucky mint be
  cloned into infinite rare children and the scarcity would evaporate in a day.
  What *is* inherited is **descent** — the chain of who planted whom.
- **Fusion is implemented — but it is not an attestation.** Four organisms fuse
  into a child via `fuse(tails) = sha256("rapp/1:fuse\n" + sorted(tails))`, which
  is pure derivation: the child is an ordinary 64-hex tail whose alleles come out
  of the ordinary bands. Measured over 4,000 fusions the children land
  74.5 / 19.3 / 5.9 / 0.35 / 0 — the spec's distribution, **uninflated**. Fusing
  four mythics does not produce something better than mythic; the scarce axis is
  *generation* (gen 1 costs 4 mints, gen 2 costs 16, gen 3 costs 64), which is
  arithmetic rather than assertion.
  What is still **not** implemented is the **co-signed attestation** — four
  owners jointly asserting a shared trait. That needs §10 signatures and
  estate-owner authority, and shipping it before signing exists would be the same
  false-authority defect that retired `rapp-frame-net`.

## Verify it

```python
import hashlib
def allele(trait, tail, bits=16):
    h = hashlib.sha256(f"rapp/1:allele:{trait}\n{tail}".encode()).hexdigest()
    return int(h[:bits // 4], 16)
```

`allele.js` is that, line for line, and it is **byte-identical** to the copy in
[rappdex](https://github.com/kody-w/rappdex) — as is `pets.js`. The two apps
cannot drift, because they are the same two files.

## Files

```
index.html   the page
app.js       nursery + kinship wiring
allele.js    rapp-allele/1.0 derivation  (shared with rappdex, byte-identical)
pets.js      deterministic SVG pet renderer (shared with rappdex, byte-identical)
style.css
```

Everything runs in the browser. No account, no server, no network after load,
and nothing is stored — there is no pet row anyone could edit.

## Upstream

Spec: [`rapp-allele/1.0`](https://github.com/kody-w/rapp-mapp/blob/main/ALLELE.md)
in `kody-w/rapp-mapp`. Identity rules: RAPP/1 §6.2 (mint-once) and §5 (domain
separation). Governance: [RAPP/CONSTITUTION.md](https://github.com/kody-w/RAPP).

## Licence

MIT.
