import { CharacterAction } from '@frontier/shared-types';
import { useEffect, useState, type ReactNode } from 'react';
import type { AdFailureReason, PlatformService } from '../platform/index.ts';
import { pushToast, useHud, type HudState } from './store.ts';

export function Hud({ platform }: { platform: PlatformService }) {
  const phase = useHud((s) => s.phase);
  const adBreak = useHud((s) => s.adBreak);
  return (
    <div className="pointer-events-none fixed inset-0 select-none font-sans text-white">
      {phase === 'loading' && <LoadingScreen />}
      {phase === 'error' && <ErrorScreen />}
      {phase === 'title' && <TitleScreen />}
      {(phase === 'playing' || phase === 'paused') && <PlayingHud />}
      {phase === 'paused' && <PauseMenu platform={platform} />}
      {adBreak && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/90 text-sm tracking-widest text-white/70 uppercase">
          Advertisement — the game is paused
        </div>
      )}
    </div>
  );
}

// --- Screens ----------------------------------------------------------------

function Title() {
  return (
    <div className="text-center">
      <div className="font-display text-5xl font-bold tracking-[0.35em] text-amber-100 drop-shadow-[0_4px_18px_rgba(0,0,0,0.8)] sm:text-7xl">
        FRONTIER
      </div>
      <div className="mt-2 text-xs font-semibold tracking-[0.5em] text-amber-200/80 uppercase sm:text-sm">The Seven Colossi</div>
    </div>
  );
}

function LoadingScreen() {
  const label = useHud((s) => s.loadingLabel);
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-8 bg-[#0b1020]">
      <Title />
      <div className="h-1 w-56 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/3 animate-[loading_1.1s_ease-in-out_infinite] rounded-full bg-amber-300/80" />
      </div>
      <div className="text-xs tracking-widest text-white/60 uppercase">{label}</div>
    </div>
  );
}

function ErrorScreen() {
  const error = useHud((s) => s.error);
  return (
    <div className="pointer-events-auto fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#0b1020] p-6 text-center">
      <Title />
      <p className="max-w-md text-sm text-rose-300">The training grounds failed to load. {error}</p>
      <p className="text-xs text-white/50">WebGL 2 and WebAssembly are required.</p>
    </div>
  );
}

function TitleScreen() {
  const commands = useHud((s) => s.commands);
  const touch = useHud((s) => s.touch);
  return (
    <div className="pointer-events-auto fixed inset-0 flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-black/60 via-black/25 to-black/70 p-6">
      <Title />
      <p className="max-w-md text-center text-sm text-white/75">
        Firstia Training Grounds. Learn the dual-blade rhythm — strike, dodge through danger, and find the dummy's exposed core.
      </p>
      <button
        type="button"
        onClick={() => commands?.play()}
        className="rounded-md border border-amber-300/60 bg-amber-500/20 px-10 py-3 text-sm font-bold tracking-[0.3em] text-amber-100 uppercase shadow-[0_0_30px_rgba(251,191,36,0.25)] transition hover:bg-amber-500/35 active:scale-95"
      >
        Enter the Arena
      </button>
      <ControlsGrid touch={touch} />
    </div>
  );
}

function ControlsGrid({ touch }: { touch: boolean }) {
  const rows: [string, string][] = touch
    ? [
        ['Left thumb', 'Move'],
        ['Right drag', 'Camera'],
        ['Strike', 'Combo (tap ×3)'],
        ['Dodge', 'Roll with i-frames'],
        ['Sprint', 'Toggle sprint'],
      ]
    : [
        ['WASD', 'Move'],
        ['Mouse', 'Camera (click to lock)'],
        ['LMB / J', 'Twin Cut combo ×3'],
        ['Space', 'Dodge roll (i-frames)'],
        ['Shift', 'Sprint'],
        ['T / G', 'Slam drill / dummy tracking'],
        ['Esc / P', 'Pause'],
        ['F3', 'Debug overlay'],
      ];
  return (
    <div className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1 rounded-lg border border-white/10 bg-black/40 px-5 py-3 text-xs">
      {rows.map(([key, action]) => (
        <div key={key} className="contents">
          <span className="font-mono font-bold text-amber-200">{key}</span>
          <span className="text-white/75">{action}</span>
        </div>
      ))}
    </div>
  );
}

