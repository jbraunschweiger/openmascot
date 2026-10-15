/**
 * The 2.5D solver: turns resolved bone channels into per-bone 2D affine
 * transforms, opacities, and depth-sorted draw orders.
 *
 * Pseudo-3D model (see docs/pseudo-3d.md):
 *  - Every bone pivot has a 3D offset from its parent pivot: (dx, dy, z).
 *  - A bone's accumulated `yaw`/`pitch` rotates its children's offsets in 3D;
 *    we keep the projected 2D offset (parallax) and the new depth (sorting).
 *  - Flat art is foreshortened by the cosine of its facing angle (and mirrors
 *    when seen from behind); `face` art fades out when facing away.
 *  - A weak perspective term scales parts by how far their depth has moved
 *    from the rest pose (so the rest pose is exactly the source drawing).
 */
import { boneMatrix, IDENTITY, mul } from './mat';
import { clamp, lerp, smoothstep } from './ease';
import type { BoneChannels, BoneNode, Frame, Mat, Rig, RigNode, SolvedBone } from './types';
import { REST } from './types';

export interface SolveOptions {
  /** Perspective focal length in character units; `0` disables perspective. Default 900. */
  focal?: number;
  /** How strongly `face` surfaces foreshorten (0..1). Default 0.85. */
  faceForeshorten?: number;
}

export interface SolveInput {
  channels: Map<string, BoneChannels>;
  slots: Record<string, string>;
  /** Extra rotation (deg) per bone name — spring secondary motion. */
  extraRot?: Record<string, number>;
}

const DEG = Math.PI / 180;

interface Ctx {
  pivot: [number, number];
  world: Mat;
  yaw: number;
  pitch: number;
  depth: number;
  /** Depth of the pivot in the rest pose (accumulated `data-om-z`). */
  restDepth: number;
  /** Product of foreshortening already applied by ancestors (x, y). */
  fx: number;
  fy: number;
  opacity: number;
}

