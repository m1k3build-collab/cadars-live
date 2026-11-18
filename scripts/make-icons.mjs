import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const bars = `
  <rect x="110" y="330" width="44" height="70" rx="10" fill="#a16207"/>
  <rect x="172" y="280" width="44" height="120" rx="10" fill="#d97706"/>
  <rect x="234" y="220" width="44" height="180" rx="10" fill="#f0b429"/>
  <rect x="296" y="160" width="44" height="240" rx="10" fill="#f5c451"/>
  <rect x="358" y="100" width="44" height="300" rx="10" fill="#ffe7a3"/>
  <rect x="104" y="412" width="304" height="10" rx="5" fill="#3d342b"/>
  <circle cx="256" cy="72" r="16" fill="#f0b429"/>
  <circle cx="256" cy="72" r="7" fill="#fff6d8"/>
`

const anyIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1c1712"/>
  <rect x="36" y="36" width="440" height="440" rx="88" fill="#2a241c"/>
  ${bars}
</svg>`

const maskable = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1c1712"/>
  <g transform="translate(256 270) scale(0.62) translate(-256 -256)">
    ${bars}
  </g>
</svg>`

await mkdir('public/icons', { recursive: true })

async function png(svg, size, file) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(file)
}

await png(anyIcon, 192, 'public/icons/icon-192.png')
await png(anyIcon, 512, 'public/icons/icon-512.png')
await png(maskable, 512, 'public/icons/icon-maskable-512.png')
await png(maskable, 180, 'public/apple-touch-icon.png')
console.log('icons written')
