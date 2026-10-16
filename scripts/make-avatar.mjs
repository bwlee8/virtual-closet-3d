#!/usr/bin/env node
/* One-time avatar builder. Runs locally, never in the browser — it needs your
 * FAL_KEY, which must not ship to the client.
 *
 *   npm run avatar -- --body avatar-source/body.jpg --face avatar-source/face.jpg
 *
 * Pipeline (each step is billed by fal):
 *   1. nano-banana-pro/edit  your full-length photo -> clean studio figure in a
 *                            fixed pose and fitted base layer
 *   2. face-swap             your face photo onto that figure, so identity holds
 *   3. birefnet/v2           background removed -> transparent avatar
 *   4. (--back) same again for a rear view, derived from the front
 *
 * Every intermediate is saved next to the result, plus recipe.json with the
 * prompt and seed. Keep that file: garment try-ons reuse the same framing, and
 * a different seed or aspect ratio is what makes layers stop lining up.
 */
import { fal } from '@fal-ai/client'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { extname, join, basename } from 'node:path'
import { parseArgs } from 'node:util'

const { values: args } = parseArgs({
  options: {
    body: { type: 'string' },
    face: { type: 'string' },
    seed: { type: 'string', default: '1234' },
    out: { type: 'string', default: 'public/avatar' },
    back: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

if (args.help || !args.body || !args.face) {
  console.log(`Usage: npm run avatar -- --body <full-length photo> --face <face photo> [--seed N] [--back] [--out dir]

  --body   full-length photo of you, head to toe, facing the camera
  --face   clear, front-on, well-lit photo of your face
  --seed   fixed seed, so reruns are repeatable (default 1234)
  --back   also generate a rear view for the Front/Back toggle
  --out    where to write the results (default public/avatar)`)
  process.exit(args.help ? 0 : 1)
}

if (!process.env.FAL_KEY) {
  console.error('FAL_KEY is not set. Create .env.local in the project folder containing the line FAL_KEY=your-key')
  process.exit(1)
}

const SEED = Number(args.seed)
const FRAMING = { aspect_ratio: '2:3', resolution: '2K', output_format: 'png' }

const FRONT_PROMPT = [
  'Full-body studio photograph of the person in the image, same face, body shape and proportions.',
  'Standing straight and facing the camera, arms held slightly away from the body, feet hip-width apart.',
  'Wearing a plain fitted light-grey tank top and fitted light-grey bike shorts, barefoot.',
  'Plain light-grey seamless background, soft even studio lighting, no shadows on the backdrop.',
  'The whole body is in frame from the top of the head to the feet, centred, with a small margin all round.',
].join(' ')

const BACK_PROMPT = [
  'The same person, in exactly the same pose, clothing, lighting, background and framing,',
  'seen from directly behind. Same body shape and proportions. Whole body in frame, centred.',
].join(' ')

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic' }

async function upload(path) {
  const type = MIME[extname(path).toLowerCase()]
  if (!type) throw new Error(`${path}: use a .jpg, .png, .webp or .heic photo`)
  const blob = new Blob([await readFile(path)], { type })
  return fal.storage.upload(new File([blob], basename(path), { type }))
}

async function run(endpoint, input, label) {
  process.stdout.write(`  ${label}… `)
  const t = Date.now()
  const { data } = await fal.subscribe(endpoint, { input })
  console.log(`done (${((Date.now() - t) / 1000).toFixed(1)}s)`)
  return data
}

async function save(url, file) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download ${url}: ${res.status}`)
  await writeFile(file, Buffer.from(await res.arrayBuffer()))
  return file
}

/** nano-banana-pro -> face-swap -> background removal, saving each step. */
async function figure(name, imageUrls, prompt, faceUrl) {
  const gen = await run('fal-ai/nano-banana-pro/edit',
    { prompt, image_urls: imageUrls, seed: SEED, num_images: 1, ...FRAMING },
    `${name}: generating figure (nano-banana-pro)`)
  const generated = gen.images[0].url
  await save(generated, join(args.out, `${name}-1-generated.png`))

  // A rear view has no face to swap.
  let swapped = generated
  if (faceUrl) {
    const fs = await run('fal-ai/face-swap',
      { base_image_url: generated, swap_image_url: faceUrl },
      `${name}: swapping in your face (face-swap)`)
    swapped = fs.image.url
    await save(swapped, join(args.out, `${name}-2-faceswap.png`))
  }

  const cut = await run('fal-ai/birefnet/v2',
    { image_url: swapped, model: 'General Use (Heavy)', operating_resolution: '2048x2048', output_format: 'png' },
    `${name}: removing background (birefnet)`)
  const file = await save(cut.image.url, join(args.out, `avatar-${name}.png`))
  return { generated, swapped, cutout: cut.image.url, file }
}

async function main() {
  await mkdir(args.out, { recursive: true })
  console.log('Uploading your photos to fal…')
  const [bodyUrl, faceUrl] = await Promise.all([upload(args.body), upload(args.face)])

  console.log('Front view')
  const front = await figure('front', [bodyUrl], FRONT_PROMPT, faceUrl)

  let back = null
  if (args.back) {
    console.log('Back view')
    // Derived from the face-swapped front, so body and framing carry over.
    back = await figure('back', [front.swapped], BACK_PROMPT, null)
  }

  const recipe = {
    createdAt: new Date().toISOString(),
    seed: SEED,
    framing: FRAMING,
    prompts: { front: FRONT_PROMPT, back: args.back ? BACK_PROMPT : null },
    // fal-hosted copies; they can expire, the local files are the record.
    sources: { front: front.swapped, back: back?.swapped ?? null },
  }
  await writeFile(join(args.out, 'recipe.json'), JSON.stringify(recipe, null, 2) + '\n')

  console.log(`\nAvatar written to ${front.file}${back ? ` and ${back.file}` : ''}.`)
  console.log('Open the *-generated and *-faceswap files too: if the pose or likeness is off, rerun with another --seed.')
}

main().catch((e) => {
  console.error('\nFailed:', e.body?.detail ? JSON.stringify(e.body.detail) : e.message)
  process.exit(1)
})
