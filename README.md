# FRONTIER: The Seven Colossi

Web-first 3D action MMORPG — hardcore exploration, high-stakes combat, zero pay-to-win.
This repository is the **Phase 1** foundation: monorepo, shared contracts, deterministic combat
core, a playable training-grounds sandbox, and a CrazyGames SDK integration.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

| Script              | What it does                                        |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Vite dev server for the client                      |
| `npm run build`     | Production build → `apps/client/dist` (relative paths, uploadable as-is) |
| `npm run typecheck` | `tsc` across every workspace                        |
| `npm test`          | Vitest across every workspace                       |
| `npm run check`     | typecheck + test + build (CI entry point)           |

Append `?platform=crazygames` to the URL to force the CrazyGames integration locally.

## Layout

```text
frontier-mmo/
├── apps/
│   └── client/                 Vite + React 19 + three.js + Rapier3D + Zustand + Tailwind 4
│       └── src/
│           ├── engine/         Game loop, SceneManager (day/night), CameraRig (lock-on), InputController,
│           │                   TouchControls, PhysicsWorld, ArenaTerrain, PlayerCharacter, PlayerRig
│           ├── combat/         CombatSystem, TrainingDummy, ShadowStalker, BladeTrail, HitSparks,
│           │                   DamageNumbers
│           ├── audio/          Procedural WebAudio SFX (no audio files)
│           ├── platform/       PlatformService interface, CrazyGamesService, WebPlatformService
│           ├── ui/             HUD (React) + Zustand store
│           └── data/           Sandbox content typed against shared contracts
└── packages/
    ├── shared-types/           Canonical data shapes: stats, items, skills, marks, monsters,
    │                           colossi, world, network state/packets, monetization policy
    └── combat-math/            Deterministic shared simulation: motor (incl. parry/lock-on), frame
                                data, hit registration, damage, stats/marks, skill evolution,
                                world clock, Shadow Stalker brain, seeded RNG
```

`apps/server`, `apps/wiki-forum` and `apps/asset-pipeline` are Phase 2+; the `apps/*` workspace
glob and Turborepo pipeline already cover them.

Internal packages are consumed as TypeScript source (`exports → ./src/index.ts`, no build step).
They use only erasable syntax and `.ts` import specifiers so the future server can run them
directly under Bun or Node type stripping.

## Architecture notes

**One simulation, two runtimes.** `SIM_TICK_HZ = 30` is shared. The client turns input into an
`InputFrame` (intent only, never positions) and steps `stepMotor()`, a pure, allocation-free
state machine (`free → dodge / attack / parry → stagger / dead`) that outputs desired velocity. Rapier's
kinematic character controller resolves collisions. The authoritative server will step the
*same* motor on the *same* frames, which is what makes reconciliation by input replay possible.
Rendering interpolates between the last two ticks at display rate.

**Frame data lives in code, in ticks** (`combat-math/src/frame-data.ts`), so the server validates
exactly what the client animates. The dual-blade chain is Twin Cut → Return Cut → Crosswind
Finisher (360° spin). It has input buffering (6 ticks), dodge-cancel out of attack recovery,
and stamina costs. The dodge travels a fixed 4.2 m along an eased curve with i-frames on ticks 1–8.
A parry deflects on ticks 0–5 (200 ms) and guards late on ticks 6–10. Perfect parries refund
stamina and free you instantly, so you can deflect every blow of a combo. `resolveIncomingAttack`
decides dodged / parried / guarded / hit identically on client and server.

**World time is simulated, not wall-clock.** `world-clock.ts` derives time of day and a per-night
moon phase from a tick-advanced clock, so every shard agrees when the new moon rises.

**Colossus AI is shared code.** `shadow-stalker.ts` is a pure, seeded state machine (prowl,
telegraphed attacks, recoil, exposed, subdued, dawn dissolve) that outputs velocity and live
hitboxes like the player motor. The client renders it today; the server will run the same brain.

**Hit registration** sweeps a horizontal sector (reach × arc × height band) against sphere
hurtboxes. Weak points can be *directional*: the dummy's core only registers from behind
(`exposure.normal` / `minDot`), which is the template for colossus parts.

