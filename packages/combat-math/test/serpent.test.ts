import { SIM_DT, type GroundPose } from '@frontier/shared-types';
import { describe, expect, it } from 'vitest';
import {
  createSerpentState,
  DeterministicRng,
  reviveSerpent,
  segmentPosition,
  SERPENT_ATTACKS,
  SERPENT_TUNING,
  serpentAttackResolved,
  SerpentEvent,
  serpentHurtboxes,
  SerpentPhase,
  serpentStruck,
  stepSerpent,
  wakeSerpent,
  type SerpentContext,
  type SerpentState,
} from '../src/index.ts';

const HOME = { x: 0, z: 0 };

function ctx(target: GroundPose, rng = new DeterministicRng(7), extra: Partial<SerpentContext> = {}): SerpentContext {
  return { target, targetAlive: true, targetInvulnerable: false, rng, dt: SIM_DT, ...extra };
}

function awake(target: GroundPose): SerpentState {
  const s = createSerpentState(HOME.x, HOME.z, 0, 26);
  wakeSerpent(s, target);
  for (let i = 0; i < SERPENT_TUNING.risingTicks; i++) stepSerpent(s, ctx(target));
  return s;
}

/** Force the next attack (tests drive specific moves). */
function begin(s: SerpentState, id: string): void {
  const a = SERPENT_ATTACKS[id]!;
  s.attack = a;
  s.attackSerial++;
  s.windupTicks = a.windupTicks;
  s.phase = SerpentPhase.Attack;
  s.phaseTick = 0;
}

