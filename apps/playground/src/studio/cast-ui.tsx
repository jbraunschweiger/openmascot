/** Character UI shared by Home / Studio / Gallery: picker chips, avatars, about panel, error boundary. */
import { Component, type ComponentProps, type CSSProperties, type ErrorInfo, type ReactNode } from 'react';
import { Mascot } from '@openmascot/react';
import type { CharacterDef } from '@openmascot/core';
import { ALL, CAST, avatarUri, castInfo, clipsOf, descriptionOf, ownClips, tintOf } from './cast';

/* ------------------------------------------------------------------ */

/** Catches render/effect errors of one subtree (e.g. one mascot tile) so the rest of the page survives. */
export class ErrorBoundary extends Component<{ fallback: (error: Error) => ReactNode; resetKey?: unknown; children: ReactNode }, { error: Error | null; key: unknown }> {
  state = { error: null as Error | null, key: this.props.resetKey };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  static getDerivedStateFromProps(props: { resetKey?: unknown }, state: { error: Error | null; key: unknown }) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[playground] tile crashed:', error, info.componentStack);
  }
  render() {
    return this.state.error ? this.props.fallback(this.state.error) : this.props.children;
  }
}

/** Fallback shown in place of a mascot that failed to load. */
export function BrokenArt({ error, name }: { error?: Error; name?: string }) {
  return (
    <div className="cx-broken" title={error?.message}>
      <b>⚠</b>
      <span>{name ? `${name} failed to load` : 'Failed to load'}</span>
      {error && <small>{error.message.slice(0, 90)}</small>}
    </div>
  );
}

/** A live `<Mascot>` inside its own error boundary (shows a "failed to load" card on crash). */
export function SafeMascot(props: ComponentProps<typeof Mascot>) {
  return (
    <ErrorBoundary resetKey={props.character.id} fallback={(e) => <BrokenArt error={e} name={props.character.name} />}>
      <Mascot {...props} />
    </ErrorBoundary>
  );
}

/* ------------------------------------------------------------------ */

export const tintStyle = (c: CharacterDef): CSSProperties => ({ ['--tint' as string]: tintOf(c) });

/** Static rest-pose thumbnail (falls back to the initial on a tinted disc). */
export function CharAvatar({ c, size = 34 }: { c: CharacterDef; size?: number }) {
  const uri = avatarUri(c);
  return (
    <span className="cx-av" style={{ ...tintStyle(c), width: size, height: size }} aria-hidden="true">
      {uri ? <img src={uri} alt="" /> : <b>{c.name.slice(0, 1)}</b>}
    </span>
  );
}

/** Row of character chips. `allowAll` adds an "All characters" chip (value `ALL`). */
export function CharacterPicker(props: { value: string; onChange: (id: string) => void; allowAll?: boolean; label?: ReactNode; className?: string }) {
  if (CAST.length < 2 && !props.allowAll) return null;
  return (
    <div className={`cx-picker ${props.className ?? ''}`} role="radiogroup" aria-label="Character">
      {props.label && <span className="cx-picker-l">{props.label}</span>}
      {CAST.map((c) => (
        <button key={c.id} role="radio" aria-checked={props.value === c.id} className={`cx-chip ${props.value === c.id ? 'on' : ''}`} style={tintStyle(c)} onClick={() => props.onChange(c.id)} title={descriptionOf(c) ?? c.name}>
          <CharAvatar c={c} />
          <span>{c.name}</span>
        </button>
      ))}
      {props.allowAll && CAST.length > 1 && (
        <button role="radio" aria-checked={props.value === ALL} className={`cx-chip all ${props.value === ALL ? 'on' : ''}`} onClick={() => props.onChange(ALL)} title="Compare the same clip across every character">
          <span className="cx-av stack" aria-hidden="true">
            {CAST.slice(0, 3).map((c) => (
              <CharAvatar key={c.id} c={c} size={22} />
            ))}
          </span>
          <span>All characters</span>
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Name, description, rig stats and palette of a character. */
export function CharacterAbout({ c, compact }: { c: CharacterDef; compact?: boolean }) {
  const info = castInfo(c);
  const clips = Object.keys(clipsOf(c)).length;
  const own = ownClips(c).length;
  const palette = Object.entries(c.palette ?? {});
  const meta = c.meta ?? {};
  const extra = (['author', 'license'] as const).filter((k) => typeof meta[k] === 'string');
  return (
    <div className={`cx-about ${compact ? 'compact' : ''}`} style={tintStyle(c)}>
      <div className="cx-about-h">
        <CharAvatar c={c} size={compact ? 44 : 56} />
        <div>
          <h3>{c.name}</h3>
          <code>{c.id}</code>
        </div>
      </div>
      <p className="cx-about-d">{descriptionOf(c) ?? <i>No description (set meta.description).</i>}</p>
      {info ? (
        <dl className="cx-stats">
          <div>
            <dt>bones</dt>
            <dd>{info.bones.length}</dd>
          </div>
          <div>
            <dt>slots</dt>
            <dd>{info.slots}</dd>
          </div>
          <div title={`${own} character-specific + ${clips - own} shared library`}>
            <dt>clips</dt>
            <dd>
              {clips} <small>({own} own)</small>
            </dd>
          </div>
          <div>
            <dt>expressions</dt>
            <dd>{Object.keys(c.expressions ?? {}).length}</dd>
          </div>
        </dl>
      ) : (
        <p className="cx-warn">The rig failed to compile — see the console.</p>
      )}
      {info && info.warnings > 0 && <p className="cx-warn">{info.warnings} rig warning(s) — run <code>pnpm openmascot validate {c.id}</code>.</p>}
      {palette.length > 0 && (
        <div className="cx-palette">
          {palette.map(([k, v]) => (
            <span key={k} title={`${k} ${v}`}>
              <i style={{ background: v }} />
              {!compact && <small>{k}</small>}
            </span>
          ))}
        </div>
      )}
      {extra.length > 0 && (
        <p className="cx-meta">
          {extra.map((k) => (
            <span key={k}>
              {k}: <b>{String(meta[k])}</b>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
