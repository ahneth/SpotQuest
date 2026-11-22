// Version: 1.1.0 | Last Modified: 2026-11-23 01:15 HKT | Build: 20261123_0115
// Module: js/mapRadar.js — Clickable Interactive Neighborhood Map & 300m Privacy Radar (Kai Lindqvist 17)
(function (global) {
  'use strict';
  let lastHitRegions = [];

  function projectCoordsToCanvas(lat, lon, width, height) {
    const minLat = 22.272, maxLat = 22.394;
    const minLon = 114.142, maxLon = 114.285;
    const normX = (lon - minLon) / (maxLon - minLon);
    const normY = 1 - (lat - minLat) / (maxLat - minLat);
    const padX = 56, padY = 48;
    return {
      x: Math.round(padX + Math.min(1, Math.max(0, normX)) * (width - padX * 2)),
      y: Math.round(padY + Math.min(1, Math.max(0, normY)) * (height - padY * 2)),
    };
  }

  function renderNeighborhoodRadar(canvas, landmarks, selectedLandmarkId, completedIds = []) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      return { ok: false, hitRegions: [] };
    }
    const ctx = canvas.getContext('2d');
    const w = canvas.width || 680;
    const h = canvas.height || 320;

    // Deep harbour night gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#071124');
    bgGrad.addColorStop(1, '#040812');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle map grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.11)';
    ctx.lineWidth = 1;
    for (let x = 44; x < w; x += 44) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 44; y < h; y += 44) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Stylized harbour water channel & islands
    ctx.fillStyle = 'rgba(14, 165, 233, 0.12)';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.66);
    ctx.bezierCurveTo(w * 0.28, h * 0.50, w * 0.60, h * 0.78, w, h * 0.44);
    ctx.lineTo(w, h * 0.62);
    ctx.bezierCurveTo(w * 0.62, h * 0.92, w * 0.30, h * 0.66, 0, h * 0.80);
    ctx.closePath();
    ctx.fill();

    // Connecting dotted explorer trail between pins
    const pts = landmarks.map((lm) => ({
      lm,
      pt: projectCoordsToCanvas(lm.zone.centerLat, lm.zone.centerLon, w, h),
    }));
    ctx.save();
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1.5;
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

      // Outer 300m fuzzy zone ring
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isSelected ? 32 : 21, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.24)' : 'rgba(244, 114, 182, 0.14)';
      ctx.fill();
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.strokeStyle = color;
      ctx.stroke();

      // Inner pin dot
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isSelected ? 9 : 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      if (isCompleted) {
        ctx.fillStyle = '#052e16';
        ctx.font = '800 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✓', pt.x, pt.y + 3.5);
      }

      // Label pill above pin
      const label = lm.shortName || lm.name;
      ctx.font = isSelected ? '800 12px Inter, sans-serif' : '600 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      const tw = ctx.measureText ? ctx.measureText(label).width : label.length * 7;
      const pillW = tw + 14;
      const pillX = Math.min(w - pillW / 2 - 6, Math.max(pillW / 2 + 6, pt.x));
      const pillY = Math.max(24, pt.y - (isSelected ? 40 : 30));

      ctx.fillStyle = isSelected ? '#0284c7' : 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(pillX - pillW / 2, pillY - 12, pillW, 18);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(pillX - pillW / 2, pillY - 12, pillW, 18);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(label, pillX, pillY + 1);

      hitRegions.push({ id: lm.id, x: pt.x, y: pt.y, radius: 36 });
    });

    ctx.textAlign = 'left';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Tap any glowing pin on the map to pick your spot • 300m Privacy Mask Active', 12, h - 12);

    lastHitRegions = hitRegions;
    return { ok: true, hitRegions };
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
    projectCoordsToCanvas,
    renderNeighborhoodRadar,
    findLandmarkAtPoint,
    getLastHitRegions,
  });
})(typeof window !== 'undefined' ? window : globalThis);
