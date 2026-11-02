import { CharacterAction } from '@frontier/shared-types';
import { useEffect, useState, type ReactNode } from 'react';
import type { AdFailureReason, PlatformService } from '../platform/index.ts';
import { LANDMARKS, WORLD_HALF } from '../world/geography.ts';
import { ICONS, type IconName } from './icons.ts';
import { pushToast, useHud, type HudState, type HuntReport } from './store.ts';

export function Hud({ platform }: { platform: PlatformService }) {
  const phase = useHud((s) => s.phase);
  const adBreak = useHud((s) => s.adBreak);
  const mapOpen = useHud((s) => s.mapOpen);
  return (
    <div className="pointer-events-none fixed inset-0 select-none font-sans text-white">
      {phase === 'loading' && <LoadingScreen />}
      {phase === 'error' && <ErrorScreen />}
      {phase === 'title' && <TitleScreen />}
      {(phase === 'playing' || phase === 'paused') && <PlayingHud />}
      {phase === 'playing' && <FallenOverlay />}
      {phase === 'paused' && <PauseMenu platform={platform} />}
      {phase === 'playing' && mapOpen && <WorldMap />}
      {(phase === 'playing' || phase === 'paused') && <HuntReportModal />}
      {adBreak && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/90 text-sm tracking-widest text-white/70 uppercase">
          Advertisement — the game is paused
        </div>
      )}
    </div>
  );
}

// --- Primitives ----------------------------------------------------------------

function Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'arcane' | 'ghost';

function Button({
  children,
  onClick,
  variant = 'secondary',
  size,
  block = false,
  icon,
  disabled = false,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: ButtonVariant;
  size?: 'sm' | 'lg';
  block?: boolean;
  icon?: IconName;
  disabled?: boolean;
  title?: string;
}) {
  const classes = [
    'fx-btn',
    variant !== 'secondary' && `fx-btn--${variant}`,
    size && `fx-btn--${size}`,
    block && 'fx-btn--block',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={classes} onClick={onClick} disabled={disabled} title={title}>
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 18} />}
      {children}
    </button>
  );
}

function Toggle({ label, on, onClick, hint }: { label: string; on: boolean; onClick: () => void; hint?: string }) {
  return (
    <button type="button" className="fx-toggle" aria-pressed={on} onClick={onClick} title={hint}>
      <span>{label}</span>
      <span className="fx-switch" />
    </button>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[10px] font-semibold tracking-[0.35em] text-amber-200/80 uppercase">
      <span className="fx-divider flex-1" />
      {children}
      <span className="fx-divider flex-1" />
    </div>
  );
}

// --- Screens ----------------------------------------------------------------

