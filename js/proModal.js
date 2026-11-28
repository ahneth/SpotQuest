// Version: 2.1.0 | Last Modified: 2026-11-28 11:36 HKT | Build: 20261128_1136
// Module: js/proModal.js — Transparent SpotQuest Plus ($4.99/mo or $39/yr), Static-Clean SVG Logo & Standalone PWA Offline App Manifest (POD2B-801) (Ronan Sterling-Kwan 15, Aria Vance-Sato 14 & Elena Park 16)
(function (global) {
  'use strict';

  const SPOTQUEST_LOGO_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">' +
    '<defs><linearGradient id="sqG" x1="0%" y1="0%" x2="100%" y2="100%">' +
    '<stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#f472b6"/>' +
    '</linearGradient></defs>' +
    '<rect x="4" y="4" width="56" height="56" rx="14" fill="#0f172a" stroke="url(#sqG)" stroke-width="4"/>' +
    '<circle cx="32" cy="30" r="14" fill="none" stroke="#38bdf8" stroke-width="3" stroke-dasharray="6 4"/>' +
    '<circle cx="32" cy="30" r="5" fill="#4ade80"/>' +
    '<path d="M32 10 L32 16 M32 44 L32 50 M12 30 L18 30 M46 30 L52 30" stroke="#facc15" stroke-width="3" stroke-linecap="round"/>' +
    '</svg>';

  const PRICING_PLANS = Object.freeze({
    free: { id: 'spotquest_free', name: 'Explorer Free', priceLabel: '$0 forever' },
    monthly: { id: 'spotquest_plus_monthly', name: 'SpotQuest Plus Monthly', priceUsd: 4.99, priceLabel: '$4.99 / mo' },
    annual: { id: 'spotquest_plus_annual', name: 'SpotQuest Plus Annual', priceUsd: 39.00, priceLabel: '$39.00 / yr' },
  });

  const PWA_INSTALL_STEPS = Object.freeze([
    '📱 iOS Safari: Tap Share -> "Add to Home Screen" for full-screen 200m walking radar.',
    '🤖 Android Chrome: Tap Menu (⋮) -> "Install App" or "Add to Home Screen".',
    '💻 Desktop Chrome / Edge: Click the Install icon in the address bar ($0.00 offline-first PWA).',
  ]);

  function getLogoDataUri() {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SPOTQUEST_LOGO_SVG);
  }

  // POD2B-801: Zero-Host Inline Web App Manifest (data:application/manifest+json)
  function buildOfflineAppManifest() {
    const iconUri = getLogoDataUri();
    return {
      name: 'SpotQuest — <=200m Walking Mini-Missions & AR Local Quests',
      short_name: 'SpotQuest',
      description: 'Privacy-first <=200m walking mini-missions, zero-EXIF AR SpotCards, and 300m local lounges by NetHustle.',
      start_url: '.',
      display: 'standalone',
      orientation: 'portrait-primary',
      background_color: '#070b14',
      theme_color: '#0f172a',
      icons: [
        {
          src: iconUri,
          sizes: '192x192 512x512',
          type: 'image/svg+xml',
          purpose: 'any maskable',
        },
      ],
    };
  }

  function getWebAppManifestDataUri() {
    const manifestObj = buildOfflineAppManifest();
    return 'data:application/manifest+json;charset=utf-8,' + encodeURIComponent(JSON.stringify(manifestObj));
  }

  function getPwaInstallGuideSteps() {
    return PWA_INSTALL_STEPS;
  }

  function verifySvgHygiene(svgString = SPOTQUEST_LOGO_SVG) {
    const s = String(svgString);
    return {
      ok: !/<script/i.test(s) && !/\bon[a-z]+\s*=/i.test(s) && !/(?:xlink:href|href)\s*=\s*["']https?:/i.test(s),
      hasScript: /<script/i.test(s),
      hasInlineEvent: /\bon[a-z]+\s*=/i.test(s),
      hasExternalHref: /(?:xlink:href|href)\s*=\s*["']https?:/i.test(s),
    };
  }

  function getPricingPlans() {
    return PRICING_PLANS;
  }

  global.SpotPro = Object.freeze({
    SPOTQUEST_LOGO_SVG,
    PWA_INSTALL_STEPS,
    getLogoDataUri,
    buildOfflineAppManifest,
    getWebAppManifestDataUri,
    getPwaInstallGuideSteps,
    verifySvgHygiene,
    getPricingPlans,
  });
})(typeof window !== 'undefined' ? window : globalThis);
