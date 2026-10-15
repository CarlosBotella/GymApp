// Genera los PNG de la PWA a partir de public/icon.svg (requiere sharp).
const sharp = require('sharp');
const path = require('path');
const pub = path.join(__dirname, '..', 'public');
const svg = path.join(pub, 'icon.svg');
(async () => {
  for (const [name, size, pad] of [['icon-192.png',192,0],['icon-512.png',512,0],['icon-maskable-512.png',512,64],['apple-touch-icon.png',180,0]]) {
    const inner = size - pad * 2;
    const img = await sharp(svg).resize(inner, inner).png().toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: '#15171A' } })
      .composite([{ input: img, left: pad, top: pad }]).png().toFile(path.join(pub, name));
  }
  console.log('ok');
})();