function PauseMenu({ platform }: { platform: PlatformService }) {
  const commands = useHud((s) => s.commands);
  const target = useHud((s) => s.target);
  const doubloons = useHud((s) => s.doubloons);
  const [adMessage, setAdMessage] = useState<string | null>(null);
  const [adPending, setAdPending] = useState(false);
  const canReward = platform.canShowRewarded('cosmetic-doubloons');

  useEffect(() => {
    if (!platform.available) return;
    void platform.showBanner('pause-banner', '300x250');
    return () => platform.clearBanner('pause-banner');
  }, [platform]);

  const watchAd = async () => {
    setAdPending(true);
    const result = await platform.showRewardedAd('cosmetic-doubloons');
    setAdPending(false);
    if (result.ok) {
      // Preview only: in Phase 2 the server validates AD_POLICY and grants the currency.
      useHud.setState((s) => ({ doubloons: s.doubloons + 25 }));
      pushToast('+25 doubloons (cosmetic)', 'gold');
      setAdMessage(null);
    } else {
      setAdMessage(AD_FAILURE_TEXT[result.reason]);
    }
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-30 overflow-y-auto bg-black/55 backdrop-blur-[2px]">
      {/* Banner sits beside the panel on landscape embeds (e.g. 800×450) and wraps below on phones. */}
      <div className="flex min-h-full flex-wrap items-center justify-center gap-4 p-4">
        <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-white/15 bg-slate-950/85 p-6 shadow-2xl">
          <div className="text-center font-display text-2xl tracking-[0.3em] text-amber-100">PAUSED</div>
          <button
            type="button"
            onClick={() => commands?.resume()}
            className="rounded-md bg-amber-500/80 py-2.5 text-sm font-bold tracking-widest text-slate-950 uppercase hover:bg-amber-400 active:scale-[0.98]"
          >
            Resume
          </button>
          <div className="grid grid-cols-2 gap-2">
            <Toggle label="Slam drill" on={target.drill} onClick={() => commands?.toggleDrill()} />
            <Toggle label="Dummy tracking" on={target.tracking} onClick={() => commands?.toggleTracking()} />
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold tracking-wide text-amber-200 uppercase">Cosmetic shop</span>
              <span className="tabular-nums text-amber-100">{doubloons} doubloons</span>
            </div>
            <button
              type="button"
              disabled={!canReward || adPending}
              onClick={watchAd}
              className="w-full rounded-md border border-amber-300/40 py-2 font-semibold text-amber-100 enabled:hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {adPending ? 'Playing ad…' : 'Watch an ad · +25 doubloons'}
            </button>
            <p className="mt-2 text-white/50">
              {adMessage ??
                (canReward
                  ? 'Cosmetic-only. Stats are never for sale.'
                  : platform.available
                    ? 'Rewarded ads are not offered here.'
                    : 'Rewarded ads are available on CrazyGames builds.')}
            </p>
            <p className="mt-1 text-white/40">
              Revive tokens: casual dungeons only · No ads ever during Colossus raids
            </p>
          </div>
        </div>
        {platform.available && <div id="pause-banner" className="h-[250px] w-[300px] shrink-0" />}
      </div>
    </div>
  );
}

const AD_FAILURE_TEXT: Record<AdFailureReason, string> = {
  policy: 'Not offered in this context.',
  cooldown: 'Please wait a little before the next ad.',
  busy: 'An ad is already playing.',
  unfilled: 'No ad available right now — try again later.',
  adblock: 'An ad blocker prevented the ad.',
  'sdk-unavailable': 'Ads are unavailable on this build.',
  error: 'The ad failed to play.',
};

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-2 text-xs font-semibold transition ${
        on ? 'border-emerald-300/60 bg-emerald-500/20 text-emerald-100' : 'border-white/15 bg-white/5 text-white/60'
      }`}
    >
      {label}: {on ? 'On' : 'Off'}
    </button>
  );
}

// --- In-game HUD --------------------------------------------------------------

function PlayingHud() {
  return (
    <>
      <TargetFrame />
      <SkillTracker />
      <Toasts />
      <ComboCounter />
      <DebugPanel />
      <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 flex items-end gap-3">
        <Vitals />
      </div>
      <ActionBar />
    </>
  );
}

function Vitals() {
  const v = useHud((s) => s.vitals);
  return (
    <>
      <Orb value={v.hp} max={v.maxHp} label="HP" from="#7f1d1d" to="#ef4444" />
      <Orb
        value={v.stamina}
        max={v.maxStamina}
        label={v.exhausted ? 'Winded' : 'Stamina'}
        from={v.exhausted ? '#7c2d12' : '#3f6212'}
        to={v.exhausted ? '#f97316' : '#a3e635'}
        pulse={v.exhausted}
      />
    </>
  );
}

function Orb({ value, max, label, from, to, pulse = false }: { value: number; max: number; label: string; from: string; to: string; pulse?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={`relative h-[72px] w-[72px] overflow-hidden rounded-full border-2 border-white/25 bg-black/55 shadow-[0_0_24px_rgba(0,0,0,0.6)] sm:h-20 sm:w-20 ${pulse ? 'animate-pulse' : ''}`}
    >
      <div
        className="absolute inset-x-0 bottom-0 transition-[height] duration-150 ease-out"
        style={{ height: `${pct}%`, background: `linear-gradient(to top, ${from}, ${to})` }}
      />
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_28%,rgba(255,255,255,0.38),transparent_45%)]" />
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-tight">
        <span className="text-sm font-bold tabular-nums [text-shadow:0_1px_2px_#000]">{Math.ceil(value)}</span>
        <span className="text-[9px] tracking-widest uppercase opacity-80">{label}</span>
      </div>
    </div>
  );
}

function ActionBar() {
  const v = useHud((s) => s.vitals);
  const target = useHud((s) => s.target);
  const touch = useHud((s) => s.touch);
  if (touch) return null; // touch devices get on-screen buttons instead
  const attacking = v.action === CharacterAction.Attack;
  return (
    <div className="fixed bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
      <Slot keyLabel="LMB" name="Twin Cut" active={attacking} disabled={v.exhausted}>
        <div className="mt-1 flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-1.5 w-1.5 rounded-full ${attacking && i <= v.comboStep ? 'bg-amber-300' : 'bg-white/20'}`} />
          ))}
        </div>
      </Slot>
      <Slot keyLabel="Space" name="Dodge" active={v.action === CharacterAction.Dodge} highlight={v.invulnerable} disabled={v.exhausted} />
      <Slot keyLabel="Shift" name="Sprint" active={v.sprinting} disabled={v.exhausted} />
      <Slot keyLabel="T" name="Drill" active={target.drill} />
      <Slot keyLabel="G" name="Track" active={target.tracking} />
    </div>
  );
}

