# Virtual Closet

Photograph your clothes, layer them on a 3D avatar built from your measurements,
build outfits, orbit the figure, and track what you actually wear.

```bash
npm install
npm run dev
```

Everything is local. Photos live in IndexedDB in your browser — nothing is uploaded anywhere.
On first run the closet is empty; there's a **Load a sample closet** button if you want to see it
populated before you start shooting.

---

## The body is lofted, not scaled

Each circumference you enter becomes an elliptical cross-section at its landmark height, and the
mesh is built by connecting those rings (`src/lib/body.js`). Change your waist and the figure
changes *shape*, not just size. Height acts as the scale denominator, so a 165cm person with a 48cm
shoulder reads as broad and a 190cm person with the same shoulder reads as narrow — that falls out
of the maths rather than needing a separate "build" slider.

Turn on **Show measurement rings** in the Body tab to check the mesh against a tape measure.

## Layering is physical thickness

Not a z-index. Every category carries a real radial offset in metres:

| Slot | Category | Offset |
|---|---|---|
| `feet` | shoes | 12mm |
| `bottom` | pants, shorts | 11–14mm |
| `baseTop` | t-shirts | 9mm |
| `midTop` | shirts | 21mm |
| `outerTop` | jackets | 36mm |

The jacket mesh sits *outside* the shirt mesh in 3D space. Rotate to three-quarters and you can see
the layers stacked at the hem. One garment per slot, so you can never build an impossible outfit.

All of it is declared in `src/lib/layers.js`. Adding a hat slot is an entry there plus a region in
`body.js`.

## How your photos map onto the mesh

Cylindrical UV wrap. `u = 0.5` is front-centre, so the front photo occupies the middle half of the
texture atlas and the back photo straddles the `u=0`/`u=1` seam behind (drawn twice, once off each
edge). See `atlasTexture` in `src/lib/garment-art.js`.

**Sleeves and trouser legs use a solid colour** sampled from the photo, not the photo itself.
Cylindrically wrapping a flat garment photo around a limb tube smears badly. Doing it properly means
a real UV layout per garment mesh — that's the next significant piece of work.

No back photo? The front is reused, desaturated, and the item shows an `F` badge in the closet list.
Deliberately visible rather than silently faked.

## Shooting the photos

1. Plain background — a wall, a wood floor, a made bed. Avoid patterned duvets.
2. Straight on, garment flat, sleeves down at the sides.
3. Even light. Overhead shadows read as part of the garment to the cutout.
4. Flip it over and shoot the back too.

Background removal runs in the browser (`src/lib/cutout.js`): flood-fill inward from the border,
drop pixels close to the sampled background colour, feather the boundary, crop transparent margins.
The **cut tolerance** slider is the control that matters — raise it if background survives, lower it
if the garment is getting eaten. Uncheck the box to keep the photo as-is.

For production-grade masking later, swap `removeBackground` for `@imgly/background-removal`
(segmentation model via WASM, still no server). Keep the signature
`(HTMLImageElement, number) => Canvas` and nothing else changes.

## Wear tracking

Two mechanisms, answering different questions:

- **Logged wears.** "I wore this today" increments every equipped item and stamps the date. Sort the
  closet by *Worn most* / *Worn least*. This is the honest number; it takes a few weeks to get
  interesting.
- **Manual pins.** ★ In rotation / ◦ Barely worn, for what you already know today.

---

## Performance notes

Three deliberate decisions, each fixing a real problem:

**Rotation lives outside React** (`src/state/useRotation.js`). Driving it through `useState` meant
every `pointermove` re-rendered the whole tree — closet list, inspector, tabs — sixty times a second
to move one transform. The value sits in a ref; subscribers write straight to the DOM and to
`root.rotation.y` from a single rAF loop. React does not render while you drag.

**Dial tick offsets are rounded to whole pixels.** Fractional offsets force the browser to
re-rasterize every glyph each frame with different subpixel antialiasing, which reads as shaking
text. At 2px per degree, snapping is invisible.

**Garment textures are cached** (`materialsFor` in `Stage3D.jsx`). Building the 1024×512 atlas costs
real time per garment and none of it depends on measurements — without the cache, dragging a body
slider regenerated every equipped garment's texture every frame. Keyed on the actual image objects,
so it only rebuilds when a photo or category changes.

If geometry rebuilds ever become the bottleneck during measurement drags, the move is to keep the
meshes and update their position buffers in place rather than constructing new `BufferGeometry`
objects — the vertex count never changes.

---

## Files

```
src/
  lib/
    body.js           measurements -> lofted mesh spec, ring interpolation
    layers.js         slots, categories, real layer thickness
    garment-art.js    texture atlas, average colour, sample-closet art
    cutout.js         background removal, photo -> panel
    db.js             IndexedDB, plus exportAll()
    three-compat.js   sRGB colour-space API guard
  state/
    useCloset.js      garments, outfits, equipped slots, wear logging
    useRotation.js    rAF rotation controller
  components/
    Stage3D.jsx       scene, lights, body + garment meshes, texture cache
    RotationDial.jsx  degree gauge
    ClosetPanel.jsx   inventory, filters, wear sorting
    AddGarment.jsx    photo intake + cutout preview
    Inspector.jsx     per-garment fit, wear stats, pins
    Measurements.jsx  body sliders
    Outfits.jsx       layer stack, save/load, wear logging
```

## Known limits

- Sleeves and trouser legs are solid colour, not photo-textured (see above).
- No cloth simulation. Garments are offset shells — they have bulk but don't fold, gather, or hang.
- The cutout fails on busy backgrounds.
- IndexedDB is per-browser, so no sync between machines. `exportAll()` in `db.js` dumps the whole
  closet as JSON with photos inlined as data URLs; the matching import isn't written yet.
