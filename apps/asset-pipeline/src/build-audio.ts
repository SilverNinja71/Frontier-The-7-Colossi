/**
 * Builds the sampled sound effects from Kenney's CC0 audio packs (https://kenney.nl):
 *
 *   npm run audio -w @frontier/asset-pipeline -- \
 *     --impact "<Impact Sounds>/Audio" --interface "<Interface Sounds>/Audio" --rpg "<RPG Audio>/Audio"
 *
 * The raw packs stay out of the repo. Each chosen clip is decoded to mono 44.1 kHz (ffmpeg),
 * trimmed of leading and trailing silence and peak-normalised, then all of them are laid end to
 * end (with gaps) into one sprite, `apps/client/public/assets/audio/sfx.mp3`, plus `sfx.json`
 * with each set's [start, duration] slices. The sprite opens with a single full-scale click at
 * SYNC_AT seconds: MP3 decoders differ in how much encoder delay they trim, so the client finds
 * the click and shifts every slice by the measured difference.
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

type Pack = 'impact' | 'interface' | 'rpg';

/** Every set the client can play (one variant picked at random each time). */
export const SAMPLE_SETS: Record<string, { pack: Pack; files: string[] }> = {
  punch: { pack: 'impact', files: range('impactPunch_medium_', 5) },
  punchHeavy: { pack: 'impact', files: range('impactPunch_heavy_', 5) },
  slice: { pack: 'rpg', files: ['knifeSlice', 'knifeSlice2'] },
  metal: { pack: 'impact', files: range('impactMetal_heavy_', 5) },
  bell: { pack: 'impact', files: range('impactBell_heavy_', 5) },
  plate: { pack: 'impact', files: range('impactPlate_medium_', 5) },
  tin: { pack: 'impact', files: range('impactTin_medium_', 5) },
  wood: { pack: 'impact', files: range('impactWood_medium_', 5) },
  thud: { pack: 'impact', files: range('impactSoft_heavy_', 5) },
  cloth: { pack: 'rpg', files: ['cloth1', 'cloth2', 'cloth3', 'cloth4'] },
  draw: { pack: 'rpg', files: ['drawKnife1', 'drawKnife2', 'drawKnife3'] },
  stepGrass: { pack: 'impact', files: range('footstep_grass_', 5) },
  stepStone: { pack: 'impact', files: range('footstep_concrete_', 5) },
  stepSnow: { pack: 'impact', files: range('footstep_snow_', 5) },
  stepWood: { pack: 'impact', files: range('footstep_wood_', 5) },
  stepDirt: { pack: 'rpg', files: ['footstep00', 'footstep02', 'footstep04', 'footstep06', 'footstep08'] },
  uiClick: { pack: 'interface', files: ['click_001', 'click_002', 'click_003'] },
  uiHover: { pack: 'interface', files: ['tick_001', 'tick_002'] },
  uiOpen: { pack: 'interface', files: ['open_001', 'open_002'] },
  uiClose: { pack: 'interface', files: ['close_001', 'close_002'] },
  uiToggle: { pack: 'interface', files: ['switch_002', 'switch_003'] },
  uiConfirm: { pack: 'interface', files: ['confirmation_001', 'confirmation_002'] },
  uiError: { pack: 'interface', files: ['error_004'] },
  uiDiscover: { pack: 'interface', files: ['maximize_006'] },
};

function range(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}${String(i).padStart(3, '0')}`);
}

const RATE = 44100;
const GAP = 0.12;
const SYNC_AT = 0.1;
const SILENCE_DB = -50;

const { values } = parseArgs({
  options: {
    impact: { type: 'string' },
    interface: { type: 'string' },
    rpg: { type: 'string' },
    out: { type: 'string', default: path.resolve(import.meta.dirname, '../../client/public/assets/audio') },
  },
});
const packDirs: Record<Pack, string | undefined> = { impact: values.impact, interface: values.interface, rpg: values.rpg };
for (const [pack, dir] of Object.entries(packDirs)) {
  if (!dir) throw new Error(`Missing --${pack} <pack>/Audio directory`);
}

/** Decodes any audio file to trimmed mono float samples at RATE. */
function decode(file: string): Promise<Float32Array> {
  const trim = `silenceremove=start_periods=1:start_threshold=${SILENCE_DB}dB`;
  const filter = `${trim},areverse,${trim},areverse`;
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-v', 'error', '-i', file, '-af', filter, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-']);
    const chunks: Buffer[] = [];
    ff.stdout.on('data', (c: Buffer) => chunks.push(c));
    ff.stderr.on('data', (c: Buffer) => process.stderr.write(c));
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg failed on ${file}`));
      const bytes = Buffer.concat(chunks);
      resolve(new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4).slice());
    });
  });
}

function encodeMp3(samples: Float32Array, out: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(RATE), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '96k', out]);
    ff.stderr.on('data', (c: Buffer) => process.stderr.write(c));
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg mp3 encode failed'))));
    ff.stdin.end(Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength));
  });
}

const pieces: Float32Array[] = [];
let cursor = Math.round((SYNC_AT + GAP) * RATE);
const manifest: Record<string, [number, number][]> = {};
for (const [name, set] of Object.entries(SAMPLE_SETS)) {
  manifest[name] = [];
  for (const file of set.files) {
    const clip = await decode(path.join(packDirs[set.pack]!, `${file}.ogg`));
    let peak = 0;
    for (const v of clip) peak = Math.max(peak, Math.abs(v));
    const gain = peak > 0 ? 0.89 / peak : 1;
    for (let i = 0; i < clip.length; i++) clip[i]! *= gain;
    pieces.push(clip);
    manifest[name]!.push([+(cursor / RATE).toFixed(4), +(clip.length / RATE).toFixed(4)]);
    cursor += clip.length + Math.round(GAP * RATE);
  }
  console.log(`${name.padEnd(11)} ${set.files.length} × ${set.pack}`);
}

const sprite = new Float32Array(cursor);
sprite[Math.round(SYNC_AT * RATE)] = 1; // the sync click
let at = Math.round((SYNC_AT + GAP) * RATE);
for (const clip of pieces) {
  sprite.set(clip, at);
  at += clip.length + Math.round(GAP * RATE);
}

await mkdir(values.out!, { recursive: true });
const mp3 = path.join(values.out!, 'sfx.mp3');
await encodeMp3(sprite, mp3);
await writeFile(path.join(values.out!, 'sfx.json'), `${JSON.stringify({ syncAt: SYNC_AT, sets: manifest })}\n`);
await writeFile(
  path.join(values.out!, 'CREDITS.txt'),
  `Sound effects by Kenney (https://kenney.nl), CC0 1.0:\n- Impact Sounds\n- Interface Sounds\n- RPG Audio\nTrimmed, normalised and packed into one sprite by apps/asset-pipeline/src/build-audio.ts.\n`,
);
console.log(`Wrote ${mp3} (${(sprite.length / RATE).toFixed(1)} s of audio)`);
