import type { AuditData, RingBuilderConfig, RingSwatch } from '../types/audit';

/** Metal swatches — hues aligned to Vikas WebGi material palette (gold ~0xe2bf7f / 0xfea04d, rose 0xfa8787). */
export const DEFAULT_RING_METALS: RingSwatch[] = [
  { id: 'yellow-gold', label: 'Yellow gold', color: '#e2bf7f' },
  { id: 'white-gold', label: 'White gold', color: '#f5f2ec' },
  { id: 'rose-gold', label: 'Rose gold', color: '#fa8787' },
  { id: 'platinum', label: 'Platinum', color: '#e8e4dc' },
];

/**
 * Gem swatches — lighter / cooler tints so MeshPhysicalMaterial transmission reads like
 * WebGi DiamondPlugin color tints (not opaque cartoon plastic).
 */
export const DEFAULT_RING_GEMS: RingSwatch[] = [
  { id: 'diamond', label: 'Diamond', color: '#f8fcff' },
  { id: 'ruby', label: 'Ruby', color: '#f070a8' },
  { id: 'sapphire', label: 'Sapphire', color: '#62cffe' },
  { id: 'emerald', label: 'Emerald', color: '#5eca88' },
  { id: 'champagne', label: 'Champagne', color: '#efe75b' },
];

export const DEFAULT_RING_BUILDER: Required<RingBuilderConfig> = {
  enabled: true,
  headline: 'Private ring studio',
  subhead: 'Show a buyer the stone and metal before they ever reach the showroom.',
  metals: DEFAULT_RING_METALS,
  gems: DEFAULT_RING_GEMS,
  defaultMetalId: 'yellow-gold',
  defaultGemId: 'diamond',
};

/**
 * Optional JSON only. Missing key → code defaults (studio on).
 * `enabled: false` hides it. Accepts top-level `ringBuilder` or `liveDemo.ringBuilder`.
 */
export function resolveRingBuilder(data: AuditData | null | undefined): Required<RingBuilderConfig> | null {
  const incoming = data?.ringBuilder ?? data?.liveDemo?.ringBuilder;
  if (incoming?.enabled === false) return null;
  return {
    enabled: true,
    headline: incoming?.headline || DEFAULT_RING_BUILDER.headline,
    subhead: incoming?.subhead || DEFAULT_RING_BUILDER.subhead,
    metals: incoming?.metals?.length ? incoming.metals : DEFAULT_RING_BUILDER.metals,
    gems: incoming?.gems?.length ? incoming.gems : DEFAULT_RING_BUILDER.gems,
    defaultMetalId: incoming?.defaultMetalId || incoming?.metals?.[0]?.id || DEFAULT_RING_BUILDER.defaultMetalId,
    defaultGemId: incoming?.defaultGemId || incoming?.gems?.[0]?.id || DEFAULT_RING_BUILDER.defaultGemId,
  };
}
