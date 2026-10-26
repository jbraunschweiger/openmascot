/**
 * #/examples — small, product-neutral integration examples.
 *
 * Three patterns most apps need from a mascot: reacting while waiting for the
 * user, answer feedback, and a celebration. Each card is a live `<Mascot>`
 * driven through its imperative handle, with the snippet that does it.
 *
 * This replaces the old 16-screen "Echo app" showcase: the Echo guitar app now
 * owns its own presentation and consumes these packages like any other app.
 */
import type { ReactNode } from 'react';
import type { CharacterDef } from '@openmascot/core';
import { useMascotRef, type MascotHandle } from '@openmascot/react';
import { getCharacter, hasClip, hasExpression, DEFAULT_ID, useCharacterSelection } from '../studio/cast';
import { CharacterPicker, SafeMascot } from '../studio/cast-ui';
import '../studio/studio.css';
import './examples.css';

/** First clip / effect / expression in `names` the character has. */
const firstClip = (c: CharacterDef, names: string[]) => names.find((n) => hasClip(c, n));
/** Effects live in the runtime's registry (built-ins plus any the app adds). */
const firstFx = (m: MascotHandle, names: string[]) => names.find((n) => !!m.runtime?.effects[n]);
const firstExpr = (c: CharacterDef, names: string[]) => names.find((n) => hasExpression(c, n));

interface Reaction {
  clips: string[];
  fx?: string[];
  /** Expression held for `hold` seconds (setExpression's 2nd arg is a hold time). */
  expr?: string[];
  hold?: number;
  bpm?: number;
}

function react(m: MascotHandle | null, c: CharacterDef, r: Reaction) {
  if (!m) return;
  const clip = firstClip(c, r.clips);
  if (clip) void m.play(clip, { then: 'idle', bpm: r.bpm });
  const expr = r.expr && firstExpr(c, r.expr);
  if (expr) m.setExpression(expr, r.hold ?? 1.5);
  const fx = r.fx && firstFx(m, r.fx);
  if (fx) m.emit(fx);
}

interface Action {
  label: string;
  reaction: Reaction;
  ghost?: boolean;
}

function ExampleCard(props: { c: CharacterDef; title: string; blurb: ReactNode; actions: Action[]; code: string }) {
  const { c } = props;
  const ref = useMascotRef();
  return (
    <article className="ex-card">
      <div className="ex-stage">
        <SafeMascot ref={ref} character={c} animation="idle" padding={44} lookAtPointer title={c.name} style={{ width: '100%', height: '100%' }} />
      </div>
      <div className="ex-body">
        <h2>{props.title}</h2>
        <p>{props.blurb}</p>
        <div className="ex-actions">
          {props.actions.map((a) => (
            <button key={a.label} type="button" className={'st-btn' + (a.ghost ? ' ghost' : '')} onClick={() => react(ref.current, c, a.reaction)}>
              {a.label}
            </button>
          ))}
        </div>
        <pre className="ex-code">
          <code>{props.code}</code>
        </pre>
      </div>
    </article>
  );
}

export function Examples() {
  const [id, select] = useCharacterSelection();
  const c = getCharacter(id) ?? getCharacter(DEFAULT_ID)!;

  return (
    <div className="ex-page">
      <header className="ex-head">
        <h1>Integration examples</h1>
        <p>
          Three patterns most apps need from a mascot, driven through the <code>&lt;Mascot&gt;</code> ref. They work with every character because clips, effects and expressions are looked up by name
          and skipped when a character lacks one.
        </p>
        <CharacterPicker value={c.id} onChange={select} label="Character" />
      </header>

      <div className="ex-grid">
        <ExampleCard
          key={`${c.id}-wait`}
          c={c}
          title="Waiting for input"
          blurb="While your app listens or waits for an answer, play a short attentive gesture and fall back to idle."
          actions={[
            { label: 'Listen', reaction: { clips: ['listen', 'think'] } },
            { label: 'Think', reaction: { clips: ['think', 'listen'], fx: ['question'] }, ghost: true },
          ]}
          code={`mascot.current?.play('listen', { then: 'idle' });`}
        />
        <ExampleCard
          key={`${c.id}-feedback`}
          c={c}
          title="Answer feedback"
          blurb="Confirm a right answer and encourage after a wrong one. Keep it short so the user can carry on straight away."
          actions={[
            { label: 'Correct', reaction: { clips: ['correct', 'nod-yes'], fx: ['check', 'sparkles'], expr: ['happy'] } },
            { label: 'Not quite', reaction: { clips: ['encourage', 'wrong', 'shake-no'], expr: ['determined', 'neutral'] }, ghost: true },
          ]}
          code={`mascot.current?.play('correct', { then: 'idle' });
mascot.current?.emit('check');
// 2nd argument is how long the expression holds, in seconds
mascot.current?.setExpression('happy', 1.5);`}
        />
        <ExampleCard
          key={`${c.id}-celebrate`}
          c={c}
          title="Celebration"
          blurb="Mark the end of a milestone with a bigger moment. Dances can sync to your app's tempo."
          actions={[
            { label: 'Celebrate', reaction: { clips: ['emote-celebrate', 'jump', 'emote-excited'], fx: ['confetti', 'stars'], expr: ['excited', 'joyful', 'happy'], hold: 2.5 } },
            { label: 'Dance at 120 bpm', reaction: { clips: ['dance-bop', 'dance-sway'], fx: ['notes'], bpm: 120 }, ghost: true },
          ]}
          code={`mascot.current?.play('emote-celebrate', { then: 'idle' });
mascot.current?.emit('confetti');
mascot.current?.play('dance-bop', { bpm: 120, then: 'idle' });`}
        />
      </div>

      <p className="ex-foot">
        Looking for a full product? <strong>Echo</strong>, a guitar-learning app, uses OpenMascot as a regular dependency and owns its own screens, layout and coaching logic. Keep product UI in
        your app; keep generic renderer and animation improvements here.
      </p>
    </div>
  );
}
