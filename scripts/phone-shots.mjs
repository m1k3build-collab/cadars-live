import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const base = process.env.APP_URL || 'http://127.0.0.1:43123/cadars-live/'
const out = process.env.SHOT_DIR || '/tmp/cadars-shots'
await mkdir(out, { recursive: true })

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

async function shoot(colorScheme, folder) {
  const dir = `${out}/${folder}`
  await mkdir(dir, { recursive: true })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme,
    hasTouch: true,
    serviceWorkers: 'allow',
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.goto(base, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: "Who's on the air" }).waitFor()

  await page.getByRole('button', { name: 'Club' }).click()
  await page.getByText('Henllys Village Hall').waitFor()
  const clubText = await page.locator('#content').innerText()
  if (/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i.test(clubText)) {
    throw new Error(`postcode leaked on the club screen: ${clubText}`)
  }

  await page.getByRole('button', { name: 'Repeaters' }).click()
  await page.getByText('GB3YA').waitFor()
  const repeaterText = await page.locator('#content').innerText()
  if (/verify on ukrepeater/i.test(repeaterText)) throw new Error('internal repeater note is visible')
  if (!/Likely a digital repeater/i.test(repeaterText)) throw new Error('useful repeater note was hidden')

  await page.getByRole('button', { name: 'On air' }).click()
  await page.getByText('The band is quiet just now.').waitFor()

  await page.getByRole('button', { name: 'Turn on' }).click()
  await page.getByText('GW4XYZ').first().waitFor()
  await page.getByRole('button', { name: "I'm on GB3YA" }).click()
  await page.getByText('You are on the air').waitFor()
  await page.getByText('MW0CAD').first().waitFor()
  await page.getByRole('button', { name: 'Clear my status' }).click()
  await page.getByText('You are on the air').waitFor({ state: 'hidden' })

  await page.getByRole('button', { name: 'Net', exact: true }).click()
  await page.getByRole('heading', { name: 'Checked in' }).waitFor()
  await page.getByText('Most regular', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Check in M7ABC' }).click()
  await page.locator('#checkin-M7ABC').waitFor()

  await page.getByRole('button', { name: 'Close the sample net' }).click()
  await page.getByRole('button', { name: "Start tonight's net" }).click()
  await page.getByRole('heading', { name: 'Checked in' }).waitFor()
  await page.getByRole('button', { name: 'Check in 2E0XYZ' }).click()
  await page.locator('#checkin-2E0XYZ').waitFor()

  await page.getByRole('button', { name: 'Turn off' }).click()
  await page.getByRole('button', { name: 'On air' }).click()
  await page.getByText('The band is quiet just now.').waitFor()
  if ((await page.getByText('GW4XYZ').count()) > 0) throw new Error('sample stations stayed after demo off')

  await page.getByRole('button', { name: 'Turn on' }).click()
  await page.getByText('GW4XYZ').first().waitFor()
  await page.waitForFunction(() => !document.querySelector('.toast'))
  const fit = await page.evaluate(() => {
    const main = document.getElementById('content')
    return { scroll: main?.scrollHeight ?? 0, client: main?.clientHeight ?? 0 }
  })
  console.log(folder, 'on-air fit', fit)
  await page.screenshot({ path: `${dir}/on-air.png` })

  await page.getByRole('button', { name: 'Net', exact: true }).click()
  await page.getByRole('heading', { name: 'Checked in' }).waitFor()
  await page.waitForFunction(() => !document.querySelector('.toast'))
  await page.screenshot({ path: `${dir}/net-check-in.png` })

  if (colorScheme === 'dark') {
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForFunction(() => navigator.serviceWorker.controller)
    await context.setOffline(true)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByText('GW4XYZ').first().waitFor({ timeout: 8000 })
    const offlineText = await page.locator('#content').innerText()
    if (!offlineText.includes('MW6DEF')) throw new Error('offline demo did not render sample stations')
    console.log('offline demo ok')
  }

  const interesting = errors.filter((item) => !/Failed to load resource/i.test(item))
  if (interesting.length) console.log(folder, 'console', interesting)
  await context.close()
}

await shoot('dark', 'dark')
await shoot('light', 'light')
await browser.close()
console.log('shots written')
