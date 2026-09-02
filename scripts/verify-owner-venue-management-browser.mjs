import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WEB_PORT = 4311;
const API_PORT = 17081;
const DEBUG_PORT = 9234;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = mkdtempSync(join(tmpdir(), 'goatsports-venues-chrome-'));
const browserErrors = [];
const ok = data => ({ statusCode: 200, message: 'OK', error: null, data });
const venueNames = ['GOAT Arena', 'Sân bóng Hoàng Mai', 'GOAT Pickleball 36', 'Cụm sân Bình Thạnh', 'Sân cầu lông Elite', 'GOAT Riverside'];
const venues = venueNames.map((name, index) => ({
  venueId: `venue-${index + 1}`,
  name,
  description: 'Không gian thể thao dành cho cộng đồng địa phương.',
  openTime: '06:00:00',
  closeTime: '23:00:00',
  active: index !== 3,
  minPrice: 100000,
  maxPrice: 350000,
  phone: '0867684603',
  email: 'lienhe@goatsports.vn',
  address: '25 Trần Phú',
  ward: 'Lộc Thọ',
  district: index % 2 ? 'Hoàng Mai' : 'Nha Trang',
  city: index % 2 ? 'Hà Nội' : 'Khánh Hòa',
  latitude: 12.2388,
  longitude: 109.1967,
  imageUrls: Array.from({ length: index === 0 ? 8 : 1 }, (_, imageIndex) =>
    `http://127.0.0.1:${WEB_PORT}/assets/images/background.jpg?venue=${index + 1}&image=${imageIndex + 1}`),
  amenities: ['Bãi giữ xe', 'Phòng thay đồ', 'Wifi miễn phí', 'Căn tin'],
  courts: []
}));
const user = {
  userId: 'owner-1', email: 'owner@goatsports.test', username: 'venue-owner', fullName: 'Đạt Minh',
  status: 'ACTIVE', gender: 'OTHER', authProviders: [], role: { roleId: 'owner-role', name: 'VENUE_OWNER' },
  createdAt: '2026-08-01T08:00:00Z', updatedAt: '2026-08-29T08:00:00Z'
};

function responseFor(request) {
  const url = new URL(request.url, `http://localhost:${API_PORT}`);
  if (url.pathname === '/auth-service/api/v1/auth/me') return ok(user);
  if (url.pathname === '/venue-service/api/v1/owner/venues') return ok(venues);
  const detail = url.pathname.match(/^\/venue-service\/api\/v1\/owner\/venues\/(venue-\d+)$/);
  if (detail) return ok(venues.find(venue => venue.venueId === detail[1]));
  return ok([]);
}

const apiServer = createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', request.headers.origin ?? `http://127.0.0.1:${WEB_PORT}`);
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
  response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(responseFor(request)));
});

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function waitForUrl(url, timeout = 120000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return; } catch { /* starting */ }
    await delay(300);
  }
  throw new Error(`Timed out waiting for ${url}`);
}
async function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails?.text ?? 'Runtime exception');
    if (!message.id || !pending.has(message.id)) return;
    const callback = pending.get(message.id);
    pending.delete(message.id);
    message.error ? callback.reject(new Error(message.error.message)) : callback.resolve(message.result);
  });
  return {
    send(method, params = {}) {
      const messageId = ++id;
      socket.send(JSON.stringify({ id: messageId, method, params }));
      return new Promise((resolve, reject) => pending.set(messageId, { resolve, reject }));
    },
    close() { socket.close(); }
  };
}
async function evaluate(cdp, expression) {
  return (await cdp.send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
}
async function waitFor(cdp, expression, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(cdp, expression)) return;
    await delay(150);
  }
  throw new Error(`Condition timed out: ${expression}`);
}
async function capture(cdp, name) {
  const image = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const path = join(tmpdir(), `goatsports-owner-venues-${name}.png`);
  writeFileSync(path, Buffer.from(image.data, 'base64'));
  return path;
}
async function inspect(cdp, kind) {
  return evaluate(cdp, `(() => ({
    kind: '${kind}',
    route: location.pathname,
    topbar: Boolean(document.querySelector('.admin-topbar')),
    sidebar: Boolean(document.querySelector('.admin-sidebar')),
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    listItems: document.querySelectorAll('.venue-option').length,
    galleryImages: document.querySelectorAll('.venue-gallery .image-card img').length,
    galleryThumbnailCount: document.querySelector('.venue-gallery__thumbnails')?.dataset.count,
    galleryThumbnailsFillRow: [...document.querySelectorAll('.venue-gallery__thumbnails .image-card')].every(card =>
      Math.abs(card.getBoundingClientRect().height - document.querySelector('.venue-gallery__thumbnails').getBoundingClientRect().height) < 2
    ),
    formSections: document.querySelectorAll('.form-section').length,
    descriptionHeight: document.querySelector('[formControlName="description"]').getBoundingClientRect().height,
    amenityBadges: document.querySelectorAll('.amenity-chip').length,
    amenityInputVisible: document.querySelector('.amenities-editor > input').getBoundingClientRect().width > 2,
    coordinateFields: document.querySelectorAll('[formControlName="latitude"], [formControlName="longitude"]').length,
    workspaceColumns: getComputedStyle(document.querySelector('.venue-workspace')).gridTemplateColumns,
    actionBarVisible: document.querySelector('.form-actions').getBoundingClientRect().bottom <= innerHeight,
    actionBarSpansWorkspace: Math.abs(
      document.querySelector('.form-actions').getBoundingClientRect().width
      - document.querySelector('.venue-workspace').getBoundingClientRect().width
    ) <= 2,
    minMainControlHeight: Math.min(...[...document.querySelectorAll('.owner-page button, .owner-page input, .owner-page textarea')]
      .filter(node => node.getBoundingClientRect().width > 2 && node.getBoundingClientRect().height > 2)
      .map(node => node.getBoundingClientRect().height))
  }))()`);
}

