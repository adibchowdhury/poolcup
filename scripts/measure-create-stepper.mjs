/**
 * Measure create-wizard stepper label fit at 1280×800 (modal) and 390×844 (mobile).
 */
import { chromium } from 'playwright'

const LABELS = ['Competition', 'Pool Type', 'Details', 'Plan', 'Review']

const stepperHtml = (labelMode, containerClass) => `
<nav class="flex w-full justify-center px-1 ${containerClass}">
  <ol class="flex w-[94%] min-w-0 max-w-full list-none items-start gap-0 p-0 m-0" style="width:94%">
    ${LABELS.map((label, index) => `
    <li class="flex items-start gap-0 ${index > 0 ? 'min-w-0 flex-1' : 'shrink-0'}">
      ${index > 0 ? '<div class="mt-[1.125rem] h-0.5 min-w-[0.375rem] flex-1 shrink bg-[#00e676]"></div>' : ''}
      <div class="flex min-w-0 flex-col items-center gap-1">
        <div class="h-9 w-9 rounded-full border-2 border-[#00e676]"></div>
        ${labelMode === 'all' || (labelMode === 'active-only' && index === 0)
          ? `<span class="max-w-[4.75rem] truncate text-center text-[10px] font-semibold leading-tight text-[#00e676] sm:max-w-[5.5rem] sm:text-[11px]">${label}</span>`
          : ''}
      </div>
    </li>`).join('')}
  </ol>
</nav>`

async function measure(viewport, labelMode, shell) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport })
  await page.setContent(`<!DOCTYPE html><html><head><style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; background: #111; color: #f0f4f8; }
    .modal { width: min(48rem, calc(100vw - 3rem)); padding: 2rem 2.5rem; margin: 24px auto; background: #111; }
    .mobile { padding: 1rem; width: 100%; }
  </style></head><body><div class="${shell}">${stepperHtml(labelMode, '')}</div></body></html>`)
  const report = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('span'))
    const nav = document.querySelector('nav')
    return {
      containerWidth: Math.round(nav.getBoundingClientRect().width),
      labels: labels.map((el) => ({
        text: el.textContent,
        width: Math.round(el.getBoundingClientRect().width),
        scrollWidth: el.scrollWidth,
        truncated: el.scrollWidth > el.clientWidth + 1,
      })),
      labelCount: labels.length,
      anyTruncated: labels.some((el) => el.scrollWidth > el.clientWidth + 1),
    }
  })
  await browser.close()
  return { viewport, labelMode, shell, ...report }
}

const modal1280 = await measure({ width: 1280, height: 800 }, 'all', 'modal')
const mobile390all = await measure({ width: 390, height: 844 }, 'all', 'mobile')
const mobile390active = await measure({ width: 390, height: 844 }, 'active-only', 'mobile')

console.log(JSON.stringify({ modal1280, mobile390all, mobile390active }, null, 2))
