// Version: 1.2.0 | Last Modified: 2026-11-23 11:08 HKT | Build: 20261123_1108
// Module: js/geoPrivacy.js — 300m Fuzzy-Zone Privacy, Nearest-Spot Finder & Speed-Lock (Ronan Sterling-Kwan 15 & Priya Nair 18)
(function (global) {
  'use strict';
  const EARTH_RADIUS_M = 6371000;

  const PUBLIC_LANDMARKS = Object.freeze([
    {
      id: 'LM_HK_HARBOUR',
      name: 'Victoria Harbour Promenade',
      shortName: 'Victoria Harbour',
      district: 'Tsim Sha Tsui',
      category: 'Waterfront',
      sceneStyle: 'harbour',
      lat: 22.2938,
      lon: 114.1712,
      missionPrompt: 'Snap the harbourfront skyline reflection with an AR sticker!',
      xpReward: 150,
      badge: 'Harbour Sunset Crew',
      safePublicSpace: true,
    },
    {
      id: 'LM_HK_CENTRAL_MURAL',
      name: 'PMQ & Hollywood Rd Murals',
      shortName: 'PMQ Murals',
      district: 'Central',
      category: 'Street Art',
      sceneStyle: 'mural',
      lat: 22.2833,
      lon: 114.1518,
      missionPrompt: 'Frame a colorful street mural with a Neon Polaroid stamp!',
      xpReward: 180,
      badge: 'Hong Kong Neon Hunter',
      safePublicSpace: true,
    },
    {
      id: 'LM_HK_KOWLOON_PARK',
      name: 'Kowloon Park Sculpture Walk',
      shortName: 'Kowloon Park',
      district: 'Tsim Sha Tsui',
      category: 'Public Park',
      sceneStyle: 'park',
      lat: 22.3016,
      lon: 114.1704,
      missionPrompt: 'Capture a banyan tree or sculpture in the park!',
      xpReward: 140,
      badge: 'Green Oasis Explorer',
      safePublicSpace: true,
    },
    {
      id: 'LM_HK_WEST_KOWLOON',
      name: 'West Kowloon Art Park Lawn',
      shortName: 'West Kowloon',
      district: 'West Kowloon',
      category: 'Art Park',
      sceneStyle: 'artpark',
      lat: 22.3012,
      lon: 114.1592,
      missionPrompt: 'Snap the sunset lawn or M+ waterfront with an AR badge!',
      xpReward: 160,
      badge: 'Art Park Pioneer',
      safePublicSpace: true,
    },
    {
      id: 'LM_HK_SHATIN_RIVER',
      name: 'Shing Mun River Promenade',
      shortName: 'Sha Tin River',
      district: 'Sha Tin',
      category: 'Riverfront',
      sceneStyle: 'river',
      lat: 22.3815,
      lon: 114.1922,
      missionPrompt: 'Frame the twin river bridges inside the AR viewfinder!',
      xpReward: 150,
      badge: 'River Promenade Scout',
      safePublicSpace: true,
    },
    {
      id: 'LM_HK_SAIKUNG_PIER',
      name: 'Sai Kung Waterfront Pier',
      shortName: 'Sai Kung Pier',
      district: 'Sai Kung',
      category: 'Pier Square',
      sceneStyle: 'pier',
      lat: 22.3814,
      lon: 114.2735,
      missionPrompt: 'Capture the sampan pier shoreline with a Coastal AR stamp!',
      xpReward: 170,
      badge: 'Coastal Trailblazer',
      safePublicSpace: true,
    },
  ]);

  function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
    const toRad = (deg) => (Number(deg) * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function quantizeToPrivacyZone(lat, lon, zoneRadiusMeters = 300) {
    const safeRadius = Math.max(250, Number(zoneRadiusMeters) || 300);
    const latStep = safeRadius / 111320;
    const latIdx = Math.floor(Number(lat) / latStep);
    const qLat = (latIdx + 0.5) * latStep;
    const cosLat = Math.max(0.1, Math.cos((qLat * Math.PI) / 180));
    const lonStep = safeRadius / (111320 * cosLat);
    const lonIdx = Math.floor(Number(lon) / lonStep);
    const qLon = (lonIdx + 0.5) * lonStep;
    const zoneId = `ZONE_${safeRadius}M_${latIdx}_${lonIdx}`;
    return {
      zoneId,
      centerLat: Number(qLat.toFixed(5)),
      centerLon: Number(qLon.toFixed(5)),
      radiusMeters: safeRadius,
      exactCoordsStripped: true,
    };
  }

  function evaluateSpeedLockSafety(speedMetersPerSec, maxWalkSpeedMps = 6.5) {
    const s = Math.max(0, Number(speedMetersPerSec) || 0);
    const isVehicleSpeed = s > maxWalkSpeedMps;
    return {
      allowed: !isVehicleSpeed,
      speedMps: s,
      warning: isVehicleSpeed
        ? `Moving too fast (${s.toFixed(1)} m/s). AR camera missions pause in vehicles for your safety.`
        : null,
    };
  }

  function getCuratedLandmarks() {
    return PUBLIC_LANDMARKS.map((lm) => ({
      ...lm,
      zone: quantizeToPrivacyZone(lm.lat, lm.lon, 300),
    }));
  }

  function findNearestLandmark(lat, lon) {
    const list = getCuratedLandmarks();
    let best = list[0];
    let bestDist = Infinity;
    list.forEach((lm) => {
      const d = haversineDistanceMeters(lat, lon, lm.lat, lm.lon);
      if (d < bestDist) {
        bestDist = d;
        best = lm;
      }
    });
    return { landmark: best, distanceMeters: Math.round(bestDist) };
  }

  function validatePublicLandmark(landmarkId) {
    const found = PUBLIC_LANDMARKS.find((lm) => lm.id === landmarkId);
    return Boolean(found && found.safePublicSpace === true);
  }

  global.SpotGeoPrivacy = Object.freeze({
    haversineDistanceMeters,
    quantizeToPrivacyZone,
    evaluateSpeedLockSafety,
    getCuratedLandmarks,
    findNearestLandmark,
    validatePublicLandmark,
  });
})(typeof window !== 'undefined' ? window : globalThis);
