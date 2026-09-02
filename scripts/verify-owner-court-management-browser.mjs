import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WEB_PORT = 4304;
const API_PORT = 17074;
const DEBUG_PORT = 9227;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = mkdtempSync(join(tmpdir(), 'goatsports-courts-chrome-'));
const ok = data => ({ statusCode: 200, message: 'OK', error: null, data });
const user = {
  userId: 'owner-1', email: 'owner@goatsports.test', username: 'venue-owner', fullName: 'Hoàng Minh',
  status: 'ACTIVE', gender: 'OTHER', authProviders: [], role: { roleId: 'role-owner', name: 'VENUE_OWNER' },
  createdAt: '2026-08-01T08:00:00', updatedAt: '2026-08-01T08:00:00'
};
const venues = [
  { venueId: 'venue-1', name: 'The Goat Arena', active: true, address: '12 Nguyễn Huệ', city: 'Hồ Chí Minh', imageUrls: [], amenities: [], courts: [] },
  { venueId: 'venue-2', name: 'Goat Riverside', active: true, address: '8 Trần Phú', city: 'Đà Nẵng', imageUrls: [], amenities: [], courts: [] }
];
const courts = [
  ['court-01', 'Sân 01', 'BADMINTON', 50, 'Thảm PVC', true, 'AVAILABLE'],
  ['court-02', 'Sân 02', 'FOOTBALL', 40, 'Cỏ nhân tạo', true, 'AVAILABLE'],
  ['court-03', 'Sân 03', 'BASKETBALL', 30, 'Sàn gỗ', true, 'AVAILABLE'],
  ['court-04', 'Sân 04', 'TENNIS', 20, 'Sơn cứng', true, 'AVAILABLE'],
  ['court-05', 'Sân 05', 'BADMINTON', 50, 'Thảm PVC', true, 'MAINTENANCE'],
  ['court-06', 'Sân 06', 'FOOTBALL', 60, 'Cỏ nhân tạo', true, 'AVAILABLE'],
  ['court-07', 'Sân 07', 'BASKETBALL', 30, 'Sàn gỗ', false, 'INACTIVE'],
  ['court-08', 'Sân 08', 'TENNIS', 22, 'Sơn cứng', true, 'AVAILABLE']
].map(([venueCourtId, name, sportType, capacity, surfaceType, active, availabilityStatus]) => ({
  venueCourtId, venueId: 'venue-1', name, sportType, capacity, surfaceType, active, availabilityStatus
}));
const today = new Date().toLocaleDateString('en-CA');
const minutesNow = new Date().getHours() * 60 + new Date().getMinutes();
const toTime = minutes => {
  const normalized = Math.max(0, Math.min(1439, minutes));
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}:00`;
};
const bookings = [
  {
    bookingId: 'booking-current', venueId: 'venue-1', venueCourtId: 'court-02', venueName: 'The Goat Arena',
    courtName: 'Sân 02', playDate: today, startTime: toTime(minutesNow - 25), endTime: toTime(minutesNow + 35), status: 'CHECKED_IN',
    source: 'WALK_IN', totalPrice: 320000, depositAmount: 0, remainingAmount: 320000,
    bookingCode: 'GS-CURRENT', walkInCustomerName: 'Anh Duy', createdAt: new Date().toISOString(), payments: [], allowedTransitions: ['COMPLETED']
  },
  {
    bookingId: 'booking-next', venueId: 'venue-1', venueCourtId: 'court-03', venueName: 'The Goat Arena',
    courtName: 'Sân 03', playDate: today, startTime: toTime(minutesNow + 55), endTime: toTime(minutesNow + 115), status: 'CONFIRMED',
    source: 'DIRECT', totalPrice: 160000, depositAmount: 48000, remainingAmount: 112000,
    bookingCode: 'GS-NEXT', createdAt: new Date().toISOString(), payments: [], allowedTransitions: ['CHECKED_IN']
  }
];

function responseFor(request) {
  const url = new URL(request.url, `http://localhost:${API_PORT}`);
  if (url.pathname === '/auth-service/api/v1/auth/me') return ok(user);
  if (url.pathname === '/venue-service/api/v1/owner/venues') return ok(venues);
  if (url.pathname === '/venue-service/api/v1/owner/venues/venue-1/courts') return ok(courts);
  if (url.pathname === '/venue-service/api/v1/owner/venues/venue-2/courts') return ok([]);
  if (url.pathname === '/venue-service/api/v1/owner/bookings') {
    return ok({ meta: { page: 0, pageSize: 200, pages: 1, total: bookings.length }, result: bookings });
  }
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
async function waitForUrl(url, timeout = 60000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return; } catch { /* still starting */ }
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