describe('Gluttonous Serpent', () => {
  it('rises facing its prey, then hunts', () => {
    const prey = { x: 0, y: 0, z: -12, yaw: 0 };
    const s = createSerpentState(0, 0, 0, 26);
    expect(wakeSerpent(s, prey)).toBe(SerpentEvent.Awoke);
    expect(Math.abs(s.yaw)).toBeLessThan(1e-6); // -Z is straight ahead
    for (let i = 0; i < SERPENT_TUNING.risingTicks; i++) stepSerpent(s, ctx(prey));
    expect(s.phase).toBe(SerpentPhase.Hunt);
  });

  it('drags its body along the path its head took', () => {
    const s = createSerpentState(0, 0, 0, 1000);
    s.phase = SerpentPhase.Hunt;
    s.yaw = 0;
    const prey = { x: 0, y: 0, z: -400, yaw: 0 };
    for (let i = 0; i < 300; i++) stepSerpent(s, { ...ctx(prey), rng: new DeterministicRng(1) });
    const p = segmentPosition(s, 9);
    // Head travelled in a straight line, so segment 9 is ~10 spacings behind it.
    expect(Math.hypot(p.x - s.x, p.z - s.z)).toBeCloseTo(10 * SERPENT_TUNING.spacing, 0);
  });

  it('a parried Fang Lunge stuns the head, and the stunned head takes double damage', () => {
    const prey = { x: 0, y: 0, z: -6, yaw: 0 };
    const s = awake(prey);
    begin(s, 'fang-lunge');
    let hit = null;
    for (let i = 0; i < 40 && !hit; i++) hit = stepSerpent(s, ctx(prey)).hit;
    expect(hit?.attack.id).toBe('fang-lunge');
    expect(serpentAttackResolved(s, 'parried')).toBe(SerpentEvent.HeadStunned);
    expect(s.phase).toBe(SerpentPhase.Stunned);
    const before = s.hp;
    expect(serpentStruck(s, 'weakpoint', 100).applied).toBe(200);
    expect(serpentStruck(s, 'body', 100).applied).toBe(100);
    expect(s.hp).toBe(before - 300);
    for (let i = 0; i < SERPENT_TUNING.headStunTicks + 1; i++) stepSerpent(s, ctx(prey));
    expect(s.phase).toBe(SerpentPhase.Hunt);
  });

  it('a dodged or guarded bite does not stun it', () => {
    const prey = { x: 0, y: 0, z: -6, yaw: 0 };
    const s = awake(prey);
    begin(s, 'fang-lunge');
    expect(serpentAttackResolved(s, 'dodged')).toBe(0);
    expect(serpentAttackResolved(s, 'guarded')).toBe(0);
    expect(s.phase).toBe(SerpentPhase.Attack);
  });

  it('Devour drags prey in front of it towards the jaws and swallows it whole', () => {
    const s = awake({ x: 0, y: 0, z: -8, yaw: 0 });
    s.yaw = 0;
    s.hp = 5000;
    begin(s, 'devour');
    let prey = { x: 0, y: 0, z: s.z - 8, yaw: 0 };
    let swallowed = false;
    for (let i = 0; i < 120 && !swallowed; i++) {
      const r = stepSerpent(s, ctx(prey));
      prey = { ...prey, x: prey.x + r.shoveX, z: prey.z + r.shoveZ };
      swallowed = (r.events & SerpentEvent.Swallowed) !== 0;
    }
    expect(swallowed).toBe(true);
    expect(s.hp).toBe(5000 + SERPENT_TUNING.maxHp * SERPENT_TUNING.swallowHeal);
    // Then it spits the prey back out, away from its mouth.
    const r = stepSerpent(s, ctx(prey));
    expect(-Math.sin(s.yaw) * r.shoveX - Math.cos(s.yaw) * r.shoveZ).toBeGreaterThan(0.2);
  });

  it('a roll at the last moment slips out of its jaws, and prey outside the cone is not pulled', () => {
    const s = awake({ x: 0, y: 0, z: -8, yaw: 0 });
    s.yaw = 0;
    begin(s, 'devour');
    const close = { x: s.x, y: 0, z: s.z - 1.5, yaw: 0 };
    const beside = { x: s.x + 9, y: 0, z: s.z, yaw: 0 };
    let swallowed = false;
    let sidePull = 0;
    for (let i = 0; i < 70; i++) {
      const r = stepSerpent(s, ctx(close, undefined, { targetInvulnerable: true }));
      swallowed ||= (r.events & SerpentEvent.Swallowed) !== 0;
      const side = stepSerpent(createAwakeCopy(s), ctx(beside));
      sidePull += Math.abs(side.shoveX);
    }
    expect(swallowed).toBe(false);
    expect(sidePull).toBe(0);
  });

  it('enters Frenzy at half health and is slain at zero', () => {
    const s = awake({ x: 0, y: 0, z: -8, yaw: 0 });
    const half = serpentStruck(s, 'body', SERPENT_TUNING.maxHp / 2);
    expect(half.events & SerpentEvent.Frenzy).toBeTruthy();
    expect(s.frenzy).toBe(true);
    const end = serpentStruck(s, 'body', SERPENT_TUNING.maxHp);
    expect(end.events & SerpentEvent.Slain).toBeTruthy();
    expect(s.phase).toBe(SerpentPhase.Slain);
    expect(serpentStruck(s, 'weakpoint', 100).applied).toBe(0);
    reviveSerpent(s);
    expect(s.phase).toBe(SerpentPhase.Dormant);
    expect(s.hp).toBe(SERPENT_TUNING.maxHp);
  });

  it('burrows back and heals when its prey flees the Gullet', () => {
    const s = awake({ x: 0, y: 0, z: -8, yaw: 0 });
    serpentStruck(s, 'body', 2000);
    const far = { x: 0, y: 0, z: -80, yaw: 0 };
    let retreated = false;
    for (let i = 0; i < SERPENT_TUNING.leashTicks + SERPENT_TUNING.retreatTicks + 5; i++) {
      retreated ||= (stepSerpent(s, ctx(far)).events & SerpentEvent.Retreated) !== 0;
    }
    expect(retreated).toBe(true);
    expect(s.phase).toBe(SerpentPhase.Dormant);
    expect(s.hp).toBe(SERPENT_TUNING.maxHp);
  });

  it('Bile Spit leaves acid that burns prey standing in it', () => {
    const prey = { x: 0, y: 0, z: -10, yaw: 0 };
    const s = awake(prey);
    begin(s, 'bile-spit');
    let burned = false;
    for (let i = 0; i < 80; i++) burned ||= stepSerpent(s, ctx(prey)).acid;
    expect(s.pools.length).toBeGreaterThan(0);
    expect(burned).toBe(true);
  });

  it('its coils are solid: prey inside the body is pushed out', () => {
    const s = awake({ x: 0, y: 0, z: -8, yaw: 0 });
    const p = segmentPosition(s, 6);
    const inside = { x: p.x + 0.2, y: 0, z: p.z, yaw: 0 };
    const r = stepSerpent(s, ctx(inside));
    expect(Math.hypot(r.shoveX, r.shoveZ)).toBeGreaterThan(0.05);
  });

  it('exposes its head as the weak point and its body as armour', () => {
    const s = awake({ x: 0, y: 0, z: -8, yaw: 0 });
    const boxes = serpentHurtboxes(s, []);
    expect(boxes[0]!.kind).toBe('weakpoint');
    expect(boxes.slice(1).every((b) => b.kind === 'body' && b.damageMultiplier === 0.5)).toBe(true);
  });

  it('fights the same way for the same seed', () => {
    const run = () => {
      const prey = { x: 3, y: 0, z: -7, yaw: 0 };
      const s = awake(prey);
      const rng = new DeterministicRng(99);
      const attacks: string[] = [];
      for (let i = 0; i < 900; i++) {
        stepSerpent(s, ctx(prey, rng));
        if (s.attack && s.phaseTick === 1) attacks.push(s.attack.id);
      }
      return attacks;
    };
    const a = run();
    expect(a.length).toBeGreaterThan(3);
    expect(run()).toEqual(a);
  });
});

/** Shallow copy with its own trail, for side-by-side probes. */
function createAwakeCopy(s: SerpentState): SerpentState {
  return { ...s, trail: [...s.trail], pools: [...s.pools], cooldowns: { ...s.cooldowns } };
}
