// Version: 1.2.0 | Last Modified: 2026-11-23 11:08 HKT | Build: 20261123_1108
// Module: js/arViewfinder.js — Live Camera / Upload / Custom Scene AR Viewfinder, Tappable Stickers, Zero-EXIF SpotCard & Explorer Passport PNG Exporter (Aria Vance-Sato 14 & Elena Park 16)
(function (global) {
  'use strict';

  const AR_FRAME_THEMES = Object.freeze({
    neon_polaroid: { label: 'Neon Cyan', border: '#38bdf8', accent: '#f472b6', bg: '#0b1120' },
    harbour_gold: { label: 'Harbour Gold', border: '#facc15', accent: '#38bdf8', bg: '#131626' },
    emerald_radar: { label: 'Emerald Glow', border: '#4ade80', accent: '#38bdf8', bg: '#071a15' },
  });

  const AR_STICKERS = Object.freeze({
    compass: { label: '🧭 Neon Compass', title: 'SPOTQUEST', sub: 'AR COMPASS', color: '#38bdf8' },
    cyber: { label: '⚡ Cyber Stamp', title: 'VERIFIED', sub: 'NEON HUNTER', color: '#f472b6' },
    sunset: { label: '🌆 Harbour Glow', title: 'GOLDEN HR', sub: 'HK EXPLORER', color: '#facc15' },
    mascot: { label: '🐾 Mascot Pin', title: 'FOUND IT!', sub: 'CREW CHECK-IN', color: '#4ade80' },
  });

  function drawSceneBackdrop(ctx, x, y, w, h, sceneStyle, theme) {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    if (sceneStyle === 'mural') {
      grad.addColorStop(0, '#3b0764'); grad.addColorStop(0.55, '#be185d'); grad.addColorStop(1, '#0f172a');
    } else if (sceneStyle === 'park') {
      grad.addColorStop(0, '#064e3b'); grad.addColorStop(0.55, '#0f766e'); grad.addColorStop(1, '#052e16');
    } else if (sceneStyle === 'artpark') {
      grad.addColorStop(0, '#1e1b4b'); grad.addColorStop(0.5, '#c2410c'); grad.addColorStop(1, '#0f172a');
    } else if (sceneStyle === 'pier') {
      grad.addColorStop(0, '#0c4a6e'); grad.addColorStop(0.55, '#0284c7'); grad.addColorStop(1, '#082f49');
    } else {
      grad.addColorStop(0, '#0f172a'); grad.addColorStop(0.5, '#312e81'); grad.addColorStop(1, '#090d16');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = 'rgba(7, 11, 20, 0.72)';
    const bars = [0.18, 0.34, 0.25, 0.45, 0.30, 0.52, 0.36, 0.22, 0.40, 0.28];
    const bw = w / bars.length;
    bars.forEach((bh, i) => {
      const rectH = h * bh;
      ctx.fillRect(x + i * bw + 3, y + h - rectH, bw - 6, rectH);
    });

    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.78);
    ctx.lineTo(x + w, y + h * 0.78);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x + w * 0.26, y + h * 0.28, 34, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.28)';
    ctx.fill();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawArSticker(ctx, vpX, vpY, vpW, vpH, stickerKey, stickerPos) {
    const st = AR_STICKERS[stickerKey] || AR_STICKERS.compass;
    const px = vpX + Math.min(0.84, Math.max(0.16, stickerPos ? stickerPos.x : 0.76)) * vpW;
    const py = vpY + Math.min(0.76, Math.max(0.18, stickerPos ? stickerPos.y : 0.24)) * vpH;

    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, 44, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(7, 11, 20, 0.82)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = st.color;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(px, py, 36, 0, Math.PI * 2);
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.textAlign = 'center';
    ctx.fillStyle = st.color;
    ctx.font = '800 11px JetBrains Mono, monospace';
    ctx.fillText(st.title, px, py - 2);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 9px Inter, sans-serif';
    ctx.fillText(st.sub, px, py + 13);
    ctx.restore();
  }

  function renderSpotCardCanvas({
    canvas,
    landmark,
    frameThemeKey = 'neon_polaroid',
    stickerKey = 'compass',
    stickerPos = { x: 0.76, y: 0.24 },
    explorerNickname = 'Explorer',
    sourceMedia = null,
    timestampStr = '2026-11-23 11:08 HKT',
  }) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      return { ok: false, reason: 'NO_CANVAS_CONTEXT' };
    }
    const theme = AR_FRAME_THEMES[frameThemeKey] || AR_FRAME_THEMES.neon_polaroid;
    const ctx = canvas.getContext('2d');
    const w = canvas.width || 540;
    const h = canvas.height || 640;

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    const vpX = 26, vpY = 26, vpW = w - 52, vpH = Math.round(h * 0.66);
    ctx.fillStyle = '#090e1a';
    ctx.fillRect(vpX, vpY, vpW, vpH);

    if (sourceMedia && typeof ctx.drawImage === 'function') {
      try {
        ctx.drawImage(sourceMedia, vpX, vpY, vpW, vpH);
      } catch (_err) {
        drawSceneBackdrop(ctx, vpX, vpY, vpW, vpH, landmark ? landmark.sceneStyle : 'harbour', theme);
      }
    } else {
      drawSceneBackdrop(ctx, vpX, vpY, vpW, vpH, landmark ? landmark.sceneStyle : 'harbour', theme);
    }

    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2.5;
    const c = 22;
    ctx.beginPath();
    ctx.moveTo(vpX + 12, vpY + 12 + c); ctx.lineTo(vpX + 12, vpY + 12); ctx.lineTo(vpX + 12 + c, vpY + 12);
    ctx.moveTo(vpX + vpW - 12, vpY + vpH - 12 - c); ctx.lineTo(vpX + vpW - 12, vpY + vpH - 12); ctx.lineTo(vpX + vpW - 12 - c, vpY + vpH - 12);
    ctx.stroke();

    drawArSticker(ctx, vpX, vpY, vpW, vpH, stickerKey, stickerPos);

    ctx.fillStyle = 'rgba(7, 11, 20, 0.80)';
    ctx.fillRect(vpX + 12, vpY + vpH - 38, vpW - 24, 28);
    ctx.textAlign = 'left';
    ctx.font = '700 11px JetBrains Mono, monospace';
    ctx.fillStyle = '#4ade80';
    ctx.fillText('EXIF & EXACT GPS STRIPPED • TAP PHOTO TO MOVE AR STICKER', vpX + 20, vpY + vpH - 20);

    const footY = vpY + vpH + 30;
    ctx.font = '800 20px Inter, sans-serif';
    ctx.fillStyle = '#f8fafc';
    const lmName = landmark ? landmark.name : 'Victoria Harbour Promenade';
    ctx.fillText(lmName.slice(0, 32), vpX, footY);

    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillStyle = theme.border;
    const district = landmark ? landmark.district : 'Tsim Sha Tsui';
    const zoneId = landmark && landmark.zone ? landmark.zone.zoneId : 'ZONE_300M';
    ctx.fillText(`${district} • ~300m Privacy Zone (${zoneId})`, vpX, footY + 24);

    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    const badge = landmark ? landmark.badge : 'Harbour Sunset Crew';
    ctx.fillText(`Explorer: ${String(explorerNickname).slice(0, 20)}  •  Badge: ${badge}`, vpX, footY + 48);

    ctx.font = '700 12px JetBrains Mono, monospace';
    ctx.fillStyle = theme.accent;
    ctx.fillText(`SpotQuest by NetHustle  •  ${timestampStr}`, vpX, footY + 74);

    return { ok: true, exifStripped: true, zoneId, frameTheme: frameThemeKey, stickerKey };
  }

  function renderExplorerPassportCanvas({
    canvas,
    landmarks = [],
    completedIds = [],
    explorerNickname = 'Explorer',
    totalXp = 0,
  }) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      return { ok: false, reason: 'NO_CANVAS_CONTEXT' };
    }
    const ctx = canvas.getContext('2d');
    const w = canvas.width || 680;
    const h = canvas.height || 440;

    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    ctx.textAlign = 'left';
    ctx.font = '800 22px Inter, sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(`SPOTQUEST EXPLORER PASSPORT — ${String(explorerNickname).slice(0, 18)}`, 28, 46);

    ctx.font = '700 13px JetBrains Mono, monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`Stamps Collected: ${completedIds.length}/${landmarks.length}  •  Total XP: ${totalXp}  •  Zero-EXIF Verified`, 28, 70);

    // 3x2 grid of district stamp slots
    const cols = 3;
    const cardW = Math.floor((w - 76) / cols);
    const cardH = 140;
    landmarks.slice(0, 6).forEach((lm, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = 28 + col * (cardW + 10);
      const y = 92 + row * (cardH + 14);
      const unlocked = completedIds.includes(lm.id);

      ctx.fillStyle = unlocked ? 'rgba(74, 222, 128, 0.14)' : 'rgba(30, 41, 59, 0.7)';
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeStyle = unlocked ? '#4ade80' : '#334155';
      ctx.lineWidth = unlocked ? 2.5 : 1.5;
      ctx.strokeRect(x, y, cardW, cardH);

      ctx.font = '800 13px Inter, sans-serif';
      ctx.fillStyle = unlocked ? '#4ade80' : '#94a3b8';
      ctx.fillText(unlocked ? '✓ STAMPED' : '○ UNVISITED', x + 12, y + 26);

      ctx.font = '700 14px Inter, sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText((lm.shortName || lm.name).slice(0, 18), x + 12, y + 54);

      ctx.font = '600 11px Inter, sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(lm.district, x + 12, y + 76);

      ctx.font = '700 11px JetBrains Mono, monospace';
      ctx.fillStyle = unlocked ? '#facc15' : '#64748b';
      ctx.fillText(lm.badge.slice(0, 20), x + 12, y + 104);
    });

    ctx.font = '700 12px JetBrains Mono, monospace';
    ctx.fillStyle = '#f472b6';
    ctx.fillText('SpotQuest by NetHustle • Make money, Legally, NEVER HARM ANY HUMAN', 28, h - 22);

    return { ok: true, stampsCount: completedIds.length, totalLandmarks: landmarks.length };
  }

  function exportSpotCardDataUrl(canvas) {
    if (!canvas || typeof canvas.toDataURL !== 'function') return '';
    return canvas.toDataURL('image/png');
  }

  global.SpotArViewfinder = Object.freeze({
    AR_FRAME_THEMES,
    AR_STICKERS,
    renderSpotCardCanvas,
    renderExplorerPassportCanvas,
    exportSpotCardDataUrl,
  });
})(typeof window !== 'undefined' ? window : globalThis);
