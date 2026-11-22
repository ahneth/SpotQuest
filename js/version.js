// Version: 1.1.0 | Last Modified: 2026-11-23 01:15 HKT | Build: 20261123_0115
// Module: js/version.js — SpotQuest v1.1.0 Build & Version Metadata (Victor Lin 03)
(function (global) {
  'use strict';
  const SpotVersion = Object.freeze({
    APP_ID: 'APP-104-SPOTQUEST',
    APP_NAME: 'SpotQuest',
    VERSION: '1.1.0',
    BUILD_ID: '20261123_0115',
    RELEASE_TAG: '20261123_0115',
    MOTTO: 'Make money, Legally, NEVER HARM ANY HUMAN',
    PRIVACY_FLOOR_METERS: 300,
    MAX_WALK_SPEED_MPS: 6.5,
    LOUNGE_TTL_MS: 4 * 3600 * 1000,
    getVersionBanner() {
      return `${this.APP_NAME} v${this.VERSION} (Build ${this.BUILD_ID})`;
    },
    verifyBuildParity() {
      return this.BUILD_ID === this.RELEASE_TAG;
    },
  });
  global.SpotVersion = SpotVersion;
})(typeof window !== 'undefined' ? window : globalThis);
