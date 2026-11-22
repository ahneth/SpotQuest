// Version: 1.1.0 | Last Modified: 2026-11-23 01:15 HKT | Build: 20261123_0115
// Module: js/localLounge.js — Ephemeral 4-Hour Landmark Lounge, Moderation & Friend Requests (Priya Nair 18)
(function (global) {
  'use strict';

  const BLOCKED_PATTERNS = [
    /\b(?:kill|suicide|self[\s-]?harm|doxx|stalk|swat)\b/i,
    /\b(?:\d{3}[-\s]?\d{3}[-\s]?\d{4})\b/,
  ];

  const ICEBREAKER_CHIPS = Object.freeze([
    '👋 Just snapped my SpotCard here!',
    '📸 The view right now is awesome!',
    '☕ Anyone nearby up for a quick coffee?',
  ]);

  class EphemeralLoungeManager {
    constructor({ ttlMs = 4 * 3600 * 1000, maxMsgsPerMinute = 12 } = {}) {
      this.ttlMs = ttlMs;
      this.maxMsgsPerMinute = maxMsgsPerMinute;
      this.blockedUsers = new Set();
      this.reportedMessageIds = new Set();
      this.friendRequests = new Map();
      this.rateLog = new Map();
      this.messagesByLandmark = new Map();
    }

    getMessages(landmarkId, nowMs = Date.now()) {
      const list = this.messagesByLandmark.get(landmarkId) || [];
      const active = list.filter(
        (m) => nowMs - m.createdAtMs < this.ttlMs && !this.blockedUsers.has(m.userId)
      );
      this.messagesByLandmark.set(landmarkId, active);
      return active;
    }

    postMessage({ landmarkId, userId, nickname, text, zoneId, nowMs = Date.now() }) {
      const uid = String(userId || 'local_explorer').trim();
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
      const list = this.getMessages(landmarkId, nowMs);
      const msg = {
        id: `sq_msg_${nowMs}_${list.length + 1}`,
        landmarkId: String(landmarkId),
        userId: uid,
        nickname: String(nickname || 'Explorer').slice(0, 24),
        text: cleanText,
        zoneId: String(zoneId || 'ZONE_300M'),
        createdAtMs: nowMs,
        expiresAtMs: nowMs + this.ttlMs,
      };
      list.push(msg);
      this.messagesByLandmark.set(landmarkId, list);
      return { ok: true, message: msg };
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
    getMessages: (lmId, nowMs) => defaultLounge.getMessages(lmId, nowMs),
    postMessage: (payload) => defaultLounge.postMessage(payload),
    blockUser: (uid) => defaultLounge.blockUser(uid),
    reportMessage: (mid) => defaultLounge.reportMessage(mid),
    sendMutualFriendRequest: (nick, lmId) => defaultLounge.sendMutualFriendRequest(nick, lmId),
  });
})(typeof window !== 'undefined' ? window : globalThis);
