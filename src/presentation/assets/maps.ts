import { Assets, type Texture } from 'pixi.js';

/** A region's island art baked by scripts/build-sprites.ts, plus where things stand on it (art pixels). */
export interface MapAsset {
  texture: Texture;
  width: number;
  height: number;
  /** Top of each node's tile, where its marker stands. */
  nodes: Record<string, { x: number; y: number }>;
  fires: [number, number][];
  glints: [number, number][];
  /** Walkable road lines keyed `from|to`, node to node, in art pixels. */
  roads: Record<string, [number, number][]>;
}

export async function loadMap(regionId: string): Promise<MapAsset> {
  const base = `${import.meta.env.BASE_URL}assets/maps/${regionId}`;
  const [texture, data] = await Promise.all([
    Assets.load<Texture>({ src: `${base}.png`, data: { scaleMode: 'nearest' } }),
    Assets.load<Omit<MapAsset, 'texture'>>(`${base}.json`),
  ]);
  return { texture, ...data };
}
