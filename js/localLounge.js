// Version: 2.1.0 | Last Modified: 2026-11-28 11:36 HKT | Build: 20261128_1136
// Module: js/localLounge.js — Real Client-Server WebSocket/REST Lounge Client, 1-Click Worker Diagnostics (POD2B-301), Hardened Friend Code PII & FNV-1a Signature Verification (POD2B-401/504), & Live Landmark Activity Pulse / First-to-Snap Daily Crown (POD2B-403) (Priya Nair 18)
(function (global) {
  'use strict';

  const BLOCKED_PATTERNS = [
    /\b(?:kill|suicide|self[\s-]?harm|doxx|stalk|swat)\b/i,
    /(?:\+?852[-\s]?)?\b[2-9]\d{3}[-\s]?\d{4}\b/,
    /\b(?:\d{3}[-\s.]?\d{3}[-\s.]?\d{4})\b/,
  ];

  const ICEBREAKER_CHIPS = Object.freeze([
    '👋 Just snapped my SpotCard here!',
    '📸 The view right now is awesome!',
    '☕ Anyone nearby up for a quick PingPod mission?',
  ]);

  function containsBlockedSafetyContent(rawStr) {
    const s = String(rawStr || '');
    for (let i = 0; i < BLOCKED_PATTERNS.length; i++) {
      if (BLOCKED_PATTERNS[i].test(s)) return true;
    }
    return false;
  }

  function hashDeterministicHex(inputStr) {
    let h = 2166136261;
    const s = String(inputStr || '');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return (h >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 6);
  }

  function getTodayDateKeyHkt(nowMs = Date.now()) {
    const d = new Date(nowMs + 8 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  }

  class EphemeralLoungeManager {
    constructor({ ttlMs = 4 * 3600 * 1000, maxMsgsPerMinute = 12 } = {}) {
      this.ttlMs = ttlMs;
      this.maxMsgsPerMinute = maxMsgsPerMinute;
      this.blockedUsers = new Set();
      this.mutedNicknames = new Set();
      this.waveRateLog = new Map();
      this.reportedMessageIds = new Set();
      this.friendRequests = new Map();
      this.savedCrew = [];
      this.pingPodsByLandmark = new Map();
      this.dailyCheckInsByLandmark = new Map();
      this.rateLog = new Map();
      this.messagesByLandmark = new Map();
      this.apiEndpointUrl = '';
      this.ws = null;
      this.connectionState = 'LOCAL_ONLY_NO_SERVER';
      this.livePeerCount = 0;
      this.lastDiagnostics = {
        status: 'UNCONFIGURED_LOCAL_MODE',
        latencyMs: 0,
        endpoint: '',
        checkedAt: null,
        zeroSyntheticPeers: true,
      };
    }

    configureBackend(apiUrl, zoneId = 'ZONE_300M', onUpdate = null) {
      const cleanUrl = String(apiUrl || '').trim();
      this.apiEndpointUrl = cleanUrl;
      if (this.ws) {
        try { this.ws.close(); } catch (_e) {}
        this.ws = null;
      }
      if (!cleanUrl) {
        this.connectionState = 'LOCAL_ONLY_NO_SERVER';
        this.livePeerCount = 0;
        return { ok: true, connectionState: this.connectionState, livePeerCount: 0 };
      }
      if (typeof WebSocket !== 'function' || !/^wss?:\/\//i.test(cleanUrl)) {
        this.connectionState = 'REST_ENDPOINT_CONFIGURED';
        return { ok: true, connectionState: this.connectionState, livePeerCount: this.livePeerCount };
      }
      try {
        this.connectionState = 'CONNECTING';
        const wsUrl = `${cleanUrl.replace(/\/$/, '')}/ws?zoneId=${encodeURIComponent(zoneId)}`;
        const socket = new WebSocket(wsUrl);
        this.ws = socket;
        socket.onopen = () => {
          this.connectionState = 'CONNECTED_LIVE_SERVER';
          if (typeof onUpdate === 'function') onUpdate();
        };
        socket.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            if (typeof data.peerCount === 'number') {
              this.livePeerCount = Math.max(0, data.peerCount);
            }
            if (data.type === 'chat_message' && data.message) {
              const lmId = data.message.landmarkId || 'LM_HK_HARBOUR';
              const list = this.getMessages(lmId);
              if (!list.some((m) => m.id === data.message.id)) {
                list.push(data.message);
                this.messagesByLandmark.set(lmId, list);
              }
            }
            if (typeof onUpdate === 'function') onUpdate();
          } catch (_e) {}
        };
        socket.onerror = () => {
          this.connectionState = 'SERVER_UNREACHABLE_FAIL_OPEN';
          this.livePeerCount = 0;
          if (typeof onUpdate === 'function') onUpdate();
        };
        socket.onclose = () => {
          if (this.connectionState === 'CONNECTED_LIVE_SERVER') {
            this.connectionState = 'DISCONNECTED';
          }
          this.livePeerCount = 0;
          if (typeof onUpdate === 'function') onUpdate();
        };
        return { ok: true, connectionState: this.connectionState };
      } catch (_err) {
        this.connectionState = 'SERVER_UNREACHABLE_FAIL_OPEN';
        this.livePeerCount = 0;
        return { ok: false, connectionState: this.connectionState };
      }
    }

    runLiveDiagnostics(apiUrl = this.apiEndpointUrl, zoneId = 'ZONE_300M_DEFAULT', onResult = null) {
      const cleanUrl = String(apiUrl || '').trim();
      const startMs = Date.now();
      if (!cleanUrl) {
        this.lastDiagnostics = {
          ok: true,
          status: 'HONEST_OFFLINE_LOCAL_MODE',
          latencyMs: 0,
          endpoint: 'None (Local Mode)',
          zoneId,
          zeroSyntheticPeers: true,
          summary: '⚪ Offline / Local Mode verified (0 synthetic bots, $0.00/mo burn). Paste a wss:// Cloudflare Worker URL to connect cross-device rooms.',
          checkedAt: new Date(startMs).toISOString(),
        };
        if (typeof onResult === 'function') onResult(this.lastDiagnostics);
        return this.lastDiagnostics;
      }
      if (!/^(?:wss?|https?):\/\//i.test(cleanUrl)) {
        this.lastDiagnostics = {
          ok: false,
          status: 'INVALID_ENDPOINT_SCHEME',
          latencyMs: 0,
          endpoint: cleanUrl,
          zoneId,
          zeroSyntheticPeers: true,
          summary: '⚠️ Endpoint must start with wss:// or https:// (e.g., wss://spotquest-rooms.your-subdomain.workers.dev).',
          checkedAt: new Date(startMs).toISOString(),
        };
        if (typeof onResult === 'function') onResult(this.lastDiagnostics);
        return this.lastDiagnostics;
      }

      const httpUrl = cleanUrl
        .replace(/^wss:\/\//i, 'https://')
        .replace(/^ws:\/\//i, 'http://')
        .replace(/\/$/, '') + `/health?zoneId=${encodeURIComponent(zoneId)}`;

      if (typeof fetch === 'function') {
        fetch(httpUrl, { method: 'GET' })
          .then((res) => res.json())
          .then((data) => {
            const elapsed = Math.max(1, Date.now() - startMs);
            this.lastDiagnostics = {
              ok: Boolean(data && data.ok),
              status: 'LIVE_WORKER_HEALTHY',
              latencyMs: elapsed,
              endpoint: cleanUrl,
              zoneId,
              zeroSyntheticPeers: true,
              summary: `🟢 Cloudflare Worker Healthy (${elapsed} ms RTT) • Zone ${zoneId} • 0 synthetic bots.`,
              checkedAt: new Date().toISOString(),
            };
            if (typeof onResult === 'function') onResult(this.lastDiagnostics);
          })
          .catch(() => {
            const elapsed = Math.max(1, Date.now() - startMs);
            this.lastDiagnostics = {
              ok: false,
              status: 'WORKER_UNREACHABLE_FAIL_OPEN',
              latencyMs: elapsed,
              endpoint: cleanUrl,
              zoneId,
              zeroSyntheticPeers: true,
              summary: `⚪ Worker unreachable (${elapsed} ms) — failed open to honest Local Mode (0 synthetic bots).`,
              checkedAt: new Date().toISOString(),
            };
            if (typeof onResult === 'function') onResult(this.lastDiagnostics);
          });
      }

      this.lastDiagnostics = {
        ok: true,
        status: 'DIAGNOSTIC_PING_DISPATCHED',
        latencyMs: Math.max(1, Date.now() - startMs),
        endpoint: cleanUrl,
        zoneId,
        zeroSyntheticPeers: true,
        summary: `🔍 Testing Cloudflare Worker endpoint ${cleanUrl} for zone ${zoneId}...`,
        checkedAt: new Date(startMs).toISOString(),
      };
      return this.lastDiagnostics;
    }

    getLastDiagnostics() {
      return this.lastDiagnostics;
    }

    generateFriendCode({ nickname = 'Explorer', zoneId = 'ZONE_300M', badge = 'Harbour Sunset Crew' } = {}) {
      const rawNickname = String(nickname || '').trim();
      const rawZone = String(zoneId || '').trim();
      if (containsBlockedSafetyContent(rawNickname) || containsBlockedSafetyContent(rawZone)) {
        return {
          ok: false,
          reason: 'SAFETY_POLICY_VIOLATION',
          zeroPii: true,
        };
      }
      const cleanNick = rawNickname.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) || 'Explorer';
      if (containsBlockedSafetyContent(cleanNick)) {
        return {
          ok: false,
          reason: 'SAFETY_POLICY_VIOLATION',
          zeroPii: true,
        };
      }
      const cleanZone = rawZone.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 24) || 'ZONE_300M';
      const zoneTag = cleanZone.slice(-9).toUpperCase();
      const cleanBadge = String(badge || 'Scout').replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 22) || 'Scout';
      const sig = hashDeterministicHex(`${cleanNick.toUpperCase()}:${zoneTag}`);
      const code = `SQ-${cleanNick.toUpperCase()}-${zoneTag}-${sig}`;
      return {
        ok: true,
        code,
        nickname: cleanNick,
        zoneId: cleanZone,
        zoneTag,
        signature: sig,
        badge: cleanBadge,
        zeroPii: true,
      };
    }

    redeemFriendCode(rawCode, currentNickname = 'Explorer') {
      const clean = String(rawCode || '').trim();
      if (!clean) {
        return { ok: false, reason: 'EMPTY_FRIEND_CODE' };
      }
      if (containsBlockedSafetyContent(clean)) {
        return { ok: false, reason: 'SAFETY_POLICY_VIOLATION' };
      }
      const match = /^SQ-([A-Z0-9_-]{2,16})-([A-Z0-9_]{3,24})-([A-F0-9]{6})$/i.exec(clean);
      if (!match) {
        return { ok: false, reason: 'INVALID_FRIEND_CODE_FORMAT' };
      }
      const peerNickname = match[1];
      const zoneTag = match[2].toUpperCase();
      const providedSig = match[3].toUpperCase();

      if (containsBlockedSafetyContent(peerNickname)) {
        return { ok: false, reason: 'SAFETY_POLICY_VIOLATION' };
      }

      const expectedSig = hashDeterministicHex(`${peerNickname.toUpperCase()}:${zoneTag}`);
      if (providedSig !== expectedSig) {
        return {
          ok: false,
          reason: 'INVALID_FRIEND_CODE_SIGNATURE',
          expectedSignature: expectedSig,
        };
      }

      if (peerNickname.toUpperCase() === String(currentNickname || '').trim().toUpperCase()) {
        return { ok: false, reason: 'CANNOT_ADD_SELF_CODE' };
      }
      const crewEntry = {
        code: clean.toUpperCase(),
        nickname: peerNickname,
        zoneTag,
        signature: providedSig,
        connectedAt: new Date().toISOString(),
        mutualOptIn: true,
        zeroPii: true,
      };
      this.savedCrew = [
        crewEntry,
        ...this.savedCrew.filter((c) => c.code !== crewEntry.code),
      ].slice(0, 24);
      return { ok: true, crewMember: crewEntry, savedCrew: this.savedCrew };
    }

    getSavedCrew() {
      return [...this.savedCrew];
    }

    recordDailyLandmarkSnap({ landmarkId, zoneId = 'ZONE_300M', nickname = 'Explorer', nowMs = Date.now() } = {}) {
      const lmKey = String(landmarkId || 'LM_MINI_POCKET_PARK');
      const dayKey = `${lmKey}:${getTodayDateKeyHkt(nowMs)}`;
      const existing = this.dailyCheckInsByLandmark.get(dayKey) || {
        landmarkId: lmKey,
        zoneId,
        dateKey: getTodayDateKeyHkt(nowMs),
        checkInCount: 0,
        firstSnapExplorer: null,
        explorers: [],
      };
      const isFirstToSnapToday = existing.checkInCount === 0;
      existing.checkInCount += 1;
      if (isFirstToSnapToday) {
        existing.firstSnapExplorer = String(nickname || 'Explorer').slice(0, 24);
      }
      if (!existing.explorers.includes(nickname)) {
        existing.explorers.push(String(nickname || 'Explorer').slice(0, 24));
      }
      this.dailyCheckInsByLandmark.set(dayKey, existing);
      return {
        ok: true,
        landmarkId: lmKey,
        dateKey: existing.dateKey,
        dailyCheckInCount: existing.checkInCount,
        isFirstToSnapToday,
        firstSnapExplorer: existing.firstSnapExplorer,
        zeroSyntheticActivity: true,
      };
    }

    getLandmarkActivityPulse(landmarkId, nowMs = Date.now()) {
      const lmKey = String(landmarkId || 'LM_MINI_POCKET_PARK');
      const dayKey = `${lmKey}:${getTodayDateKeyHkt(nowMs)}`;
      const entry = this.dailyCheckInsByLandmark.get(dayKey);
      return {
        landmarkId: lmKey,
        dateKey: getTodayDateKeyHkt(nowMs),
        dailyCheckInCount: entry ? entry.checkInCount : 0,
        firstSnapExplorer: entry ? entry.firstSnapExplorer : null,
        livePeerCount: this.livePeerCount,
        isLiveServer: this.connectionState === 'CONNECTED_LIVE_SERVER',
        zeroSyntheticActivity: true,
      };
    }

    getConnectionStatus() {
      return {
        state: this.connectionState,
        apiEndpointUrl: this.apiEndpointUrl,
        livePeerCount: this.livePeerCount,
        isLiveServer: this.connectionState === 'CONNECTED_LIVE_SERVER',
        zeroSyntheticPeers: true,
      };
    }

    getMessages(landmarkId, nowMs = Date.now()) {
      const list = this.messagesByLandmark.get(landmarkId) || [];
      const active = list.filter(
        (m) =>
          nowMs - m.createdAtMs < this.ttlMs &&
          !this.blockedUsers.has(m.userId) &&
          !this.mutedNicknames.has(String(m.nickname || '').toUpperCase()) &&
          !this.mutedNicknames.has(String(m.userId || '').toUpperCase())
      );
      this.messagesByLandmark.set(landmarkId, active);
      return active;
    }

    postMessage({ landmarkId, zoneId, userId, nickname, author, text, nowMs = Date.now() }) {
      const lmKey = String(landmarkId || zoneId || 'LM_HK_HARBOUR');
      const uid = String(userId || author || 'local_explorer').trim();
      const displayNick = String(nickname || author || 'Explorer').slice(0, 24);
      if (!uid || this.blockedUsers.has(uid)) {
        return { ok: false, reason: 'USER_BLOCKED_OR_INVALID' };
      }
      const recent = (this.rateLog.get(uid) || []).filter((ts) => nowMs - ts < 60000);
      if (recent.length >= this.maxMsgsPerMinute) {
        return { ok: false, reason: 'RATE_LIMITED' };
      }
      const cleanText = String(text || '').trim().slice(0, 280);
      if (!cleanText) return { ok: false, reason: 'EMPTY_MESSAGE' };

      if (containsBlockedSafetyContent(cleanText) || containsBlockedSafetyContent(displayNick)) {
        return { ok: false, reason: 'SAFETY_POLICY_VIOLATION' };
      }

      recent.push(nowMs);
      this.rateLog.set(uid, recent);
      const list = this.getMessages(lmKey, nowMs);
      const msg = {
        id: `sq_msg_${nowMs}_${list.length + 1}`,
        landmarkId: lmKey,
        userId: uid,
        nickname: displayNick,
        text: cleanText,
        zoneId: String(zoneId || 'ZONE_300M'),
        createdAtMs: nowMs,
        expiresAtMs: nowMs + this.ttlMs,
      };
      list.push(msg);
      this.messagesByLandmark.set(lmKey, list);

      if (this.ws && this.connectionState === 'CONNECTED_LIVE_SERVER') {
        try {
          this.ws.send(JSON.stringify({ type: 'chat_message', message: msg }));
        } catch (_e) {}
      }
      return { ok: true, message: msg };
    }

    createOrJoinPingPod({ landmarkId, zoneId, nickname = 'Explorer', missionTitle = 'Golden Hour Group SpotCard', nowMs = Date.now() }) {
      const lmKey = String(landmarkId || 'LM_HK_HARBOUR');
      const existing = this.pingPodsByLandmark.get(lmKey);
      if (existing && nowMs < existing.expiresAtMs) {
        if (!existing.members.includes(nickname) && existing.members.length < 6) {
          existing.members.push(nickname);
        }
        return { ok: true, pingPod: existing };
      }
      const pod = {
        podId: `PINGPOD_${lmKey}_${nowMs}`,
        landmarkId: lmKey,
        zoneId: String(zoneId || 'ZONE_300M'),
        missionTitle,
        minMembers: 3,
        maxMembers: 6,
        members: [String(nickname).slice(0, 24)],
        createdAtMs: nowMs,
        expiresAtMs: nowMs + 60 * 60 * 1000,
        zeroSyntheticMembers: true,
      };
      this.pingPodsByLandmark.set(lmKey, pod);
      return { ok: true, pingPod: pod };
    }

    leavePingPod(landmarkId, nickname = 'Explorer') {
      const lmKey = String(landmarkId || 'LM_HK_HARBOUR');
      this.pingPodsByLandmark.delete(lmKey);
      return { ok: true, leftLandmarkId: lmKey, nickname };
    }

    getActivePingPod(landmarkId, nowMs = Date.now()) {
      const lmKey = String(landmarkId || 'LM_HK_HARBOUR');
      const pod = this.pingPodsByLandmark.get(lmKey);
      if (!pod) return null;
      if (nowMs >= pod.expiresAtMs) {
        this.pingPodsByLandmark.delete(lmKey);
        return null;
      }
      return pod;
    }


    // POD2B-603: 1-Tap Friendly "👋 Nearby Wave" Reaction Broadcast & Instant Quick-Mute Controls

    // POD2B-703: 1-Tap "Copy Landmark Invite" Card for Step 3 Lounge (Zero Exact GPS, 300m Quantized Zone Only)
    generateLandmarkInviteCard({
      landmarkName = 'Neighborhood Pocket Park',
      district = 'Within 200m Walk',
      zoneId = 'ZONE_300M_DEFAULT',
      nickname = 'Explorer',
      trailHash = '',
    } = {}) {
      const rawSpot = String(landmarkName || 'Public Spot').trim();
      const rawDist = String(district || 'Local Walk').trim();
      const rawZone = String(zoneId || 'ZONE_300M').trim();
      const rawNick = String(nickname || 'Explorer').trim();
      if (
        containsBlockedSafetyContent(rawSpot) ||
        containsBlockedSafetyContent(rawDist) ||
        containsBlockedSafetyContent(rawZone) ||
        containsBlockedSafetyContent(rawNick)
      ) {
        return { ok: false, reason: 'SAFETY_POLICY_VIOLATION', zeroPii: true };
      }
      // Strip any HTML/script tags and any raw decimal coordinates (>=4 decimal places) so exact GPS never leaks
      const stripGpsAndHtml = (s, maxLen) =>
        String(s || '')
          .replace(/<[^>]*>/g, '')
          .replace(/[<>]/g, '')
          .replace(/-?\b\d{1,3}\.\d{4,}\b/g, '[300m-Fuzzy]')
          .trim()
          .slice(0, maxLen);

      const cleanSpot = stripGpsAndHtml(rawSpot, 36) || 'Public Landmark';
      const cleanDist = stripGpsAndHtml(rawDist, 24) || 'Within 200m Walk';
      const cleanZone = rawZone.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 28) || 'ZONE_300M';
      const cleanNick = stripGpsAndHtml(rawNick, 18) || 'Explorer';
      const cleanTrail =
        typeof trailHash === 'string' && trailHash.startsWith('#trail=')
          ? trailHash.replace(/[<>\s]/g, '').slice(0, 180)
          : '';
      const trailSuffix = cleanTrail ? ` • Trail: ${cleanTrail}` : '';
      const inviteText = `📍 Join my 300m SpotQuest Lounge at ${cleanSpot} (${cleanDist})! Hosted by ${cleanNick} • Fuzzy Zone: ${cleanZone}${trailSuffix} • 4h Ephemeral Room (Zero exact GPS, Zero PII)`;
      return {
        ok: true,
        inviteText,
        landmarkName: cleanSpot,
        district: cleanDist,
        zoneId: cleanZone,
        nickname: cleanNick,
        exactCoordsStripped: true,
        zeroPii: true,
      };
    }

    sendNearbyWave({
      landmarkId = 'LM_MINI_POCKET_PARK',
      zoneId = 'ZONE_300M',
      userId = 'local_explorer_1',
      nickname = 'Explorer',
      targetNickname = 'Nearby Explorers',
      nowMs = Date.now(),
    } = {}) {
      const rawNick = String(nickname || 'Explorer').trim();
      const rawTarget = String(targetNickname || 'Nearby Explorers').trim();
      if (containsBlockedSafetyContent(rawNick) || containsBlockedSafetyContent(rawTarget)) {
        return { ok: false, reason: 'SAFETY_POLICY_VIOLATION', zeroPii: true };
      }
      const uid = String(userId || 'local_explorer_1').trim();
      if (this.blockedUsers.has(uid)) {
        return { ok: false, reason: 'USER_BLOCKED_OR_INVALID' };
      }
      const recentWaves = (this.waveRateLog.get(uid) || []).filter((ts) => nowMs - ts < 60000);
      if (recentWaves.length >= 6) {
        return { ok: false, reason: 'WAVE_RATE_LIMITED' };
      }
      recentWaves.push(nowMs);
      this.waveRateLog.set(uid, recentWaves);

      const cleanNick = rawNick.replace(/[<>]/g, '').slice(0, 20) || 'Explorer';
      const cleanTarget = rawTarget.replace(/[<>]/g, '').slice(0, 22) || 'Nearby Explorers';
      const waveText = `👋 ${cleanNick} sent a friendly Nearby Wave to ${cleanTarget} (~300m zone)!`;
      const postRes = this.postMessage({
        landmarkId,
        zoneId,
        userId: uid,
        nickname: cleanNick,
        text: waveText,
        nowMs,
      });
      if (!postRes.ok) return postRes;
      postRes.message.isWave = true;
      return {
        ok: true,
        waveMessage: postRes.message,
        zeroPii: true,
        ttlHours: 4,
      };
    }

    muteExplorer(handleOrUserId) {
      const raw = String(handleOrUserId || '').replace(/[<>]/g, '').trim().slice(0, 24);
      if (!raw) return { ok: false, reason: 'EMPTY_MUTE_HANDLE' };
      if (containsBlockedSafetyContent(raw)) {
        return { ok: false, reason: 'SAFETY_POLICY_VIOLATION' };
      }
      const key = raw.toUpperCase();
      this.mutedNicknames.add(key);
      return {
        ok: true,
        mutedHandle: key,
        mutedList: this.getMutedExplorers(),
      };
    }

    unmuteExplorer(handleOrUserId) {
      const key = String(handleOrUserId || '').trim().toUpperCase();
      this.mutedNicknames.delete(key);
      return {
        ok: true,
        unmutedHandle: key,
        mutedList: this.getMutedExplorers(),
      };
    }

    clearMutedExplorers() {
      this.mutedNicknames.clear();
      return { ok: true, mutedList: [] };
    }

    getMutedExplorers() {
      return Array.from(this.mutedNicknames);
    }

    blockUser(userId) {
      const uid = String(userId || '').trim();
      if (!uid) return { ok: false };
      this.blockedUsers.add(uid);
      return { ok: true, blockedUserId: uid };
    }

    reportMessage(messageId) {
      const mid = String(messageId || '').trim();
      if (!mid) return { ok: false };
      this.reportedMessageIds.add(mid);
      return { ok: true, reportedMessageId: mid };
    }

    sendMutualFriendRequest(targetNickname, landmarkId) {
      const key = `${String(landmarkId)}:${String(targetNickname).trim()}`;
      this.friendRequests.set(key, {
        targetNickname: String(targetNickname).trim(),
        landmarkId,
        status: 'PENDING_MUTUAL_OPT_IN',
        createdAt: new Date().toISOString(),
      });
      return { ok: true, request: this.friendRequests.get(key) };
    }
  }


  // POD2B-903: Step 3 Lounge "Quick Icebreaker Prompt" Spinner (Deterministic, Zero PII, 4h TTL, Rate-Limited)
  const LOUNGE_ICEBREAKER_SPINNER_PROMPTS = Object.freeze([
    '📸 What camera lens or color filter do you recommend for this spot?',
    '☕ Best rainy-day coffee or tea order within a 200m walk of here?',
    '☔ Which covered arcade or sheltered walkway angle looks best today?',
    '🏛️ Any hidden architectural detail at this landmark most people walk past?',
    '🤝 Who is up for a quick 3-person PingPod photo check-in right here?',
    '🥾 Just checked in on the 200m walking loop — which nearby spot should I snap next?',
  ]);

  function spinQuickIcebreakerPrompt(currentIndex = 0) {
    const total = LOUNGE_ICEBREAKER_SPINNER_PROMPTS.length;
    const safeCurrent = Number.isFinite(Number(currentIndex)) && Number(currentIndex) >= 0
      ? Math.floor(Number(currentIndex))
      : 0;
    const nextIndex = (safeCurrent + 1) % total;
    const promptText = LOUNGE_ICEBREAKER_SPINNER_PROMPTS[nextIndex];
    return {
      ok: true,
      nextIndex,
      promptText,
      totalPrompts: total,
      ttlHours: 4,
      rateLimitSeconds: 3,
      zeroPii: true,
    };
  }

  const defaultLounge = new EphemeralLoungeManager();

  global.SpotLounge = Object.freeze({
    ICEBREAKER_CHIPS,
    LOUNGE_ICEBREAKER_SPINNER_PROMPTS,
    spinQuickIcebreakerPrompt,
    containsBlockedSafetyContent,
    hashDeterministicHex,
    EphemeralLoungeManager,
    configureBackend: (url, zoneId, cb) => defaultLounge.configureBackend(url, zoneId, cb),
    runLiveDiagnostics: (url, zoneId, cb) => defaultLounge.runLiveDiagnostics(url, zoneId, cb),
    getLastDiagnostics: () => defaultLounge.getLastDiagnostics(),
    generateFriendCode: (opts) => defaultLounge.generateFriendCode(opts),
    redeemFriendCode: (code, nick) => defaultLounge.redeemFriendCode(code, nick),
    getSavedCrew: () => defaultLounge.getSavedCrew(),
    recordDailyLandmarkSnap: (opts) => defaultLounge.recordDailyLandmarkSnap(opts),
    getLandmarkActivityPulse: (lmId, nowMs) => defaultLounge.getLandmarkActivityPulse(lmId, nowMs),
    getConnectionStatus: () => defaultLounge.getConnectionStatus(),
    getMessages: (lmId, nowMs) => defaultLounge.getMessages(lmId, nowMs),
    postMessage: (payload) => defaultLounge.postMessage(payload),
    createOrJoinPingPod: (payload) => defaultLounge.createOrJoinPingPod(payload),
    leavePingPod: (lmId, nick) => defaultLounge.leavePingPod(lmId, nick),
    getActivePingPod: (lmId, nowMs) => defaultLounge.getActivePingPod(lmId, nowMs),
    generateLandmarkInviteCard: (opts) => defaultLounge.generateLandmarkInviteCard(opts),
    sendNearbyWave: (opts) => defaultLounge.sendNearbyWave(opts),
    muteExplorer: (h) => defaultLounge.muteExplorer(h),
    unmuteExplorer: (h) => defaultLounge.unmuteExplorer(h),
    clearMutedExplorers: () => defaultLounge.clearMutedExplorers(),
    getMutedExplorers: () => defaultLounge.getMutedExplorers(),
    blockUser: (uid) => defaultLounge.blockUser(uid),
    reportMessage: (mid) => defaultLounge.reportMessage(mid),
    sendMutualFriendRequest: (nick, lmId) => defaultLounge.sendMutualFriendRequest(nick, lmId),
  });
})(typeof window !== 'undefined' ? window : globalThis);
