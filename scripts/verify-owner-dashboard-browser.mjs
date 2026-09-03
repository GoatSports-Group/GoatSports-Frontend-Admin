import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WEB_PORT = 4305;
const API_PORT = 17075;
const DEBUG_PORT = 9228;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = mkdtempSync(join(tmpdir(), 'goatsports-dashboard-chrome-'));
const browserErrors = [];
const receivedRequests = [];
let activeScenario = 'multi';
const now = new Date();
const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
const nowMinutes = now.getHours() * 60 + now.getMinutes();
const toTime = minutes => {
  const normalizedMinutes = Math.max(0, Math.min(1439, minutes));
  return `${String(Math.floor(normalizedMinutes / 60)).padStart(2, '0')}:${String(normalizedMinutes % 60).padStart(2, '0')}:00`;
};

const ok = data => ({ statusCode: 200, message: 'OK', error: null, data });
const user = {
  userId: 'owner-1', email: 'owner@goatsports.test', username: 'venue-owner',
  fullName: 'Nguyễn Minh Owner', status: 'ACTIVE', gender: 'OTHER', authProviders: [],
  role: { roleId: 'role-owner', name: 'VENUE_OWNER' },
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
};
const application = status => ({
  ownerApplicationId: `application-${status.toLowerCase()}`, userId: 'owner-1',
  venueId: status === 'APPROVED' ? 'venue-1' : undefined,
  fullName: 'Nguyễn Minh Owner', phone: '0909000000', email: 'owner@goatsports.test',
  businessName: 'GOAT Arena', businessType: 'INDIVIDUAL', taxCode: 'TAX-01',
  identityNumber: '012345678901', status, createdAt: '2026-08-28T08:00:00Z',
  address: { addressId: 'address-1', address: '1 Võ Văn Ngân', ward: 'Linh Chiểu', district: 'Thủ Đức', city: 'Hồ Chí Minh' },
  documents: []
});
const primaryVenue = {
  venueId: 'venue-1', name: 'GOAT Arena Thủ Đức', description: 'Cơ sở vận hành chính',
  openTime: '06:00:00', closeTime: '23:00:00', active: true,
  averageRating: 4.8, totalReviews: 12, phone: '0900000000', email: 'arena@goatsports.test',
  address: '1 Võ Văn Ngân', district: 'Thủ Đức', city: 'Hồ Chí Minh', imageUrls: [],
  amenities: ['Bãi đỗ xe', 'Phòng thay đồ'],
  courts: [
    { venueCourtId: 'court-1', venueId: 'venue-1', name: 'Sân Sapphire', sportType: 'BADMINTON', capacity: 4, surfaceType: 'WOOD', active: true },
    { venueCourtId: 'court-2', venueId: 'venue-1', name: 'Sân Emerald', sportType: 'PICKLEBALL', capacity: 4, surfaceType: 'SYNTHETIC', active: false }
  ]
};
const secondaryVenue = {
  venueId: 'venue-2', name: 'GOAT Riverside', description: 'Cơ sở đang hoàn thiện',
  openTime: '07:00:00', closeTime: '22:00:00', active: false,
  averageRating: 3.6, totalReviews: 8, phone: '0911000000', email: 'riverside@goatsports.test',
  address: '20 Nguyễn Huệ', district: 'Quận 1', city: 'Hồ Chí Minh', imageUrls: [], amenities: [],
  courts: [{ venueCourtId: 'court-3', venueId: 'venue-2', name: 'Sân Riverside 1', sportType: 'FOOTBALL', capacity: 14, surfaceType: 'GRASS', active: false }]
};
const currentBooking = {
  bookingId: 'booking-current', venueId: 'venue-1', venueCourtId: 'court-1', venueName: primaryVenue.name,
  courtName: 'Sân Sapphire', playDate: today, startTime: toTime(nowMinutes - 20), endTime: toTime(nowMinutes + 40),
  status: 'PENDING_PAYMENT', source: 'WALK_IN', totalPrice: 100000, depositAmount: 0, remainingAmount: 100000,
  bookingCode: 'GS-CURRENT', walkInCustomerName: 'Khách hiện tại', createdAt: now.toISOString(), payments: [], allowedTransitions: []
};