let angularProcess;
let chromeProcess;
try {
  await new Promise((resolve, reject) => { apiServer.once('error', reject); apiServer.listen(API_PORT, resolve); });
  angularProcess = spawn('cmd.exe', ['/d', '/s', '/c', `npm.cmd start -- --host 127.0.0.1 --port ${WEB_PORT}`], {
    cwd: process.cwd(), stdio: 'ignore', windowsHide: true,
    env: { ...process.env, NG_APP_API_URL: `http://localhost:${API_PORT}` }
  });
  await waitForUrl(`http://127.0.0.1:${WEB_PORT}`);
  chromeProcess = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--disable-extensions', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'
  ], { stdio: 'ignore', windowsHide: true });
  await waitForUrl(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
  const pages = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`).then(response => response.json());
  const page = pages.find(candidate => candidate.type === 'page' && candidate.url === 'about:blank');
  const cdp = await connectCdp(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${WEB_PORT}/admin/venues` });
  await waitFor(cdp, "document.querySelectorAll('.venue-option').length === 5 && document.querySelectorAll('.form-section').length === 6");
  await delay(400);
  const desktop = { ...(await inspect(cdp, 'desktop')), screenshot: await capture(cdp, 'desktop') };
  await evaluate(cdp, "document.querySelector('button.gallery-more').click()");
  await waitFor(cdp, "Boolean(document.querySelector('.gallery-lightbox [role=dialog]'))");
  const lightboxStart = await evaluate(cdp, `(() => ({
    visibleImages: document.querySelectorAll('.gallery-lightbox__stage figure img').length,
    currentSrc: document.querySelector('.gallery-lightbox__stage figure img').src,
    visibleText: document.querySelector('.gallery-lightbox__dialog').innerText.trim()
  }))()`);
  const lightboxScreenshot = await capture(cdp, 'lightbox');
  await evaluate(cdp, "document.querySelector('.gallery-lightbox__nav--next').click()");
  const lightboxNextSrc = await evaluate(cdp, "document.querySelector('.gallery-lightbox__stage figure img').src");
  await evaluate(cdp, "document.querySelector('.gallery-lightbox__close').click()");

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await delay(300);
  const widescreen = { ...(await inspect(cdp, 'widescreen')), screenshot: await capture(cdp, 'widescreen') };

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp.send('Page.reload');
  await delay(500);
  await waitFor(cdp, "document.querySelectorAll('.venue-option').length === 5 && document.querySelectorAll('.form-section').length === 6");
  await delay(300);
  const mobile = { ...(await inspect(cdp, 'mobile')), screenshot: await capture(cdp, 'mobile') };

  const checks = [
    desktop.route === '/admin/venues' && desktop.topbar && desktop.sidebar,
    desktop.listItems === 5 && desktop.galleryImages === 6 && desktop.formSections === 6,
    desktop.galleryThumbnailCount === '5',
    lightboxStart.visibleImages === 1 && !lightboxStart.visibleText && lightboxStart.currentSrc !== lightboxNextSrc,
    desktop.descriptionHeight >= 72,
    desktop.amenityBadges === 4 && !desktop.amenityInputVisible,
    desktop.workspaceColumns.split(' ').length >= 2,
    parseFloat(widescreen.workspaceColumns) <= 371,
    mobile.listItems === 5 && mobile.formSections === 6,
    mobile.workspaceColumns.trim().split(/\s+/).length === 1,
    desktop.coordinateFields === 0 && mobile.coordinateFields === 0,
    desktop.actionBarSpansWorkspace,
    !desktop.horizontalOverflow && !mobile.horizontalOverflow,
    desktop.minMainControlHeight >= 24 && mobile.minMainControlHeight >= 24
  ];
  if (checks.some(check => !check)) throw new Error(`Owner venue browser assertion failed: ${JSON.stringify({ desktop, widescreen, mobile, lightboxStart, lightboxNextSrc }, null, 2)}`);
  cdp.close();
  if (browserErrors.length) throw new Error(`Browser exceptions: ${browserErrors.join('; ')}`);
  console.log(JSON.stringify({ passed: true, desktop, widescreen, mobile, lightboxStart, lightboxNextSrc, lightboxScreenshot, browserErrors }, null, 2));
} finally {
  await new Promise(resolve => apiServer.close(resolve));
  for (const process of [chromeProcess, angularProcess]) {
    if (!process?.pid) continue;
    try { execFileSync('taskkill.exe', ['/pid', String(process.pid), '/t', '/f'], { stdio: 'ignore' }); }
    catch { /* exited */ }
  }
  await delay(500);
  try { rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
  catch { /* Chrome can briefly retain its temporary profile on Windows. */ }
}