function Title() {
  return (
    <div className="text-center">
      <div className="mb-1 flex items-center justify-center gap-3 font-display text-sm font-semibold tracking-[0.6em] text-amber-200/90 uppercase sm:text-lg">
        <span className="fx-divider w-10 sm:w-20" />
        Sovereign
        <span className="fx-divider w-10 sm:w-20" />
      </div>
      <div className="font-display text-5xl font-bold tracking-[0.3em] text-amber-100 drop-shadow-[0_4px_18px_rgba(0,0,0,0.85)] sm:text-7xl">
        FRONTIER
      </div>
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
  const discovered = useHud((s) => s.explore.discovered.length);
  return (
    <div className="pointer-events-auto fixed inset-0 overflow-y-auto bg-gradient-to-b from-black/65 via-black/20 to-black/75">
      <div className="flex min-h-full flex-col items-center justify-center gap-6 p-6">
        <Title />
        <p className="max-w-md text-center text-sm leading-relaxed text-white/80 [text-shadow:0_1px_4px_#000]">
          Learn the rhythm in the arena of the First Bastion — strike, dodge, parry — then walk out of the gates. Ridges, a lake, a
          haunted wood: {LANDMARKS.length} landmarks wait in the wilds. When the new moon rises, something else hunts.
        </p>
        <Button variant="primary" size="lg" icon="play" onClick={() => commands?.play()}>
          Enter the Bastion
        </Button>
        {discovered > 1 && (
          <div className="text-xs tracking-wide text-sky-200/80">
            {discovered}/{LANDMARKS.length} landmarks discovered
          </div>
        )}
        <ControlsGrid touch={touch} />
        {!touch && (
          <div className="max-w-md text-center text-[11px] text-white/50">
            Gamepad: LS move · RS camera · X/RT strike · A dodge · RB parry · B/LT sprint · Y swap · R3 lock · Back map · Start pause
          </div>
        )}
        <RecordsLine />
      </div>
    </div>
  );
}

function RecordsLine() {
  const records = useHud((s) => s.records);
  if (records.hunts === 0) return null;
  return (
    <div className="text-center text-xs text-violet-200/80">
      Shadow Stalker · {records.hunts} {records.hunts === 1 ? 'hunt' : 'hunts'} · best {Math.round(records.bestResolveBroken * 100)}% of
      its Resolve broken · best chain {records.bestChain}
      {records.subdued > 0 && ` · subdued ×${records.subdued}`}
    </div>
  );
}

function ControlsGrid({ touch }: { touch: boolean }) {
  const rows: [string[], string][] = touch
    ? [
        [['Left thumb'], 'Move'],
        [['Right drag'], 'Camera'],
        [['Strike'], 'Combo'],
        [['Dodge'], 'Roll with i-frames'],
        [['Parry'], 'Deflect at the moment of impact'],
        [['Swap'], 'Twin Fangs ⇄ Ruyi Staff'],
        [['Map'], 'World map & discoveries'],
      ]
    : [
        [['W', 'A', 'S', 'D'], 'Move'],
        [['Mouse'], 'Camera (click to lock)'],
        [['LMB', 'J'], 'Strike combo'],
        [['Space'], 'Dodge roll (i-frames)'],
        [['RMB', 'L'], 'Parry: deflect at the moment of impact'],
        [['Q'], 'Swap weapon: Twin Fangs ⇄ Ruyi Staff'],
        [['Tab'], 'Lock on'],
        [['Shift'], 'Sprint'],
        [['M'], 'World map & discoveries'],
        [['T', 'G', 'Y'], 'Slam drill · dummy tracking · parry drill'],
        [['N'], 'Call the new moon (sandbox)'],
        [['Esc'], 'Pause'],
      ];
  return (
    <div className="fx-panel grid grid-cols-[auto_auto] items-center gap-x-5 gap-y-1.5 px-5 py-4 text-xs">
      {rows.map(([keys, action]) => (
        <div key={action} className="contents">
          <span className="flex flex-wrap justify-end gap-1">
            {keys.map((k) => (
              <span key={k} className="fx-key">
                {k}
              </span>
            ))}
          </span>
          <span className="text-white/75">{action}</span>
        </div>
      ))}
    </div>
  );
}

function PauseMenu({ platform }: { platform: PlatformService }) {
  const commands = useHud((s) => s.commands);
  const bossVisible = useHud((s) => s.boss.visible);
  const target = useHud((s) => s.target);
  const doubloons = useHud((s) => s.doubloons);
  const weapon = useHud((s) => s.weapon);
  const discovered = useHud((s) => s.explore.discovered.length);
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
    <div className="pointer-events-auto fixed inset-0 z-30 overflow-y-auto bg-black/55 backdrop-blur-[3px]">
      {/* Banner sits beside the panel on landscape embeds (e.g. 800×450) and wraps below on phones. */}
      <div className="flex min-h-full flex-wrap items-center justify-center gap-4 p-4">
        <div className="fx-panel flex w-full max-w-sm flex-col gap-3.5 p-6">
          <div className="text-center font-display text-2xl font-bold tracking-[0.3em] text-amber-100">PAUSED</div>
          <Button variant="primary" block icon="play" onClick={() => commands?.resume()}>
            Resume
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" icon="map" onClick={() => commands?.openMap()}>
              Map {discovered}/{LANDMARKS.length}
            </Button>
            <Button size="sm" icon="swap" onClick={() => commands?.swapWeapon()} title="Swap weapon (Q)">
              Swap
            </Button>
          </div>
          <div className="text-center text-[11px] text-white/55">
            Wielding <span className="font-semibold text-amber-100">{weapon.name}</span> · {weapon.moves.join(' → ')}
          </div>

          <SectionTitle>Training</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <Toggle label="Slam drill" on={target.drill} onClick={() => commands?.toggleDrill()} />
            <Toggle label="Tracking" on={target.tracking} onClick={() => commands?.toggleTracking()} />
            <Toggle label="Parry drill" on={target.strikeDrill} onClick={() => commands?.toggleStrikeDrill()} />
          </div>
          <Button variant="arcane" block icon="moon" onClick={() => commands?.summonNewMoon()}>
            Call the new moon
          </Button>
          {bossVisible && (
            <Button variant="ghost" size="sm" block icon="sunrise" onClick={() => commands?.fleeToDawn()}>
              Flee until dawn · forfeits the mark
            </Button>
          )}
          <MarksPanel />

          <SectionTitle>Cosmetics</SectionTitle>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-xs">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold tracking-wide text-amber-200 uppercase">Shop</span>
              <span className="flex items-center gap-1 tabular-nums text-amber-100">
                <Icon name="coin" size={14} /> {doubloons}
              </span>
            </div>
            <Button variant="ghost" size="sm" block disabled={!canReward || adPending} onClick={watchAd}>
              {adPending ? 'Playing ad…' : 'Watch an ad · +25'}
            </Button>
            <p className="mt-2 text-white/50">
              {adMessage ??
                (canReward
                  ? 'Cosmetic-only. Stats are never for sale.'
                  : platform.available
                    ? 'Rewarded ads are not offered here.'
                    : 'Rewarded ads are available on CrazyGames builds.')}
            </p>
            <p className="mt-1 text-white/40">Revive tokens: casual dungeons only · No ads ever during Colossus raids</p>
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

function MarksPanel() {
  const marks = useHud((s) => s.marks);
  const commands = useHud((s) => s.commands);
  if (marks.length === 0) return null;
  return (
    <div className="rounded-lg border border-violet-300/25 bg-violet-950/40 p-3 text-xs">
      <div className="mb-1 font-semibold tracking-wide text-violet-200 uppercase">World marks</div>
      {marks.map((mark) => (
        <div key={mark.id} className="mb-2">
          <div className="flex justify-between">
            <span className="font-semibold text-violet-100">{mark.name}</span>
            <span className={mark.active ? 'text-violet-300' : 'text-white/40'}>{mark.active ? 'Active' : 'Dormant'}</span>
          </div>
          <p className="text-white/55">{mark.description}</p>
        </div>
      ))}
      <button type="button" onClick={() => commands?.clearMarks()} className="text-[11px] text-white/40 underline hover:text-white/70">
        Clear marks (sandbox only)
      </button>
    </div>
  );
}

// --- In-game HUD --------------------------------------------------------------

function PlayingHud() {
  const bossVisible = useHud((s) => s.boss.visible);
  return (
    <>
      {bossVisible ? <BossFrame /> : <TargetFrame />}
      <MinimapCorner />
      <Announcement />
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
      className={`relative h-[72px] w-[72px] overflow-hidden rounded-full border-2 border-amber-200/45 bg-black/60 shadow-[0_0_0_3px_rgba(10,12,18,0.75),0_0_24px_rgba(0,0,0,0.6)] sm:h-20 sm:w-20 ${pulse ? 'animate-pulse' : ''}`}
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
  const lockOn = useHud((s) => s.lockOn);
  const weapon = useHud((s) => s.weapon);
  const mapOpen = useHud((s) => s.mapOpen);
  if (touch) return null; // touch devices get on-screen buttons instead
  const attacking = v.action === CharacterAction.Attack;
  const staff = weapon.name.toLowerCase().includes('staff');
  const move = attacking ? weapon.moves[v.comboStep] : undefined;
  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 items-end gap-2">
      <Slot keyLabel="LMB" name={move ?? 'Strike'} icon={staff ? 'staff' : 'swords'} active={attacking} disabled={v.exhausted} primary>
        <div className="flex justify-center gap-1">
          {weapon.moves.map((m, i) => (
            <span
              key={m}
              className={`h-1.5 w-1.5 rotate-45 ${attacking && i <= v.comboStep ? 'bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.9)]' : 'bg-white/25'}`}
            />
          ))}
        </div>
      </Slot>
      <Slot keyLabel="Q" name="Swap" icon={staff ? 'swords' : 'staff'} active={false} />
      <Slot keyLabel="Space" name="Dodge" icon="dodge" active={v.action === CharacterAction.Dodge} highlight={v.invulnerable} disabled={v.exhausted} />
      <Slot keyLabel="RMB" name="Parry" icon="shield" active={v.action === CharacterAction.Parry} highlight={v.deflecting} disabled={v.exhausted} />
      <Slot keyLabel="Tab" name="Lock" icon="lock" active={lockOn} />
      <Slot keyLabel="Shift" name="Sprint" icon="sprint" active={v.sprinting} disabled={v.exhausted} />
      <Slot keyLabel="M" name="Map" icon="map" active={mapOpen} trainingOnly />
      <Slot keyLabel="T" name="Drill" icon="target" active={target.drill} trainingOnly />
      <Slot keyLabel="G" name="Track" icon="eye" active={target.tracking} trainingOnly />
    </div>
  );
}

function Slot({
  keyLabel,
  name,
  icon,
  active,
  disabled = false,
  highlight = false,
  trainingOnly = false,
  primary = false,
  children,
}: {
  keyLabel: string;
  name: string;
  icon: IconName;
  active: boolean;
  disabled?: boolean;
  highlight?: boolean;
  /** Secondary slots: dropped on narrower screens so the bar never covers the orbs. */
  trainingOnly?: boolean;
  primary?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={`fx-slot ${primary ? 'fx-slot--primary' : ''} ${trainingOnly ? 'max-lg:!hidden' : ''} ${primary ? '' : 'max-sm:!h-12 max-sm:!w-12'}`}
      data-state={highlight ? 'highlight' : active ? 'active' : 'idle'}
      data-disabled={disabled}
    >
      <span className="fx-key">{keyLabel}</span>
      <Icon name={icon} size={primary ? 24 : 19} />
      <span className={`fx-slot__name ${primary ? 'max-w-[64px] truncate' : 'max-sm:hidden'}`}>{name}</span>
      {children}
    </div>
  );
}

function TargetFrame() {
  const t = useHud((s) => s.target);
  const region = useHud((s) => s.explore.region);
  const pct = (t.hp / t.maxHp) * 100;
  // Out in the wilds the dummy's frame gives way to the region name.
  if (region && region !== 'Bastion Training Grounds' && t.dps === 0 && !t.strikeDrill) return null;
  return (
    <div className="fixed left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] w-[min(26rem,62vw)] -translate-x-1/2">
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-semibold tracking-wide [text-shadow:0_1px_3px_#000]">
          <span className="mr-1 text-amber-300">Lv.{t.level}</span>
          {t.name}
        </span>
        <span className="tabular-nums text-white/70 [text-shadow:0_1px_3px_#000]">
          {t.dps > 0 ? `${t.dps} DPS · ${t.total.toLocaleString()} dmg` : t.strikeDrill ? 'Parry its swings' : 'Strike to begin'}
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-sm border border-black/60 bg-black/60 shadow-[0_0_0_1px_rgba(253,230,138,0.25)]">
        <div className="absolute inset-y-0 left-0 bg-white/70 transition-[width] delay-200 duration-700 ease-out" style={{ width: `${pct}%` }} />
        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-rose-700 to-rose-500 transition-[width] duration-100" style={{ width: `${pct}%` }} />
      </div>
      {t.strikeDrill && (
        <div className="mt-1 text-center text-[11px] tracking-wide text-amber-100/90 [text-shadow:0_1px_3px_#000]">
          Parry drill · streak <span className="font-bold tabular-nums">{t.drillStreak}</span> · best {t.drillBest}
          <span className="text-white/50"> — parry on the white flash</span>
        </div>
      )}
    </div>
  );
}

function SkillTracker() {
  const skill = useHud((s) => s.skill);
  const touch = useHud((s) => s.touch);
  const pct = Math.min(100, (skill.precisionHits / skill.goal) * 100);
  return (
    <div
      className={`fixed left-3 top-3 w-52 rounded-lg border border-amber-200/15 bg-black/50 p-2.5 text-[11px] shadow-[0_6px_18px_rgba(0,0,0,0.35)] ${touch ? 'hidden lg:block' : 'max-md:hidden'}`}
    >
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
    <div className="fixed left-3 top-28 rounded bg-black/70 p-2 font-mono text-[10px] leading-relaxed text-lime-300">
      <div>fps {debug.fps}</div>
      <div>tick {debug.tick}</div>
      <div>
        pos {debug.x.toFixed(2)}, {debug.z.toFixed(2)}
      </div>
      <div>action {debug.action}</div>
      <div>stalker {debug.stalker}</div>
      <div>platform {platformId}</div>
    </div>
  );
}

// --- Exploration -----------------------------------------------------------------

const MINIMAP_SIZE = 148;
/** Minimap scale, pixels per metre. */
const MINIMAP_ZOOM = 1.1;

/** Minimap with the clock and the region name beneath it. */
function MinimapCorner() {
  const explore = useHud((s) => s.explore);
  const commands = useHud((s) => s.commands);
  const touch = useHud((s) => s.touch);
  return (
    <div className="pointer-events-none fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] flex flex-col items-center gap-1.5">
      <div className={touch ? 'pointer-events-auto' : ''} onClick={touch ? () => commands?.openMap() : undefined}>
        <Minimap size={touch ? 108 : MINIMAP_SIZE} />
      </div>
      <div className="max-w-[190px] truncate text-center font-display text-[10px] font-semibold tracking-[0.08em] text-amber-100 [text-shadow:0_1px_3px_#000]">
        {explore.region}
      </div>
      <ClockChip />
    </div>
  );
}

function Minimap({ size }: { size: number }) {
  const e = useHud((s) => s.explore);
  const half = size / 2;
  const mapPx = WORLD_HALF * 2 * MINIMAP_ZOOM;
  const offsetX = half - (e.x + WORLD_HALF) * MINIMAP_ZOOM;
  const offsetY = half - (e.z + WORLD_HALF) * MINIMAP_ZOOM;
  return (
    <div className="fx-minimap" style={{ width: size, height: size }}>
      {e.mapUrl && (
        <img
          src={e.mapUrl}
          alt=""
          draggable={false}
          className="absolute top-0 left-0 max-w-none"
          style={{ width: mapPx, height: mapPx, transform: `translate(${offsetX}px, ${offsetY}px)` }}
        />
      )}
      {LANDMARKS.map((l) => {
        let dx = (l.stone.x - e.x) * MINIMAP_ZOOM;
        let dy = (l.stone.z - e.z) * MINIMAP_ZOOM;
        const d = Math.hypot(dx, dy);
        const edge = half - 11;
        const clamped = d > edge;
        if (clamped) {
          dx = (dx / d) * edge;
          dy = (dy / d) * edge;
        }
        const known = e.discovered.includes(l.id);
        return (
          <div
            key={l.id}
            className={`absolute flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[9px] font-bold ${
              known ? 'bg-sky-400/90 text-slate-950 shadow-[0_0_6px_rgba(56,189,248,0.9)]' : 'bg-black/70 text-amber-200 ring-1 ring-amber-200/70'
            } ${clamped ? 'opacity-80' : ''}`}
            style={{ left: half + dx, top: half + dy }}
            title={known ? l.name : 'Undiscovered'}
          >
            {known ? <Icon name="waystone" size={10} /> : '?'}
          </div>
        );
      })}
      {/* Camera view cone, then the player arrow. */}
      <div
        className="absolute h-0 w-0"
        style={{ left: half, top: half, transform: `rotate(${-e.cameraYaw}rad)` }}
      >
        <div
          className="absolute -top-[44px] -left-[30px] h-[44px] w-[60px] opacity-30"
          style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.9), transparent)', clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }}
        />
      </div>
      <div className="absolute" style={{ left: half, top: half, transform: `translate(-50%, -50%) rotate(${-e.facing}rad)` }}>
        <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true">
          <path d="M8 0 L15 17 L8 13 L1 17 Z" fill="#fde68a" stroke="#1a1206" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="absolute top-0.5 left-1/2 -translate-x-1/2 font-display text-[10px] font-bold text-amber-100 [text-shadow:0_1px_2px_#000]">
        N
      </div>
    </div>
  );
}

/** Full world map: landmarks and discovery progress. The wilds are walked; there is no fast travel. */
function WorldMap() {
  const e = useHud((s) => s.explore);
  const commands = useHud((s) => s.commands);
  const touch = useHud((s) => s.touch);
  const found = e.discovered.length;
  const toPct = (v: number) => `${((v + WORLD_HALF) / (WORLD_HALF * 2)) * 100}%`;
  return (
    <div className="pointer-events-auto fixed inset-0 z-30 overflow-y-auto bg-black/65 backdrop-blur-[3px]">
      <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
        <div className="fx-panel flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6 md:flex-row">
          <div className="relative mx-auto aspect-square w-full max-w-[min(78vh,560px)] shrink-0 overflow-hidden rounded-lg border border-amber-200/30 bg-[#1a2230] shadow-[inset_0_0_40px_rgba(0,0,0,0.6)]">
            {e.mapUrl && <img src={e.mapUrl} alt="Map of the Bramble Primeval" className="absolute inset-0 h-full w-full" draggable={false} />}
            <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_60px_rgba(10,8,4,0.55)]" />
            {LANDMARKS.map((l) => {
              const known = e.discovered.includes(l.id);
              return (
                <div
                  key={l.id}
                  className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                  style={{ left: toPct(l.stone.x), top: toPct(l.stone.z) }}
                  title={known ? l.name : 'Undiscovered'}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-bold transition ${
                      known
                        ? 'border-sky-200 bg-sky-500/90 text-slate-950 shadow-[0_0_10px_rgba(56,189,248,0.9)]'
                        : 'border-amber-200/70 bg-black/70 text-amber-200'
                    }`}
                  >
                    {known ? <Icon name="waystone" size={13} /> : '?'}
                  </span>
                  <span className="mt-0.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-white/90 max-sm:hidden">
                    {known ? l.name : '???'}
                  </span>
                </div>
              );
            })}
            <div
              className="pointer-events-none absolute"
              style={{ left: toPct(e.x), top: toPct(e.z), transform: `translate(-50%, -50%) rotate(${-e.facing}rad)` }}
            >
              <svg width="18" height="20" viewBox="0 0 16 18" aria-hidden="true">
                <path d="M8 0 L15 17 L8 13 L1 17 Z" fill="#fde68a" stroke="#1a1206" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="absolute top-2 left-1/2 -translate-x-1/2 font-display text-sm font-bold text-amber-100 [text-shadow:0_1px_3px_#000]">N</div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div>
              <div className="font-display text-xl font-bold tracking-[0.2em] text-amber-100 uppercase">The Bramble Primeval</div>
              <div className="mt-1 text-xs text-white/60">
                {found}/{LANDMARKS.length} landmarks discovered · {e.region}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-gradient-to-r from-sky-500 to-sky-300" style={{ width: `${(found / LANDMARKS.length) * 100}%` }} />
              </div>
            </div>
            <div className="fx-divider" />
            <ul className="flex flex-col gap-1.5 text-sm">
              {LANDMARKS.map((l) => {
                const known = e.discovered.includes(l.id);
                const metres = Math.round(Math.hypot(l.x - e.x, l.z - e.z));
                return (
                  <li key={l.id} className="flex items-center justify-between gap-2 rounded-md border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5">
                    <div className="min-w-0">
                      <div className={`truncate font-semibold ${known ? 'text-white' : 'text-white/35'}`}>{known ? l.name : 'Undiscovered'}</div>
                      <div className="truncate text-[11px] text-white/45">{known ? l.blurb : 'Walk out and find it. Follow the "?" on the map.'}</div>
                    </div>
                    <span className={`shrink-0 text-[11px] tabular-nums ${known ? 'text-sky-200/80' : 'text-amber-200/70'}`}>{metres} m</span>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] text-white/45">Waystones you wake become the places you rise after a fall. There is no fast travel: the wilds are walked.</p>
            <div className="mt-auto flex items-center justify-between gap-2">
              <span className="text-[11px] text-white/45">{touch ? 'Tap the minimap to open this map' : 'M or Esc to close'}</span>
              <Button variant="primary" size="sm" icon="close" onClick={() => commands?.closeMap()}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Colossus, clock, announcements ----------------------------------------------

const BOSS_STATUS: Record<HudState['boss']['status'], { label: string; className: string }> = {
  emerging: { label: 'Emerging', className: 'border-violet-300/50 text-violet-200' },
  hunting: { label: 'Immune to blades', className: 'border-white/20 text-white/60' },
  exposed: { label: 'Exposed: strike the heart', className: 'animate-pulse border-amber-300 bg-amber-500/25 text-amber-100' },
  subdued: { label: 'Subdued', className: 'border-emerald-300/60 text-emerald-200' },
  fading: { label: 'Fading with the dawn', className: 'border-white/20 text-white/50' },
};

function BossFrame() {
  const boss = useHud((s) => s.boss);
  const pct = (boss.resolve / boss.maxResolve) * 100;
  const status = BOSS_STATUS[boss.status];
  return (
    <div className="fixed left-1/2 top-[max(0.6rem,env(safe-area-inset-top))] w-[min(34rem,60vw)] -translate-x-1/2 text-center max-sm:w-[56vw]">
      <div className="text-[10px] font-semibold tracking-[0.45em] text-violet-300/90 uppercase [text-shadow:0_1px_3px_#000]">
        Unique Colossus
      </div>
      <div className="font-display text-lg tracking-[0.25em] text-violet-50 uppercase [text-shadow:0_2px_8px_#000] sm:text-xl">
        {boss.name}
        {boss.eclipsed && (
          <span className="ml-2 inline-block -translate-y-0.5 rounded border border-fuchsia-400/70 bg-fuchsia-700/40 px-1.5 py-0.5 align-middle font-sans text-[10px] font-bold tracking-widest text-fuchsia-100">
            ECLIPSE
          </span>
        )}
      </div>
      <div className="relative mt-1 h-3 overflow-hidden rounded-sm border border-black/70 bg-black/70 shadow-[0_0_0_1px_rgba(196,181,253,0.3)]">
        <div className="absolute inset-y-0 left-0 bg-white/60 transition-[width] delay-200 duration-700" style={{ width: `${pct}%` }} />
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-800 via-violet-500 to-fuchsia-400 transition-[width] duration-150"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1.5 [text-shadow:0_1px_3px_#000]">
          <span className="text-white/60">Parry chain</span>
          {Array.from({ length: boss.chainGoal }, (_, i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rotate-45 border ${i < boss.chain ? 'border-amber-200 bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)]' : 'border-white/40 bg-black/40'}`}
            />
          ))}
        </div>
        <span className={`rounded border px-2 py-0.5 font-semibold tracking-wide uppercase ${status.className}`}>{status.label}</span>
      </div>
    </div>
  );
}

