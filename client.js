const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const defaultTimeSlots = ['09:00', '09:30', '10:00', '10:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '18:00', '18:30'];

const state = {
  activeTab: 'setup',
  mode: 'host',
  ssoConnected: false,
  calendarConnected: false,
  selectedSlot: null,
  recommendedSlots: [],
  duration: 20,
  bufferBefore: 15,
  bufferAfter: 15,
  inviteChannel: '캘린더 + 메일',
  bookingCount: 0,
  host: {
    name: '김기표',
    title: 'Technical Program Manager',
    company: 'Viva Republica',
    email: 'kipyokim@toss.im',
  },
  identity: {
    provider: 'SSO',
    verifiedEmail: 'kipyokim@toss.im',
    displayName: '김기표',
  },
  rangeStart: '',
  rangeEnd: '',
  slotStatus: {},
  guest: { role: '', interest: '', intent: '' },
  shareId: '',
  sharePromise: null,
};

const bookingStoreKey = 'linkflow.bookings.v1';

const el = {
  ssoStatus: document.getElementById('sso-status'),
  calendarStatus: document.getElementById('calendar-status'),
  shareCount: document.getElementById('share-count'),
  slotCount: document.getElementById('slot-count'),
  durationLabel: document.getElementById('duration-label'),
  modePill: document.getElementById('mode-pill'),
  hostName: document.getElementById('host-name'),
  hostTitle: document.getElementById('host-title'),
  hostCompany: document.getElementById('host-company'),
  hostEmail: document.getElementById('host-email'),
  rangeStart: document.getElementById('range-start'),
  rangeEnd: document.getElementById('range-end'),
  duration: document.getElementById('meeting-duration'),
  bufferBefore: document.getElementById('buffer-before'),
  bufferAfter: document.getElementById('buffer-after'),
  inviteChannel: document.getElementById('invite-channel'),
  slotGrid: document.getElementById('slot-grid'),
  shareLink: document.getElementById('share-link'),
  guestCompany: document.getElementById('guest-company'),
  guestTitle: document.getElementById('guest-title'),
  guestSubtitle: document.getElementById('guest-subtitle'),
  guestOwner: document.getElementById('guest-owner'),
  guestRange: document.getElementById('guest-range'),
  guestSlotList: document.getElementById('guest-slot-list'),
  guestName: document.getElementById('guest-name'),
  guestContact: document.getElementById('guest-contact'),
  guestMessage: document.getElementById('guest-message'),
  guestRole: document.getElementById('guest-role'),
  guestInterest: document.getElementById('guest-interest'),
  guestIntent: document.getElementById('guest-intent'),
  routeResult: document.getElementById('route-result'),
  agendaList: document.getElementById('agenda-list'),
  bookingResult: document.getElementById('booking-result'),
  bookingHistory: document.getElementById('booking-history'),
  slotTemplate: document.getElementById('slot-template'),
};

function getTodayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatFriendly(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${dateStr} (${weekdays[d.getDay()]})`;
}

function toMinutes(time) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function base64UrlEncode(str) {
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return decodeURIComponent(escape(atob(normalized)));
}

function readLocalBookings() {
  try {
    const raw = localStorage.getItem(bookingStoreKey);
    const parsed = raw ? JSON.parse(raw) : { bookings: [] };
    return { bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [] };
  } catch {
    return { bookings: [] };
  }
}

function writeLocalBookings(store) {
  try {
    localStorage.setItem(bookingStoreKey, JSON.stringify(store));
  } catch {
    // Ignore storage errors in private mode or restricted environments.
  }
}

async function fetchBookingStore() {
  try {
    const response = await fetch('/api/bookings');
    if (!response.ok) throw new Error('api unavailable');
    return await response.json();
  } catch {
    return readLocalBookings();
  }
}

async function fetchAuthStatus() {
  try {
    const response = await fetch('/api/auth/status', { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function createBookingRecord(payload) {
  try {
    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('api unavailable');
    return await response.json();
  } catch {
    const store = readLocalBookings();
    const booking = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      status: 'confirmed',
      ...payload,
    };
    store.bookings.unshift(booking);
    writeLocalBookings(store);
    return booking;
  }
}

function profileForRoute(routeName) {
  if (routeName === '멘토링') {
    return {
      label: '멘토링',
      duration: 30,
      subtitle: '조언과 방향 점검이 필요한 만남입니다.',
      agenda: ['상대가 기대하는 도움의 범위', '가장 필요한 조언 1~2개', '후속 자료 또는 추천'],
    };
  }
  if (routeName === '소개 미팅') {
    return {
      label: '소개 미팅',
      duration: 15,
      subtitle: '짧게 인사하고 적합성을 확인합니다.',
      agenda: ['만남 목적', '후속 미팅 필요 여부', '다음 연락 방식'],
    };
  }
  if (routeName === '심화 논의') {
    return {
      label: '심화 논의',
      duration: 45,
      subtitle: '기술과 사업을 깊게 보는 만남입니다.',
      agenda: ['문제 정의와 배경', '현재 접근 방식과 병목', '구체적 협업 또는 검토 포인트'],
    };
  }
  return {
    label: '커피챗',
    duration: 20,
    subtitle: '가볍게 대화할 수 있는 시간만 공개합니다.',
    agenda: ['서로의 배경과 연결 지점', '현재 관심 주제 1개', '다음 액션 또는 후속 연락'],
  };
}

function setRangeDefaults() {
  const start = getTodayPlus(5);
  const end = getTodayPlus(9);
  el.rangeStart.value = formatDate(start);
  el.rangeEnd.value = formatDate(end);
  state.rangeStart = el.rangeStart.value;
  state.rangeEnd = el.rangeEnd.value;
}

function createBusyMatrix() {
  const matrix = {};
  const startDate = new Date(`${state.rangeStart}T00:00:00`);
  const endDate = new Date(`${state.rangeEnd}T00:00:00`);

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const ds = formatDate(d);
    matrix[ds] = {};
    defaultTimeSlots.forEach((slot, index) => {
      matrix[ds][slot] = index % 7 === 0 || index === 4;
    });
  }

  return matrix;
}

function seedSlots() {
  state.slotStatus = createBusyMatrix();
  state.recommendedSlots = [];
}

function buildPayload() {
  return {
    host: state.host,
    rangeStart: state.rangeStart,
    rangeEnd: state.rangeEnd,
    duration: state.duration,
    bufferBefore: state.bufferBefore,
    bufferAfter: state.bufferAfter,
    inviteChannel: state.inviteChannel,
    recommendedSlots: state.recommendedSlots,
  };
}

async function createShareRecord() {
  const response = await fetch('/api/shares', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: buildPayload() }),
  });
  if (!response.ok) {
    throw new Error('share creation failed');
  }
  const data = await response.json();
  state.shareId = data.id;
  return data.id;
}

function applyPayload(payload) {
  if (!payload) return;
  state.host = { ...state.host, ...(payload.host || {}) };
  state.rangeStart = payload.rangeStart || state.rangeStart;
  state.rangeEnd = payload.rangeEnd || state.rangeEnd;
  state.duration = payload.duration || state.duration;
  state.bufferBefore = payload.bufferBefore ?? state.bufferBefore;
  state.bufferAfter = payload.bufferAfter ?? state.bufferAfter;
  state.inviteChannel = payload.inviteChannel || state.inviteChannel;
  if (Array.isArray(payload.recommendedSlots)) {
    state.recommendedSlots = payload.recommendedSlots;
  }
  if (payload.slotStatus) {
    state.slotStatus = payload.slotStatus;
  }
}

async function loadFromShare() {
  const share = new URL(window.location.href).searchParams.get('share');
  if (!share) return;
  state.mode = 'guest';
  try {
    const response = await fetch(`/api/shares?id=${encodeURIComponent(share)}`, { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      applyPayload(data.payload || {});
      state.shareId = share;
      return;
    }
    applyPayload(JSON.parse(base64UrlDecode(share)));
  } catch (error) {
    console.error('Failed to parse share payload', error);
  }
}

function isBlocked(date, time) {
  if (state.slotStatus[date]?.[time]) return true;
  const target = toMinutes(time);
  const before = state.bufferBefore;
  const after = state.bufferAfter;
  const duration = state.duration;
  const busySlots = state.slotStatus[date] || {};

  return Object.entries(busySlots).some(([busyTime, isBusy]) => {
    if (!isBusy) return false;
    const start = toMinutes(busyTime);
    const end = start + duration;
    return target >= start - before && target < end + after;
  });
}

function routeGuest() {
  const combined = `${el.guestRole.value} ${el.guestInterest.value} ${el.guestIntent.value}`.toLowerCase();
  if (/mentor|멘토|advice|조언|coaching|피드백|코칭/.test(combined)) return '멘토링';
  if (/recruit|job|hiring|intro|network|채용|커리어|소개|네트워킹/.test(combined)) return '소개 미팅';
  if (/deep|architecture|technical|system|data|model|심화|아키텍처|기술|시스템|데이터|모델/.test(combined)) return '심화 논의';
  return '커피챗';
}

function collectAvailableSlots() {
  if (state.mode === 'guest' && state.recommendedSlots.length) {
    return state.recommendedSlots.slice(0, 4);
  }

  const start = new Date(`${state.rangeStart}T00:00:00`);
  const end = new Date(`${state.rangeEnd}T00:00:00`);
  const slots = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ds = formatDate(d);
    defaultTimeSlots.forEach((time) => {
      if (!isBlocked(ds, time)) {
        const hour = Number(time.slice(0, 2));
        const score = hour >= 13 && hour <= 16 ? 4 : hour >= 10 && hour <= 12 ? 3 : 1;
        slots.push({ date: ds, time, score });
      }
    });
  }

  slots.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });

  return slots.slice(0, 4);
}

function renderPanels() {
  document.querySelectorAll('[data-panel]').forEach((panel) => {
    if (state.mode === 'guest') {
      panel.classList.toggle('active', panel.dataset.panel === 'guest');
      return;
    }
    panel.classList.toggle('active', panel.dataset.panel === state.activeTab);
  });
  document.querySelectorAll('[data-tab]').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === state.activeTab);
  });
  document.body.dataset.mode = state.mode;
}

function renderStatus() {
  el.calendarStatus.textContent = state.calendarConnected ? '캘린더 연결됨' : '캘린더 미연결';
  el.ssoStatus.textContent = state.ssoConnected ? 'SSO 연결됨' : 'SSO 미연결';
  el.modePill.textContent = state.mode === 'guest' ? '게스트' : '호스트';
  el.durationLabel.textContent = `${state.duration}m`;
  el.hostName.value = state.host.name;
  el.hostTitle.value = state.host.title;
  el.hostCompany.value = state.host.company;
  el.hostEmail.value = state.host.email;
  el.shareCount.textContent = String(state.bookingCount);
}

function renderShareLink() {
  const url = new URL(window.location.href);
  if (!state.shareId) {
    el.shareLink.value = '링크 생성 중...';
    if (!state.sharePromise) {
      state.sharePromise = createShareRecord()
        .then((id) => {
          url.searchParams.set('share', id);
          el.shareLink.value = url.toString();
          return id;
        })
        .catch(() => {
          el.shareLink.value = '링크를 만들 수 없습니다.';
          return '';
        })
        .finally(() => {
          state.sharePromise = null;
        });
    }
    return;
  }
  url.searchParams.set('share', state.shareId);
  el.shareLink.value = url.toString();
}

function renderSlotGrid() {
  el.slotGrid.innerHTML = '';
  const recommended = collectAvailableSlots();
  state.recommendedSlots = recommended;

  recommended.forEach((slot, index) => {
    const node = el.slotTemplate.content.firstElementChild.cloneNode(true);
    node.classList.toggle('selected', Boolean(state.selectedSlot && state.selectedSlot.date === slot.date && state.selectedSlot.time === slot.time));
    node.querySelector('.slot-date').textContent = `${formatFriendly(slot.date)} · 추천 ${index + 1}`;
    node.querySelector('.slot-time').textContent = slot.time;
    node.querySelector('.slot-status').textContent = index === 0 ? '우선 추천' : '추천';
    node.addEventListener('click', () => {
      state.selectedSlot = { date: slot.date, time: slot.time };
      renderAll();
    });
    el.slotGrid.appendChild(node);
  });

  el.slotCount.textContent = String(recommended.length);
}

function renderGuestView() {
  const profile = profileForRoute(routeGuest());
  el.guestCompany.textContent = state.host.company;
  el.guestTitle.textContent = `${state.host.name}님과 ${profile.label}`;
  el.guestSubtitle.textContent = profile.subtitle;
  el.guestOwner.textContent = `${state.host.title}`;
  el.guestRange.textContent = `${state.rangeStart} ~ ${state.rangeEnd}`;
  el.routeResult.textContent = `추천 형태: ${profile.label}`;

  el.agendaList.innerHTML = '';
  profile.agenda.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    el.agendaList.appendChild(li);
  });

  el.guestSlotList.innerHTML = '';
  state.recommendedSlots.slice(0, 4).forEach((slot, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot-card';
    if (state.selectedSlot && state.selectedSlot.date === slot.date && state.selectedSlot.time === slot.time) btn.classList.add('selected');
    const slotDate = document.createElement('span');
    slotDate.className = 'slot-date';
    slotDate.textContent = `${formatFriendly(slot.date)} · 추천 ${index + 1}`;
    const slotTime = document.createElement('strong');
    slotTime.className = 'slot-time';
    slotTime.textContent = slot.time;
    const slotStatus = document.createElement('span');
    slotStatus.className = 'slot-status';
    slotStatus.textContent = index === 0 ? '우선 추천' : '추천';
    btn.append(slotDate, slotTime, slotStatus);
    btn.addEventListener('click', () => {
      state.selectedSlot = { date: slot.date, time: slot.time };
      renderAll();
    });
    el.guestSlotList.appendChild(btn);
  });
}

function renderBookingHistory(bookings = []) {
  state.bookingCount = bookings.length;
  if (!bookings.length) {
    el.bookingHistory.innerHTML = '<div class="booking-item"><strong>예약 기록이 없습니다.</strong><span>첫 예약이 생성되면 여기에 표시됩니다.</span></div>';
    return;
  }

  el.bookingHistory.innerHTML = '';
  bookings.slice(0, 5).forEach((booking) => {
    const item = document.createElement('div');
    item.className = 'booking-item';

    const title = document.createElement('strong');
    title.textContent = `${booking.meetingType || '커피챗'} · ${booking.selectedSlot?.date || '-'} ${booking.selectedSlot?.time || '-'}`;

    const guestLine = document.createElement('span');
    guestLine.textContent = `${booking.guest?.name || '게스트'} / ${booking.guest?.email || '이메일 없음'}`;

    const metaLine = document.createElement('span');
    metaLine.textContent = `${booking.status || '확정'} · ${booking.inviteChannel || '캘린더 + 메일'}`;

    item.append(title, guestLine, metaLine);
    el.bookingHistory.appendChild(item);
  });
}

async function loadBookingHistory() {
  const data = await fetchBookingStore();
  renderBookingHistory(data.bookings || []);
}

async function syncAuthStatus() {
  const status = await fetchAuthStatus();
  if (!status) return;
  state.ssoConnected = Boolean(status.oktaConnected);
  state.calendarConnected = Boolean(status.googleConnected);
  if (status.hostName) {
    state.identity.displayName = status.hostName;
    state.host.name = status.hostName;
  }
  if (status.hostEmail) {
    state.identity.verifiedEmail = status.hostEmail;
    state.host.email = status.hostEmail;
  }
  renderAll();
}

function renderAll() {
  document.body.dataset.mode = state.mode;
  renderPanels();
  renderStatus();
  renderSlotGrid();
  renderShareLink();
  if (state.mode === 'guest') {
    renderGuestView();
  }
}

async function bookSlot() {
  if (!state.selectedSlot) {
    el.bookingResult.textContent = '시간을 먼저 선택하세요.';
    return;
  }

  const route = routeGuest();
  const profile = profileForRoute(route);
  const name = el.guestName.value.trim();
  const email = el.guestContact.value.trim();
  const message = el.guestMessage.value.trim();

  try {
    const booking = await createBookingRecord({
      meetingType: profile.label,
      selectedSlot: state.selectedSlot,
      host: state.host,
      identity: state.identity,
      guest: { name, email, message },
      inviteChannel: state.inviteChannel,
      bufferBefore: state.bufferBefore,
      bufferAfter: state.bufferAfter,
      duration: profile.duration,
    });
    el.bookingResult.textContent = `예약 완료: ${booking.selectedSlot.date} ${booking.selectedSlot.time}`;
    await loadBookingHistory();
    renderStatus();
    setTab('log');
  } catch {
    el.bookingResult.textContent = '예약 저장에 실패했습니다.';
  }
}

function downloadICS() {
  if (!state.selectedSlot) {
    el.bookingResult.textContent = '먼저 시간을 선택해야 ICS 파일을 만들 수 있습니다.';
    return;
  }

  const start = new Date(`${state.selectedSlot.date}T${state.selectedSlot.time}:00+09:00`);
  const end = new Date(start.getTime() + state.duration * 60000);
  const pad = (n) => String(n).padStart(2, '0');
  const toICS = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Coffee Chat Linkflow//EN\nBEGIN:VEVENT\nUID:${crypto.randomUUID()}\nDTSTAMP:${toICS(new Date())}\nDTSTART:${toICS(start)}\nDTEND:${toICS(end)}\nSUMMARY:Coffee chat with ${state.host.name}\nDESCRIPTION:Generated from Coffee Chat Linkflow.\nEND:VEVENT\nEND:VCALENDAR`;
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `coffee-chat-${state.selectedSlot.date}-${state.selectedSlot.time.replace(':', '')}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

async function connectOkta() {
  const status = await fetchAuthStatus();
  if (status) {
    window.location.href = '/api/auth/okta/start';
    return;
  }

  state.ssoConnected = true;
  state.identity = {
    provider: 'SSO',
    verifiedEmail: state.host.email,
    displayName: state.host.name,
  };
  renderAll();
}

async function connectGoogle() {
  const status = await fetchAuthStatus();
  if (status) {
    window.location.href = '/api/auth/google/start';
    return;
  }

  if (!state.ssoConnected) await connectOkta();
  state.calendarConnected = true;
  renderAll();
}

function loadDemo() {
  state.mode = 'host';
  state.ssoConnected = true;
  state.calendarConnected = true;
  state.host.title = 'Technical Program Manager';
  state.host.company = 'Viva Republica';
  state.host.email = 'kipyokim@toss.im';
  state.identity = { provider: 'SSO', verifiedEmail: 'kipyokim@toss.im', displayName: '김기표' };
  seedSlots();
  const dates = Object.keys(state.slotStatus);
  dates.slice(1, 3).forEach((date) => {
    state.slotStatus[date]['09:00'] = false;
    state.slotStatus[date]['13:00'] = false;
    state.slotStatus[date]['15:00'] = false;
  });
  renderAll();
}

async function copyLink() {
  if (!state.shareId && state.sharePromise) {
    await state.sharePromise;
    renderShareLink();
  }
  await navigator.clipboard.writeText(el.shareLink.value);
  el.bookingResult.textContent = '공유 링크를 복사했습니다.';
}

function setTab(tab) {
  state.activeTab = tab;
  renderPanels();
}

function bindEvents() {
  document.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'connect-okta') connectOkta();
      if (action === 'connect-google') connectGoogle();
      if (action === 'load-demo') loadDemo();
      if (action === 'copy-link') copyLink();
      if (action === 'download-ics') downloadICS();
      if (action === 'book-slot') bookSlot();
    });
  });

  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => setTab(btn.dataset.tab));
  });

  [
    el.hostName, el.hostTitle, el.hostCompany, el.hostEmail,
    el.rangeStart, el.rangeEnd, el.duration, el.bufferBefore,
    el.bufferAfter, el.inviteChannel,
  ].forEach((input) => {
    input.addEventListener('input', () => {
      state.host.name = el.hostName.value.trim();
      state.host.title = el.hostTitle.value.trim();
      state.host.company = el.hostCompany.value.trim();
      state.host.email = el.hostEmail.value.trim();
      state.rangeStart = el.rangeStart.value;
      state.rangeEnd = el.rangeEnd.value;
      state.duration = Number(el.duration.value);
      state.bufferBefore = Number(el.bufferBefore.value);
      state.bufferAfter = Number(el.bufferAfter.value);
      state.inviteChannel = el.inviteChannel.value;
      seedSlots();
      renderAll();
    });
  });

  [el.guestRole, el.guestInterest, el.guestIntent].forEach((input) => {
    input.addEventListener('input', renderGuestView);
  });
}

async function hydrate() {
  await loadFromShare();
  state.recommendedSlots = collectAvailableSlots();
  document.body.dataset.mode = state.mode;
  el.rangeStart.value = state.rangeStart;
  el.rangeEnd.value = state.rangeEnd;
  el.duration.value = String(state.duration);
  el.bufferBefore.value = String(state.bufferBefore);
  el.bufferAfter.value = String(state.bufferAfter);
  el.inviteChannel.value = state.inviteChannel;
  el.hostName.value = state.host.name;
  el.hostTitle.value = state.host.title;
  el.hostCompany.value = state.host.company;
  el.hostEmail.value = state.host.email;
}

function main() {
  setRangeDefaults();
  seedSlots();
  bindEvents();
  hydrate().then(() => {
    syncAuthStatus();
    renderAll();
    loadBookingHistory();
    if (state.mode === 'guest') {
      setTab('guest');
    }
  });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

main();
