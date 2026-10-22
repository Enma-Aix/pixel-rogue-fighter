export const live: { scene: string; data: Record<string, unknown> } = {
  scene: "boot",
  data: {},
};

export function publish(scene: string, data: Record<string, unknown>): void {
  live.scene = scene;
  live.data = data;
}