const PERIOD_ICON: Record<HudState['clock']['period'], string> = { dawn: '◒', day: '☀', dusk: '◓', night: '☾' };
const MOON_LABEL: Record<HudState['clock']['moon'], string> = {
  new: 'New moon',
  waxing: 'Waxing moon',
  full: 'Full moon',
  waning: 'Waning moon',
};

function ClockChip() {
  const clock = useHud((s) => s.clock);
  const night = clock.period === 'night';
  return (
    <div
      className={`rounded-full border px-3 py-0.5 text-[11px] font-semibold tracking-wide capitalize [text-shadow:0_1px_2px_#000] ${
        night && clock.moon === 'new' ? 'border-violet-400/60 bg-violet-950/70 text-violet-100' : 'border-amber-200/25 bg-black/55 text-white/85'
      }`}
    >
      {PERIOD_ICON[clock.period]} {clock.period}
      {night && <span className="ml-1 font-normal normal-case opacity-80">· {MOON_LABEL[clock.moon]}</span>}
    </div>
  );
}

function Announcement() {
  const announcement = useHud((s) => s.announcement);
  if (!announcement) return null;
  return (
    <div key={announcement.id} className="fixed left-1/2 top-[30%] w-[min(40rem,92vw)] -translate-x-1/2 animate-toast-in text-center">
      <div className="mx-auto mb-1 h-px w-2/3 bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />
      <div className="text-[11px] font-semibold tracking-[0.5em] text-amber-200/90 uppercase [text-shadow:0_1px_4px_#000]">{announcement.kicker}</div>
      <div className="font-display text-2xl tracking-[0.12em] text-white [text-shadow:0_2px_12px_#000] sm:text-3xl">{announcement.title}</div>
      {announcement.subtitle && <div className="mt-1 text-sm text-white/75 [text-shadow:0_1px_4px_#000]">{announcement.subtitle}</div>}
      <div className="mx-auto mt-2 h-px w-2/3 bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />
    </div>
  );
}

