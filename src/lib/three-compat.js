import * as THREE from 'three'

// three renamed the colour-space API at r152: renderer.outputEncoding and
// texture.encoding became outputColorSpace and colorSpace. package.json pins
// three ^0.170, so this uses the modern names. The `in` guards mean nothing
// throws if you later pin something older — you would just lose sRGB output,
// which shows up as slightly washed-out garment colours.

export function configureRenderer(renderer) {
  if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace
}

export function markSRGB(texture) {
  if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
