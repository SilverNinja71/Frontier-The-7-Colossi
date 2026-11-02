import { describe, expect, it } from 'vitest';
import {
  ARENA_RADIUS,
  CELL_SIZE,
  GRID_CELLS,
  heightAt,
  HeightGrid,
  inLake,
  ISLE,
  LAKE,
  LANDMARKS,
  PLAYABLE_RADIUS,
  roadAt,
  WATER_LEVEL,
  WORLD_HALF,
} from './geography.ts';

const grid = new HeightGrid();

describe('Bramble Primeval geography', () => {
  it('keeps the arena floor exactly level', () => {
    for (const [x, z] of [
      [0, 0],
      [12, -20],
      [-25, 10],
      [ARENA_RADIUS - 1, 0],
    ] as const) {
      expect(heightAt(x, z)).toBe(0);
    }
  });

  it('puts every landmark inside the playable land, with lake waystones on dry ground', () => {
    for (const l of LANDMARKS) {
      expect(Math.hypot(l.x, l.z)).toBeLessThan(PLAYABLE_RADIUS);
      if (inLake(l.stone.x, l.stone.z)) expect(grid.sample(l.stone.x, l.stone.z)).toBeGreaterThan(WATER_LEVEL);
    }
  });

  it('holds a wadeable lake with an isle above the water', () => {
    const bed = grid.sample(LAKE.x + LAKE.radius * 0.4, LAKE.z - LAKE.radius * 0.3);
    expect(inLake(LAKE.x, LAKE.z)).toBe(true);
    expect(bed).toBeLessThan(WATER_LEVEL);
    expect(WATER_LEVEL - bed).toBeLessThan(1.4); // never over the hunter's head
    expect(grid.sample(ISLE.x, ISLE.z)).toBeGreaterThan(WATER_LEVEL + 1);
  });

  it('rings the world with mountains', () => {
    expect(grid.sample(0, -(PLAYABLE_RADIUS + 70))).toBeGreaterThan(40);
    expect(grid.sample(PLAYABLE_RADIUS + 70, 0)).toBeGreaterThan(40);
  });

  it('levels the ground across a road', () => {
    const road = roadAt(2, -70);
    expect(road.weight).toBeGreaterThan(0.9);
    const left = heightAt(road.x - 1.5, road.z);
    const right = heightAt(road.x + 1.5, road.z);
    expect(Math.abs(left - right)).toBeLessThan(0.6);
  });

  it('samples grid vertices exactly and stores Rapier heights column-major', () => {
    const ix = 300;
    const iz = 123;
    const x = -WORLD_HALF + ix * CELL_SIZE;
    const z = -WORLD_HALF + iz * CELL_SIZE;
    expect(grid.sample(x, z)).toBeCloseTo(grid.at(ix, iz), 5);
    const rapier = grid.toRapierHeights();
    expect(rapier[iz + ix * (GRID_CELLS + 1)]).toBe(grid.at(ix, iz));
  });
});
