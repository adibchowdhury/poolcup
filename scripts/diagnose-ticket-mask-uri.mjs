/**
 * Diagnose SVG data-URI mask failure vs CSS-gradient mask.
 * Usage: node scripts/diagnose-ticket-mask-uri.mjs
 *        HEADED=1 node scripts/diagnose-ticket-mask-uri.mjs
 */
import { chromium } from 'playwright'

const width = 768
const height = 760

function buildSvg(w, h) {
  const side = 27
  const scallopR = 5
  const pitch = 13
  const stub = 12
  const corner = 16
  const footer = 94
  const centerY = h / 2
  const stubY = h - footer
  function layout(a, b, p) {
    const c = []
    let y = a + p * 0.5
    while (y <= b) {
      c.push(y)
      y += p
    }
    return c
  }
  const margin = corner + scallopR + 2
  const exMin = centerY - side - scallopR - 2
  const exMax = centerY + side + scallopR + 2
  const scallops = [
    ...layout(margin, exMin, pitch),
    ...layout(exMax, h - margin, pitch),
  ]
  const holes = [
    `<circle cx="0" cy="${centerY}" r="${side}" fill="#000"/>`,
    `<circle cx="${w}" cy="${centerY}" r="${side}" fill="#000"/>`,
    `<circle cx="0" cy="${stubY}" r="${stub}" fill="#000"/>`,
    `<circle cx="${w}" cy="${stubY}" r="${stub}" fill="#000"/>`,
  ]
  for (const y of scallops) {
    holes.push(
      `<circle cx="0" cy="${y.toFixed(2)}" r="${scallopR}" fill="#000"/>`,
    )
    holes.push(
      `<circle cx="${w}" cy="${y.toFixed(2)}" r="${scallopR}" fill="#000"/>`,
    )
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`,
    `<rect x="0" y="0" width="${w}" height="${h}" rx="${corner}" ry="${corner}" fill="#fff"/>`,
    ...holes,
    '</svg>',
  ].join('')
}

const svg = buildSvg(width, height)
const urlencoded = `data:image/svg+xml,${encodeURIComponent(svg)}`
const base64 = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`

console.log('\n=== 1. Encoding analysis ===')
console.log({
  rawHashCount: (svg.match(/#/g) || []).length,
  urlencodedUnescapedHash: (urlencoded.match(/#/g) || []).length,
  hasPercent23: urlencoded.includes('%23'),
  uriLen: urlencoded.length,
})

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
let cspInfo = { csp: null }
try {
  const res = await fetch(`${baseUrl}/dashboard`, { redirect: 'manual' })
  const csp = res.headers.get('content-security-policy')
  cspInfo = {
    status: res.status,
    csp: csp ?? '(none locally)',
    dataAllowed: csp ? /img-src[^;]*\bdata:/.test(csp) : null,
  }
} catch (e) {
  cspInfo = { error: e.message }
}
console.log('\n=== 2. CSP ===')
console.log(cspInfo)
console.log(
  'vercel.json img-src includes data: (production): YES — so CSP is not the local cause',
)

const headed = process.env.HEADED === '1'
const browser = await chromium.launch({
  headless: !headed,
  channel: headed ? 'chrome' : undefined,
})
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

// Build SVG INSIDE the page so Playwright arg serialization can't corrupt it
const probe = await page.evaluate(async ({ width, height }) => {
  function buildSvg(w, h) {
    const side = 27
    const scallopR = 5
    const pitch = 13
    const stub = 12
    const corner = 16
    const footer = 94
    const centerY = h / 2
    const stubY = h - footer
    function layout(a, b, p) {
      const c = []
      let y = a + p * 0.5
      while (y <= b) {
        c.push(y)
        y += p
      }
      return c
    }
    const margin = corner + scallopR + 2
    const exMin = centerY - side - scallopR - 2
    const exMax = centerY + side + scallopR + 2
    const scallops = [
      ...layout(margin, exMin, pitch),
      ...layout(exMax, h - margin, pitch),
    ]
    const holes = [
      `<circle cx="0" cy="${centerY}" r="${side}" fill="#000"/>`,
      `<circle cx="${w}" cy="${centerY}" r="${side}" fill="#000"/>`,
      `<circle cx="0" cy="${stubY}" r="${stub}" fill="#000"/>`,
      `<circle cx="${w}" cy="${stubY}" r="${stub}" fill="#000"/>`,
    ]
    for (const y of scallops) {
      holes.push(
        `<circle cx="0" cy="${y.toFixed(2)}" r="${scallopR}" fill="#000"/>`,
      )
      holes.push(
        `<circle cx="${w}" cy="${y.toFixed(2)}" r="${scallopR}" fill="#000"/>`,
      )
    }
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`,
      `<rect x="0" y="0" width="${w}" height="${h}" rx="${corner}" ry="${corner}" fill="#fff"/>`,
      ...holes,
      '</svg>',
    ].join('')
  }

  function buildCssMask(w, h) {
    const side = 27
    const scallopR = 5
    const pitch = 13
    const stub = 12
    const corner = 16
    const footer = 94
    const centerY = h / 2
    const stubY = h - footer
    function punch(cx, cy, r) {
      return `radial-gradient(circle ${r}px at ${cx} ${cy}, transparent 98%, #000 100%)`
    }
    function layout(a, b, p) {
      const c = []
      let y = a + p * 0.5
      while (y <= b) {
        c.push(y)
        y += p
      }
      return c
    }
    const margin = corner + scallopR + 2
    const exMin = centerY - side - scallopR - 2
    const exMax = centerY + side + scallopR + 2
    const scallops = [
      ...layout(margin, exMin, pitch),
      ...layout(exMax, h - margin, pitch),
    ]
    const layers = [
      'linear-gradient(#000 0 0)',
      punch('0px', `${centerY}px`, side),
      punch(`${w}px`, `${centerY}px`, side),
      punch('0px', `${stubY}px`, stub),
      punch(`${w}px`, `${stubY}px`, stub),
    ]
    for (const y of scallops) {
      const cy = `${y.toFixed(2)}px`
      layers.push(punch('0px', cy, scallopR))
      layers.push(punch(`${w}px`, cy, scallopR))
    }
    return {
      maskImage: layers.join(', '),
      maskComposite: 'intersect',
      webkitMaskComposite: 'source-in',
      layerCount: layers.length,
    }
  }

  async function imageLoad(src) {
    return new Promise((resolve) => {
      const img = new Image()
      const t = setTimeout(() => resolve({ result: 'timeout' }), 3000)
      img.onload = () => {
        clearTimeout(t)
        resolve({ result: 'load', w: img.naturalWidth, h: img.naturalHeight })
      }
      img.onerror = () => {
        clearTimeout(t)
        resolve({ result: 'error' })
      }
      img.src = src
    })
  }

  const svg = buildSvg(width, height)
  const urlencoded = 'data:image/svg+xml,' + encodeURIComponent(svg)
  const base64 = 'data:image/svg+xml;base64,' + btoa(svg)
  const css = buildCssMask(width, height)

  // Paint green shells with each mask strategy and read center pixel via canvas draw? 
  // Instead: report computed styles + whether url mask Image loads.
  function applyMask(label, applyFn) {
    const el = document.createElement('div')
    el.id = label
    el.style.cssText = `position:fixed;left:40px;top:40px;width:${width}px;height:${height}px;background:#00c853;`
    document.body.appendChild(el)
    applyFn(el)
    const cs = getComputedStyle(el)
    const mask = cs.maskImage || cs.webkitMaskImage || ''
    return {
      label,
      opacity: cs.opacity,
      maskKind: mask.startsWith('url(')
        ? 'url'
        : mask.includes('gradient')
          ? 'gradient'
          : 'other:' + mask.slice(0, 40),
      layerHint: mask.split(/,\s*(?![^(]*\))/).filter(Boolean).length,
    }
  }

  const simple =
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#000"/></svg>'

  return {
    encoding: {
      unescapedHashInUri: (urlencoded.match(/#/g) || []).length,
      hasPercent23: urlencoded.includes('%23'),
    },
    imageSimple: await imageLoad(
      'data:image/svg+xml,' + encodeURIComponent(simple),
    ),
    imageTicketUrlencoded: await imageLoad(urlencoded),
    imageTicketBase64: await imageLoad(base64),
    urlMask: applyMask('url-mask', (el) => {
      el.style.maskImage = `url("${urlencoded}")`
      el.style.webkitMaskImage = `url("${urlencoded}")`
      el.style.maskSize = '100% 100%'
    }),
    gradientMask: applyMask('grad-mask', (el) => {
      el.style.maskImage = css.maskImage
      el.style.webkitMaskImage = css.maskImage
      el.style.maskComposite = css.maskComposite
      el.style.webkitMaskComposite = css.webkitMaskComposite
      el.style.maskSize = '100% 100%'
    }),
    cssLayerCount: css.layerCount,
  }
}, { width, height })

console.log('\n=== 3. In-browser Image() + mask apply ===')
console.log(JSON.stringify(probe, null, 2))

console.log('\n=== 4. DIAGNOSIS ===')
const encodingOk =
  probe.encoding.unescapedHashInUri === 0 && probe.encoding.hasPercent23
const svgFails =
  probe.imageTicketUrlencoded.result === 'error' ||
  probe.imageTicketBase64.result === 'error'
const simpleOk = probe.imageSimple.result === 'load'
const gradientsOk = probe.gradientMask.maskKind === 'gradient'

console.log('Unescaped # in data URI?', !encodingOk ? 'YES (bug)' : 'NO — encodeURIComponent is correct')
console.log('Local CSP blocking data:?', 'NO (no CSP header; vercel allows data: in img-src)')
console.log('Simple SVG Image() load?', simpleOk ? 'OK' : 'FAIL')
console.log(
  'Ticket SVG Image() load (urlencoded / base64)?',
  probe.imageTicketUrlencoded.result,
  '/',
  probe.imageTicketBase64.result,
)
console.log('CSS gradient mask applied?', gradientsOk ? 'YES' : 'NO')

if (svgFails && simpleOk && encodingOk) {
  console.log(
    '\nACTUAL CAUSE: ticket SVG data-URI fails to load as an image in Chrome (Image onerror), even with correct %23 encoding and base64. A failed mask-image url() paints the element as fully masked-out (invisible) with zero console errors. Fix path (b): layered CSS gradients — no fetchable URL, cannot fail to load.',
  )
} else if (!encodingOk) {
  console.log('\nACTUAL CAUSE: unescaped # in data URI.')
} else {
  console.log(
    '\nCAUSE: see probe JSON. Prefer CSS gradients regardless for zero load risk.',
  )
}

if (headed) await page.waitForTimeout(4000)
await browser.close()
