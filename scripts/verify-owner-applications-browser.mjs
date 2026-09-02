import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WEB_PORT = 4310;
const API_PORT = 17080;
const DEBUG_PORT = 9233;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = mkdtempSync(join(tmpdir(), 'goatsports-applications-chrome-'));
const browserErrors = [];

const ok = data => ({ statusCode: 200, message: 'OK', error: null, data });
const user = {
  userId: 'owner-1', email: 'owner@goatsports.test', username: 'venue-owner',
  fullName: 'Nguyễn Minh Đạt', status: 'ACTIVE', gender: 'OTHER', authProviders: [],
  role: { roleId: 'role-owner', name: 'VENUE_OWNER' },
  createdAt: '2026-08-01T08:00:00Z', updatedAt: '2026-08-29T08:00:00Z'
};
const application = (id, businessName, status, createdAt, rejectReason) => ({
  ownerApplicationId: id, userId: 'owner-1', venueId: status === 'APPROVED' ? `venue-${id}` : undefined,
  fullName: 'Đạt Minh', phone: '0867684603', email: 'nguyenthangdat84@gmail.com',
  businessName, businessType: 'INDIVIDUAL', taxCode: '0312345678', identityNumber: '079098123456',
  status, rejectReason, createdAt,
  reviewedAt: status === 'PENDING' ? undefined : createdAt.replace(':31:', ':47:'),
  address: { addressId: `address-${id}`, address: '25 Trần Phú', ward: 'Lộc Thọ', district: 'Nha Trang', city: 'Khánh Hòa' },
  documents: []
});
const applications = [
  application('1', 'GOAT Arena', 'APPROVED', '2026-08-29T16:31:00Z'),
  application('2', 'GOAT Riverside', 'APPROVED', '2026-08-15T10:12:00Z'),
  application('3', 'GOAT Central', 'CANCELLED', '2026-08-07T09:45:00Z'),
  application('4', 'GOAT Garden', 'APPROVED', '2026-08-01T14:20:00Z'),
  application('5', 'GOAT Coast', 'REJECTED', '2026-07-29T15:56:00Z', 'Giấy phép kinh doanh chưa rõ thông tin.'),
  application('6', 'GOAT North', 'APPROVED', '2026-07-10T08:30:00Z')
];

