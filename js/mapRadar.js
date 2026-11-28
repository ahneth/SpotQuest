// Version: 2.1.0 | Last Modified: 2026-11-28 11:36 HKT | Build: 20261128_1136
// Module: js/mapRadar.js — Real Interactive OpenStreetMap Slippy Tile Map (Pan/Zoom/Web Mercator) + 200m Walking Mini-Mission Ring & Live Overpass POI Pins + Offline Vector Fallback (Ronan Sterling-Kwan 15 & Kai Lindqvist 17)
(function (global) {
  'use strict';
  let lastHitRegions = [];
  const tileCache = new Map();

  function lonToTileX(lon, zoom) {
    return ((Number(lon) + 180) / 360) * Math.pow(2, zoom);
  }

  function latToTileY(lat, zoom) {
    const rad = (Number(lat) * Math.PI) / 180;
    return (
      ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
      Math.pow(2, zoom)
    );
  }

  function tileXToLon(tileX, zoom) {
    return (tileX / Math.pow(2, zoom)) * 360 - 180;
  }

  function tileYToLat(tileY, zoom) {
    const n = Math.PI - (2 * Math.PI * tileY) / Math.pow(2, zoom);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }

  function projectCoordsToCanvas(lat, lon, width, height, viewState = null) {
    const centerLat = viewState && viewState.centerLat ? viewState.centerLat : 22.2938;
    const centerLon = viewState && viewState.centerLon ? viewState.centerLon : 114.1712;
    const zoom = viewState && viewState.zoom ? viewState.zoom : 16;

    const centerPxX = lonToTileX(centerLon, zoom) * 256;
    const centerPxY = latToTileY(centerLat, zoom) * 256;
    const ptPxX = lonToTileX(lon, zoom) * 256;
    const ptPxY = latToTileY(lat, zoom) * 256;

    return {
      x: Math.round(width / 2 + (ptPxX - centerPxX)),
      y: Math.round(height / 2 + (ptPxY - centerPxY)),
    };
  }

  function panCenterByPixels(centerLat, centerLon, zoom, dxPx, dyPx) {
    const cx = lonToTileX(centerLon, zoom) - dxPx / 256;
    const cy = latToTileY(centerLat, zoom) - dyPx / 256;
    return {
      centerLat: Number(Math.min(85, Math.max(-85, tileYToLat(cy, zoom))).toFixed(5)),
      centerLon: Number(Math.min(180, Math.max(-180, tileXToLon(cx, zoom))).toFixed(5)),
    };
  }

  function drawOsmSlippyTiles(ctx, width, height, centerLat, centerLon, zoom, onTileLoaded) {
    const z = Math.min(18, Math.max(10, Math.round(zoom)));
    const centerTileX = lonToTileX(centerLon, z);
    const centerTileY = latToTileY(centerLat, z);
    const startTileX = Math.floor(centerTileX - width / 512) - 1;
    const endTileX = Math.ceil(centerTileX + width / 512) + 1;
    const startTileY = Math.floor(centerTileY - height / 512) - 1;
    const endTileY = Math.ceil(centerTileY + height / 512) + 1;
    const maxTile = Math.pow(2, z);
    let tilesDrawn = 0;

    for (let tx = startTileX; tx <= endTileX; tx++) {
      for (let ty = startTileY; ty <= endTileY; ty++) {
        if (ty < 0 || ty >= maxTile) continue;
        const wrappedTx = ((tx % maxTile) + maxTile) % maxTile;
        const key = `${z}/${wrappedTx}/${ty}`;
        const drawX = Math.round(width / 2 + (tx - centerTileX) * 256);
        const drawY = Math.round(height / 2 + (ty - centerTileY) * 256);

        if (typeof Image !== 'undefined') {
          let entry = tileCache.get(key);
          if (!entry) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            entry = { img, loaded: false, error: false };
            tileCache.set(key, entry);
            img.onload = () => {
              entry.loaded = true;
              if (typeof onTileLoaded === 'function') onTileLoaded();
            };
            img.onerror = () => {
              entry.error = true;
            };
            img.src = `https://tile.openstreetmap.org/${key}.png`;
          }
          if (entry.loaded && typeof ctx.drawImage === 'function') {
            try {
              ctx.drawImage(entry.img, drawX, drawY, 256, 256);
              tilesDrawn++;
            } catch (_e) {}
          }
        }
      }
    }
    return tilesDrawn;
  }

  function renderNeighborhoodRadar(
    canvas,
    landmarks,
    selectedLandmarkId,
    completedIds = [],
    mapOptions = {}
  ) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      return { ok: false, hitRegions: [] };
    }
    const ctx = canvas.getContext('2d');
    const w = canvas.width || 860;
    const h = canvas.height || 520;
    const centerLat = mapOptions.centerLat || 22.2938;
    const centerLon = mapOptions.centerLon || 114.1712;
    const anchorLat = mapOptions.anchorLat || centerLat;
    const anchorLon = mapOptions.anchorLon || centerLon;
    const zoom = mapOptions.zoom || 16;
    const tileMode = mapOptions.tileMode || 'osm_streets';
    const categoryFilter = mapOptions.categoryFilter || 'mini';
    const viewState = { centerLat, centerLon, zoom };

    // 1. Base Harbour Night Vector Backdrop (Always instant & offline-safe)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#071226');
    bgGrad.addColorStop(1, '#040914');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle lat/lon coordinate grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 48; x < w; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 48; y < h; y += 48) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // 2. Real OpenStreetMap Slippy Tiles (when tileMode === 'osm_streets')
    let osmTilesRendered = 0;
    if (tileMode === 'osm_streets') {
      osmTilesRendered = drawOsmSlippyTiles(
        ctx,
        w,
        h,
        centerLat,
        centerLon,
        zoom,
        mapOptions.onTileLoaded
      );
      if (osmTilesRendered > 0) {
        ctx.fillStyle = 'rgba(7, 11, 20, 0.22)';
        ctx.fillRect(0, 0, w, h);
      }
    }

    // Stylized coastline vector overlay when offline or in vector mode
    if (osmTilesRendered === 0) {
      ctx.fillStyle = 'rgba(14, 165, 233, 0.14)';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.66);
      ctx.bezierCurveTo(w * 0.28, h * 0.50, w * 0.60, h * 0.78, w, h * 0.44);
      ctx.lineTo(w, h * 0.64);
      ctx.bezierCurveTo(w * 0.62, h * 0.92, w * 0.30, h * 0.66, 0, h * 0.80);
      ctx.closePath();
      ctx.fill();
    }

    // 3. Draw Player 200m Walking Mini-Mission Radius Ring (FD-P0-20261124-01)
    const anchorPt = projectCoordsToCanvas(anchorLat, anchorLon, w, h, viewState);
    const edgePt = projectCoordsToCanvas(anchorLat + 200 / 111320, anchorLon, w, h, viewState);
    const walkRadiusPx = Math.max(38, Math.min(240, Math.abs(anchorPt.y - edgePt.y)));

    ctx.save();
    ctx.beginPath();
    ctx.arc(anchorPt.x, anchorPt.y, walkRadiusPx, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(74, 222, 128, 0.08)';
    ctx.fill();
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.65)';
    ctx.stroke();
    ctx.restore();

    // Player Anchor Center Dot ("YOU · 200m Walk Zone")
    ctx.beginPath();
    ctx.arc(anchorPt.x, anchorPt.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // 4. Project & Render Landmarks
    const pts = landmarks.map((lm) => {
      const drawLat = lm.isMiniMission ? lm.lat : (lm.zone ? lm.zone.centerLat : lm.lat);
      const drawLon = lm.isMiniMission ? lm.lon : (lm.zone ? lm.zone.centerLon : lm.lon);
      return {
        lm,
        pt: projectCoordsToCanvas(drawLat, drawLon, w, h, viewState),
      };
    });

    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.38)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.pt.x, p.pt.y);
      else ctx.lineTo(p.pt.x, p.pt.y);
    });
    ctx.stroke();
    ctx.restore();

    const hitRegions = [];
    pts.forEach(({ lm, pt }) => {
      const isSelected = lm.id === selectedLandmarkId;
      const isCompleted = completedIds.includes(lm.id);
      const color = isCompleted
        ? '#4ade80'
        : isSelected
        ? '#38bdf8'
        : lm.missionCategory === 'mini'
        ? '#4ade80'
        : lm.isCustom
        ? '#facc15'
        : '#f472b6';

      const ringRadius = isSelected ? 34 : 22;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, ringRadius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.28)' : 'rgba(15, 23, 42, 0.55)';
      ctx.fill();
      ctx.lineWidth = isSelected ? 3.5 : 2;
      ctx.strokeStyle = color;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isSelected ? 10 : 7, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      const prefix = isCompleted ? '✓ ' : lm.missionCategory === 'mini' ? '🚶 ' : lm.isCustom ? '★ ' : '🗺️ ';
      const label = `${prefix}${lm.shortName || lm.name}`;
      ctx.font = isSelected ? '800 13px Inter, sans-serif' : '700 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      const tw = ctx.measureText ? ctx.measureText(label).width : label.length * 7;
      const pillW = tw + 16;
      const pillX = Math.min(w - pillW / 2 - 8, Math.max(pillW / 2 + 8, pt.x));
      const pillY = Math.max(26, pt.y - (isSelected ? 42 : 30));

      ctx.fillStyle = isSelected ? '#0284c7' : 'rgba(15, 23, 42, 0.92)';
      ctx.fillRect(pillX - pillW / 2, pillY - 13, pillW, 20);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pillX - pillW / 2, pillY - 13, pillW, 20);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(label, pillX, pillY + 1);

      hitRegions.push({ id: lm.id, x: pt.x, y: pt.y, radius: 42 });
    });

    // Top-left Live Map Status HUD
    ctx.fillStyle = 'rgba(7, 11, 20, 0.86)';
    ctx.fillRect(10, 10, 480, 26);
    ctx.textAlign = 'left';
    ctx.font = '700 11px JetBrains Mono, monospace';
    ctx.fillStyle = '#4ade80';
    const catLabel = categoryFilter === 'mini' ? 'WALKING MINI-MISSIONS (<=200M)' : categoryFilter === 'big' ? 'CITY-WIDE BIG MISSIONS' : 'ALL MISSIONS';
    ctx.fillText(`${catLabel} • Z${zoom} • ${landmarks.length} SPOTS • 300M CHAT PRIVACY`, 18, 27);

    lastHitRegions = hitRegions;
    return { ok: true, hitRegions, osmTilesRendered, zoom, walkRadiusPx };
  }

  function findLandmarkAtPoint(hitRegions, clickX, clickY) {
    const regions = Array.isArray(hitRegions) && hitRegions.length ? hitRegions : lastHitRegions;
    let closestId = null;
    let closestDistSq = Infinity;
    for (let i = 0; i < regions.length; i++) {
      const r = regions[i];
      const dx = clickX - r.x;
      const dy = clickY - r.y;
      const dSq = dx * dx + dy * dy;
      if (dSq <= r.radius * r.radius && dSq < closestDistSq) {
        closestDistSq = dSq;
        closestId = r.id;
      }
    }
    return closestId;
  }

  function getLastHitRegions() {
    return lastHitRegions;
  }

  global.SpotMapRadar = Object.freeze({
    lonToTileX,
    latToTileY,
    projectCoordsToCanvas,
    panCenterByPixels,
    renderNeighborhoodRadar,
    findLandmarkAtPoint,
    getLastHitRegions,
  });
})(typeof window !== 'undefined' ? window : globalThis);
