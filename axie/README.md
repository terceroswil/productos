# Axie Survivors: Core Evolution

A survivors roguelite where the AXP you harvest never resets — it levels the one
Axie that is yours, run after run.

Built for the [Axie Vibeathon 2026](https://vibeathon.axieinfinity.ai/).

**Play:** https://loscaseritos.com/axie

---

## What it is

One HTML file, a folder of art and a folder of effects. No build step and no
dependencies; the sound is synthesised with the Web Audio API. Everything you
see that is an Axie or a Chimera is the real thing, not an impression of it:

- **Your Axie** is built by the official `@axieinfinity/mixer` from real genes,
  with its real parts and colours, baked to a spritesheet.
- **The Chimeras** are the PvE Chimeras of Axie Infinity: Origins, straight out
  of the Battle Kit — treants, dryads, wolves, bears, slimes.
- **The combat VFX** are the Origins skill and buff effects.

All of it is local and loads on demand. If none of it arrives the game still
plays: it falls back to the hand-drawn creatures it had before.

You adopt one Axie and name it. Each run you hold off waves of corrupted Chimeras
across Lunacia and harvest AXP gems. When you die the run resets — your Axie does
not.

## The shape of a run

Ten minutes, with a named boss every two — one of each class, so each of the four
asks something different of your build. The clock counts down rather than up,
because a player should know how far they are from winning and not just how long
they have lasted. Reaching zero is an extraction, and it pays a bonus on
everything you harvested. A game you can only lose is a game you play once.

Every Chimera wears its class as its colour, and the colour is a read on
behaviour rather than only a damage multiplier:

- **Bird** — fast, weaves, hard to hit
- **Beast** — closes in, stops, telegraphs, then charges in a straight line
- **Plant** — slow and tough; a wall that cuts off your escape
- **Aquatic** — holds its distance and spits, so it is the one class you have to
  go and hunt

Roughly one Chimera in twenty-five drops a heart, and a boss always drops two.
Hearts are the one pickup the Eyes’ magnet does not pull in: you have to walk
onto them, which is the decision — the heart is usually lying where the fight
just was. Without them the run was not a fight but a clock. Measured before they
existed: six runs dying between 131 and 145 seconds with the arena nearly empty,
because 100 HP against unavoidable chip damage ends at 150 seconds no matter how
well anyone plays.

## Controls

Move with **WASD** or the **arrow keys**. On a phone or tablet, drag the joystick
at the bottom left. That is the whole scheme: your Axie's cards fire on their own
cooldowns, so the only thing you steer is where it stands.

On each level-up you pick one of three: evolve a body-part card, equip a Rune, or
attach a Charm to a specific card.

## How it maps to Axie Core

The Axie Core doc describes Axie Core as the Axie experience that is *"eternal and
not tied to one particular game"*, and asks third-party builders to feed the
player's Axie instead of building isolated experiences. Everything below works in
the prototype today.

| Axie | Here |
|---|---|
| AXP, off-chain and bound to the Axie | Harvested in runs, banks into a lifetime total, never resets on death |
| Levels to 60, on-chain | Same ceiling, driven by lifetime AXP |
| Ascension every 10 levels, unlocks part evolution | Same cadence; each Ascension raises the ceiling on permanent part upgrades |
| Six body parts, each one a card with its own class | Six cards; a Beast Axie with Plant ears has a Plant card |
| Potential Points: 2 per part of that part's class, 3 from the body | Same arithmetic, and Charms are paid out of it |
| One class-locked Rune per Axie, one Charm per card | Same, offered on level-up |
| Class triangle: ±15%, +10% for your own class | Same, and every Chimera wears its class as its colour |
| Rage stacking to Fury Form at 10 | Same, with a recovery window so Fury stays a spike |
| Origins skill and buff VFX | The official ones, played on the card’s own class |

**The starter Buba carries the real body parts of Axie #5147** — Neo, Clover,
Goda, Little Branch, Ronin and Shiba. The Potential Point arithmetic lands on
11 Beast / 2 Bird / 2 Plant, the same split the marketplace shows for that Axie.

### The creatures are the real ones

The Chimeras come from `Assets/OriginsKit/PvE/Avatars/portraits/` in the Battle
Kit, copied pixel for pixel — twenty creatures, 436 KB, white outline already
on them, which is exactly what a top-down game needs to keep them readable over
dark ground. Two of the kit’s twenty-two were left out: `machito` and `shilin`
are framed polaroid-style story portraits, not creatures.

⚠️ The kit ships **no Bird Chimera** — treants and dryads (Plant), wolves and
bears (Beast), aquatic slimes (Aquatic), and nothing else. Bird gets
`forest-slime-flower`, the one pink creature, because in this game pink *is*
Bird. One line of a table changes it if a real one ever appears.

⚠️ And because the sprite now owns how a creature looks, the class colour left
the body and moved to **the floor**: every Chimera stands on a ring of its
class colour, and your Axie stands on a white one, the only colour no class
uses. That last ring matters more than it sounds — once the Chimeras and your
Axie are drawn equally well, fifteen of them on screen and you cannot find
yourself.

Your Axie is not copied but **generated**, by `herramientas/horno-axie.cjs`:
`@axieinfinity/mixer` (MIT, Sky Mavis) builds the real skeleton from genes,
the part textures come from the official CDN, Spine animates it, and the tool
photographs 8 frames of `action/run` and 6 of `action/idle/normal` into a
spritesheet. It is baked **outside** the game for three reasons, and the third
is the one that matters: the mixer drags in PixiJS and pixi-spine, the textures
live on someone else’s server, and the rules warn that shipping Spine runtime
code needs a separate licence from Esoteric Software. Baked outside, what ships
is a PNG.

The class of an Axie lives in bits 3–6 of the first byte of its genes —
`(byte >> 3) & 0xF`, in the order Beast, Bug, Bird, Plant, Aquatic, Reptile.
Verified one class at a time against the variant the mixer returns. That is how
three classes come out of one sample gene string.

It also made the game **faster**: a frame of rendering went from 0.86 ms to
0.10 ms, because one `drawImage` costs less than fifty canvas path operations.

What was lost: the old drawing showed each card’s *level* — the tail grew, the
back appeared. That is gone from the body. It was traded knowingly: an Axie
that reads as an Axie in two seconds is worth more than a detail you had to go
looking for, and the card levels are written in the panel.

### The effects are the real ones

Every hit plays the Origins VFX for that card: the class the card actually is,
and the attack its body part actually performs — the horn gores, the mouth
bites, the tail smashes the ground. Fury Form plays the Origins transformation.
They come from the **Axie Origins Battle Kit** at the revision the Vibeathon
rules authorise, [`069a59b`](https://github.com/axieinfinity/axie-origins-asset-kit/tree/069a59b772e54633d04a3d9d12ecde73b3e4be5d),
and its `LICENSE.md` and `Third Party Notices.md` travel with the copy in `vfx/`.

They are not used as they ship. `herramientas/vfx-preparar.cjs` does two things
to them, and the reasons are written out in full at the top of that file:

- **Subtracts the recorded background.** The clips are additive and were captured
  on `[19,22,27]`, not on black. Added over Lunacia’s warm ground, those 19
  points drew the rectangle of the frame around every effect.
- **Halves them.** A PNG costs width × height × 4 bytes once the browser opens
  it, not its file size. `fury_on_transfrom` alone was 110 MB, and one run held
  243 MB. This game has a joystick — it is played on phones, where that is a
  dead tab. Halved: 156 MB for the whole set, 5.9 MB on disk instead of 18.4,
  and no visible loss, because the effects draw at about half size anyway.

Nothing is done by hand. Re-download the folder from that commit, run the tool,
and you get what is in the repo.

### The arc, measured

The game plays itself in a test harness — no rendering, a bot that flees, picks
up gems and takes healing when it is hurt. Four simulated player lifetimes of six
runs each, every one the same shape:

| run | outcome | what the Axie gains |
|---|---|---|
| 1 | dies around 255 s | first Ascension; body parts unlock to level 2 |
| 2 | dies around 255 s, or extracts | parts to 2 across the board |
| 3 | extracts at 10:00 | Ascensions 2–3; parts to 4 |
| 4 | extracts | parts maxed at 5 |
| 6–8 | extracts | Axie reaches level 60 |

That shape is the point: the first run is meant to be lost, and losing it is what
teaches that the AXP stayed. A judge who plays three times sees the whole loop —
death, kept progress, visible power, extraction — without exhausting it.

Both curves were retuned to get there, and both were wrong in the same direction
before: the run was unwinnable and the Axie was finished in two games. With the
old numbers, at ten minutes 2,159 HP of Chimeras arrived per second and an Axie
with **all six cards maxed** could deal 1,129 — there was no build that finished
a run, and ten measured runs died at 85 seconds on average without ever meeting
the first boss. Meanwhile the Axie hit level 60 on the second run and every game
after that was identical.

### One thing that is compressed

Axie #5147 needs 71,720 AXP to go from level 35 to 36. Here the whole climb to
level 60 is about 217,000, and the first Ascension lands at 5,035 — one run. A
judge has three runs, not three months, and a loop nobody sees complete teaches
nothing. The curve is a demo scale; the structure underneath it is the real one.

### What this game deliberately does not do

It does not mint or promise tokens. A third-party game is not where AXS or bAXS
comes from. What a game at this tier can legitimately feed is AXP, and that is
what this one feeds.

## Running it locally

It is a single file, but it must be served over HTTP rather than opened from the
filesystem. Any static server works:

```bash
npx serve .
```

## Where the progression lives

`cargarAxie()` and `guardarAxie()` are the only two functions that read and write
the Axie. Today they use browser storage; pointing them at the Sky Mavis API and
a Ronin wallet is a contained change rather than a rewrite.

## AI tools used

- **Antigravity** — the first playable prototype: render loop, wave spawning, the
  six body-part attacks, the mobile joystick and the synthesised audio.
- **Claude Code (Claude Opus 5)** — the Axie Core persistence layer, Runes,
  Charms, Potential Points, the class triangle, Rage and Fury Form, the artwork,
  the balance work, and the Origins VFX integration with the tool that prepares
  the atlases. The game was run headless, frame by frame, to measure the design
  rather than guess at it — which is how three balance bugs were found and
  fixed, and how the VFX were checked: 1200 frames, 500 kills, no errors, and
  0.97 ms of a 16.7 ms frame.

No AI-generated art or audio.

## Licence

The game — code, gameplay systems, the Axie and Chimera artwork drawn on the
canvas, the writing — is **MIT**.

`vfx/` and `arte/` are **not**. Those are Sky Mavis / Axie Infinity assets —
the Origins VFX, the PvE Chimeras, and the Axie art the mixer composes — used
under the limited licence the Vibeathon rules grant: for the Vibeathon, not for
redistribution on their own and not commercially. `LICENSE.md` and `Third Party
Notices.md` sit in both folders, are the authoritative terms, and stay with any
copy. `arte/PROCEDENCIA.md` says exactly where every file came from and how to
re-derive it.

The mixer itself is MIT; the art it composes is not. And no Spine runtime code
ships here: the kit includes Spine data but not a Spine runtime licence, the
web VFX path does not need one, and the Axie sprites are baked before the game
ever runs.
