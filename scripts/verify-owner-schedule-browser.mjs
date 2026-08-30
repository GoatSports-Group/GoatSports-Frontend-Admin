import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WEB_PORT = 4300;
const API_PORT = 17070;
const DEBUG_PORT = 9223;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = mkdtempSync(join(tmpdir(), 'goatsports-chrome-'));
const receivedRequests = [];

const today = new Date();
const isoDate = offset => {
  const date = new Date(today);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const ok = data => ({ statusCode: 200, message: 'OK', error: null, data });
const user = {
  userId: 'owner-1', email: 'owner@goatsports.test', username: 'venue-owner',
  fullName: 'Nguyen Minh Owner', status: 'ACTIVE', gender: 'OTHER', authProviders: [],
  role: { roleId: 'role-owner', name: 'VENUE_OWNER' },
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
};
const venue = {
  venueId: 'venue-1', name: 'Goat Arena Thu Duc', description: 'Responsive verification venue',
  openTime: '06:00:00', closeTime: '23:00:00', active: true, minPrice: 120000,
  maxPrice: 250000, phone: '0900000000', email: 'arena@goatsports.test',
  address: '1 Vo Van Ngan', city: 'Ho Chi Minh City', imageUrls: [], amenities: [], courts: []
};
const court = {
  venueCourtId: 'court-1', venueId: venue.venueId, sportType: 'BADMINTON',
  name: 'San cau long A', capacity: 4, surfaceType: 'SYNTHETIC', active: true
};
const rules = [{
  pricingRuleId: 'rule-1', courtId: court.venueCourtId, dayOfWeek: 'MONDAY',
  startTime: '06:00:00', endTime: '12:00:00', pricePerHour: 180000,
  basePricePerHour: 150000, effectiveFrom: isoDate(1), effectiveTo: isoDate(30)
}];
const slots = [
  { timeSlotId: 'slot-1', venueCourtId: court.venueCourtId, date: isoDate(1), startTime: '06:00:00', endTime: '07:00:00', pricePerHour: 180000, status: 'AVAILABLE' },
  { timeSlotId: 'slot-2', venueCourtId: court.venueCourtId, date: isoDate(1), startTime: '07:00:00', endTime: '08:00:00', pricePerHour: 180000, status: 'MAINTENANCE' }
];

function responseFor(url) {
  if (url.pathname === '/auth-service/api/v1/auth/me') return ok(user);
  if (url.pathname === '/venue-service/api/v1/owner/venues') return ok([venue]);
  if (url.pathname === `/venue-service/api/v1/owner/venues/${venue.venueId}/courts`) return ok([court]);
  if (url.pathname.endsWith('/pricing-rules')) return ok(rules);
  if (url.pathname.endsWith('/time-slots')) return ok(slots);
  return ok([]);
}

const apiServer = createServer((request, response) => {
  receivedRequests.push(`${request.method} ${request.url}`);
  response.setHeader('Access-Control-Allow-Origin', request.headers.origin ?? `http://127.0.0.1:${WEB_PORT}`);
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }
  response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(responseFor(new URL(request.url, `http://localhost:${API_PORT}`))));
});

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitForUrl(url, timeout = 60000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch { /* service is still starting */ }
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
    if (!message.id) return;
    const callback = pending.get(message.id);
    if (!callback) return;
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

async function waitForExpression(cdp, expression, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true });
    if (result.result.value) return;
    await delay(150);
  }
  const diagnostics = await cdp.send('Runtime.evaluate', {
    expression: `({ location: location.href, title: document.title, text: document.body?.innerText?.slice(0, 1000), html: document.body?.innerHTML?.slice(0, 1000) })`,
    returnByValue: true
  });
  throw new Error(`Browser condition timed out: ${expression}\n${JSON.stringify({ browser: diagnostics.result.value, receivedRequests }, null, 2)}`);
}

async function verifyViewport(cdp, name, width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width < 600
  });
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${WEB_PORT}/admin/schedule` });
  await waitForExpression(cdp, "document.querySelectorAll('.rule-card').length === 1");
  const pricing = await cdp.send('Runtime.evaluate', {
    expression: `(() => ({
      route: location.pathname,
      title: document.querySelector('.page-hero h1')?.textContent?.trim(),
      rules: document.querySelectorAll('.rule-card').length,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      minInteractiveHeight: Math.min(...[...document.querySelectorAll('.schedule-page button, .schedule-page select, .schedule-page input')].map(element => element.getBoundingClientRect().height))
    }))()`,
    returnByValue: true
  });
  await cdp.send('Runtime.evaluate', {
    expression: "document.querySelectorAll('.schedule-tabs button')[1].click()"
  });
  await waitForExpression(cdp, "document.querySelectorAll('.slot-card').length === 2");
  const calendar = await cdp.send('Runtime.evaluate', {
    expression: `(() => ({
      slots: document.querySelectorAll('.slot-card').length,
      maintenanceSlots: document.querySelectorAll('.slot-card--maintenance').length,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    }))()`,
    returnByValue: true
  });
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const screenshotPath = join(tmpdir(), `goatsports-owner-schedule-${name}.png`);
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  return { viewport: `${width}x${height}`, ...pricing.result.value, ...calendar.result.value, screenshotPath };
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
    '--headless=new', '--disable-gpu', '--disable-extensions', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'
  ], { stdio: 'ignore', windowsHide: true });
  await waitForUrl(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
  const pages = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`).then(response => response.json());
  const page = pages.find(candidate => candidate.type === 'page' && candidate.url === 'about:blank');
  if (!page) throw new Error(`No browser page target found: ${JSON.stringify(pages)}`);
  const cdp = await connectCdp(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
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
    try {
      execFileSync('taskkill.exe', ['/pid', String(process.pid), '/t', '/f'], { stdio: 'ignore' });
    } catch { /* process already exited */ }
  }
  rmSync(profileDir, { recursive: true, force: true });
}