function responseFor(request) {
  const url = new URL(request.url, `http://localhost:${API_PORT}`);
  if (url.pathname === '/auth-service/api/v1/auth/me') return { status: 200, body: ok(user) };
  if (url.pathname === '/venue-service/api/v1/owner-applications/me') {
    if (activeScenario === 'application-error') return { status: 503, body: { message: 'Application provider unavailable' } };
    const applications = activeScenario === 'pending' ? [application('PENDING')] : [application('APPROVED')];
    return { status: 200, body: ok({ meta: { page: 0, pageSize: 20, pages: 1, total: applications.length }, result: applications }) };
  }
  if (url.pathname === '/venue-service/api/v1/owner/venues') {
    if (activeScenario === 'venue-error') return { status: 503, body: { message: 'Venue provider unavailable' } };
    if (activeScenario === 'empty') return { status: 200, body: ok([]) };
    if (activeScenario === 'inactive') return { status: 200, body: ok([secondaryVenue]) };
    return { status: 200, body: ok([primaryVenue, secondaryVenue]) };
  }
  if (url.pathname === '/venue-service/api/v1/owner/venues/venue-1/courts') {
    return { status: 200, body: ok(primaryVenue.courts.map(court => ({ ...court, availabilityStatus: 'AVAILABLE' }))) };
  }
  if (url.pathname === '/venue-service/api/v1/owner/venues/venue-2/courts') {
    return { status: 200, body: ok(secondaryVenue.courts.map(court => ({ ...court, availabilityStatus: 'INACTIVE' }))) };
  }
  if (url.pathname === '/venue-service/api/v1/owner/bookings') {
    return { status: 200, body: ok({ meta: { page: 0, pageSize: 20, pages: 1, total: 1 }, result: [currentBooking] }) };
  }
  return { status: 200, body: ok([]) };
}

