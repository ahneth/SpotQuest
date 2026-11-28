// Version: 2.1.0 | Last Modified: 2026-11-28 11:36 HKT | Build: 20261128_1136
// Module: js/geoPrivacy.js — Live Overpass OSM Public-POI <=200m Mini-Mission Enricher (POD2B-501), Big Mission Multi-Stop Trail Progress Tracker (POD2B-503), 300m Fuzzy-Zone Privacy, Custom Public Spots & Speed-Lock (Ronan Sterling-Kwan 15 & Priya Nair 18)
(function (global) {
  'use strict';
  const EARTH_RADIUS_M = 6371000;
  const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

  // City-Wide Big Missions (Curated 6-Stop Multi-District Trails)
  const PUBLIC_LANDMARKS = Object.freeze([
    {
      id: 'LM_HK_HARBOUR',
      name: 'Victoria Harbour Promenade',
      shortName: 'Victoria Harbour',
      district: 'Tsim Sha Tsui',
      category: 'Waterfront',
      missionCategory: 'big',
      trailName: 'HK Harbour & Neon Trail',
      trailStepIndex: 1,
      sceneStyle: 'harbour',
      lat: 22.2938,
      lon: 114.1712,
      missionPrompt: 'Snap the harbourfront skyline reflection with an AR sticker!',
      xpReward: 150,
      badge: 'Harbour Sunset Crew',
      safePublicSpace: true,
      isCustom: false,
    },
    {
      id: 'LM_HK_CENTRAL_MURAL',
      name: 'PMQ & Hollywood Rd Murals',
      shortName: 'PMQ Murals',
      district: 'Central',
      category: 'Street Art',
      missionCategory: 'big',
      trailName: 'HK Harbour & Neon Trail',
      trailStepIndex: 2,
      sceneStyle: 'mural',
      lat: 22.2833,
      lon: 114.1518,
      missionPrompt: 'Frame a colorful street mural with a Neon Polaroid stamp!',
      xpReward: 180,
      badge: 'Hong Kong Neon Hunter',
      safePublicSpace: true,
      isCustom: false,
    },
    {
      id: 'LM_HK_KOWLOON_PARK',
      name: 'Kowloon Park Sculpture Walk',
      shortName: 'Kowloon Park',
      district: 'Tsim Sha Tsui',
      category: 'Public Park',
      missionCategory: 'big',
      trailName: 'HK Harbour & Neon Trail',
      trailStepIndex: 3,
      sceneStyle: 'park',
      lat: 22.3016,
      lon: 114.1704,
      missionPrompt: 'Capture a banyan tree or sculpture in the park!',
      xpReward: 140,
      badge: 'Green Oasis Explorer',
      safePublicSpace: true,
      isCustom: false,
    },
    {
      id: 'LM_HK_WEST_KOWLOON',
      name: 'West Kowloon Art Park Lawn',
      shortName: 'West Kowloon',
      district: 'West Kowloon',
      category: 'Art Park',
      missionCategory: 'big',
      trailName: 'District Heritage Circuit',
      trailStepIndex: 4,
      sceneStyle: 'artpark',
      lat: 22.3012,
      lon: 114.1592,
      missionPrompt: 'Snap the sunset lawn or M+ waterfront with an AR badge!',
      xpReward: 160,
      badge: 'Art Park Pioneer',
      safePublicSpace: true,
      isCustom: false,
    },
    {
      id: 'LM_HK_SHATIN_RIVER',
      name: 'Shing Mun River Promenade',
      shortName: 'Sha Tin River',
      district: 'Sha Tin',
      category: 'Riverfront',
      missionCategory: 'big',
      trailName: 'District Heritage Circuit',
      trailStepIndex: 5,
      sceneStyle: 'river',
      lat: 22.3815,
      lon: 114.1922,
      missionPrompt: 'Frame the twin river bridges inside the AR viewfinder!',
      xpReward: 150,
      badge: 'River Promenade Scout',
      safePublicSpace: true,
      isCustom: false,
    },
    {
      id: 'LM_HK_SAIKUNG_PIER',
      name: 'Sai Kung Waterfront Pier',
      shortName: 'Sai Kung Pier',
      district: 'Sai Kung',
      category: 'Pier Square',
      missionCategory: 'big',
      trailName: 'District Heritage Circuit',
      trailStepIndex: 6,
      sceneStyle: 'pier',
      lat: 22.3814,
      lon: 114.2735,
      missionPrompt: 'Capture the sampan pier shoreline with a Coastal AR stamp!',
      xpReward: 170,
      badge: 'Coastal Trailblazer',
      safePublicSpace: true,
      isCustom: false,
    },
  ]);

  // FD-P0-20261124-01: Safe public walking-distance Mini-Mission templates (<= 200m of user/map anchor anywhere in the world)
  const MINI_MISSION_TEMPLATES = Object.freeze([
    {
      suffix: 'POCKET_PARK',
      name: 'Neighborhood Pocket Park & Green Bench',
      shortName: 'Pocket Park (~55m)',
      category: 'Mini • Green Corner',
      sceneStyle: 'park',
      distanceMeters: 55,
      bearingDeg: 35,
      missionPrompt: 'Walk ~55m to the nearest public trees or park bench and snap a calming greenery SpotCard!',
      xpReward: 110,
      badge: '200m Green Stroller',
      coveredRainSafe: false,
      weatherTag: '🌤️ Open-Air Walk',
      moodKey: 'chill_walk',
      moodLabel: '🌿 Chill Walk',
    },
    {
      suffix: 'CAFE_PLAZA',
      name: 'Corner Cafe & Pedestrian Walkway',
      shortName: 'Corner Plaza (~95m)',
      category: 'Mini • Public Plaza',
      sceneStyle: 'mural',
      distanceMeters: 95,
      bearingDeg: 125,
      missionPrompt: 'Walk ~95m along the public sidewalk or cafe corner and frame the street vibe with an AR sticker!',
      xpReward: 120,
      badge: 'Local Sidewalk Scout',
      coveredRainSafe: true,
      weatherTag: '☔ Covered / Rain-Safe',
      moodKey: 'chill_walk',
      moodLabel: '🌿 Chill Walk',
    },
    {
      suffix: 'MURAL_ARCH',
      name: 'Public Facade & Architecture Viewpoint',
      shortName: 'Street Facade (~140m)',
      category: 'Mini • Architecture',
      sceneStyle: 'artpark',
      distanceMeters: 140,
      bearingDeg: 220,
      missionPrompt: 'Stroll ~140m to a distinctive public building facade or open courtyard and snap its skyline geometry!',
      xpReward: 125,
      badge: 'Urban Geometry Hunter',
      coveredRainSafe: true,
      weatherTag: '☔ Covered / Rain-Safe',
      moodKey: 'photo_art',
      moodLabel: '🎨 Photo Art',
    },
    {
      suffix: 'TRANSIT_SQUARE',
      name: 'Pedestrian Piazzetta & Transit Exit Square',
      shortName: 'Public Square (~180m)',
      category: 'Mini • Pedestrian Hub',
      sceneStyle: 'harbour',
      distanceMeters: 180,
      bearingDeg: 310,
      missionPrompt: 'Walk ~180m to the public pedestrian square and capture the neighborhood horizon with a Neon Compass!',
      xpReward: 135,
      badge: '200m Neighborhood Pioneer',
      coveredRainSafe: true,
      weatherTag: '☔ Covered / Rain-Safe',
      moodKey: 'night_neon',
      moodLabel: '🌃 Night Neon',
    },
  ]);

  const UNSAFE_SPOT_REGEX = /\b(?:highway|freeway|motorway|rail\s*track|cliff\s*edge|restricted|military|private\s*residence|trespass|kill|suicide|self[\s-]?harm)\b/i;
  const PHONE_OR_PII_REGEX = /(?:\+?852[-\s]?)?\b[2-9]\d{3}[-\s]?\d{4}\b|\b(?:\d{3}[-\s.]?\d{3}[-\s.]?\d{4})\b/;

  function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
    const toRad = (deg) => (Number(deg) * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function formatWalkingDistanceLabel(distanceMeters) {
    const d = Math.max(5, Math.round(Number(distanceMeters) || 0));
    const walkMins = Math.max(1, Math.round(d / 80));
    if (d < 1000) {
      return `~${d}m · ${walkMins} min walk`;
    }
    const km = (d / 1000).toFixed(1);
    return `~${km}km · City Trail`;
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

  // FD-P0-20261124-01: Generates 4 safe public walking-distance Mini-Missions strictly <= 200m of (lat, lon)
  function generateNearbyMiniMissions(lat = 22.2938, lon = 114.1712, maxRadiusMeters = 200) {
    const baseLat = Number.isFinite(Number(lat)) ? Number(lat) : 22.2938;
    const baseLon = Number.isFinite(Number(lon)) ? Number(lon) : 114.1712;
    const capRadius = Math.min(200, Math.max(50, Number(maxRadiusMeters) || 200));
    const cosLat = Math.max(0.1, Math.cos((baseLat * Math.PI) / 180));
    const privacyZone = quantizeToPrivacyZone(baseLat, baseLon, 300);

    return MINI_MISSION_TEMPLATES.map((tpl) => {
      const distM = Math.min(capRadius - 10, tpl.distanceMeters);
      const rad = (tpl.bearingDeg * Math.PI) / 180;
      const dLat = (distM * Math.cos(rad)) / 111320;
      const dLon = (distM * Math.sin(rad)) / (111320 * cosLat);
      const pinLat = Number((baseLat + dLat).toFixed(6));
      const pinLon = Number((baseLon + dLon).toFixed(6));
      const verifiedDist = Math.round(haversineDistanceMeters(baseLat, baseLon, pinLat, pinLon));

      return {
        id: `LM_MINI_${tpl.suffix}`,
        name: tpl.name,
        shortName: tpl.shortName,
        district: 'Within 200m Walk',
        category: tpl.category,
        missionCategory: 'mini',
        trailName: '200m Local Walking Loop',
        sceneStyle: tpl.sceneStyle,
        lat: pinLat,
        lon: pinLon,
        distanceMeters: verifiedDist,
        walkingLabel: formatWalkingDistanceLabel(verifiedDist),
        missionPrompt: tpl.missionPrompt,
        xpReward: tpl.xpReward,
        badge: tpl.badge,
        coveredRainSafe: Boolean(tpl.coveredRainSafe),
        weatherTag: tpl.weatherTag || (tpl.coveredRainSafe ? '☔ Covered / Rain-Safe' : '🌤️ Open-Air Walk'),
        moodKey: tpl.moodKey || 'chill_walk',
        moodLabel: tpl.moodLabel || '🌿 Chill Walk',
        safePublicSpace: true,
        isCustom: false,
        isMiniMission: true,
        source: 'deterministic_200m',
        zone: {
          ...privacyZone,
          pinLat,
          pinLon,
        },
      };
    });
  }

  // POD2B-501: Live Overpass OSM Public-POI <= 200m Mini-Mission Enricher
  // Queries strictly public-space OSM tags (leisure=park/garden, tourism=viewpoint/artwork, amenity=fountain/bench/cafe)
  function buildOverpassPublicPoiQuery(lat = 22.2938, lon = 114.1712, radiusMeters = 200) {
    const r = Math.min(200, Math.max(50, Math.round(Number(radiusMeters) || 200)));
    const safeLat = Number(Number(lat || 22.2938).toFixed(5));
    const safeLon = Number(Number(lon || 114.1712).toFixed(5));
    return (
      `[out:json][timeout:6];(` +
      `node["leisure"~"^(park|garden|playground)$"](around:${r},${safeLat},${safeLon});` +
      `node["tourism"~"^(viewpoint|artwork|attraction)$"](around:${r},${safeLat},${safeLon});` +
      `node["amenity"~"^(fountain|bench|cafe|public_building)$"](around:${r},${safeLat},${safeLon});` +
      `);out body 6;`
    );
  }

  function parseOverpassPublicPoiResponse(payload, anchorLat = 22.2938, anchorLon = 114.1712, maxRadiusMeters = 200) {
    const cap = Math.min(200, Math.max(50, Number(maxRadiusMeters) || 200));
    const privacyZone = quantizeToPrivacyZone(anchorLat, anchorLon, 300);
    const elements = payload && Array.isArray(payload.elements) ? payload.elements : [];
    const results = [];

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (!el || typeof el.lat !== 'number' || typeof el.lon !== 'number') continue;
      const dist = Math.round(haversineDistanceMeters(anchorLat, anchorLon, el.lat, el.lon));
      if (dist > cap) continue;
      const tags = el.tags || {};
      const rawName = String(
        tags['name:en'] || tags.name || tags.tourism || tags.leisure || tags.amenity || 'Public Spot'
      )
        .replace(/[<>]/g, '')
        .trim()
        .slice(0, 38);
      if (!rawName || UNSAFE_SPOT_REGEX.test(rawName) || PHONE_OR_PII_REGEX.test(rawName)) continue;

      const poiType = String(tags.leisure || tags.tourism || tags.amenity || 'Public POI').slice(0, 18);
      const shortLabel = `${rawName.slice(0, 15)} (~${dist}m)`;
      results.push({
        id: `LM_OSM_POI_${el.id || i + 1}`,
        name: rawName,
        shortName: shortLabel,
        district: 'Live OSM <=200m POI',
        category: `Mini • ${poiType}`,
        missionCategory: 'mini',
        trailName: 'Live Overpass 200m Walk',
        sceneStyle: tags.leisure ? 'park' : tags.tourism === 'artwork' ? 'mural' : 'harbour',
        lat: Number(el.lat.toFixed(6)),
        lon: Number(el.lon.toFixed(6)),
        distanceMeters: dist,
        walkingLabel: formatWalkingDistanceLabel(dist),
        missionPrompt: `Walk ~${dist}m to ${rawName} (verified OSM public ${poiType}) and snap a zero-EXIF AR SpotCard!`,
        xpReward: 130,
        badge: 'Live OSM 200m Scout',
        safePublicSpace: true,
        isCustom: false,
        isMiniMission: true,
        source: 'overpass_osm_live',
        zone: {
          ...privacyZone,
          pinLat: Number(el.lat.toFixed(6)),
          pinLon: Number(el.lon.toFixed(6)),
        },
      });
      if (results.length >= 5) break;
    }
    return results;
  }

  async function fetchNearbyOverpassMiniMissions(lat = 22.2938, lon = 114.1712, maxRadiusMeters = 200) {
    const fallbackMissions = generateNearbyMiniMissions(lat, lon, maxRadiusMeters);
    if (typeof fetch !== 'function') {
      return {
        ok: true,
        source: 'deterministic_200m_fallback',
        missions: fallbackMissions,
        zeroSyntheticPeers: true,
      };
    }
    try {
      const query = buildOverpassPublicPoiQuery(lat, lon, maxRadiusMeters);
      const url = `${OVERPASS_ENDPOINT}?data=${encodeURIComponent(query)}`;
      const res = await fetch(url, { method: 'GET' });
      if (!res || !res.ok) {
        return {
          ok: true,
          source: 'deterministic_200m_fallback',
          missions: fallbackMissions,
          zeroSyntheticPeers: true,
        };
      }
      const data = await res.json();
      const parsed = parseOverpassPublicPoiResponse(data, lat, lon, maxRadiusMeters);
      if (parsed.length > 0) {
        return {
          ok: true,
          source: 'overpass_osm_live',
          missions: parsed,
          zeroSyntheticPeers: true,
        };
      }
      return {
        ok: true,
        source: 'deterministic_200m_fallback',
        missions: fallbackMissions,
        zeroSyntheticPeers: true,
      };
    } catch (_err) {
      return {
        ok: true,
        source: 'deterministic_200m_fallback',
        missions: fallbackMissions,
        zeroSyntheticPeers: true,
      };
    }
  }

  // POD2B-503: Big Mission Multi-Stop Progress Bar & Next-Stop Resolver
  function computeBigMissionTrailProgress(landmarks = [], completedIds = []) {
    const bigSpots = (Array.isArray(landmarks) ? landmarks : []).filter(
      (lm) => lm && lm.missionCategory === 'big'
    );
    const totalBig = bigSpots.length || 6;
    const completedBigSpots = bigSpots.filter((lm) => completedIds.includes(lm.id));
    const completedBig = completedBigSpots.length;
    const nextUnvisitedSpot = bigSpots.find((lm) => !completedIds.includes(lm.id)) || bigSpots[0] || null;
    const percent = Math.min(100, Math.round((completedBig / Math.max(1, totalBig)) * 100));
    return {
      completedBig,
      totalBig,
      percent,
      nextStopId: nextUnvisitedSpot ? nextUnvisitedSpot.id : 'LM_HK_HARBOUR',
      nextStopName: nextUnvisitedSpot ? nextUnvisitedSpot.shortName || nextUnvisitedSpot.name : 'Victoria Harbour',
      allCompleted: completedBig >= totalBig,
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

  function createCustomPublicLandmark({
    name,
    district = 'Local Walk',
    category = 'Public Plaza',
    missionCategory = 'mini',
    missionPrompt = 'Snap this public landmark with an AR sticker!',
    lat = 22.2938,
    lon = 114.1712,
    confirmedPublicSafe = false,
    speedMetersPerSec = 1.4,
    nowMs = Date.now(),
  } = {}) {
    const speedCheck = evaluateSpeedLockSafety(speedMetersPerSec);
    if (!speedCheck.allowed) {
      return { ok: false, reason: 'VEHICLE_SPEED_LOCK_ACTIVE' };
    }
    if (!confirmedPublicSafe) {
      return { ok: false, reason: 'PUBLIC_SPACE_CONFIRMATION_REQUIRED' };
    }
    const cleanName = String(name || '').replace(/[<>]/g, '').trim().slice(0, 42);
    const cleanDistrict = String(district || 'Local Walk').replace(/[<>]/g, '').trim().slice(0, 28) || 'Local Walk';
    const cleanCategory = String(category || 'Public Plaza').replace(/[<>]/g, '').trim().slice(0, 24) || 'Public Plaza';
    const cleanPrompt = String(missionPrompt || 'Snap this public spot with an AR sticker!').replace(/[<>]/g, '').trim().slice(0, 120);

    if (!cleanName || cleanName.length < 3) {
      return { ok: false, reason: 'INVALID_SPOT_NAME' };
    }
    const combined = `${cleanName} ${cleanDistrict} ${cleanPrompt}`;
    if (UNSAFE_SPOT_REGEX.test(combined) || PHONE_OR_PII_REGEX.test(combined)) {
      return { ok: false, reason: 'SAFETY_POLICY_VIOLATION' };
    }
    const numLat = Number(lat);
    const numLon = Number(lon);
    if (!Number.isFinite(numLat) || !Number.isFinite(numLon)) {
      return { ok: false, reason: 'INVALID_COORDINATES' };
    }
    const zone = quantizeToPrivacyZone(numLat, numLon, 300);
    const id = `LM_CUSTOM_${nowMs}`;
    const landmark = {
      id,
      name: cleanName,
      shortName: cleanName.slice(0, 18),
      district: cleanDistrict,
      category: cleanCategory,
      missionCategory: missionCategory === 'big' ? 'big' : 'mini',
      trailName: 'Custom Public Spots',
      sceneStyle: 'harbour',
      lat: zone.centerLat,
      lon: zone.centerLon,
      distanceMeters: 45,
      walkingLabel: formatWalkingDistanceLabel(45),
      missionPrompt: cleanPrompt,
      xpReward: 150,
      badge: `${cleanDistrict.slice(0, 12)} Custom Scout`,
      safePublicSpace: true,
      isCustom: true,
      zone,
    };
    return { ok: true, landmark };
  }

  function getCuratedLandmarks(customLandmarks = [], options = {}) {
    const anchorLat = Number.isFinite(Number(options.anchorLat)) ? Number(options.anchorLat) : 22.2938;
    const anchorLon = Number.isFinite(Number(options.anchorLon)) ? Number(options.anchorLon) : 114.1712;
    const includeMini = options.includeMini !== false;
    const liveOverpassPois = Array.isArray(options.overpassMiniMissions) ? options.overpassMiniMissions : [];

    const bigList = PUBLIC_LANDMARKS.map((lm) => {
      const dist = Math.round(haversineDistanceMeters(anchorLat, anchorLon, lm.lat, lm.lon));
      return {
        ...lm,
        missionCategory: 'big',
        distanceMeters: dist,
        walkingLabel: formatWalkingDistanceLabel(dist),
        zone: quantizeToPrivacyZone(lm.lat, lm.lon, 300),
      };
    });

    const baseMiniList = includeMini ? generateNearbyMiniMissions(anchorLat, anchorLon, 200) : [];
    const miniList = liveOverpassPois.length > 0 ? [...liveOverpassPois, ...baseMiniList].slice(0, 6) : baseMiniList;

    const extras = Array.isArray(customLandmarks)
      ? customLandmarks
          .filter((c) => c && c.id && c.name && c.safePublicSpace === true)
          .map((c) => {
            const cLat = Number(c.lat) || anchorLat;
            const cLon = Number(c.lon) || anchorLon;
            const dist = Math.round(haversineDistanceMeters(anchorLat, anchorLon, cLat, cLon));
            return {
              ...c,
              missionCategory: c.missionCategory || 'mini',
              isCustom: true,
              distanceMeters: dist,
              walkingLabel: formatWalkingDistanceLabel(dist),
              zone: c.zone || quantizeToPrivacyZone(cLat, cLon, 300),
            };
          })
      : [];
    return [...miniList, ...bigList, ...extras];
  }


  // POD2B-803: Quick-Filter "Unvisited Near Me (<=200m)" Chip Helper
  function filterUnvisitedNearbyMiniMissions(landmarks = [], completedIds = [], maxRadiusMeters = 200) {
    const cap = Math.min(200, Math.max(50, Number(maxRadiusMeters) || 200));
    const doneSet = new Set(Array.isArray(completedIds) ? completedIds : []);
    const list = Array.isArray(landmarks) ? landmarks : [];
    const unvisited = list.filter((lm) => {
      if (!lm) return false;
      const isLocalMini = lm.missionCategory === 'mini' || lm.isCustom === true;
      const dist = Number(lm.distanceMeters);
      const withinCap = !Number.isFinite(dist) || dist <= cap;
      return isLocalMini && withinCap && !doneSet.has(lm.id);
    });
    return {
      ok: true,
      unvisitedMiniMissions: unvisited,
      remainingCount: unvisited.length,
      allNearbyVisited: unvisited.length === 0,
      maxDistanceMeters: cap,
      chatPrivacyFloorMeters: 300,
    };
  }


  // POD2B-902: "Covered / Rain-Safe" Mini-Mission Filter (<=200m Public Arcades, Plazas & Sheltered Walkways)
  function filterCoveredRainSafeMiniMissions(landmarks = [], maxRadiusMeters = 200) {
    const cap = Math.min(200, Math.max(50, Number(maxRadiusMeters) || 200));
    const list = Array.isArray(landmarks) ? landmarks : [];
    const covered = list.filter((lm) => {
      if (!lm) return false;
      const isLocalMini = lm.missionCategory === 'mini' || lm.isCustom === true;
      const dist = Number(lm.distanceMeters);
      const withinCap = !Number.isFinite(dist) || dist <= cap;
      const isCovered =
        lm.coveredRainSafe === true ||
        /arcade|plaza|square|facade|transit|covered|shelter|gallery|atrium|cafe/i.test(
          `${lm.name || ''} ${lm.category || ''}`
        );
      return isLocalMini && withinCap && isCovered;
    });
    return {
      ok: true,
      coveredMiniMissions: covered,
      coveredCount: covered.length,
      maxDistanceMeters: cap,
      chatPrivacyFloorMeters: 300,
      publicSpaceOnly: true,
    };
  }

  function filterLandmarksByCategory(landmarks = [], categoryFilter = 'mini', completedIds = []) {
    const mode = String(categoryFilter || 'mini').toLowerCase();
    if (mode === 'all') return landmarks;
    if (mode === 'big') return landmarks.filter((lm) => lm.missionCategory === 'big');
    if (mode === 'covered_mini') {
      const res = filterCoveredRainSafeMiniMissions(landmarks, 200);
      return res.coveredMiniMissions.length > 0
        ? res.coveredMiniMissions
        : landmarks.filter((lm) => lm.missionCategory === 'mini' || lm.isCustom);
    }
    if (mode === 'unvisited_mini') {
      const res = filterUnvisitedNearbyMiniMissions(landmarks, completedIds, 200);
      return res.unvisitedMiniMissions.length > 0
        ? res.unvisitedMiniMissions
        : landmarks.filter((lm) => lm.missionCategory === 'mini' || lm.isCustom);
    }
    return landmarks.filter((lm) => lm.missionCategory === 'mini' || lm.isCustom);
  }

  function findNearestLandmark(lat, lon, customLandmarks = [], categoryFilter = 'all') {
    const all = getCuratedLandmarks(customLandmarks, { anchorLat: lat, anchorLon: lon });
    const list = filterLandmarksByCategory(all, categoryFilter);
    const pool = list.length > 0 ? list : all;
    let best = pool[0];
    let bestDist = Infinity;
    pool.forEach((lm) => {
      const d = haversineDistanceMeters(lat, lon, lm.lat, lm.lon);
      if (d < bestDist) {
        bestDist = d;
        best = lm;
      }
    });
    return { landmark: best, distanceMeters: Math.round(bestDist) };
  }

  function validatePublicLandmark(landmarkId, customLandmarks = []) {
    const all = getCuratedLandmarks(customLandmarks);
    const found = all.find((lm) => lm.id === landmarkId);
    return Boolean(found && found.safePublicSpace === true);
  }


  // POD2B-602: Shareable Custom Walking Trail (#trail=) URL-Hash Encoder & Sanitizer
  function sanitizeTrailText(rawStr, maxLen = 42) {
    return String(rawStr || '')
      .replace(/<[^>]*>/g, '')
      .replace(/[<>]/g, '')
      .replace(/script/gi, '')
      .trim()
      .slice(0, maxLen);
  }

  function computeTrailSignatureHex(title, stopIds = []) {
    const seed = `${String(title || '').toUpperCase()}|${(Array.isArray(stopIds) ? stopIds : []).join(',')}`;
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return (h >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 6);
  }

  function toBase64UrlSafe(utf8Str) {
    return encodeURIComponent(String(utf8Str || ''))
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29');
  }

  function fromBase64UrlSafe(tokenStr) {
    return decodeURIComponent(String(tokenStr || ''));
  }

  function encodeCustomWalkingTrail({
    title = 'Harbour & Pocket Park 3-Stop Walk',
    stopIds = [],
    creatorNickname = 'Explorer',
    confirmedPublicSafe = true,
  } = {}) {
    if (confirmedPublicSafe === false) {
      return { ok: false, reason: 'PUBLIC_SPACE_CONFIRMATION_REQUIRED' };
    }
    const rawTitle = String(title || '').trim();
    const rawCreator = String(creatorNickname || 'Explorer').trim();
    if (
      UNSAFE_SPOT_REGEX.test(rawTitle) ||
      PHONE_OR_PII_REGEX.test(rawTitle) ||
      UNSAFE_SPOT_REGEX.test(rawCreator) ||
      PHONE_OR_PII_REGEX.test(rawCreator)
    ) {
      return { ok: false, reason: 'SAFETY_POLICY_VIOLATION', zeroPii: true };
    }
    const cleanTitle = sanitizeTrailText(rawTitle, 42) || 'Local 200m Public Trail';
    const cleanCreator = sanitizeTrailText(rawCreator, 18) || 'Explorer';
    const validStops = [];
    const rawList = Array.isArray(stopIds) ? stopIds : [];
    for (let i = 0; i < rawList.length; i++) {
      const sid = String(rawList[i] || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 36);
      if (sid.length >= 3 && !validStops.includes(sid)) {
        validStops.push(sid);
      }
    }
    if (validStops.length < 3 || validStops.length > 5) {
      return {
        ok: false,
        reason: 'TRAIL_MUST_HAVE_3_TO_5_STOPS',
        stopCount: validStops.length,
      };
    }
    const sig = computeTrailSignatureHex(cleanTitle, validStops);
    const payloadObj = {
      t: cleanTitle,
      s: validStops,
      c: cleanCreator,
      g: sig,
    };
    const token = toBase64UrlSafe(JSON.stringify(payloadObj));
    return {
      ok: true,
      hash: `#trail=${token}`,
      token,
      trail: {
        title: cleanTitle,
        stopIds: validStops,
        creatorNickname: cleanCreator,
        signature: sig,
        stopCount: validStops.length,
        confirmedPublicSafe: true,
        zeroPii: true,
      },
    };
  }

  function decodeCustomWalkingTrail(hashOrToken = '') {
    const rawInput = String(hashOrToken || '').trim();
    if (!rawInput) {
      return { ok: false, reason: 'EMPTY_TRAIL_HASH' };
    }
    const idx = rawInput.indexOf('#trail=');
    const token = idx >= 0
      ? rawInput.slice(idx + 7).split('&')[0].trim()
      : rawInput.replace(/^trail=/i, '').trim();
    if (!token) {
      return { ok: false, reason: 'EMPTY_TRAIL_TOKEN' };
    }
    try {
      const jsonStr = fromBase64UrlSafe(token);
      const parsed = JSON.parse(jsonStr);
      if (!parsed || typeof parsed !== 'object') {
        return { ok: false, reason: 'INVALID_TRAIL_PAYLOAD' };
      }
      const rawTitle = String(parsed.t || '');
      const rawCreator = String(parsed.c || 'Explorer');
      if (
        UNSAFE_SPOT_REGEX.test(rawTitle) ||
        PHONE_OR_PII_REGEX.test(rawTitle) ||
        UNSAFE_SPOT_REGEX.test(rawCreator) ||
        PHONE_OR_PII_REGEX.test(rawCreator)
      ) {
        return { ok: false, reason: 'SAFETY_POLICY_VIOLATION', zeroPii: true };
      }
      const cleanTitle = sanitizeTrailText(rawTitle, 42);
      const cleanCreator = sanitizeTrailText(rawCreator, 18) || 'Explorer';
      if (!cleanTitle) {
        return { ok: false, reason: 'EMPTY_TRAIL_TITLE' };
      }
      const rawStops = Array.isArray(parsed.s) ? parsed.s : [];
      const validStops = [];
      for (let i = 0; i < rawStops.length; i++) {
        const sid = String(rawStops[i] || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 36);
        if (sid.length >= 3 && !validStops.includes(sid)) {
          validStops.push(sid);
        }
      }
      if (validStops.length < 3 || validStops.length > 5) {
        return { ok: false, reason: 'TRAIL_MUST_HAVE_3_TO_5_STOPS', stopCount: validStops.length };
      }
      const expectedSig = computeTrailSignatureHex(cleanTitle, validStops);
      const providedSig = String(parsed.g || '').toUpperCase();
      if (providedSig !== expectedSig) {
        return {
          ok: false,
          reason: 'INVALID_TRAIL_SIGNATURE',
          expectedSignature: expectedSig,
        };
      }
      return {
        ok: true,
        trail: {
          title: cleanTitle,
          stopIds: validStops,
          creatorNickname: cleanCreator,
          signature: expectedSig,
          stopCount: validStops.length,
          confirmedPublicSafe: true,
          zeroPii: true,
        },
      };
    } catch (_err) {
      return { ok: false, reason: 'MALFORMED_TRAIL_HASH' };
    }
  }


  // POD2B-701: Local Device Clock Golden-Hour Evaluator (+50% Bonus XP & Sunburst AR Stamp)
  function evaluateLocalGoldenHour(dateOrHour = new Date(), forcePreview = false) {
    let localHour = 12;
    if (typeof dateOrHour === 'number' && Number.isFinite(dateOrHour)) {
      localHour = Math.floor(dateOrHour) % 24;
    } else if (dateOrHour instanceof Date && !Number.isNaN(dateOrHour.getTime())) {
      localHour = dateOrHour.getHours();
    } else if (typeof dateOrHour === 'string' && dateOrHour.trim()) {
      const parsed = new Date(dateOrHour);
      if (!Number.isNaN(parsed.getTime())) {
        localHour = parsed.getHours();
      }
    }
    const isMorningGolden = localHour >= 6 && localHour < 9;
    const isEveningGolden = localHour >= 16 && localHour < 19;
    const isGoldenHour = Boolean(forcePreview || isMorningGolden || isEveningGolden);
    const windowLabel = isMorningGolden
      ? 'Morning Golden Hour (06:00–08:59 Local)'
      : isEveningGolden
      ? 'Evening Golden Hour (16:00–18:59 Local)'
      : forcePreview
      ? 'Golden Hour Sunburst Preview Active (1.5x XP)'
      : 'Standard Local Window (Golden Hour: 06:00–08:59 & 16:00–18:59)';
    return {
      ok: true,
      localHour,
      isGoldenHour,
      isPreview: Boolean(forcePreview && !isMorningGolden && !isEveningGolden),
      xpMultiplier: isGoldenHour ? 1.5 : 1.0,
      bonusPercent: isGoldenHour ? 50 : 0,
      windowLabel,
      stampLabel: isGoldenHour ? '🌅 GOLDEN HOUR SUNBURST (+50% XP)' : 'Standard AR Frame (1.0x XP)',
      zeroPii: true,
    };
  }


  // POD2B-1103: Step 1 Quick-Mood Mission Filter (Chill Walk / Photo Art / Night Neon within <=200m)
  function filterMiniMissionsByMood(landmarks = [], moodKey = 'all', maxRadiusMeters = 200) {
    const cap = Math.min(200, Math.max(50, Number(maxRadiusMeters) || 200));
    const targetMood = String(moodKey || 'all').toLowerCase();
    const list = Array.isArray(landmarks) ? landmarks : [];
    const matched = list.filter((lm) => {
      if (!lm) return false;
      const dist = Number(lm.distanceMeters);
      const isLocalMini = lm.missionCategory === 'mini' || lm.isCustom === true;
      if (isLocalMini && Number.isFinite(dist) && dist > cap) return false;
      if (targetMood === 'all') return true;
      if (lm.moodKey) return lm.moodKey === targetMood;
      const text = `${lm.name || ''} ${lm.category || ''} ${lm.sceneStyle || ''}`.toLowerCase();
      if (targetMood === 'chill_walk') return /park|green|cafe|bench|garden|walk/.test(text);
      if (targetMood === 'photo_art') return /mural|art|facade|arch|gallery|sculpture/.test(text);
      if (targetMood === 'night_neon') return /neon|harbour|transit|square|night|cyber/.test(text);
      return true;
    });
    return {
      ok: true,
      moodKey: targetMood,
      filteredMissions: matched.length > 0 ? matched : list,
      matchCount: matched.length,
      maxDistanceMeters: cap,
      chatPrivacyFloorMeters: 300,
    };
  }

  global.SpotGeoPrivacy = Object.freeze({
    filterMiniMissionsByMood,
    filterCoveredRainSafeMiniMissions,
    filterUnvisitedNearbyMiniMissions,
    evaluateLocalGoldenHour,
    sanitizeTrailText,
    computeTrailSignatureHex,
    encodeCustomWalkingTrail,
    decodeCustomWalkingTrail,
    OVERPASS_ENDPOINT,
    haversineDistanceMeters,
    formatWalkingDistanceLabel,
    quantizeToPrivacyZone,
    generateNearbyMiniMissions,
    buildOverpassPublicPoiQuery,
    parseOverpassPublicPoiResponse,
    fetchNearbyOverpassMiniMissions,
    computeBigMissionTrailProgress,
    evaluateSpeedLockSafety,
    createCustomPublicLandmark,
    getCuratedLandmarks,
    filterLandmarksByCategory,
    findNearestLandmark,
    validatePublicLandmark,
  });
})(typeof window !== 'undefined' ? window : globalThis);
