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
const requestedPaths = [];
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
    courtName: 'Sân 02', playDate: today, startTime: toTime(minutesNow - 25), endTime: toTime(minutesNow + 35), status: 'PENDING_PAYMENT',
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
const timeSlots = [
  { timeSlotId: 'slot-available', venueCourtId: 'court-02', date: today, startTime: '06:00:00', endTime: '07:00:00', pricePerHour: 100000, status: 'AVAILABLE' },
  { timeSlotId: 'slot-locked', venueCourtId: 'court-02', date: today, startTime: '07:00:00', endTime: '08:00:00', pricePerHour: 100000, status: 'LOCKED' },
  { timeSlotId: 'slot-booked', venueCourtId: 'court-02', date: today, startTime: '08:00:00', endTime: '09:00:00', pricePerHour: 100000, status: 'BOOKED' },
  { timeSlotId: 'slot-maintenance', venueCourtId: 'court-02', date: today, startTime: '09:00:00', endTime: '10:00:00', pricePerHour: 100000, status: 'MAINTENANCE' }
];

function responseFor(request) {
  const url = new URL(request.url, `http://localhost:${API_PORT}`);
  requestedPaths.push(`${request.method} ${url.pathname}${url.search}`);
  if (url.pathname === '/auth-service/api/v1/auth/me') return ok(user);
  if (url.pathname === '/venue-service/api/v1/owner/venues') return ok(venues);
  if (url.pathname.endsWith('/facility-layout')) return ok(null);
  if (url.pathname === '/venue-service/api/v1/owner/venues/venue-1/courts') return ok(courts);
  if (url.pathname === '/venue-service/api/v1/owner/venues/venue-2/courts') return ok([]);
  if (url.pathname === '/venue-service/api/v1/owner/bookings') {
    return ok({ meta: { page: 0, pageSize: 20, pages: 1, total: bookings.length }, result: bookings });
  }
  if (url.pathname.endsWith('/time-slots')) return ok(timeSlots);
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
  const events = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id) {
      if (message.method === 'Runtime.exceptionThrown' || message.method === 'Runtime.consoleAPICalled') {
        events.push(message);
      }
      return;
    }
    if (!pending.has(message.id)) return;
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
    events,
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
  await waitFor(cdp, "!!document.querySelector('.court-detail h2')");
  await waitFor(cdp, "!!document.querySelector('.court-detail .daily-bookings, .court-detail .detail-booking-state--error')");
  const initial = await evaluate(cdp, `(() => ({
    route: location.pathname,
    title: document.querySelector('.page-heading h1')?.textContent?.trim(),
    courts: document.querySelectorAll('.court-object').length,
    facilities: document.querySelectorAll('.facility-object').length,
    zones: document.querySelectorAll('.facility-zone').length,
    tabs: document.querySelectorAll('.workspace-tabs button').length,
    floatingMapControls: document.querySelectorAll('.map-controls').length,
    initialDetailTitle: document.querySelector('.court-detail h2')?.textContent?.trim(),
    detailCloseButtonCount: document.querySelectorAll('.court-detail > header > button').length,
    detailUpdateButtonCount: document.querySelectorAll('.court-detail__identity > button').length,
    emptyCurrentBookingText: document.querySelector('.booking-now--empty')?.textContent?.trim(),
    emptyCurrentBookingIconCount: document.querySelectorAll('.booking-now--empty lucide-icon').length,
    dateFilterInline: Math.abs(document.querySelector('.booking-date-filter--toolbar').getBoundingClientRect().top - document.querySelector('.venue-select__trigger').getBoundingClientRect().top) < 2,
    dateNativeInputOpacity: getComputedStyle(document.querySelector('.booking-date-filter--toolbar input')).opacity,
    dateVisibleValue: document.querySelector('.booking-date-filter__value')?.textContent?.trim(),
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    workspaceWidth: Math.round(document.querySelector('.workspace-shell').getBoundingClientRect().width)
  }))()`);
  let firstCourtTooltip = null;
  if (width >= 768) {
    const hoverPoint = await evaluate(cdp, `(() => {
      const rect = document.querySelector('.court-object').getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hoverPoint.x, y: hoverPoint.y });
    await waitFor(cdp, "getComputedStyle(document.querySelector('.court-object .court-tooltip')).opacity === '1'");
    firstCourtTooltip = await evaluate(cdp, `(() => {
      const courtElement = document.querySelector('.court-object');
      const borderElement = document.querySelector('.facility-zone-border');
      const court = courtElement.getBoundingClientRect();
      const tooltip = courtElement.querySelector('.court-tooltip').getBoundingClientRect();
      const canvas = document.querySelector('.facility-canvas').getBoundingClientRect();
      const courtZIndex = Number(getComputedStyle(courtElement).zIndex);
      const zoneBorderZIndex = Number(getComputedStyle(borderElement).zIndex);
      return {
        opensBelow: tooltip.top >= court.bottom,
        withinCanvas: tooltip.top >= canvas.top && tooltip.bottom <= canvas.bottom,
        courtZIndex,
        zoneBorderZIndex,
        unobscured: courtZIndex > zoneBorderZIndex
      };
    })()`);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 });
  }
  await evaluate(cdp, "document.querySelector('.venue-select__trigger').click()");
  await waitFor(cdp, "!!document.querySelector('.venue-select__menu')");
  const venueDropdown = await evaluate(cdp, `(() => ({
    customTriggerVisible: !!document.querySelector('.venue-select__trigger'),
    nativeSelectCount: document.querySelectorAll('.venue-select select').length,
    optionCount: document.querySelectorAll('.venue-select__menu [role="option"]').length,
    selectedOptionVisible: !!document.querySelector('.venue-select__menu .is-selected'),
    optionContentLayout: getComputedStyle(document.querySelector('.venue-select__menu [role="option"] > span')).display
  }))()`);
  await evaluate(cdp, "document.querySelector('.venue-select__trigger').click()");
  await evaluate(cdp, "document.querySelector('.court-search input').focus()");
  const searchFocus = await evaluate(cdp, `(() => {
    const input = document.querySelector('.court-search input');
    const wrapper = document.querySelector('.court-search');
    return {
      inputOutlineWidth: getComputedStyle(input).outlineWidth,
      inputBoxShadow: getComputedStyle(input).boxShadow,
      wrapperBoxShadow: getComputedStyle(wrapper).boxShadow
    };
  })()`);
  await evaluate(cdp, "document.querySelector('.sport-select .select-control').click()");
  await waitFor(cdp, "!!document.querySelector('.sport-select__menu')");
  const sportDropdown = await evaluate(cdp, `(() => ({
    nativeToolbarSelectCount: document.querySelectorAll('.operations-toolbar select').length,
    optionCount: document.querySelectorAll('.sport-select__menu [role="option"]').length,
    widthMatchesTrigger: Math.abs(document.querySelector('.sport-select__menu').getBoundingClientRect().width - document.querySelector('.sport-select .select-control').getBoundingClientRect().width) < 1
  }))()`);
  await evaluate(cdp, "document.querySelector('.sport-select .select-control').click(); document.querySelector('.court-filter > button').click()");
  await waitFor(cdp, "!!document.querySelector('.court-filter__menu:not(.sport-select__menu)')");
  const statusDropdown = await evaluate(cdp, `(() => ({
    optionCount: document.querySelectorAll('.court-filter__menu:not(.sport-select__menu) [role="button"], .court-filter__menu:not(.sport-select__menu) > button').length,
    widthMatchesTrigger: Math.abs(document.querySelector('.court-filter__menu:not(.sport-select__menu)').getBoundingClientRect().width - document.querySelector('.court-filter > button').getBoundingClientRect().width) < 1
  }))()`);
  await evaluate(cdp, "document.querySelector('.court-filter > button').click()");
  await evaluate(cdp, "document.querySelectorAll('.court-object')[1].click()");
  await waitFor(cdp, "!!document.querySelector('.court-detail')");
  await waitFor(cdp, "!!document.querySelector('.court-detail .daily-bookings, .court-detail .detail-booking-state--error')");
  const detail = await evaluate(cdp, `(() => ({
    detailOpen: !!document.querySelector('.court-detail'),
    detailTitle: document.querySelector('.court-detail h2')?.textContent?.trim(),
    operationalStatusVisible: document.querySelector('.court-detail')?.innerText.includes('Đang sử dụng'),
    detailStatusAtTopRight: (() => {
      const header = document.querySelector('.court-detail > header').getBoundingClientRect();
      const status = document.querySelector('.court-detail > header > .table-status').getBoundingClientRect();
      return status.left > header.left + header.width / 2 && status.top < header.top + header.height / 2;
    })(),
    detailHeaderHeight: Math.round(document.querySelector('.court-detail > header').getBoundingClientRect().height),
    detailPriceRowHeight: Math.round(document.querySelector('.court-detail__identity').getBoundingClientRect().height),
    detailCloseButtonCount: document.querySelectorAll('.court-detail > header > button').length,
    detailQuickActionCount: document.querySelectorAll('.court-detail .quick-actions a, .court-detail .quick-actions button').length,
    detailHasCourtThumbnail: !!document.querySelector('.court-detail .detail-court-visual'),
    detailTimelineDotCount: document.querySelectorAll('.court-detail .daily-bookings article > i').length,
    detailTimelineLabelCount: document.querySelectorAll('.court-detail .daily-bookings article > b').length,
    detailDailyBookingTitle: document.querySelector('.court-detail .daily-bookings h3')?.textContent?.trim(),
    detailHasLegacyScheduleBlocks: !!document.querySelector('.court-detail .next-booking, .court-detail .today-schedule'),
    panelWithinViewport: document.querySelector('.court-detail').getBoundingClientRect().right <= innerWidth,
    panelOverflow: getComputedStyle(document.querySelector('.court-detail')).overflowY,
    stickyHeader: getComputedStyle(document.querySelector('.court-detail > header')).position,
    detailFooterCount: document.querySelectorAll('.court-detail__footer').length,
    bodyHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
  }))()`);
  await evaluate(cdp, `(() => {
    const button = [...document.querySelectorAll('.quick-actions button')]
      .find(item => item.textContent.trim() === 'Bảo trì');
    button?.click();
  })()`);
  await waitFor(cdp, "!!document.querySelector('.maintenance-dialog')");
  await delay(1200);
  const maintenanceSlotCount = await evaluate(cdp, "document.querySelectorAll('.maintenance-slot').length");
  if (maintenanceSlotCount !== 4) {
    const maintenanceDebug = await evaluate(cdp, `(() => ({
      text: document.querySelector('.maintenance-dialog')?.innerText,
      error: document.querySelector('.maintenance-error')?.innerText,
      empty: document.querySelector('.maintenance-empty')?.innerText,
      loading: !!document.querySelector('.maintenance-loading')
    }))()`);
    const runtimeEvents = cdp.events.map(event => {
      const details = event.params?.exceptionDetails;
      if (details) {
        return details.exception?.description ?? details.text;
      }
      return (event.params?.args ?? [])
        .map(argument => argument.value ?? argument.description ?? argument.type)
        .join(' ');
    });
    throw new Error(`Unexpected maintenance slots: ${JSON.stringify({ maintenanceDebug, requestedPaths, runtimeEvents })}`);
  }
  await waitFor(cdp, "document.querySelectorAll('.maintenance-slot').length === 4");
  const maintenanceStart = await evaluate(cdp, `(() => {
    const slots = [...document.querySelectorAll('.maintenance-slot')];
    return {
      visible: !!document.querySelector('.maintenance-dialog'),
      slotCount: slots.length,
      unavailableSlotCount: slots.filter(item => item.disabled).length,
      lockedDisabled: slots.find(item => item.textContent.includes('Đang giữ chỗ'))?.disabled,
      bookedDisabled: slots.find(item => item.textContent.includes('Đã đặt'))?.disabled
    };
  })()`);
  await evaluate(cdp, `[...document.querySelectorAll('.maintenance-slot')]
    .find(item => item.textContent.includes('Khả dụng'))?.click()`);
  await waitFor(cdp, "document.querySelectorAll('.maintenance-slot.is-selected').length === 1");
  await evaluate(cdp, `[...document.querySelectorAll('.maintenance-modes button')]
    .find(item => item.textContent.includes('Kết thúc'))?.click()`);
  await waitFor(cdp, "[...document.querySelectorAll('.maintenance-slot')].filter(item => !item.disabled).length === 1");
  const maintenanceDialog = {
    ...maintenanceStart,
    ...(await evaluate(cdp, `(() => ({
      startModeSelectedCount: 1,
      endModeSelectableCount: [...document.querySelectorAll('.maintenance-slot')].filter(item => !item.disabled).length,
      endModeTargetsMaintenance: [...document.querySelectorAll('.maintenance-slot')]
        .filter(item => !item.disabled).every(item => item.textContent.includes('Đang bảo trì'))
    }))()`))
  };
  await evaluate(cdp, "document.querySelector('.maintenance-dialog > header > button').click()");
  await waitFor(cdp, "!document.querySelector('.maintenance-dialog')");
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const screenshotPath = join(tmpdir(), `goatsports-owner-courts-map-${name}.png`);
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  let editMode = null;
  if (width >= 768) {
    await evaluate(cdp, "document.querySelector('.edit-layout-button').click()");
    await waitFor(cdp, "!!document.querySelector('.facility-workspace.is-editing')");
    editMode = await evaluate(cdp, `(() => ({
      layoutMode: !!document.querySelector('.facility-workspace.is-editing'),
      libraryItems: document.querySelectorAll('.object-library > button').length,
      inspectorVisible: !!document.querySelector('.layout-inspector'),
      zoneBorderCount: document.querySelectorAll('.facility-zone-border').length,
      parkingSlotCount: document.querySelectorAll('.parking-slots i').length,
      parkingLucideCarCount: document.querySelectorAll('.parking-slots lucide-icon svg').length,
      facilityDecorationCount: document.querySelectorAll('.facility-furniture').length,
      libraryButtonFontSize: getComputedStyle(document.querySelector('.object-library > button')).fontSize,
      toolbarButtonFontSize: getComputedStyle(document.querySelector('.layout-mode-toolbar__actions button')).fontSize,
      saveDisabledInitially: document.querySelector('.save-layout-button')?.disabled,
      editHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    }))()`);
    await evaluate(cdp, `(() => {
      const button = [...document.querySelectorAll('.layout-mode-toolbar__actions button')]
        .find(item => item.textContent.includes('Thêm khu'));
      button?.click();
    })()`);
    await waitFor(cdp, "document.querySelectorAll('.facility-zone').length === 3");
    Object.assign(editMode, await evaluate(cdp, `(() => ({
      addedZoneSelected: !!document.querySelector('.facility-zone-border.is-selected'),
      zoneResizeHandleVisible: !!document.querySelector('.facility-zone-border.is-selected .zone-resize-handle'),
      zoneResizeHandleCount: document.querySelectorAll('.facility-zone-border.is-selected .zone-resize-handle').length,
      horizontalZoneResizeHandleVisible: !!document.querySelector('.facility-zone-border.is-selected .zone-resize-handle--width'),
      verticalZoneResizeHandleVisible: !!document.querySelector('.facility-zone-border.is-selected .zone-resize-handle--height'),
      expandedCanvas: document.querySelector('.facility-canvas').scrollWidth > document.querySelector('.facility-stage').clientWidth,
      zoneInspectorVisible: document.querySelector('.layout-inspector')?.innerText.includes('Khu vực cơ sở'),
      zoneCountAfterAdd: document.querySelectorAll('.facility-zone').length
    }))()`));
    const resizeBefore = await evaluate(cdp, "document.querySelector('.facility-zone-border.is-selected').getBoundingClientRect().width");
    await evaluate(cdp, `(() => {
      const handle = document.querySelector('.facility-zone-border.is-selected .zone-resize-handle--width');
      const rect = handle.getBoundingClientRect();
      const options = { bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
      handle.dispatchEvent(new PointerEvent('pointerdown', options));
      document.dispatchEvent(new PointerEvent('pointermove', { ...options, clientX: options.clientX + 80 }));
      document.dispatchEvent(new PointerEvent('pointerup', { ...options, clientX: options.clientX + 80 }));
    })()`);
    await delay(100);
    Object.assign(editMode, await evaluate(cdp, `(() => ({
      horizontalResizeWorked: document.querySelector('.facility-zone-border.is-selected').getBoundingClientRect().width > ${resizeBefore},
      interactionStateCleared: !document.querySelector('.facility-workspace').classList.contains('is-interacting')
    }))()`));
    await evaluate(cdp, `(() => {
      const button = [...document.querySelectorAll('.object-library > button')]
        .find(item => item.textContent.includes('Tiện ích'));
      button?.click();
    })()`);
    await waitFor(cdp, "!!document.querySelector('.custom-object-dialog')");
    Object.assign(editMode, await evaluate(cdp, `(() => ({
      customObjectDialogVisible: !!document.querySelector('.custom-object-dialog'),
      customObjectIconChoices: document.querySelectorAll('.custom-icon-picker button').length,
      customObjectNamePlaceholder: document.querySelector('.custom-object-dialog input[formcontrolname="name"]')?.placeholder
    }))()`));
    await evaluate(cdp, `document.querySelector('.custom-object-dialog > header > button')?.click()`);
    const editScreenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const editScreenshotPath = join(tmpdir(), `goatsports-owner-courts-edit-${name}.png`);
    writeFileSync(editScreenshotPath, Buffer.from(editScreenshot.data, 'base64'));
    editMode.editScreenshotPath = editScreenshotPath;
  }
  return { viewport: `${width}x${height}`, ...initial, firstCourtTooltip, venueDropdown, searchFocus, sportDropdown, statusDropdown, ...detail, maintenanceDialog, screenshotPath, editMode };
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
    await verifyViewport(cdp, 'widescreen', 1920, 900),
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
  try { rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
  catch { /* Windows may release the temporary Chrome profile shortly after process exit. */ }
}
