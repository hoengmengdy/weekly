import {test, expect, type Page} from '@playwright/test';

const status = (page: Page) => page.locator('.narration-status');
const panel = (page: Page) => page.locator('.voice-controls');
const step = (page: Page, index: number) => page.locator('.step-button').nth(index);
const frame = async (page: Page) => Number(await status(page).getAttribute('data-frame'));
const audioPeak = (page: Page) => page.evaluate(() => {
  const {audioMeters} = window as unknown as {audioMeters: AnalyserNode[]};
  return Math.max(0, ...audioMeters.map((meter) => {
    if (meter.context.state !== 'running') return 0;
    const data = new Float32Array(meter.fftSize);
    meter.getFloatTimeDomainData(data);
    return Math.max(...data.map(Math.abs));
  }));
});
const seek = async (page: Page, seconds: number) => {
  await page.locator('.video-card').hover();
  const bar = page.locator('.video-card [style*="touch-action: none"]').last();
  const box = await bar.boundingBox();
  if (!box) throw new Error('Native player seek bar not found');
  await bar.click({position: {x: box.width * seconds * 30 / 4799, y: box.height / 2}});
};

test.beforeEach(async ({page}) => {
  await page.addInitScript(() => {
    // Prove the app works even when the browser offers no Khmer TTS voice.
    Object.defineProperty(window.speechSynthesis, 'getVoices', {value: () => []});
    window.speechSynthesis.speak = () => {throw new Error('Unexpected browser TTS fallback');};
    // Measure actual Web Audio output, not just the UI's playing flag.
    const target = window as unknown as {audioMeters: AnalyserNode[]};
    target.audioMeters = [];
    const connect = AudioNode.prototype.connect as (this: AudioNode, destination: AudioNode | AudioParam, ...args: number[]) => AudioNode;
    AudioNode.prototype.connect = function(this: AudioNode, destination: AudioNode | AudioParam, ...args: number[]) {
      if (destination instanceof AudioDestinationNode) {
        const meter = this.context.createAnalyser();
        meter.fftSize = 2048;
        connect.call(this, meter);
        connect.call(meter, destination);
        target.audioMeters.push(meter);
        return destination;
      }
      return connect.call(this, destination, ...args);
    } as unknown as typeof AudioNode.prototype.connect;
  });
  await page.goto('/Workday-Khmer-Guide');
  await expect(page.getByRole('heading', {name: 'សៀវភៅណែនាំ Workday', exact: true})).toBeVisible();
});

test('real Khmer audio, pause/resume, replay and native mute controls', async ({page}) => {
  await expect(status(page)).toHaveAttribute('data-playing', 'false');
  await panel(page).getByRole('button', {name: '▶️ ស្តាប់ជំហាននេះ', exact: true}).click();
  await expect(status(page)).toHaveAttribute('data-playing', 'true');
  await expect.poll(() => audioPeak(page)).toBeGreaterThan(0.001);
  await panel(page).getByRole('button', {name: '⏸️ ផ្អាកសំឡេង', exact: true}).click();
  await expect(status(page)).toHaveAttribute('data-playing', 'false');
  const paused = await frame(page);
  await page.waitForTimeout(250);
  expect(await frame(page)).toBe(paused);
  await expect.poll(() => audioPeak(page)).toBeLessThan(0.001);
  await panel(page).getByRole('button', {name: '▶️ បន្តសំឡេង', exact: true}).click();
  await expect.poll(() => frame(page)).toBeGreaterThan(paused + 5);
  await panel(page).getByRole('button', {name: '🔇 បិទសំឡេង', exact: true}).click();
  await expect(status(page)).toHaveAttribute('data-audible', 'false');
  await expect.poll(() => audioPeak(page)).toBeLessThan(0.001);
  await page.locator('.video-card').hover();
  await page.getByRole('button', {name: 'Unmute sound', exact: true}).click();
  await expect(status(page)).toHaveAttribute('data-audible', 'true');
  await panel(page).getByRole('button', {name: '🔁 ស្តាប់ម្តងទៀត', exact: true}).click();
  expect(await frame(page)).toBeLessThan(35);
});

test('switching away from isolated narration cancels it without limiting the new chapter', async ({page}) => {
  await page.getByRole('checkbox').uncheck();
  await panel(page).getByRole('button', {name: '▶️ ស្តាប់ជំហាននេះ', exact: true}).click();
  await expect(status(page)).toHaveAttribute('data-audible', 'true');
  await step(page, 7).click();
  await expect(status(page)).toHaveAttribute('data-step-id', '08-manage');
  await expect(status(page)).toHaveAttribute('data-audible', 'false');
  await expect.poll(() => frame(page)).toBeGreaterThan(124 * 30 + 20);
  await expect.poll(() => audioPeak(page)).toBeLessThan(0.001);
});