// --- Death and hunt results -----------------------------------------------------

function FallenOverlay() {
  const fallen = useHud((s) => s.fallen);
  if (!fallen) return null;
  return (
    <div className="fixed inset-0 z-40 flex animate-toast-in flex-col items-center justify-center bg-gradient-to-b from-black/30 via-red-950/50 to-black/60">
      <div className="font-display text-5xl tracking-[0.4em] text-red-200 [text-shadow:0_4px_20px_#000] sm:text-6xl">YOU FELL</div>
      {fallen.fed > 0 && (
        <div className="mt-3 text-sm tracking-widest text-violet-200 uppercase [text-shadow:0_1px_4px_#000]">
          It feeds · +{Math.round(fallen.fed)} Resolve
        </div>
      )}
      <div className="mt-2 text-xs text-white/60">Rising again at the nearest waystone…</div>
    </div>
  );
}

const OUTCOME_TITLE: Record<HuntReport['outcome'], string> = {
  subdued: 'The Shadow Stalker is subdued',
  survived: 'You survived the new moon',
  faded: 'The hunt is over',
};

function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** One concrete thing to fix next time, read from the tally. */
function coachingTip(r: HuntReport): string {
  if (r.outcome === 'subdued') return 'Few hunters ever see this. The mark is yours.';
  if (r.early > r.late * 1.5 && r.early >= 3) return 'Most misses were early: wait for the white flash in its eyes, not the gold.';
  if (r.late > r.early && r.late >= 3) return 'Most misses were late: press on the white flash, before the claws arrive.';
  if (r.falls > 0) return 'Every fall fed it 35% Resolve. Roll away and breathe before chasing a chain.';
  if (r.exposures === 0) return 'Five perfect parries in a row expose its heart. Rending Claws gives three at once.';
  if (!r.eclipse) return 'Strike only the heart while it is Exposed: the body takes a quarter.';
  return 'In Eclipse its lunge flows into claws. Parry the lunge to stop the follow-up.';
}

