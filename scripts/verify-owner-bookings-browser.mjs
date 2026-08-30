import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WEB_PORT = 4301;
const API_PORT = 17071;
const DEBUG_PORT = 9224;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = mkdtempSync(join(tmpdir(), 'goatsports-bookings-chrome-'));
const ok = data => ({ statusCode: 200, message: 'OK', error: null, data });
const user = {
  userId: 'owner-1', email: 'owner@goatsports.test', username: 'venue-owner',
  fullName: 'Nguyen Minh Owner', status: 'ACTIVE', gender: 'OTHER', authProviders: [],
  role: { roleId: 'role-owner', name: 'VENUE_OWNER' },
  createdAt: '2026-08-01T08:00:00', updatedAt: '2026-08-01T08:00:00'
};
const venue = {
  venueId: 'venue-1', name: 'Goat Arena Thu Duc', openTime: '06:00:00', closeTime: '23:00:00',
  active: true, imageUrls: [], amenities: [], courts: []
};
const court = {
  venueCourtId: 'court-1', venueId: venue.venueId, sportType: 'BADMINTON',
  name: 'San cau long A', capacity: 4, surfaceType: 'SYNTHETIC', active: true
};
const booking = {
  bookingId: 'booking-1', playerId: 'player-12345678', venueId: venue.venueId,
  venueCourtId: court.venueCourtId, venueName: venue.name, courtName: court.name,
  playDate: '2026-08-29', startTime: '08:00:00', endTime: '09:00:00',
  status: 'CHECKED_IN', source: 'DIRECT', totalPrice: 200000, depositAmount: 60000,
  remainingAmount: 140000, bookingCode: 'GS123456', createdAt: '2026-08-28T08:00:00',
  updatedAt: '2026-08-29T08:02:00', allowedTransitions: ['COMPLETED'],
  payments: [{
    paymentId: 'payment-1', purpose: 'BOOKING_DEPOSIT', amount: 60000, currency: 'VND',
    status: 'SUCCEEDED', paidAt: '2026-08-28T08:05:00', createdAt: '2026-08-28T08:01:00'
  }]
};

function responseFor(request) {
  const url = new URL(request.url, `http://localhost:${API_PORT}`);
  if (url.pathname === '/auth-service/api/v1/auth/me') return ok(user);
  if (url.pathname === '/venue-service/api/v1/owner/venues') return ok([venue]);
  if (url.pathname === `/venue-service/api/v1/owner/venues/${venue.venueId}/courts`) return ok([court]);
  if (url.pathname === '/venue-service/api/v1/owner/bookings') {
    return ok({ meta: { page: 0, pageSize: 12, pages: 1, total: 1 }, result: [booking] });
  }
  if (url.pathname === `/venue-service/api/v1/owner/bookings/${booking.bookingId}`) return ok(booking);
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
  const diagnostics = await evaluate(cdp, `({ location: location.href, text: document.body?.innerText?.slice(0, 1200) })`);
  throw new Error(`Condition timed out: ${expression}\n${JSON.stringify(diagnostics, null, 2)}`);
}

async function verifyViewport(cdp, name, width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width < 600
  });
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${WEB_PORT}/admin/owner-bookings` });
  await waitFor(cdp, "document.querySelectorAll('.booking-card').length === 1");
  const list = await evaluate(cdp, `(() => ({
    route: location.pathname,
    title: document.querySelector('.page-hero h1')?.textContent?.trim(),
    cards: document.querySelectorAll('.booking-card').length,
    paymentStatusVisible: document.body.innerText.includes('SUCCEEDED'),
    developingBadgeVisible: [...document.querySelectorAll('*')].some(node => node.textContent?.trim() === 'DEV' && node.getBoundingClientRect().width > 0),
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    minInteractiveHeight: Math.min(...[...document.querySelectorAll('.owner-bookings-page button, .owner-bookings-page select, .owner-bookings-page input')].map(element => element.getBoundingClientRect().height))
  }))()`);
  await evaluate(cdp, "document.querySelector('.booking-card footer button').click()");
  await waitFor(cdp, "document.querySelector('.detail-panel')?.innerText.includes('SUCCEEDED')");
  const detail = await evaluate(cdp, `(() => ({
    detailOpen: !!document.querySelector('.detail-panel'),
    timelineItems: document.querySelectorAll('.timeline li').length,
    completeActionVisible: !!document.querySelector('.detail-panel__footer .primary-button'),
    panelWithinViewport: document.querySelector('.detail-panel').getBoundingClientRect().width <= innerWidth
  }))()`);
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const screenshotPath = join(tmpdir(), `goatsports-owner-bookings-${name}.png`);
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  return { viewport: `${width}x${height}`, ...list, ...detail, screenshotPath };
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
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  const results = [
    await verifyViewport(cdp, 'desktop', 1440, 1000),
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