**Damage** is `attack × motionValue × 100/(100+defense) × hurtboxMultiplier × crit`. The crit
roll is injected from a seeded Mulberry32 RNG, and the hot path uses only operations that are
exact across JS engines.

**World marks & skill evolution** are data: e.g. *Mark of the Night Lycaon* applies
night-only modifiers and forbids the chest slot (`resolveStats`, `canEquipSlot`).
*Critical Strike* evolves into *Spiral Slash* at 1,000 precision hits (`findEvolution`).

**Fair economy in the type system.** `ItemSource` has no store/premium variant, so anything
with stats can only come from drops, crafting, quests or scenarios. `CosmeticDefinition`
declares `stats?: never`.

## The sandbox (Firstia Training Grounds)

| Desktop          | Touch            | Action                                        |
| ---------------- | ---------------- | --------------------------------------------- |
| WASD + mouse     | left thumb / right drag | Move / camera (click to pointer-lock; right-drag fallback) |
| LMB or J         | Strike           | 3-hit combo (mash or buffer)                  |
| Space            | Dodge            | Roll with i-frames; no direction = backstep   |
| RMB or L         | Parry            | Deflect at the moment of impact               |
| Tab or MMB       | Lock             | Lock on: camera tracks, you strafe and swing at the target |
| Shift            | Sprint (toggle)  | Drains stamina; empty → *winded*              |
| N                | pause menu       | Call the new moon (skip to the Shadow Stalker) |
| T                | pause menu       | Slam drill: telegraphed AoE every 5 s         |
| G                | pause menu       | Dummy tracking on/off                         |
| Esc / P          | II               | Pause (CrazyGames `gameplayStop`, banner slot) |
| F3               | —                | Debug overlay                                 |

Things to try:
- With tracking on, the dummy turns to face you at 55°/s. Dodge-roll around it to strike the
  glowing core on its back. Those crits count toward *Spiral Slash*.
- Turn on the slam drill and roll *through* the red ring as it lands for a **Perfect Dodge**.

## The Shadow Stalker (Unique Colossus #1)

A full day lasts 8 minutes; the sandbox starts in late afternoon, about a minute before a
new-moon night (or press **N**). At nightfall the Stalker rises across the arena and a world
announcement fires.

It is meant to be **brutal**. Expect to lose many nights before you subdue it.

- **Blades cannot wound it.** Every strike shows *IMMUNE* until it is Exposed.
- **Parry to break it.** A gold glint and gold eyes mean *this one can be parried*. Its eyes
  flash **white** in the instant before the blow lands: that is your timing cue, because its
  windups hesitate by a random few frames. The deflect window is 167 ms against claws and
  133 ms against the lunge. Each perfect parry drains its Resolve, and **five in a row**
  (watch the ◆◆◆◆◆ chain) collapse it Exposed for 2.5 s. Only the heart under its chest
  takes real damage; the body takes a quarter.
- **Red 危 means get out.** Moonless Howl (ring around it) and Shade Pounce (ring under you) can't
  be parried: dodge through with i-frames or outrun the ring.
- Its moves: *Rending Claws* (3-hit combo), *Shadow Lunge* (gap-closer, a parry knocks it
  back), *Moonless Howl*, *Shade Pounce*. Claws hit for ~195, the lunge ~300, the howl ~390
  against 1,000 HP: three mistakes and you are down.
- **Eclipse** below half Resolve: faster windups, faster chases, shorter pauses, and an
  unparried lunge flows straight into the claw combo.
- **No mercy:** no health regeneration while it hunts, late parries only halve damage, and each
  time it kills you it regains 35% of its Resolve.
- **Subdue it, or survive the whole night without dying once**, to earn the permanent
  **Mark of the Night Lycaon**: violet brands on your character, chest armor forbidden, +20%
  agility and +20% crit at night. It is saved in this browser for the sandbox (server-side in
  Phase 2). A win also calls CrazyGames `happytime()`.

Simulated nights against bots that read a given share of strikes correctly (a parry for
parryable blows, a dodge for perilous ones) and punish each exposure like a strong player:

