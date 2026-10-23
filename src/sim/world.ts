import { TILE } from '../core/constants';
import type { Dir, Floor, Room } from '../core/types';
import type { Run } from './model';

export function roomById(floors: Floor[], id: string): Room | undefined {
  for (const floor of floors) {
    const room = floor.rooms.find((r) => r.id === id);
    if (room) return room;
  }
  return undefined;
}

export function currentRoom(run: Run): Room {
  const room = roomById(run.floors, run.roomId);
  if (!room) throw new Error(`missing room ${run.roomId}`);
  return room;
}

export function currentFloor(run: Run): Floor {
  return run.floors[run.floorIndex] ?? run.floors[0]!;
}

export function hurtbox(x: number, y: number, w: number, h: number) {
  return { x: x - w / 2, y: y - h, w, h };
}

export function holePixel(_room: Room, tile: number): number {
  return tile * TILE + TILE / 2;
}

export function dirOpposite(d: Dir): Dir {
  if (d === 'l') return 'r';
  if (d === 'r') return 'l';
  if (d === 'u') return 'd';
  return 'u';
}