function HuntReportModal() {
  const report = useHud((s) => s.report);
  const records = useHud((s) => s.records);
  const commands = useHud((s) => s.commands);
  if (!report) return null;
  const best = (key: string) =>
    report.newBests.includes(key) ? <span className="ml-1.5 rounded bg-amber-400/25 px-1 text-[10px] font-bold text-amber-200">NEW BEST</span> : null;
  const rows: [string, ReactNode][] = [
    ['Resolve broken', <>{Math.round(report.resolveBroken * 100)}%{best('resolve')}</>],
    ['Hunt length', <>{formatTime(report.seconds)}{best('time')}</>],
    ['Perfect parries', report.perfectParries],
    ['Best chain', <>{report.bestChain}{best('chain')}</>],
    ['Exposed', `${report.exposures}×${report.eclipse ? ' · reached Eclipse' : ''}`],
    ['Parry misses', `${report.early} early · ${report.late} late · ${report.guards} guarded`],
    ['Hits taken', `${report.hitsTaken} · ${report.falls} ${report.falls === 1 ? 'fall' : 'falls'}`],
    ['Perilous blows dodged', report.dodges],
  ];
  return (
    <div className="pointer-events-auto fixed inset-0 z-40 overflow-y-auto bg-black/65 backdrop-blur-[2px]">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fx-panel w-full max-w-md p-6">
          <div className="text-center text-[11px] font-semibold tracking-[0.45em] text-violet-300 uppercase">Hunt report</div>
          <div className="mt-1 text-center font-display text-2xl tracking-[0.08em] text-white">{OUTCOME_TITLE[report.outcome]}</div>
          {report.markEarned && (
            <div className="mt-2 text-center text-sm text-violet-200">Mark acquired: Mark of the Moonless Hunt</div>
          )}
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-white/55">{label}</dt>
                <dd className="text-right tabular-nums text-white">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 rounded-md border border-amber-300/20 bg-amber-500/10 p-2.5 text-xs text-amber-100">{coachingTip(report)}</p>
          <div className="mt-3 text-center text-[11px] text-white/45">
            Record · {records.hunts} hunts · subdued {records.subdued} · survived {records.survived} · best chain {records.bestChain}
            {records.fastestSubdueSeconds !== null && ` · fastest subdue ${formatTime(records.fastestSubdueSeconds)}`}
          </div>
          <div className="mt-4">
            <Button variant="arcane" block onClick={() => commands?.closeReport()}>
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