async function verifyViewport(cdp, name, width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${WEB_PORT}/admin/courts` });
  await waitFor(cdp, "document.querySelectorAll('.court-object').length === 8");
  const initial = await evaluate(cdp, `(() => ({
    route: location.pathname,
    title: document.querySelector('.page-heading h1')?.textContent?.trim(),
    courts: document.querySelectorAll('.court-object').length,
    facilities: document.querySelectorAll('.facility-object').length,
    zones: document.querySelectorAll('.facility-zone').length,
    tabs: document.querySelectorAll('.workspace-tabs button').length,
    floatingMapControls: document.querySelectorAll('.map-controls').length,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    workspaceWidth: Math.round(document.querySelector('.workspace-shell').getBoundingClientRect().width)
  }))()`);
  await evaluate(cdp, "document.querySelectorAll('.court-object')[1].click()");
  await waitFor(cdp, "!!document.querySelector('.court-detail')");
  const detail = await evaluate(cdp, `(() => ({
    detailOpen: !!document.querySelector('.court-detail'),
    detailTitle: document.querySelector('.court-detail h2')?.textContent?.trim(),
    operationalStatusVisible: document.querySelector('.court-detail')?.innerText.includes('Đang sử dụng'),
    panelWithinViewport: document.querySelector('.court-detail').getBoundingClientRect().right <= innerWidth,
    bodyHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
  }))()`);
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const screenshotPath = join(tmpdir(), `goatsports-owner-courts-map-${name}.png`);
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  let editMode = null;
  if (width >= 768) {
    await evaluate(cdp, "document.querySelector('.court-detail > header > button').click(); document.querySelector('.edit-layout-button').click()");
    await waitFor(cdp, "!!document.querySelector('.facility-workspace.is-editing')");
    editMode = await evaluate(cdp, `(() => ({
      layoutMode: !!document.querySelector('.facility-workspace.is-editing'),
      libraryItems: document.querySelectorAll('.object-library > button').length,
      inspectorVisible: !!document.querySelector('.layout-inspector'),
      saveDisabledInitially: document.querySelector('.save-layout-button')?.disabled,
      editHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    }))()`);
    const editScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const editScreenshotPath = join(tmpdir(), `goatsports-owner-courts-edit-${name}.png`);
    writeFileSync(editScreenshotPath, Buffer.from(editScreenshot.data, 'base64'));
    editMode.editScreenshotPath = editScreenshotPath;
  }
  return { viewport: `${width}x${height}`, ...initial, ...detail, screenshotPath, editMode };
}

let angularProcess;
let chromeProcess;
try {
  await new Promise((resolve, reject) => {
    apiServer.once('error', reject);
    apiServer.listen(API_PORT, resolve);
  });
  angularProcess = spawn('cmd.exe', ['/d', '/s', '/c', `npm.cmd start -- --host 127.0.0.1 --port ${WEB_PORT}`], {
    cwd: process.cwd(), stdio: 'ignore', windowsHide: true,
    env: { ...process.env, NG_APP_API_URL: `http://localhost:${API_PORT}` }
  });
  await waitForUrl(`http://127.0.0.1:${WEB_PORT}`);
  chromeProcess = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--disable-extensions', '--no-first-run',
    `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'
  ], { stdio: 'ignore', windowsHide: true });
  await waitForUrl(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
  const pages = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`).then(response => response.json());
  const page = pages.find(candidate => candidate.type === 'page' && candidate.url === 'about:blank');
  if (!page) throw new Error('No browser page target found');
  const cdp = await connectCdp(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  const results = [
    await verifyViewport(cdp, 'desktop', 1440, 960),
    await verifyViewport(cdp, 'tablet', 1024, 900),
    await verifyViewport(cdp, 'mobile', 390, 844)
  ];
  cdp.close();
  console.log(JSON.stringify({ passed: true, results }, null, 2));
} finally {
  await new Promise(resolve => apiServer.close(resolve));
  for (const process of [chromeProcess, angularProcess]) {
    if (!process?.pid) continue;
    try { execFileSync('taskkill.exe', ['/pid', String(process.pid), '/t', '/f'], { stdio: 'ignore' }); }
    catch { /* already exited */ }
  }
  rmSync(profileDir, { recursive: true, force: true });
}
