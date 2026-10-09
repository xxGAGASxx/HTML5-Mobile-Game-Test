import { Assets, type Texture } from 'pixi.js';

/**
 * Placeholder art: white silhouettes from game-icons.net (CC BY 3.0, see CREDITS.md),
 * tinted at runtime. Files live in public/icons.
 */
export const ICON_SLUGS = [
  'shield',
  'broadsword',
  'bow-arrow',
  'magic-swirl',
  'two-coins',
  'meat',
  'crossed-swords',
  'camping-tent',
  'crab',
  'wolf-head',
  'bandit',
  'pirate-skull',
  'fast-forward-button',
  'sword-clash',
] as const;

export type IconSlug = (typeof ICON_SLUGS)[number];
export type Icons = ReadonlyMap<string, Texture>;

/** The SVGs are 512 px; rasterize at a quarter size, plenty for on-screen sizes up to ~64 px at 2x DPR. */
const RASTER_RESOLUTION = 0.25;

export async function loadIcons(): Promise<Icons> {
  const entries = await Promise.all(
    ICON_SLUGS.map(async (slug) => {
      const texture = await Assets.load<Texture>({
        src: `${import.meta.env.BASE_URL}icons/${slug}.svg`,
        data: { resolution: RASTER_RESOLUTION },
      });
      return [slug, texture] as const;
    }),
  );
  return new Map(entries);
}

export function icon(icons: Icons, slug: string): Texture {
  const texture = icons.get(slug);
  if (!texture) throw new Error(`Icon not loaded: ${slug}`);
  return texture;
}
