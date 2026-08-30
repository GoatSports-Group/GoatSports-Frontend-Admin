import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WEB_PORT = 4303;
const API_PORT = 17073;
const DEBUG_PORT = 9226;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = mkdtempSync(join(tmpdir(), 'goatsports-revenue-chrome-'));
const browserErrors = [];
const receivedRequests = [];
const ok = data => ({ statusCode: 200, message: 'OK', error: null, data });

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
const revenue = {
  scopeVenueId: null,
  currency: 'VND',
  periodBasis: 'BOOKING_PLAY_DATE',
  currentPeriod: {
    fromDate: '2026-08-01', toDate: '2026-08-30', bookingCount: 3,
    paidBookingCount: 2, totalRevenue: 320000
  },
  previousPeriod: {
    fromDate: '2026-07-02', toDate: '2026-07-31', bookingCount: 2,
    paidBookingCount: 1, totalRevenue: 200000
  },
  revenueChangePercentage: 60,
  bookingCountChangePercentage: 50,
  paymentStatusBreakdown: [
    { status: 'PENDING', paymentCount: 1, nominalAmount: 140000 },
    { status: 'SUCCEEDED', paymentCount: 2, nominalAmount: 320000 }
  ],
  dailyRevenue: [
    { date: '2026-08-01', revenue: 120000, succeededPaymentCount: 1 },
    { date: '2026-08-02', revenue: 200000, succeededPaymentCount: 1 }
  ]
};

function responseFor(request) {
  const url = new URL(request.url, `http://localhost:${API_PORT}`);
  if (url.pathname === '/auth-service/api/v1/auth/me') return ok(user);
  if (url.pathname === '/venue-service/api/v1/owner/venues') return ok([venue]);
  if (url.pathname === '/venue-service/api/v1/owner/revenue') {
    return ok({ ...revenue, scopeVenueId: url.searchParams.get('venueId') });
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
  const diagnostics = await evaluate(cdp, `({ location: location.href, text: document.body?.innerText?.slice(0, 1800) })`);
  throw new Error(`Condition timed out: ${expression}\n${JSON.stringify({ diagnostics, receivedRequests }, null, 2)}`);
}

async function verifyViewport(cdp, name, width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width < 600
  });
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${WEB_PORT}/admin/finance` });
  await waitFor(cdp, "document.querySelectorAll('.metric-card').length === 4");
  await evaluate(cdp, 'window.scrollTo(0, 0)');
  const initial = await evaluate(cdp, `(() => ({
    route: location.pathname,
    title: document.querySelector('.hero h1')?.textContent?.trim(),
    currentRevenueVisible: document.querySelector('.metric-grid')?.innerText.includes('320.000'),
    previousRevenueVisible: document.querySelector('.metric-grid')?.innerText.includes('200.000'),
    succeededVisible: document.querySelector('.status-table')?.innerText.includes('Thành công'),
    chartBars: document.querySelectorAll('.bar-item').length,
    developingBadgeVisible: [...document.querySelectorAll('*')].some(node => node.textContent?.trim() === 'DEV' && node.getBoundingClientRect().width > 0),
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    minInteractiveHeight: Math.min(...[...document.querySelectorAll('.revenue-page button, .revenue-page select, .revenue-page input')].map(element => element.getBoundingClientRect().height)),
    reportGridFits: document.querySelector('.report-grid').getBoundingClientRect().width <= innerWidth
  }))()`);
  const requestsBeforeFilter = receivedRequests.length;
  await evaluate(cdp, `(() => {
    const select = document.querySelector('.filter-panel select');
    select.value = 'venue-1';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('.filter-panel button').click();
  })()`);
  await waitFor(cdp, `document.querySelector('.period-strip')?.innerText.includes('Goat Arena Thu Duc')`);
  const filteredRequest = receivedRequests.slice(requestsBeforeFilter)
    .some(request => request.includes('/owner/revenue?') && request.includes('venueId=venue-1'));
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const screenshotPath = join(tmpdir(), `goatsports-owner-revenue-${name}.png`);
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  return { viewport: `${width}x${height}`, ...initial, filteredRequest, screenshotPath };
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
