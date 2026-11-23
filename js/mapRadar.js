// Version: 1.2.0 | Last Modified: 2026-11-23 11:08 HKT | Build: 20261123_1108
// Module: js/mapRadar.js — Real Interactive OpenStreetMap Slippy Tile Map (Pan/Zoom/Web Mercator) + Offline Vector Fallback (Ronan Sterling-Kwan 15 & Kai Lindqvist 17)
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
    const centerLat = viewState && viewState.centerLat ? viewState.centerLat : 22.312;
    const centerLon = viewState && viewState.centerLon ? viewState.centerLon : 114.185;
    const zoom = viewState && viewState.zoom ? viewState.zoom : 12;

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
      centerLat: Number(Math.min(22.55, Math.max(22.15, tileYToLat(cy, zoom))).toFixed(5)),
      centerLon: Number(Math.min(114.45, Math.max(113.85, tileXToLon(cx, zoom))).toFixed(5)),
    };
  }

  function drawOsmSlippyTiles(ctx, width, height, centerLat, centerLon, zoom, onTileLoaded) {
    const z = Math.min(17, Math.max(10, Math.round(zoom)));
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
    const centerLat = mapOptions.centerLat || 22.305;
    const centerLon = mapOptions.centerLon || 114.175;
    const zoom = mapOptions.zoom || 12;
    const tileMode = mapOptions.tileMode || 'osm_streets';
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
        // Slight dark tint so high-contrast neon 300m privacy zones pop clearly over OSM streets
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

    // 3. Project & Render Curated Public Landmarks + 300m Fuzzy Privacy Zones
    const pts = landmarks.map((lm) => ({
      lm,
      pt: projectCoordsToCanvas(lm.zone.centerLat, lm.zone.centerLon, w, h, viewState),
    }));

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
      const color = isCompleted ? '#4ade80' : isSelected ? '#38bdf8' : '#f472b6';

      // 300m Coarse Fuzzy-Zone Privacy Ring
      const ringRadius = isSelected ? 36 : 24;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, ringRadius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.28)' : 'rgba(15, 23, 42, 0.55)';
      ctx.fill();
      ctx.lineWidth = isSelected ? 3.5 : 2;
      ctx.strokeStyle = color;
      ctx.stroke();

      // Inner Landmark Beacon
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isSelected ? 10 : 7, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Label Pill
      const label = `${isCompleted ? '✓ ' : ''}${lm.shortName || lm.name}`;
      ctx.font = isSelected ? '800 13px Inter, sans-serif' : '700 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      const tw = ctx.measureText ? ctx.measureText(label).width : label.length * 7;
      const pillW = tw + 16;
      const pillX = Math.min(w - pillW / 2 - 8, Math.max(pillW / 2 + 8, pt.x));
      const pillY = Math.max(26, pt.y - (isSelected ? 44 : 32));

      ctx.fillStyle = isSelected ? '#0284c7' : 'rgba(15, 23, 42, 0.92)';
      ctx.fillRect(pillX - pillW / 2, pillY - 13, pillW, 20);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pillX - pillW / 2, pillY - 13, pillW, 20);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(label, pillX, pillY + 1);

      hitRegions.push({ id: lm.id, x: pt.x, y: pt.y, radius: 40 });
    });

    // Top-left Live Map Status HUD
    ctx.fillStyle = 'rgba(7, 11, 20, 0.84)';
    ctx.fillRect(10, 10, 420, 26);
    ctx.textAlign = 'left';
    ctx.font = '700 11px JetBrains Mono, monospace';
    ctx.fillStyle = '#4ade80';
    const modeLabel = tileMode === 'osm_streets' ? `OSM STREET TILES (Z${zoom})` : `OFFLINE VECTOR GRID (Z${zoom})`;
    ctx.fillText(`${modeLabel} • DRAG TO PAN • 300M FUZZY ZONE • 0 FAKE DOTS`, 18, 27);

    lastHitRegions = hitRegions;
    return { ok: true, hitRegions, osmTilesRendered, zoom };
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
