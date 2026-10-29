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
│           ├── engine/         Game loop, SceneManager, CameraRig, InputController, TouchControls,
│           │                   PhysicsWorld, ArenaTerrain, PlayerCharacter, PlayerRig
│           ├── combat/         CombatSystem, TrainingDummy, BladeTrail, HitSparks, DamageNumbers
│           ├── platform/       PlatformService interface, CrazyGamesService, WebPlatformService
│           ├── ui/             HUD (React) + Zustand store
│           └── data/           Sandbox content typed against shared contracts
└── packages/
    ├── shared-types/           Canonical data shapes: stats, items, skills, marks, monsters,
    │                           colossi, world, network state/packets, monetization policy
    └── combat-math/            Deterministic rules: motor, frame data, hit registration,
                                damage, stats/marks, skill evolution, seeded RNG
```

`apps/server`, `apps/wiki-forum` and `apps/asset-pipeline` are Phase 2+; the `apps/*` workspace
glob and Turborepo pipeline already cover them.

Internal packages are consumed as TypeScript source (`exports → ./src/index.ts`, no build step).
They use only erasable syntax and `.ts` import specifiers so the future server can run them
directly under Bun or Node type stripping.

## Architecture notes

**One simulation, two runtimes.** `SIM_TICK_HZ = 30` is shared. The client turns input into an
`InputFrame` (intent only, never positions) and steps `stepMotor()`, a pure, allocation-free
state machine (`free → dodge / attack → stagger / dead`) that outputs desired velocity. Rapier's
kinematic character controller resolves collisions. The authoritative server will step the
*same* motor on the *same* frames, which is what makes reconciliation by input replay possible.
Rendering interpolates between the last two ticks at display rate.

**Frame data lives in code, in ticks** (`combat-math/src/frame-data.ts`), so the server validates
exactly what the client animates. The dual-blade chain is Twin Cut → Return Cut → Crosswind
Finisher (360° spin). It has input buffering (6 ticks), dodge-cancel out of attack recovery,
and stamina costs. The dodge travels a fixed 4.2 m along an eased curve with i-frames on ticks 1–8.

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
| Shift            | Sprint (toggle)  | Drains stamina; empty → *winded*              |
| T                | pause menu       | Slam drill: telegraphed AoE every 5 s         |
| G                | pause menu       | Dummy tracking on/off                         |
| Esc / P          | II               | Pause (CrazyGames `gameplayStop`, banner slot) |
| F3               | —                | Debug overlay                                 |

Things to try:
- With tracking on, the dummy turns to face you at 55°/s. Dodge-roll around it to strike the
  glowing core on its back. Those crits count toward *Spiral Slash*.
- Turn on the slam drill and roll *through* the red ring as it lands for a **Perfect Dodge**.

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

- `npm run check`: typecheck, 26 unit tests (motor, dodge distance/i-frames, combo/cancel,
  stamina exhaustion, hit registration incl. directional weak points, damage, marks, skill
  evolution, SDK wrapper lifecycle/policy/errors/throttling/timeouts), and the production build.
- The production build was driven in headless Chromium: combo hits and the DPS meter, a
  precision core crit from behind, the slam drill (150 damage + stagger) and a perfect dodge
  (no damage), touch controls under mobile emulation, and the full CrazyGames call sequence
  against an intercepted SDK (`init → loadingStart/Stop → gameplayStart → gameplayStop →
  requestBanner → rewarded ad → gameplayStart`). No console errors.

## Phase 2 candidates

- `apps/server`: Colyseus `WorldZoneRoom` stepping `stepMotor` per `InputFrame`, schema classes
  implementing `PlayerNetState`/`WorldZoneNetState`, input-replay reconciliation on the client.
- Parry timing windows (`InputButton.Parry` is reserved) and the first colossus prototype.
- `apps/asset-pipeline`: glTF → Draco + KTX2 batch CLI; swap `PlayerRig` meshes for the model.
- Positional audio (hook into `onAdBreak` / `onMuteChange`), gamepad input, WebGPU renderer path.
- Swap `@dimforge/rapier3d-compat` (base64 WASM, 1.7 MB gzip) for the streaming `.wasm` build.
- Lint/format (Biome or ESLint + Prettier) and CI running `npm run check`.

## License

[Mozilla Public License 2.0](LICENSE).
