/** Matches --create-pool-modal-stub-footer-region at 16px root (8.125rem). */
export const CREATE_POOL_MODAL_STUB_FOOTER_REGION_PX = 130

/** Classic side punch — center of 24–30px range. */
export const TICKET_SIDE_PUNCH_RADIUS_PX = 27

/** Edge scallop perforations (left/right only). */
export const TICKET_SCALLOP_RADIUS_PX = 8
export const TICKET_SCALLOP_PITCH_PX = 22

/** Secondary stub notches at stub-y (smaller than side punches). */
export const TICKET_STUB_NOTCH_RADIUS_PX = 12

/** Modal shell rounded-2xl (= 1rem). */
export const TICKET_SHELL_CORNER_RADIUS_PX = 16

export type TicketSilhouetteMaskOptions = {
  width: number
  height: number
  stubFooterRegionPx?: number
  sidePunchRadius?: number
  scallopRadius?: number
  scallopPitch?: number
  stubNotchRadius?: number
  cornerRadius?: number
}

export type TicketSilhouetteCssMask = {
  /** Comma-separated CSS gradient layers — never url()/data-URI. */
  maskImage: string
  maskComposite: 'intersect'
  webkitMaskComposite: 'source-in'
}

function layoutScallopCenters(
  segmentStart: number,
  segmentEnd: number,
  pitch: number,
): number[] {
  if (segmentEnd - segmentStart < pitch) return []
  const centers: number[] = []
  let y = segmentStart + pitch * 0.5
  while (y <= segmentEnd) {
    centers.push(y)
    y += pitch
  }
  return centers
}

export function computeTicketSilhouetteScallopCenters(
  height: number,
  options: Pick<
    TicketSilhouetteMaskOptions,
    'sidePunchRadius' | 'scallopRadius' | 'scallopPitch' | 'cornerRadius'
  >,
): number[] {
  const cornerRadius = options.cornerRadius ?? TICKET_SHELL_CORNER_RADIUS_PX
  const sidePunchRadius = options.sidePunchRadius ?? TICKET_SIDE_PUNCH_RADIUS_PX
  const scallopRadius = options.scallopRadius ?? TICKET_SCALLOP_RADIUS_PX
  const scallopPitch = options.scallopPitch ?? TICKET_SCALLOP_PITCH_PX

  const centerY = height / 2
  const margin = cornerRadius + scallopRadius + 2
  const excludeMin = centerY - sidePunchRadius - scallopRadius - 2
  const excludeMax = centerY + sidePunchRadius + scallopRadius + 2

  return [
    ...layoutScallopCenters(margin, excludeMin, scallopPitch),
    ...layoutScallopCenters(excludeMax, height - margin, scallopPitch),
  ]
}

/** Opaque everywhere except a transparent circle hole. */
function punchLayer(cx: string, cy: string, radiusPx: number): string {
  return `radial-gradient(circle ${radiusPx}px at ${cx} ${cy}, transparent 98%, #000 100%)`
}

/**
 * Classic sports-ticket silhouette via layered CSS gradients.
 * Prefer this over SVG data-URIs — gradients cannot fail to load as mask-image.
 */
export function buildTicketSilhouetteCssMask(
  options: TicketSilhouetteMaskOptions,
): TicketSilhouetteCssMask {
  const width = Math.max(1, Math.round(options.width))
  const height = Math.max(1, Math.round(options.height))
  const stubFooterRegionPx =
    options.stubFooterRegionPx ?? CREATE_POOL_MODAL_STUB_FOOTER_REGION_PX
  const sidePunchRadius =
    options.sidePunchRadius ?? TICKET_SIDE_PUNCH_RADIUS_PX
  const scallopRadius = options.scallopRadius ?? TICKET_SCALLOP_RADIUS_PX
  const scallopPitch = options.scallopPitch ?? TICKET_SCALLOP_PITCH_PX
  const stubNotchRadius = options.stubNotchRadius ?? TICKET_STUB_NOTCH_RADIUS_PX
  const cornerRadius = options.cornerRadius ?? TICKET_SHELL_CORNER_RADIUS_PX

  const centerY = height / 2
  const stubY = height - stubFooterRegionPx
  const scallopCenters = computeTicketSilhouetteScallopCenters(height, {
    sidePunchRadius,
    scallopRadius,
    scallopPitch,
    cornerRadius,
  })

  const layers: string[] = [
    'linear-gradient(#000 0 0)',
    punchLayer('0px', `${centerY}px`, sidePunchRadius),
    punchLayer(`${width}px`, `${centerY}px`, sidePunchRadius),
    punchLayer('0px', `${stubY}px`, stubNotchRadius),
    punchLayer(`${width}px`, `${stubY}px`, stubNotchRadius),
  ]

  for (const y of scallopCenters) {
    const cy = `${y.toFixed(2)}px`
    layers.push(punchLayer('0px', cy, scallopRadius))
    layers.push(punchLayer(`${width}px`, cy, scallopRadius))
  }

  return {
    maskImage: layers.join(', '),
    maskComposite: 'intersect',
    webkitMaskComposite: 'source-in',
  }
}

