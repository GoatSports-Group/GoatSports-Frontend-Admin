import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WEB_PORT = 4304;
const API_PORT = 17074;
const DEBUG_PORT = 9227;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = mkdtempSync(join(tmpdir(), 'goatsports-reviews-chrome-'));
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
  venueId: 'venue-1', name: 'Goat Arena Thu Duc', active: true, imageUrls: [], amenities: [],
  courts: [{
    venueCourtId: 'court-1', venueId: 'venue-1', name: 'Court Sapphire',
    sportType: 'BADMINTON', capacity: 4, surfaceType: 'WOOD', active: true
  }]
};
const reviews = [
  {
    reviewId: 'review-1', venueId: 'venue-1', venueName: 'Goat Arena Thu Duc',
    venueCourtId: 'court-1', courtName: 'Court Sapphire', bookingId: 'private-player-booking-1',
    bookingCode: 'GS123456', playDate: '2026-08-20', startTime: '18:00:00', endTime: '19:00:00',
    rating: 5, content: 'Sân sạch, ánh sáng tốt và đúng giờ.', status: 'PUBLISHED',
    createdAt: '2026-08-21T09:30:00'
  },
  {
    reviewId: 'review-2', venueId: 'venue-1', venueName: 'Goat Arena Thu Duc',
    venueCourtId: 'court-1', courtName: 'Court Sapphire', bookingId: 'private-player-booking-2',
    bookingCode: 'GS654321', playDate: '2026-08-22', startTime: '20:00:00', endTime: '21:00:00',
    rating: 4, content: 'Nhân viên hỗ trợ nhanh.', status: 'HIDDEN',
    createdAt: '2026-08-23T10:15:00'
  }
];

function responseFor(request) {
  const url = new URL(request.url, `http://localhost:${API_PORT}`);
  if (url.pathname === '/auth-service/api/v1/auth/me') return ok(user);
  if (url.pathname === '/venue-service/api/v1/owner/venues') return ok([venue]);
  if (url.pathname === '/venue-service/api/v1/owner/reviews') {
    const page = Number(url.searchParams.get('page') ?? 0);
    return ok({ meta: { page, pageSize: 12, pages: 3, total: 25 }, result: reviews });
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
    if (message.method === 'Runtime.exceptionThrown') {
      browserErrors.push(message.params.exceptionDetails?.text ?? 'Runtime exception');
    }
    if (!message.id || !pending.has(message.id)) return;
    const callback = pending.get(message.id); pending.delete(message.id);
    message.error ? callback.reject(new Error(message.error.message)) : callback.resolve(message.result);
  });
  return {
    send(method, params = {}) {
      const messageId = ++id; socket.send(JSON.stringify({ id: messageId, method, params }));
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
  const diagnostic = await evaluate(cdp, `document.body?.innerText?.slice(0, 1800)`);
  throw new Error(`Condition timed out: ${expression}\n${diagnostic}\n${receivedRequests.join('\n')}`);
}

async function verifyViewport(cdp, name, width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${WEB_PORT}/admin/reviews` });
  await waitFor(cdp, "document.querySelectorAll('.review-card').length === 2");
  const initial = await evaluate(cdp, `(() => ({
    route: location.pathname,
    title: document.querySelector('.hero h1')?.textContent?.trim(),
    bookingVisible: document.body.innerText.includes('GS123456'),
    contentVisible: document.body.innerText.includes('Sân sạch'),
    privateIdVisible: document.body.innerText.includes('private-player-booking'),
    developingBadgeVisible: [...document.querySelectorAll('*')].some(node => node.textContent?.trim() === 'DEV' && node.getBoundingClientRect().width > 0),
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    minInteractiveHeight: Math.min(...[...document.querySelectorAll('.reviews-page button, .reviews-page select, .reviews-page input')].map(element => element.getBoundingClientRect().height)),
    cardsFit: [...document.querySelectorAll('.review-card')].every(card => card.getBoundingClientRect().right <= innerWidth)
  }))()`);
  const requestStart = receivedRequests.length;
  await evaluate(cdp, `(() => {
    const selects = document.querySelectorAll('.filter-panel select');
    selects[0].value = 'venue-1'; selects[0].dispatchEvent(new Event('change', { bubbles: true }));
    selects[1].value = 'court-1'; selects[1].dispatchEvent(new Event('change', { bubbles: true }));
    selects[2].value = '5'; selects[2].dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('.filter-panel button').click();
  })()`);
  await waitFor(cdp, `document.querySelectorAll('.review-card').length === 2`);
  const filterRequest = receivedRequests.slice(requestStart).some(request =>
    request.includes('venueId=venue-1') && request.includes('venueCourtId=court-1') && request.includes('rating=5')
  );
  await evaluate(cdp, `document.querySelector('.pagination button:last-child').click()`);
  await waitFor(cdp, `document.querySelector('.pagination span')?.textContent.includes('2 / 3')`);
  const paginationRequest = receivedRequests.some(request => request.includes('/owner/reviews?') && request.includes('page=1'));
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const screenshotPath = join(tmpdir(), `goatsports-owner-reviews-${name}.png`);
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  return { viewport: `${width}x${height}`, ...initial, filterRequest, paginationRequest, screenshotPath };
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
    catch { /* exited */ }
  }
  rmSync(profileDir, { recursive: true, force: true });
}
