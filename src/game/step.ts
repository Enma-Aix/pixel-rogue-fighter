import type Phaser from "phaser";
import type { Solid } from "./types";

const MIN_RISE = 8;
const MAX_RISE = 80;

export function tryStep(sprite: Phaser.Physics.Arcade.Sprite, dir: number, solids: Solid[]): boolean {
  const body = sprite.body as Phaser.Physics.Arcade.Body | null;
  if (!body || (!body.blocked.left && !body.blocked.right)) return false;
  const facing = dir || (body.blocked.right ? 1 : -1);
  const probe = sprite.x + facing * (body.width * 0.5 + 10);
  let top = Infinity;
  for (const solid of solids) {
    if (probe < solid.x - 4 || probe > solid.x + solid.w + 4) continue;
    if (solid.top < top) top = solid.top;
  }
  if (!Number.isFinite(top)) return false;
  const rise = sprite.y - top;
  if (rise < MIN_RISE || rise > MAX_RISE) return false;
  body.reset(sprite.x + facing * 12, top - 2);
  sprite.setVelocityY(0);
  return true;
}

export function stickToSurface(sprite: Phaser.Physics.Arcade.Sprite, solids: Solid[]): void {
  const body = sprite.body as Phaser.Physics.Arcade.Body | null;
  if (!body) return;
  let top = Infinity;
  for (const solid of solids) {
    if (sprite.x < solid.x || sprite.x > solid.x + solid.w) continue;
    if (solid.top < top) top = solid.top;
  }
  if (!Number.isFinite(top) || sprite.y <= top + 28) return;
  body.reset(sprite.x, top - 2);
  sprite.setVelocityY(0);
}
