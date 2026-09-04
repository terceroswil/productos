# Axie Survivors: Core Evolution

A survivors roguelite where the AXP you harvest never resets — it levels the one
Axie that is yours, run after run.

Built for the [Axie Vibeathon 2026](https://vibeathon.axieinfinity.ai/).

**Play:** https://loscaseritos.com/axie

---

## What it is

One HTML file. No build step, no dependencies, no external assets — the Axies are
drawn on a canvas and the sound is synthesised with the Web Audio API.

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

**The starter Buba carries the real body parts of Axie #5147** — Neo, Clover,
Goda, Little Branch, Ronin and Shiba. The Potential Point arithmetic lands on
11 Beast / 2 Bird / 2 Plant, the same split the marketplace shows for that Axie.

### One thing that is compressed

Axie #5147 needs 71,720 AXP to go from level 35 to 36. Here the first Ascension
lands at 1,675 — roughly a fortyfold compression. A judge has three runs, not
three months, and a loop nobody sees complete teaches nothing. The curve is a
demo scale; the structure underneath it is the real one.

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
  and the balance work. The game was run headless, frame by frame, to measure the
  design rather than guess at it — which is how three balance bugs were found and
  fixed.

No AI-generated art or audio.

## Licence

MIT.