export function solve(rig: Rig, input: SolveInput, opts: SolveOptions = {}, prev?: Frame): Frame {
  const focal = opts.focal ?? 900;
  const faceK = opts.faceForeshorten ?? 0.85;
  const bones: SolvedBone[] = prev?.bones ?? new Array(rig.bones.length);
  const order = new Map<number, number[]>();
  const extra = input.extraRot ?? {};

  const rotate3 = (dx: number, dy: number, dz: number, yaw: number, pitch: number): [number, number, number] => {
    // yaw (about the vertical axis): +yaw turns toward screen-right
    const cy = Math.cos(yaw * DEG);
    const sy = Math.sin(yaw * DEG);
    const x1 = dx * cy + dz * sy;
    const z1 = -dx * sy + dz * cy;
    // pitch (about the horizontal axis): +pitch nods down
    const cp = Math.cos(pitch * DEG);
    const sp = Math.sin(pitch * DEG);
    const y2 = dy * cp + z1 * sp;
    const z2 = -dy * sp + z1 * cp;
    return [x1, y2, z2];
  };

  const visit = (key: number, children: RigNode[], ctx: Ctx) => {
    const depths: number[] = new Array(children.length);
    for (let i = 0; i < children.length; i++) {
      const n = children[i];
      if (n.kind === 'art') {
        depths[i] = 0;
      } else if (n.kind === 'bone') {
        depths[i] = solveBone(n, ctx);
      } else {
        const zr = rotate3(0, 0, n.z, ctx.yaw, ctx.pitch)[2];
        depths[i] = zr;
        if (n.kind === 'layer') {
          visit(n.index, n.children, ctx);
        } else {
          const visible = input.slots[n.name] ?? n.defaultVariant;
          for (const v of n.variants) {
            // Solve hidden variants too (cheap) so world transforms stay valid.
            if (v.name === visible) visit(n.index, v.children, ctx);
            else visit(-2 - n.index, v.children, ctx);
          }
        }
      }
    }
    if (key < -1) return; // hidden variant: no order needed
    // Stable sort by depth; ties (within epsilon) keep document order.
    let sorted = true;
    for (let i = 1; i < depths.length; i++) {
      if (depths[i] < depths[i - 1] - 1e-6) {
        sorted = false;
        break;
      }
    }
    if (!sorted) {
      const idx = children.map((_, i) => i);
      idx.sort((a, b) => {
        const d = depths[a] - depths[b];
        return Math.abs(d) > 1e-6 ? d : a - b;
      });
      order.set(key, idx);
    }
  };

  const solveBone = (b: BoneNode, ctx: Ctx): number => {
    const ch = input.channels.get(b.name) ?? REST;
    const dx = b.pivot[0] - ctx.pivot[0];
    const dy = b.pivot[1] - ctx.pivot[1];
    const [rx, ry, rz] = ctx.yaw || ctx.pitch ? rotate3(dx, dy, b.z, ctx.yaw, ctx.pitch) : [dx, dy, b.z];
    const yaw = ctx.yaw + ch.yaw;
    const pitch = ctx.pitch + ch.pitch;

    // Surface response.
    let fx = 1;
    let fy = 1;
    let vis = 1;
    if (b.surface !== 'volume') {
      const [ny, np] = b.normal;
      const back = b.surface === 'back' ? 180 : 0;
      const cxa = Math.cos((yaw + ny + back) * DEG);
      const cya = Math.cos((pitch + np) * DEG);
      const cx0 = Math.cos((ny + back) * DEG);
      const cy0 = Math.cos(np * DEG);
      if (b.surface === 'flat') {
        fx = Math.abs(cx0) > 1e-3 ? cxa / Math.abs(cx0) : cxa;
        fy = Math.abs(cy0) > 1e-3 ? cya / Math.abs(cy0) : cya;
        // Edge-on flat art degenerates into a distracting sliver: fade it out.
        vis = smoothstep(0.03, 0.2, Math.abs(cxa * cya));
      } else if (b.surface === 'feature') {
        // Protruding feature (snout, beak): foreshortens but never culls; the
        // parent's art occludes it naturally once it rotates behind.
        const rxr = Math.abs(cx0) > 1e-3 ? Math.abs(cxa) / Math.abs(cx0) : Math.abs(cxa);
        const ryr = Math.abs(cy0) > 1e-3 ? Math.abs(cya) / Math.abs(cy0) : Math.abs(cya);
        fx = lerp(1, clamp(Math.max(rxr, 0.4), 0, 1.1), faceK);
        fy = lerp(1, clamp(Math.max(ryr, 0.4), 0, 1.1), faceK);
      } else {
        const facing = cxa * cya;
        vis = smoothstep(0.02, 0.32, facing);
        const rxr = Math.abs(cx0) > 1e-3 ? Math.max(0, cxa) / Math.abs(cx0) : Math.max(0, cxa);
        const ryr = Math.abs(cy0) > 1e-3 ? Math.max(0, cya) / Math.abs(cy0) : Math.max(0, cya);
        fx = lerp(1, clamp(rxr, 0, 1.12), faceK);
        fy = lerp(1, clamp(ryr, 0, 1.12), faceK);
      }
      // Remove what flat/face ancestors already applied, so nesting doesn't compound.
      fx = Math.abs(ctx.fx) > 0.05 ? fx / ctx.fx : fx;
      fy = Math.abs(ctx.fy) > 0.05 ? fy / ctx.fy : fy;
    }

    const depth = ctx.depth + rz + ch.dz;
    const restDepth = ctx.restDepth + b.z;
    let k = 1;
    if (focal > 0) {
      // Perspective relative to the rest pose, so the rest pose renders exactly
      // like the source drawing (the artist already drew near parts near-sized).
      const lim = focal * 0.8;
      const d0 = Math.min(ctx.depth, lim);
      const d1 = Math.min(depth, lim);
      const r0 = Math.min(ctx.restDepth, lim);
      const r1 = Math.min(restDepth, lim);
      k = ((focal - d0) / (focal - d1)) * ((focal - r1) / (focal - r0));
    }

    const rot = ch.rot + (extra[b.name] ?? 0);
    const local = boneMatrix(ch.x + (rx - dx), ch.y + (ry - dy), b.pivot[0], b.pivot[1], rot, ch.sx * fx * k, ch.sy * fy * k);
    const world = mul(ctx.world, local);
    const opacity = ch.opacity * vis;
    const solved: SolvedBone = { local, world, opacity, depth, yaw, pitch };
    if (b.spring) {
      solved.rigid = rot === ch.rot ? world : mul(ctx.world, boneMatrix(ch.x + (rx - dx), ch.y + (ry - dy), b.pivot[0], b.pivot[1], ch.rot, ch.sx * fx * k, ch.sy * fy * k));
    }
    bones[b.bi] = solved;

    visit(b.index, b.children, {
      pivot: b.pivot,
      world,
      yaw,
      pitch,
      depth,
      restDepth,
      fx: b.surface === 'volume' ? ctx.fx : ctx.fx * fx,
      fy: b.surface === 'volume' ? ctx.fy : ctx.fy * fy,
      opacity: ctx.opacity * opacity,
    });
    // Face features sit *on* their parent's surface: keep them in front of the
    // parent's own art (culling, not sorting, hides them when turned away).
    if (b.surface === 'face' && b.z > 0) return Math.max(rz + ch.dz, 1e-3);
    return rz + ch.dz;
  };

  visit(-1, rig.nodes, {
    pivot: [0, 0],
    world: [...IDENTITY] as Mat,
    yaw: 0,
    pitch: 0,
    depth: 0,
    restDepth: 0,
    fx: 1,
    fy: 1,
    opacity: 1,
  });

  return { bones, slots: input.slots, order };
}

/** World-space pivot of the first instance of a bone (after solving). */
export function bonePosition(rig: Rig, frame: Frame, name: string, offset: [number, number] = [0, 0]): [number, number] | undefined {
  const b = rig.bonesByName[name]?.[0];
  if (!b) return undefined;
  const s = frame.bones[b.bi];
  if (!s) return undefined;
  const m = s.world;
  const x = b.pivot[0] + offset[0];
  const y = b.pivot[1] + offset[1];
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
