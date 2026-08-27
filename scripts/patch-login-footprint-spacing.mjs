import { readFileSync, writeFileSync } from 'fs'

const r = JSON.parse(
  readFileSync('scripts/.screenshots/login-approved-footprint-tile.json', 'utf8'),
)
let css = readFileSync('app/globals.css', 'utf8')
const start = css.indexOf('.login-page-shell {')
const end = css.indexOf('/* Commissioner printable export')
if (start < 0 || end < 0) throw new Error('markers missing')
const commentStart = css.lastIndexOf('/*', start)

const block = `/*
 * Login page shell — LOCKED gradient + approved footprint wallpaper
 * (public/login_assets/poolcup_penguin_footprint.svg). Shape from asset only;
 * data-URI fill forced to #fff @ 0.085 (asset uses currentColor).
 * Spacing: pitch 106×81 (+~40% vs 76×58); stamp scale unchanged.
 */
.login-page-shell {
  background-color: #0b1014;
  background-image:
    url("data:image/svg+xml;base64,${r.b64}"),
    radial-gradient(circle at 50% 45%, rgba(0, 230, 118, 0.10) 0%, rgba(0, 230, 118, 0.025) 28%, transparent 52%),
    linear-gradient(125deg, #0a1f16 0%, #0a1411 32%, #0b1014 67%, #0d1522 100%);
  background-repeat: repeat, no-repeat, no-repeat;
  background-position: 0 0, center, center;
  background-size: 106px 162px, auto, auto;
}

@media (max-width: 480px) {
  .login-page-shell {
    background-size: ${r.mobileTile.w}px ${r.mobileTile.h}px, auto, auto;
  }
}

`

writeFileSync('app/globals.css', css.slice(0, commentStart) + block + css.slice(end))
console.log('ok', { tile: r.tile, mobile: r.mobileTile })
