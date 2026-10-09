/**
 * Art style test (GDD 12): the same battle can be drawn in each shortlisted style.
 * A = icon tokens (current placeholder), B = pixel art, E = tabletop minis.
 */
export const ART_STYLES = ['icons', 'pixel', 'minis'] as const;
export type ArtStyle = (typeof ART_STYLES)[number];

export const ART_STYLE_LABELS: Record<ArtStyle, string> = {
  icons: 'A: Icons',
  pixel: 'B: Pixel',
  minis: 'E: Minis',
};

const STORAGE_KEY = 'wreckbound.artStyle';

function isStyle(value: string | null): value is ArtStyle {
  return value !== null && (ART_STYLES as readonly string[]).includes(value);
}

/** `?style=pixel` in the URL wins, then the last style picked on this device, then pixel art. */
function initialArtStyle(): ArtStyle {
  const fromUrl = new URLSearchParams(window.location.search).get('style');
  if (isStyle(fromUrl)) return fromUrl;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isStyle(saved)) return saved;
  } catch {
    // storage blocked (private mode): fall through to the default
  }
  return 'pixel';
}

let current: ArtStyle | null = null;

/** The style battles are drawn in; picked once per page load, then changed with the in-battle switch. */
export function getArtStyle(): ArtStyle {
  return (current ??= initialArtStyle());
}

export function setArtStyle(style: ArtStyle): void {
  current = style;
  saveArtStyle(style);
}

function saveArtStyle(style: ArtStyle): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, style);
  } catch {
    // not fatal: the choice just won't survive a reload
  }
}

export function nextArtStyle(style: ArtStyle): ArtStyle {
  return ART_STYLES[(ART_STYLES.indexOf(style) + 1) % ART_STYLES.length]!;
}