function Slot({
  keyLabel,
  name,
  active,
  disabled = false,
  highlight = false,
  children,
}: {
  keyLabel: string;
  name: string;
  active: boolean;
  disabled?: boolean;
  highlight?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={`flex h-14 w-16 flex-col items-center justify-center rounded-md border text-center transition ${
        highlight
          ? 'border-sky-300 bg-sky-500/30 shadow-[0_0_16px_rgba(56,189,248,0.6)]'
          : active
            ? 'border-amber-300/80 bg-amber-500/25'
            : 'border-white/15 bg-black/45'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      <span className="font-mono text-[10px] text-amber-200/90">{keyLabel}</span>
      <span className="text-[11px] font-semibold">{name}</span>
      {children}
    </div>
  );
}

function TargetFrame() {
  const t = useHud((s) => s.target);
  const pct = (t.hp / t.maxHp) * 100;
  return (
    <div className="fixed left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] w-[min(26rem,80vw)] -translate-x-1/2">
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-semibold tracking-wide [text-shadow:0_1px_3px_#000]">
          <span className="mr-1 text-amber-300">Lv.{t.level}</span>
          {t.name}
        </span>
        <span className="tabular-nums text-white/70 [text-shadow:0_1px_3px_#000]">
          {t.dps > 0 ? `${t.dps} DPS · ${t.total.toLocaleString()} dmg` : 'Strike to begin'}
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-sm border border-black/60 bg-black/60">
        <div className="absolute inset-y-0 left-0 bg-white/70 transition-[width] delay-200 duration-700 ease-out" style={{ width: `${pct}%` }} />
        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-rose-700 to-rose-500 transition-[width] duration-100" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SkillTracker() {
  const skill = useHud((s) => s.skill);
  const touch = useHud((s) => s.touch);
  const pct = Math.min(100, (skill.precisionHits / skill.goal) * 100);
  return (
    <div className={`fixed left-3 top-3 w-52 rounded-md border border-white/10 bg-black/45 p-2.5 text-[11px] ${touch ? 'hidden lg:block' : ''}`}>
      <div className="flex justify-between font-semibold">
        <span className="text-amber-200">{skill.name}</span>
        <span className="text-white/60">Lv.{skill.level}</span>
      </div>
      <div className="mt-1 text-white/60">
        Evolves into <span className="text-amber-100">{skill.evolvesInto}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 tabular-nums text-white/50">
        {skill.precisionHits} / {skill.goal} precision hits (core crits)
      </div>
    </div>
  );
}

const TOAST_TONE: Record<HudState['toasts'][number]['tone'], string> = {
  info: 'text-white/90',
  gold: 'text-amber-300 text-lg',
  cyan: 'text-sky-300 text-lg',
  danger: 'text-rose-400',
};

function Toasts() {
  const toasts = useHud((s) => s.toasts);
  return (
    <div className="fixed left-1/2 top-[22%] flex -translate-x-1/2 flex-col items-center gap-1">
      {toasts.map((t) => (
        <div key={t.id} className={`animate-toast-in font-bold tracking-[0.2em] whitespace-nowrap uppercase [text-shadow:0_2px_6px_#000] ${TOAST_TONE[t.tone]}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

function ComboCounter() {
  const combo = useHud((s) => s.combo);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (combo.count < 2) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(timer);
  }, [combo]);
  if (!visible) return null;
  return (
    <div className="fixed right-[8%] top-[38%] text-right">
      <div key={combo.count} className="animate-combo-pop font-display text-5xl font-black text-amber-200 [text-shadow:0_3px_10px_#000]">
        {combo.count}
      </div>
      <div className="text-xs font-bold tracking-[0.4em] text-white/70 uppercase">Hits</div>
    </div>
  );
}

function DebugPanel() {
  const debug = useHud((s) => s.debug);
  const platformId = useHud((s) => s.platformId);
  if (!debug.visible) return null;
  return (
    <div className="fixed right-3 top-3 rounded bg-black/70 p-2 font-mono text-[10px] leading-relaxed text-lime-300">
      <div>fps {debug.fps}</div>
      <div>tick {debug.tick}</div>
      <div>
        pos {debug.x.toFixed(2)}, {debug.z.toFixed(2)}
      </div>
      <div>action {debug.action}</div>
      <div>platform {platformId}</div>
    </div>
  );
}