/**
 * Legacy SVG data-URI — diagnosis / Image() probes only.
 * Runtime masks must use {@link buildTicketSilhouetteCssMask}.
 */
export function buildTicketSilhouetteMaskDataUri(
  options: TicketSilhouetteMaskOptions,
): string {
  const width = Math.max(1, Math.round(options.width))
  const height = Math.max(1, Math.round(options.height))
  const stubFooterRegionPx =
    options.stubFooterRegionPx ?? CREATE_POOL_MODAL_STUB_FOOTER_REGION_PX
  const sidePunchRadius =
    options.sidePunchRadius ?? TICKET_SIDE_PUNCH_RADIUS_PX
  const scallopRadius = options.scallopRadius ?? TICKET_SCALLOP_RADIUS_PX
  const scallopPitch = options.scallopPitch ?? TICKET_SCALLOP_PITCH_PX
  const stubNotchRadius = options.stubNotchRadius ?? TICKET_STUB_NOTCH_RADIUS_PX
  const cornerRadius = options.cornerRadius ?? TICKET_SHELL_CORNER_RADIUS_PX

  const centerY = height / 2
  const stubY = height - stubFooterRegionPx
  const scallopCenters = computeTicketSilhouetteScallopCenters(height, {
    sidePunchRadius,
    scallopRadius,
    scallopPitch,
    cornerRadius,
  })

  const holes: string[] = [
    `<circle cx="0" cy="${centerY}" r="${sidePunchRadius}" fill="#000"/>`,
    `<circle cx="${width}" cy="${centerY}" r="${sidePunchRadius}" fill="#000"/>`,
    `<circle cx="0" cy="${stubY}" r="${stubNotchRadius}" fill="#000"/>`,
    `<circle cx="${width}" cy="${stubY}" r="${stubNotchRadius}" fill="#000"/>`,
  ]

  for (const y of scallopCenters) {
    holes.push(
      `<circle cx="0" cy="${y.toFixed(2)}" r="${scallopRadius}" fill="#000"/>`,
    )
    holes.push(
      `<circle cx="${width}" cy="${y.toFixed(2)}" r="${scallopRadius}" fill="#000"/>`,
    )
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"`,
    `width="${width}" height="${height}">`,
    `<rect x="0" y="0" width="${width}" height="${height}"`,
    `rx="${cornerRadius}" ry="${cornerRadius}" fill="#fff"/>`,
    ...holes,
    '</svg>',
  ].join('')

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/** Raw data URI (no url() wrapper) for Image() load probes. */
export function buildTicketSilhouetteMaskRawDataUri(
  options: TicketSilhouetteMaskOptions,
  encoding: 'urlencoded' | 'base64' = 'urlencoded',
): string {
  const cssUrl = buildTicketSilhouetteMaskDataUri(options)
  const match = cssUrl.match(/^url\("?(data:image\/svg\+xml[^"]*)"?\)$/)
  const urlencoded = match?.[1]
  if (!urlencoded) return ''

  if (encoding === 'urlencoded') return urlencoded

  const encoded = urlencoded.replace(/^data:image\/svg\+xml,/, '')
  const svg = decodeURIComponent(encoded)
  if (typeof btoa === 'function') {
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
  }
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
}

export function extractMaskImageUrls(maskImage: string): string[] {
  const urls: string[] = []
  const re = /url\(\s*(['"]?)(.*?)\1\s*\)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(maskImage)) !== null) {
    if (m[2]) urls.push(m[2])
  }
  return urls
}

/**
 * Prove a url()-based mask resource can load before applying it.
 * Returns false on error or timeout — caller must not apply the mask.
 */
export function probeMaskImageUrl(
  src: string,
  timeoutMs = 1500,
): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(false)
      return
    }
    const img = new Image()
    const timer = window.setTimeout(() => {
      img.onload = null
      img.onerror = null
      resolve(false)
    }, timeoutMs)
    img.onload = () => {
      window.clearTimeout(timer)
      resolve(img.naturalWidth > 0 && img.naturalHeight > 0)
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      resolve(false)
    }
    img.src = src
  })
}
