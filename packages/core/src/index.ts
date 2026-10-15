/**
 * @openmascot/core — framework-agnostic mascot engine.
 *
 *   annotated SVG ──compileRig──▶ Rig
 *   clips + alive layers ──Mascot.update──▶ Pose ──resolvePose──▶ channels ──solve──▶ Frame
 *   Frame ──renderSvg / DOM renderer / native renderer──▶ pixels
 */
export * from './types';
export * from './xml';
export * from './rig';
export * from './mat';
export * from './ease';
export * from './pose';
export * from './clip';
export * from './solve';
export * from './effects';
export * from './effects-library';
export * from './render-string';
export * from './mascot';
export * from './author';
