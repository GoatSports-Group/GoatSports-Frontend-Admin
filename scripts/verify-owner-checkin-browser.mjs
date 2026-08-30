import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WEB_PORT = 4302;
const API_PORT = 17072;
const DEBUG_PORT = 9225;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = mkdtempSync(join(tmpdir(), 'goatsports-checkin-chrome-'));
const browserErrors = [];
const receivedRequests = [];
const ok = data => ({ statusCode: 200, message: 'OK', error: null, data });
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

const user = {
  userId: 'owner-1', email: 'owner@goatsports.test', username: 'venue-owner',
  fullName: 'Nguyen Minh Owner', status: 'ACTIVE', gender: 'OTHER', authProviders: [],
  role: { roleId: 'role-owner', name: 'VENUE_OWNER' },
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
};
const venue = {
  venueId: 'venue-1', name: 'Goat Arena Thu Duc', openTime: '06:00:00', closeTime: '23:00:00',
  active: true, imageUrls: [], amenities: [], courts: []
};
const court = {
  venueCourtId: 'court-1', venueId: venue.venueId, sportType: 'BADMINTON',
  name: 'San cau long A', capacity: 4, surfaceType: 'SYNTHETIC', active: true
};
const slot = {
  timeSlotId: 'slot-1', venueCourtId: court.venueCourtId, date: today,
  startTime: '18:00:00', endTime: '19:00:00', pricePerHour: 200000, status: 'AVAILABLE'
};
const booking = {
  bookingId: 'booking-1', playerId: 'player-12345678', venueId: venue.venueId,
  venueCourtId: court.venueCourtId, venueName: venue.name, courtName: court.name,
  playDate: today, startTime: '18:00:00', endTime: '19:00:00', status: 'CONFIRMED',
  source: 'DIRECT', totalPrice: 200000, depositAmount: 60000, remainingAmount: 140000,
  bookingCode: 'GS123456', createdAt: new Date().toISOString(), allowedTransitions: ['CHECKED_IN'],
  payments: [{
    paymentId: 'payment-1', purpose: 'BOOKING_DEPOSIT', amount: 60000, currency: 'VND',
    status: 'SUCCEEDED', paidAt: new Date().toISOString(), createdAt: new Date().toISOString()
  }]
};
const reconciliation = { booking, outstandingAmount: 140000 };
const historyItem = {
  booking: { ...booking, status: 'CHECKED_IN', allowedTransitions: ['COMPLETED'] },
  outstandingAmount: 0,
  checkIn: {
    checkInId: 'checkin-1', paymentId: 'payment-remaining-1', checkedInBy: user.userId,
    method: 'BOOKING_CODE', remainingAmountCollected: 140000, checkedInAt: new Date().toISOString()
  }
};

function responseFor(request) {
  const url = new URL(request.url, `http://localhost:${API_PORT}`);
  if (url.pathname === '/auth-service/api/v1/auth/me') return ok(user);
  if (url.pathname === '/venue-service/api/v1/owner/venues') return ok([venue]);
  if (url.pathname === `/venue-service/api/v1/owner/venues/${venue.venueId}/courts`) return ok([court]);
  if (url.pathname.endsWith(`/venue-courts/${court.venueCourtId}/time-slots`)) return ok([slot]);
  if (url.pathname === '/venue-service/api/v1/owner/check-ins/lookup') return ok(reconciliation);
  if (url.pathname === '/venue-service/api/v1/owner/check-ins' && request.method === 'GET') {
    return ok({ meta: { page: 0, pageSize: 10, pages: 1, total: 1 }, result: [historyItem] });
  }
  return ok([]);
}

const apiServer = createServer((request, response) => {
  receivedRequests.push(`${request.method} ${request.url}`);
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
    if (message.method === 'Runtime.exceptionThrown') {
      browserErrors.push(message.params.exceptionDetails?.text ?? 'Runtime exception');
    }
    if (!message.id || !pending.has(message.id)) return;
    const callback = pending.get(message.id);
    pending.delete(message.id);
    message.error
      ? callback.reject(new Error(`${callback.method}: ${message.error.message}`))
      : callback.resolve(message.result);
  });
  return {
    send(method, params = {}) {
      const messageId = ++id;
      socket.send(JSON.stringify({ id: messageId, method, params }));
      const label = params.expression ? `${method} ${params.expression.slice(0, 100)}` : method;
      return new Promise((resolve, reject) => pending.set(messageId, { resolve, reject, method: label }));
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
  const diagnostics = await evaluate(cdp, `({ location: location.href, text: document.body?.innerText?.slice(0, 1400) })`);
  throw new Error(`Condition timed out: ${expression}\n${JSON.stringify({ diagnostics, receivedRequests }, null, 2)}`);
}

async function verifyViewport(cdp, name, width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width < 600
  });
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${WEB_PORT}/admin/check-in` });
  await waitFor(cdp, "!!document.querySelector('.lookup-form input')");
  await evaluate(cdp, 'window.scrollTo(0, 0)');
  await evaluate(cdp, `(() => {
    const input = document.querySelector('.lookup-form input');
    input.value = 'GS123456';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.lookup-form button[type=submit]').click();
  })()`);
  await waitFor(cdp, "document.querySelector('.booking-summary')?.innerText.includes('GS123456')");
  const checkIn = await evaluate(cdp, `(() => ({
    route: location.pathname,
    title: document.querySelector('.hero h1')?.textContent?.trim(),
    paymentVisible: document.querySelector('.payments')?.innerText.includes('SUCCEEDED'),
    outstandingVisible: document.querySelector('.money-grid')?.innerText.includes('140.000'),
    developingBadgeVisible: [...document.querySelectorAll('*')].some(node => node.textContent?.trim() === 'DEV' && node.getBoundingClientRect().width > 0),
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    minInteractiveHeight: Math.min(...[...document.querySelectorAll('.checkin-page button, .checkin-page select, .checkin-page input:not([type=radio]), .payment-choice label')].map(element => element.getBoundingClientRect().height))
  }))()`);
  await evaluate(cdp, "document.querySelectorAll('.tabs button')[1].click()");
  await waitFor(cdp, "document.querySelectorAll('.walkin-form option').length === 2");
  const walkIn = await evaluate(cdp, `({
    availableSlots: document.querySelectorAll('.walkin-form option').length - 1,
    walkInFormWithinViewport: document.querySelector('.walkin-panel').getBoundingClientRect().width <= innerWidth
  })`);
  await evaluate(cdp, "document.querySelectorAll('.tabs button')[2].click()");
  await waitFor(cdp, "document.querySelectorAll('.history-list article').length === 1");
  const history = await evaluate(cdp, `({
    historyRows: document.querySelectorAll('.history-list article').length,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
  })`);
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const screenshotPath = join(tmpdir(), `goatsports-owner-checkin-${name}.png`);
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  return { viewport: `${width}x${height}`, ...checkIn, ...walkIn, ...history, screenshotPath };
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
  if (browserErrors.length) throw new Error(`Browser exceptions: ${browserErrors.join('; ')}`);
  console.log(JSON.stringify({ passed: true, results, browserErrors }, null, 2));
} finally {
  await new Promise(resolve => apiServer.close(resolve));
  for (const process of [chromeProcess, angularProcess]) {
    if (!process?.pid) continue;
    try { execFileSync('taskkill.exe', ['/pid', String(process.pid), '/t', '/f'], { stdio: 'ignore' }); }
    catch { /* already exited */ }
  }
  rmSync(profileDir, { recursive: true, force: true });
}