test('switch steps, preserve mute, and advance without restarting each frame', async ({page}) => {
  await step(page, 2).click();
  await expect(status(page)).toHaveAttribute('data-step-id', '03-tasks');
  await expect.poll(() => frame(page)).toBeGreaterThan(26 * 30 + 30);
  await panel(page).getByRole('button', {name: '🔇 បិទសំឡេង', exact: true}).click();
  await step(page, 4).click();
  await expect(status(page)).toHaveAttribute('data-step-id', '05-evidence');
  await expect(status(page)).toHaveAttribute('data-audible', 'false');
  await step(page, 6).click();
  await expect(status(page)).toHaveAttribute('data-step-id', '07-review');
  await panel(page).getByRole('button', {name: '▶️ ស្តាប់ជំហាននេះ', exact: true}).click();
  await expect(status(page)).toHaveAttribute('data-audible', 'true');
  await expect(step(page, 6)).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('.active-step')).toHaveCount(1);
});

test('manual narration stops at step end; automatic narration crosses steps; speed stays in sync', async ({page}) => {
  await page.getByRole('checkbox').uncheck();
  await step(page, 2).click();
  await expect(status(page)).toHaveAttribute('data-audible', 'false');
  await panel(page).getByRole('button', {name: '▶️ ស្តាប់ជំហាននេះ', exact: true}).click();
  await expect(status(page)).toHaveAttribute('data-audible', 'true');
  await seek(page, 45.3);
  await expect(status(page)).toHaveAttribute('data-playing', 'false');
  await expect(status(page)).toHaveAttribute('data-step-id', '03-tasks');
  await page.getByRole('checkbox').check();
  await step(page, 1).click();
  await seek(page, 25.3);
  await expect(status(page)).toHaveAttribute('data-step-id', '03-tasks');
  await expect(status(page)).toHaveAttribute('data-audible', 'true');
  await page.getByRole('combobox').selectOption('0.8');
  await expect(page.getByRole('combobox')).toHaveValue('0.8');
  await page.getByRole('combobox').selectOption('1.2');
  const before = await frame(page);
  await page.waitForTimeout(1000);
  const advanced = (await frame(page)) - before;
  expect(advanced).toBeGreaterThan(24);
  expect(advanced).toBeLessThan(49);
});

test('missing audio shows a Khmer error while video and other steps remain usable', async ({page}) => {
  await page.route('**/voiceover/04-report.mp3', (route) => route.fulfill({status: 404, contentType: 'text/html', body: 'missing'}));
  await page.reload();
  await step(page, 3).click();
  await expect(page.getByRole('alert')).toContainText('មិនអាចផ្ទុកឯកសារសំឡេងខ្មែរ');
  await expect(panel(page).getByRole('button', {name: '▶️ ស្តាប់ជំហាននេះ', exact: true})).toBeDisabled();
  await expect(status(page)).toHaveAttribute('data-playing', 'true');
  await step(page, 4).click();
  await expect(status(page)).toHaveAttribute('data-step-id', '05-evidence');
  await expect(status(page)).toHaveAttribute('data-audible', 'true');
});

test('corrupt audio does not crash the video or select an English voice', async ({page}) => {
  await page.route('**/voiceover/05-evidence.mp3', (route) => route.fulfill({contentType: 'audio/mpeg', body: 'invalid audio bytes'}));
  await page.reload();
  await step(page, 4).click();
  await expect(page.getByRole('alert')).toContainText('មិនអាចផ្ទុកឯកសារសំឡេងខ្មែរ');
  await expect(page.locator('.video-card')).toContainText('បន្ថែមលទ្ធផលការងារ');
  await step(page, 5).click();
  await expect(status(page)).toHaveAttribute('data-step-id', '06-submit');
});

test('mobile controls fit and every existing step maps to its audio URL', async ({page}) => {
  await page.setViewportSize({width: 375, height: 812});
  for (let index = 0; index < 9; index++) {
    await step(page, index).click();
    await expect(status(page)).toHaveAttribute('data-step-id', `${String(index + 1).padStart(2, '0')}-${['opening','login','tasks','report','evidence','submit','review','manage','closing'][index]}`);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator('.video-card')).toContainText('តាមដានជារៀងរាល់ថ្ងៃ');
  await expect.poll(() => frame(page)).toBeGreaterThan(144 * 30 + 28);
  await panel(page).getByRole('button', {name: '⏸️ ផ្អាកសំឡេង', exact: true}).click();
  await page.screenshot({path: 'out/qa/mobile-controls.png', fullPage: true});
});
