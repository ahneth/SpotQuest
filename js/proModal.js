// Version: 1.2.0 | Last Modified: 2026-11-23 11:08 HKT | Build: 20261123_1108
// Module: js/proModal.js — Transparent SpotQuest Plus ($4.99/mo or $39/yr) & Static-Clean SVG Logo (Elena Park 16)
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

  function getLogoDataUri() {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SPOTQUEST_LOGO_SVG);
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

  function getPricingPlans() { return PRICING_PLANS; }

  global.SpotPro = Object.freeze({
    SPOTQUEST_LOGO_SVG,
    getLogoDataUri,
    verifySvgHygiene,
    getPricingPlans,
  });
})(typeof window !== 'undefined' ? window : globalThis);
