// Equipment slots, RPG-style: one garment per slot, so you can never build an
// impossible outfit. `off` is REAL radial thickness in metres — this is what
// makes layering physical rather than a z-index. A jacket mesh genuinely sits
// outside a shirt mesh in 3D space.

export const SLOTS = {
  baseTop: { label: 'Base layer' },
  midTop: { label: 'Mid layer' },
  outerTop: { label: 'Outer layer' },
  bottom: { label: 'Bottom' },
  feet: { label: 'Feet' },
}

// Outermost first — also the order garments are built in.
export const SLOT_ORDER = ['outerTop', 'midTop', 'baseTop', 'bottom', 'feet']

export const CATEGORIES = {
  tshirt: { label: 'T-shirts', slot: 'baseTop', kind: 'top', off: 0.009, puff: 1.05, hem: 0.605, sleeve: 0.34 },
  shirt: { label: 'Shirts', slot: 'midTop', kind: 'top', off: 0.021, puff: 1.08, hem: 0.575, sleeve: 0.94 },
  jacket: { label: 'Jackets', slot: 'outerTop', kind: 'top', off: 0.036, puff: 1.13, hem: 0.545, sleeve: 1.0 },
  pants: { label: 'Pants', slot: 'bottom', kind: 'bottom', off: 0.011, puff: 1.05, hem: 0.055 },
  shorts: { label: 'Shorts', slot: 'bottom', kind: 'bottom', off: 0.014, puff: 1.11, hem: 0.365 },
  shoes: { label: 'Shoes', slot: 'feet', kind: 'feet', off: 0.012, puff: 1.0 },
}

export const CATEGORY_ORDER = ['tshirt', 'shirt', 'jacket', 'pants', 'shorts', 'shoes']

export const slotOf = (category) => CATEGORIES[category]?.slot ?? 'baseTop'

/** A garment is labelled by brand + style, e.g. "Uniqlo Oxford button-down". */
export const garmentLabel = (g) => [g.brand, g.style].filter(Boolean).join(' ') || 'Untitled'

export const DEFAULT_FIT = { scale: 1, drop: 0, length: 1 }
