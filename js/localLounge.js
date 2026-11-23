// Version: 1.2.0 | Last Modified: 2026-11-23 11:08 HKT | Build: 20261123_1108
// Module: js/localLounge.js — Real Client-Server WebSocket/REST Lounge Client, PingPod 3-6 Person Group Missions & Hardened HK/Intl Phone PII Filter (Priya Nair 18)
(function (global) {
  'use strict';

  // Hardened per Pod 3 CISO Observation OBS-P2B-20261123-01:
  // Blocks 8-digit HK phone numbers (e.g., 9123-4567, 6123 4567, +852 9123 4567) AND 10-digit US/Intl numbers
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

  class EphemeralLoungeManager {
    constructor({ ttlMs = 4 * 3600 * 1000, maxMsgsPerMinute = 12 } = {}) {
      this.ttlMs = ttlMs;
      this.maxMsgsPerMinute = maxMsgsPerMinute;
      this.blockedUsers = new Set();
      this.reportedMessageIds = new Set();
      this.friendRequests = new Map();
      this.pingPodsByLandmark = new Map();
      this.rateLog = new Map();
      this.messagesByLandmark = new Map();
      this.apiEndpointUrl = '';
      this.ws = null;
      this.connectionState = 'LOCAL_ONLY_NO_SERVER';
      this.livePeerCount = 0;
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
        (m) => nowMs - m.createdAtMs < this.ttlMs && !this.blockedUsers.has(m.userId)
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

      for (let i = 0; i < BLOCKED_PATTERNS.length; i++) {
        if (BLOCKED_PATTERNS[i].test(cleanText)) {
          return { ok: false, reason: 'SAFETY_POLICY_VIOLATION' };
        }
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

  const defaultLounge = new EphemeralLoungeManager();

  global.SpotLounge = Object.freeze({
    ICEBREAKER_CHIPS,
    EphemeralLoungeManager,
    configureBackend: (url, zoneId, cb) => defaultLounge.configureBackend(url, zoneId, cb),
    getConnectionStatus: () => defaultLounge.getConnectionStatus(),
    getMessages: (lmId, nowMs) => defaultLounge.getMessages(lmId, nowMs),
    postMessage: (payload) => defaultLounge.postMessage(payload),
    createOrJoinPingPod: (payload) => defaultLounge.createOrJoinPingPod(payload),
    leavePingPod: (lmId, nick) => defaultLounge.leavePingPod(lmId, nick),
    getActivePingPod: (lmId, nowMs) => defaultLounge.getActivePingPod(lmId, nowMs),
    blockUser: (uid) => defaultLounge.blockUser(uid),
    reportMessage: (mid) => defaultLounge.reportMessage(mid),
    sendMutualFriendRequest: (nick, lmId) => defaultLounge.sendMutualFriendRequest(nick, lmId),
  });
})(typeof window !== 'undefined' ? window : globalThis);
