// Version: 1.1.0 | Last Modified: 2026-11-23 01:15 HKT | Build: 20261123_0115
// Module: js/state.js — SafeStateEngine Zero-PII & Zero-Synthetic-Data Local Vault (Victor Lin 03 & Priya Nair 18)
(function (global) {
  'use strict';
  const STORAGE_KEY = 'spotquest_v1_1_state';
  const SCHEMA_VERSION = '1.1.0';

  function createEmptyState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      activeStep: 1,
      selectedLandmarkId: 'LM_HK_HARBOUR',
      explorerNickname: 'Explorer',
      totalXp: 0,
      completedMissions: [],
      earnedBadges: [],
      savedSpotCards: [],
      mutedAudio: false,
      simulatedSpeedMps: 1.4,
      arFrameStyle: 'neon_polaroid',
      arStickerKey: 'compass',
      stickerPos: { x: 0.76, y: 0.24 },
      photoSourceMode: 'scene',
      lastMissionCompletedId: null,
      updatedAt: new Date().toISOString(),
    };
  }

  let currentState = createEmptyState();

  function loadState() {
    try {
      if (typeof localStorage === 'undefined') return currentState;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        currentState = createEmptyState();
        return currentState;
      }
      const parsed = JSON.parse(raw);
      currentState = { ...createEmptyState(), ...(parsed || {}), schemaVersion: SCHEMA_VERSION };
      return currentState;
    } catch (_err) {
      currentState = createEmptyState();
      return currentState;
    }
  }

  function saveState(patch = {}) {
    currentState = {
      ...currentState,
      ...patch,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
    };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
      }
    } catch (_err) {}
    return currentState;
  }

  function getState() {
    return currentState;
  }

  function recordCompletedMission({ landmarkId, zoneId, xpReward, badge, cardDataUrl }) {
    const alreadyDone = currentState.completedMissions.includes(landmarkId);
    const completedMissions = alreadyDone
      ? currentState.completedMissions
      : [...currentState.completedMissions, landmarkId];
    const earnedBadges = currentState.earnedBadges.includes(badge)
      ? currentState.earnedBadges
      : [...currentState.earnedBadges, badge];
    const totalXp = alreadyDone
      ? currentState.totalXp
      : currentState.totalXp + (Number(xpReward) || 150);
    const savedSpotCards = [
      {
        landmarkId,
        zoneId,
        badge,
        capturedAt: new Date().toISOString(),
        exifStripped: true,
        hasPreview: Boolean(cardDataUrl),
      },
      ...currentState.savedSpotCards,
    ].slice(0, 12);

    return saveState({
      completedMissions,
      earnedBadges,
      totalXp,
      savedSpotCards,
      lastMissionCompletedId: landmarkId,
    });
  }

  function isLandmarkUnlocked(landmarkId) {
    return currentState.completedMissions.includes(landmarkId);
  }

  function resetState() {
    currentState = createEmptyState();
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
    } catch (_err) {}
    return currentState;
  }

  global.SpotState = Object.freeze({
    STORAGE_KEY,
    SCHEMA_VERSION,
    createEmptyState,
    loadState,
    saveState,
    getState,
    recordCompletedMission,
    isLandmarkUnlocked,
    resetState,
  });
})(typeof window !== 'undefined' ? window : globalThis);