| Strikes read correctly | Subdued within the night | Survived the night deathless |
| ---------------------- | ------------------------ | ---------------------------- |
| 100%                   | 99% (≈115 s)             | 100%                         |
| 95%                    | 89% (≈130 s)             | 75%                          |
| 90%                    | 55% (≈145 s)             | 31%                          |
| 85%                    | 15%                      | 6%                           |
| 80%                    | 0%                       | 0%                           |

The two ends of this curve are locked in as tests, so tuning changes cannot quietly make it
easy or impossible.

## CrazyGames SDK wrapper

`apps/client/src/platform/` exposes one `PlatformService` interface with two implementations:
`CrazyGamesService` (SDK v3) and `WebPlatformService` (web/Steam no-op). `createPlatformService()`
picks one from the hostname, the referrer, `?platform=` or `VITE_PLATFORM`.

```ts
const platform = createPlatformService();
await platform.init();                 // never throws; degrades to no-op if blocked/disabled
platform.loadingStart(); /* … */ platform.loadingStop();
platform.onAdBreak((active) => game.setAdBreak(active));   // pause sim + mute while an ad plays
platform.setAdContext('overworld');
platform.gameplayStart();              // idempotent; suspended automatically during ads
const result = await platform.showRewardedAd('cosmetic-doubloons');
if (result.ok) requestServerGrant();   // the server re-checks AD_POLICY — never grant client-side
```

Policy (`shared-types/src/monetization.ts`, enforced by the wrapper and meant to be re-checked by the server):

| Context          | Rewarded                          | Midgame | Banners |
| ---------------- | --------------------------------- | ------- | ------- |
| `menu`           | cosmetic doubloons                | ✓       | ✓       |
| `overworld`      | cosmetic doubloons                | —       | —       |
| `casual-dungeon` | cosmetic doubloons, revive token  | —       | —       |
| `colossus-raid`  | **nothing**                       | —       | —       |

On top of the SDK's own capping, the wrapper adds a local 3-minute midgame cooldown, a 60 s
refresh throttle per banner slot, single-flight ads, an ad timeout, auto-clearing of banners
when entering a no-banner context, and stable error reasons (`policy`, `cooldown`, `busy`,
`unfilled`, `adblock`, `sdk-unavailable`, `error`).

## Verification

- `npm run check`: typecheck, 47 unit tests (motor, dodge distance/i-frames, combo/cancel,
  parry windows/frontal arc/guard break, lock-on strafing, stamina exhaustion, hit registration
  incl. directional weak points, damage, marks, skill evolution, world clock and moon phases,
  simulated Shadow Stalker fights (a perfect-parry bot subdues it, a passive one never exposes
  it, dawn dissolves it, seeds are deterministic), its difficulty envelope, hesitating
  windups, per-attack deflect windows, Eclipse and feeding, SDK wrapper lifecycle/policy/errors/
  throttling/timeouts), and the production build.
- The production build was driven in headless Chromium: combo hits and the DPS meter, a
  precision core crit from behind, the slam drill (150 damage + stagger) and a perfect dodge
  (no damage), touch controls under mobile emulation, and the full CrazyGames call sequence
  against an intercepted SDK (`init → loadingStart/Stop → gameplayStart → gameplayStop →
  requestBanner → rewarded ad → gameplayStart`). The night encounter was driven too: emergence
  announcement, boss frame, lock-on, IMMUNE strikes, landed parries, the 危 peril warning and
  ring, its full attack cycle (pounce, howl, lunge, claw combo), respawn grace, and the mark
  panel/tattoo after a reload. No console errors.

## Phase 2 candidates

- `apps/server`: Colyseus `WorldZoneRoom` stepping `stepMotor` per `InputFrame`, schema classes
  implementing `PlayerNetState`/`WorldZoneNetState`, input-replay reconciliation on the client.
- Server-authoritative colossus: run `stepStalker` in a `ColossusRaidRoom`, one instance per world.
- `apps/asset-pipeline`: glTF → Draco + KTX2 batch CLI; swap `PlayerRig` meshes for the model.
- Gamepad input, WebGPU renderer path, recorded/foley audio to replace the synthesised SFX.
- Swap `@dimforge/rapier3d-compat` (base64 WASM, 1.7 MB gzip) for the streaming `.wasm` build.
- Lint/format (Biome or ESLint + Prettier) and CI running `npm run check`.

## License

[Mozilla Public License 2.0](LICENSE).