const apiServer = createServer((request, response) => {
  receivedRequests.push(`${activeScenario} ${request.method} ${request.url}`);
  response.setHeader('Access-Control-Allow-Origin', request.headers.origin ?? `http://127.0.0.1:${WEB_PORT}`);
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
  const result = responseFor(request);
  response.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(result.body));
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
  throw new Error(`Condition timed out: ${expression}\n${diagnostic}\n${receivedRequests.slice(-20).join('\n')}`);
}
async function navigateScenario(cdp, scenario, readyExpression) {
  activeScenario = scenario;
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${WEB_PORT}/admin/dashboard?scenario=${scenario}` });
  await waitFor(cdp, readyExpression);
}
async function capture(cdp, name) {
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const screenshotPath = join(tmpdir(), `goatsports-owner-dashboard-${name}.png`);
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  return screenshotPath;
}
async function verifyMultiVenue(cdp, name, width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await navigateScenario(cdp, 'multi', "document.querySelectorAll('.venue-selector option').length === 2");
  await waitFor(cdp, "!!document.querySelector('.live-courts-list article[data-status=\"OCCUPIED\"]')");
  const result = await evaluate(cdp, `(() => ({
    route: location.pathname,
    metricValues: [...document.querySelectorAll('.metric-rail__item strong')].map(node => node.textContent.trim()),
    venueButtons: document.querySelectorAll('.venue-switcher button').length,
    toolLinks: [...document.querySelectorAll('a.feature-card')].map(link => link.getAttribute('href')),
    quickAction: document.querySelector('.owner-hero__action')?.getAttribute('href'),
    liveCourtStatus: document.querySelector('.live-courts-list article')?.getAttribute('data-status'),
    liveCourtLabel: document.querySelector('.live-courts-list article em')?.textContent?.trim(),
    utilizationRate: document.querySelector('.utilization-ring strong')?.textContent?.trim(),
    devVisible: [...document.querySelectorAll('*')].some(node => ['DEV', 'Đang phát triển'].includes(node.textContent?.trim()) && node.getBoundingClientRect().width > 0),
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    minInteractiveHeight: Math.min(...[...document.querySelectorAll('.owner-dashboard a, .owner-dashboard button')].filter(node => node.getBoundingClientRect().width > 0).map(node => node.getBoundingClientRect().height)),
    smallestInteractive: [...document.querySelectorAll('.owner-dashboard a, .owner-dashboard button')]
      .filter(node => node.getBoundingClientRect().width > 0)
      .map(node => ({
        element: node.tagName.toLowerCase(),
        className: node.className,
        text: node.textContent.trim().replace(/\s+/g, ' ').slice(0, 60),
        height: node.getBoundingClientRect().height
      }))
      .sort((left, right) => left.height - right.height)
      .slice(0, 5)
  }))()`);
  await evaluate(cdp, `(() => {
    const select = document.querySelector('.venue-selector select');
    select.value = 'venue-2';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(cdp, "document.querySelector('.venue-selector select')?.value === 'venue-2'");
  return {
    viewport: `${width}x${height}`,
    ...result,
    selectedVenue: await evaluate(cdp, "document.querySelector('.venue-selector option:checked')?.textContent.trim()"),
    screenshotPath: await capture(cdp, name)
  };
}
async function verifyOperationalStates(cdp) {
  await navigateScenario(cdp, 'pending', "document.body.innerText.includes('Chờ duyệt hồ sơ để mở khóa vận hành')");
  const pending = await evaluate(cdp, `({ metrics: document.querySelectorAll('.metric-rail__item').length, lockedTools: document.querySelectorAll('.feature-card--locked').length })`);
  const pendingVenueRequest = receivedRequests.some(request => request.startsWith('pending GET /venue-service/api/v1/owner/venues'));

  await navigateScenario(cdp, 'empty', "document.body.innerText.includes('Chưa có cơ sở được liên kết')");
  const empty = await evaluate(cdp, `({ metricValues: [...document.querySelectorAll('.metric-rail__item strong')].map(node => node.textContent.trim()), lockedTools: document.querySelectorAll('.feature-card--locked').length })`);

  await navigateScenario(cdp, 'inactive', "document.body.innerText.includes('Kích hoạt cơ sở')");
  const inactive = await evaluate(cdp, `({ quickAction: document.querySelector('.owner-hero__action')?.getAttribute('href'), statusVisible: document.querySelector('.venue-status')?.textContent.toLowerCase().includes('chưa kích hoạt'), toolLinks: document.querySelectorAll('a.feature-card').length })`);

  await navigateScenario(cdp, 'venue-error', "document.body.innerText.includes('Venue Service chưa trả về được danh mục cơ sở')");
  const venueError = await evaluate(cdp, `({ metricValues: [...document.querySelectorAll('.metric-rail__item strong')].map(node => node.textContent.trim()), lockedTools: document.querySelectorAll('.feature-card--locked').length, retryVisible: Boolean(document.querySelector('.venue-state--error button')) })`);

  await navigateScenario(cdp, 'application-error', "document.body.innerText.includes('Không thể tải tiến trình lúc này')");
  const applicationError = await evaluate(cdp, `({ metrics: document.querySelectorAll('.metric-rail__item').length, lockedTools: document.querySelectorAll('.feature-card--locked').length, retryVisible: Boolean(document.querySelector('.history-state--error button')) })`);
  return { pending: { ...pending, venueRequest: pendingVenueRequest }, empty, inactive, venueError, applicationError };
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
  if (!page) throw new Error('No browser page target found');
  const cdp = await connectCdp(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  const results = {
    desktop: await verifyMultiVenue(cdp, 'desktop', 1440, 1000),
    mobile: await verifyMultiVenue(cdp, 'mobile', 390, 844)
  };
  const checks = [
    results.desktop.route === '/admin/dashboard',
    results.desktop.liveCourtStatus === 'OCCUPIED' && results.desktop.liveCourtLabel === 'Đang chơi' && results.desktop.utilizationRate === '100%',
    results.desktop.selectedVenue === 'GOAT Riverside',
    !results.desktop.horizontalOverflow,
    results.mobile.liveCourtStatus === 'OCCUPIED' && results.mobile.liveCourtLabel === 'Đang chơi' && results.mobile.utilizationRate === '100%',
    results.mobile.selectedVenue === 'GOAT Riverside',
    !results.mobile.horizontalOverflow
  ];
  if (checks.some(check => !check)) throw new Error(`Dashboard browser assertion failed: ${JSON.stringify(results, null, 2)}`);
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