function responseFor(request) {
  const url = new URL(request.url, `http://localhost:${API_PORT}`);
  if (url.pathname === '/auth-service/api/v1/auth/me') return ok(user);
  if (url.pathname === '/venue-service/api/v1/owner-applications/me') {
    return ok({ meta: { page: 0, pageSize: 100, pages: 1, total: applications.length }, result: applications });
  }
  if (url.pathname === '/workflow-service/api/v1/workflows/owner-applications/my/progress/search') {
    return ok({ items: applications.map(item => ({
      ownerApplicationId: item.ownerApplicationId,
      receivedAt: item.createdAt.replace(':31:', ':32:').replace(':12:', ':13:'),
      viewedAt: item.createdAt.replace(':31:', ':33:').replace(':12:', ':14:')
    })) });
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
  const path = join(tmpdir(), `goatsports-owner-applications-${name}.png`);
  writeFileSync(path, Buffer.from(image.data, 'base64'));
  return path;
}
async function openHistory(cdp, width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${WEB_PORT}/admin/applications` });
  await waitFor(cdp, "document.querySelectorAll('.application-list__item').length === 5");
}
async function inspect(cdp, kind) {
  return evaluate(cdp, `(() => ({
    kind: '${kind}',
    route: location.pathname,
    topbar: Boolean(document.querySelector('.admin-topbar')),
    sidebar: Boolean(document.querySelector('.admin-sidebar')),
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    minMainControlHeight: Math.min(...[...document.querySelectorAll('.owner-page button, .owner-page input, .owner-page select')]
      .filter(node => node.getBoundingClientRect().width > 0)
      .map(node => node.getBoundingClientRect().height)),
    listItems: document.querySelectorAll('.application-list__item').length,
    selectedName: document.querySelector('.application-detail h2')?.textContent.trim(),
    steps: document.querySelectorAll('.stepper li').length,
    representativeFields: document.querySelectorAll('.owner-form-panel input').length
  }))()`);
}
async function fillFields(cdp, values) {
  await evaluate(cdp, `(() => {
    const values = ${JSON.stringify(values)};
    for (const [name, value] of Object.entries(values)) {
      const field = document.querySelector('[name="' + name + '"]');
      if (!field) throw new Error('Missing field: ' + name);
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  })()`);
  await delay(100);
  await evaluate(cdp, "document.querySelector('.owner-form-panel__footer .button--primary').click()");
}
async function openDocumentStep(cdp) {
  await fillFields(cdp, { fullName: 'Dat Minh', phone: '0867684603', email: 'owner@goatsports.test', identityNumber: '079098123456' });
  await waitFor(cdp, "Boolean(document.querySelector('[name=businessName]'))");
  await fillFields(cdp, { businessName: 'GOAT Arena', taxCode: '0312345678' });
  await waitFor(cdp, "Boolean(document.querySelector('[name=address]'))");
  await fillFields(cdp, { address: '25 Tran Phu', ward: 'Loc Tho', city: 'Nha Trang' });
  await waitFor(cdp, "Boolean(document.querySelector('.document-grid'))");
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
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  await openHistory(cdp, 1440, 1000);
  const desktopHistory = { ...(await inspect(cdp, 'desktop-history')), screenshot: await capture(cdp, 'desktop-history') };
  await evaluate(cdp, "document.querySelector('.application-search input').focus()");
  const desktopSearchFocus = await evaluate(cdp, `(() => {
    const inputStyle = getComputedStyle(document.querySelector('.application-search input'));
    const workspaceStyle = getComputedStyle(document.querySelector('.application-workspace'));
    return {
      inputOutlineWidth: inputStyle.outlineWidth,
      inputOutlineStyle: inputStyle.outlineStyle,
      inputBoxShadow: inputStyle.boxShadow,
      workspaceTopLeftRadius: workspaceStyle.borderTopLeftRadius,
      workspaceTopRightRadius: workspaceStyle.borderTopRightRadius,
      screenshot: null
    };
  })()`);
  desktopSearchFocus.screenshot = await capture(cdp, 'desktop-search-focus');
  await evaluate(cdp, "document.querySelector('.owner-page__action').click()");
  await waitFor(cdp, "document.querySelectorAll('.stepper li').length === 4");
  const desktopForm = { ...(await inspect(cdp, 'desktop-form')), screenshot: await capture(cdp, 'desktop-form') };
  await openDocumentStep(cdp);
  const desktopDocuments = await evaluate(cdp, `(() => {
    const body = document.querySelector('.owner-form-panel__body');
    const grid = document.querySelector('.document-grid');
    const cards = [...document.querySelectorAll('.document-card')];
    const bodyRect = body.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    return {
      cards: cards.length,
      bodyHeight: Math.round(bodyRect.height),
      gridHeight: Math.round(gridRect.height),
      bottomGap: Math.round(bodyRect.bottom - gridRect.bottom),
      formTopLeftRadius: getComputedStyle(document.querySelector('.owner-form-layout')).borderTopLeftRadius,
      screenshot: null
    };
  })()`);
  desktopDocuments.screenshot = await capture(cdp, 'desktop-documents');

  await openHistory(cdp, 390, 844);
  const mobileHistory = { ...(await inspect(cdp, 'mobile-history')), screenshot: await capture(cdp, 'mobile-history') };
  await evaluate(cdp, "document.querySelector('.owner-page__action').click()");
  await waitFor(cdp, "document.querySelectorAll('.stepper li').length === 4");
  const mobileForm = { ...(await inspect(cdp, 'mobile-form')), screenshot: await capture(cdp, 'mobile-form') };
  const results = { desktopHistory, desktopSearchFocus, desktopForm, desktopDocuments, mobileHistory, mobileForm };
  const checks = [
    desktopHistory.route === '/admin/applications' && desktopHistory.topbar && desktopHistory.sidebar,
    desktopHistory.listItems === 5 && desktopHistory.selectedName === 'GOAT Arena',
    desktopForm.steps === 4 && desktopForm.representativeFields === 4,
    (desktopSearchFocus.inputOutlineWidth === '0px' || desktopSearchFocus.inputOutlineStyle === 'none')
      && desktopSearchFocus.inputBoxShadow === 'none',
    desktopSearchFocus.workspaceTopLeftRadius !== '0px' && desktopSearchFocus.workspaceTopRightRadius !== '0px',
    desktopDocuments.cards === 4 && desktopDocuments.bottomGap <= 20 && desktopDocuments.formTopLeftRadius !== '0px',
    mobileHistory.listItems === 5 && mobileForm.steps === 4,
    [desktopHistory, desktopForm, mobileHistory, mobileForm]
      .every(result => !result.horizontalOverflow && result.minMainControlHeight >= 44)
  ];
  if (checks.some(check => !check)) throw new Error(`Owner applications browser assertion failed: ${JSON.stringify(results, null, 2)}`);
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
  await delay(500);
  try { rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
  catch { /* Chrome can briefly retain its temporary profile on Windows. */ }
}
