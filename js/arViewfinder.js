// Version: 2.1.0 | Last Modified: 2026-11-28 11:36 HKT | Build: 20261128_1136
// Module: js/arViewfinder.js — Live Camera / Upload / Custom Scene AR Viewfinder, Sticker & Color-Grade Filter Carousel (POD2B-402), First-to-Snap Daily Crown (POD2B-403), Neighborhood Explorer Rank & Weekly Recap Card Exporter (POD2B-502), Friend Code QR Badge & Explorer Passport PNG Exporter (Aria Vance-Sato 14 & Elena Park 16)
(function (global) {
  'use strict';

  const AR_FRAME_THEMES = Object.freeze({
    neon_polaroid: { label: 'Neon Cyan', border: '#38bdf8', accent: '#f472b6', bg: '#0b1120' },
    harbour_gold: { label: 'Harbour Gold', border: '#facc15', accent: '#38bdf8', bg: '#131626' },
    emerald_radar: { label: 'Emerald Glow', border: '#4ade80', accent: '#38bdf8', bg: '#071a15' },
    sunburst_golden: { label: '🌅 Golden Sunburst', border: '#f59e0b', accent: '#fde047', bg: '#1c1208' },
    rain_neon_arcade: { label: '☔ Rain-Day Arcade', border: '#38bdf8', accent: '#c084fc', bg: '#091526' },
  });

  const AR_STICKERS = Object.freeze({
    compass: { label: '🧭 Neon Compass', title: 'SPOTQUEST', sub: 'AR COMPASS', color: '#38bdf8' },
    cyber: { label: '⚡ Cyber Stamp', title: 'VERIFIED', sub: 'NEON HUNTER', color: '#f472b6' },
    sunset: { label: '🌆 Harbour Glow', title: 'GOLDEN HR', sub: 'HK EXPLORER', color: '#facc15' },
    mascot: { label: '🐾 Mascot Pin', title: 'FOUND IT!', sub: 'CREW CHECK-IN', color: '#4ade80' },
    sunburst: { label: '🌅 Sunburst Seal', title: 'GOLDEN HR', sub: '+50% BONUS XP', color: '#fde047' },
    rain_canopy: { label: '☔ Rain-Safe Seal', title: 'RAIN-SAFE', sub: 'COVERED <=200M', color: '#38bdf8' },
  });

  const AR_COLOR_FILTERS = Object.freeze({
    natural: { label: '🌈 Natural', overlay: null },
    cyber_glow: { label: '💜 Cyber Glow', overlay: 'rgba(236, 72, 153, 0.20)' },
    sunset_warm: { label: '🌅 Golden Hour', overlay: 'rgba(250, 204, 21, 0.20)' },
    emerald_matrix: { label: '💚 Emerald Matrix', overlay: 'rgba(16, 185, 129, 0.20)' },
  });


  // POD2B-601: "Snap & Greet" 1-Tap Dual-Explorer AR Icebreaker Stamp
  const SNAP_AND_GREET_PROMPTS = Object.freeze([
    '👋 Spotted this <=200m landmark too! Best snack or coffee corner nearby?',
    '📸 Dual-Explorer Stamp unlocked! Which 200m mini-mission are you tackling next?',
    '🌆 Harbour Neon Crew check-in! First time exploring this public plaza?',
  ]);

  const AR_SAFETY_BLOCK_REGEX = /(?:\+?852[-\s]?)?\b[2-9]\d{3}[-\s]?\d{4}\b|\b(?:\d{3}[-\s.]?\d{3}[-\s.]?\d{4})\b|\b(?:kill|suicide|self[\s-]?harm|doxx|stalk)\b/i;

  function createSnapAndGreetStamp({
    explorerNickname = 'Explorer',
    peerNickname = 'Nearby Scout',
    landmarkName = 'Pocket Park',
    promptIndex = 0,
  } = {}) {
    const rawExp = String(explorerNickname || 'Explorer').trim();
    const rawPeer = String(peerNickname || 'Nearby Scout').trim();
    const rawLm = String(landmarkName || 'Pocket Park').trim();
    if (
      AR_SAFETY_BLOCK_REGEX.test(rawExp) ||
      AR_SAFETY_BLOCK_REGEX.test(rawPeer) ||
      AR_SAFETY_BLOCK_REGEX.test(rawLm)
    ) {
      return { ok: false, reason: 'SAFETY_POLICY_VIOLATION', zeroPii: true };
    }
    const cleanExp = rawExp.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').slice(0, 16) || 'Explorer';
    const cleanPeer = rawPeer.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').slice(0, 16) || 'Nearby Scout';
    const cleanLm = rawLm.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').slice(0, 26) || 'Pocket Park';
    const idx = Math.abs(Number(promptIndex) || 0) % SNAP_AND_GREET_PROMPTS.length;
    const promptText = SNAP_AND_GREET_PROMPTS[idx];
    return {
      ok: true,
      stampTitle: `🤝 SNAP & GREET: ${cleanExp} × ${cleanPeer}`,
      promptText,
      promptIndex: idx,
      landmarkName: cleanLm,
      exifStripped: true,
      chatPrivacyFloorMeters: 300,
      zeroPii: true,
    };
  }

  function cycleArSticker(currentKey = 'compass', direction = 1) {
    const keys = Object.keys(AR_STICKERS);
    const idx = Math.max(0, keys.indexOf(currentKey));
    const nextIdx = (idx + (direction >= 0 ? 1 : -1) + keys.length) % keys.length;
    return keys[nextIdx];
  }

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
    colorFilterKey = 'natural',
    stickerPos = { x: 0.76, y: 0.24 },
    explorerNickname = 'Explorer',
    isFirstToSnapToday = false,
    snapAndGreetStamp = null,
    goldenHourStatus = null,
    mascotCoStarId = 'mochi',
    mascotArCoStarEnabled = true,
    sourceMedia = null,
    timestampStr = '2026-11-28 11:36 HKT',
  }) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      return { ok: false, reason: 'NO_CANVAS_CONTEXT' };
    }
    const theme = AR_FRAME_THEMES[frameThemeKey] || AR_FRAME_THEMES.neon_polaroid;
    const filterObj = AR_COLOR_FILTERS[colorFilterKey] || AR_COLOR_FILTERS.natural;
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

    if (filterObj && filterObj.overlay) {
      ctx.fillStyle = filterObj.overlay;
      ctx.fillRect(vpX, vpY, vpW, vpH);
    }

    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2.5;
    const c = 22;
    ctx.beginPath();
    ctx.moveTo(vpX + 12, vpY + 12 + c); ctx.lineTo(vpX + 12, vpY + 12); ctx.lineTo(vpX + 12 + c, vpY + 12);
    ctx.moveTo(vpX + vpW - 12, vpY + vpH - 12 - c); ctx.lineTo(vpX + vpW - 12, vpY + vpH - 12); ctx.lineTo(vpX + vpW - 12 - c, vpY + vpH - 12);
    ctx.stroke();

    drawArSticker(ctx, vpX, vpY, vpW, vpH, stickerKey, stickerPos);

    // POD2B-1101 & FD-P0-20261128-01: Render Prominent Cartoon Mascot AR Co-Star Overlay on Viewfinder & SpotCard
    if (mascotArCoStarEnabled && global.SpotMascots && typeof global.SpotMascots.drawMascotCanvasOverlay === 'function') {
      global.SpotMascots.drawMascotCanvasOverlay(ctx, mascotCoStarId || 'mochi', vpX + 58, vpY + vpH - 58, 86);
    }

    if (goldenHourStatus && goldenHourStatus.isGoldenHour) {
      const ghGrad = ctx.createRadialGradient(
        vpX + vpW * 0.78,
        vpY + vpH * 0.22,
        8,
        vpX + vpW * 0.78,
        vpY + vpH * 0.22,
        120
      );
      ghGrad.addColorStop(0, 'rgba(253, 224, 71, 0.38)');
      ghGrad.addColorStop(0.6, 'rgba(245, 158, 11, 0.16)');
      ghGrad.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
      ctx.fillStyle = ghGrad;
      ctx.fillRect(vpX, vpY, vpW, vpH);

      ctx.fillStyle = 'rgba(245, 158, 11, 0.94)';
      ctx.fillRect(vpX + vpW - 236, vpY + 14, 222, 26);
      ctx.textAlign = 'left';
      ctx.font = '800 11px JetBrains Mono, monospace';
      ctx.fillStyle = '#070b14';
      ctx.fillText('🌅 GOLDEN HOUR SUNBURST (+50% XP)', vpX + vpW - 228, vpY + 31);
    }

    if (isFirstToSnapToday) {
      ctx.fillStyle = 'rgba(250, 204, 21, 0.92)';
      ctx.fillRect(vpX + 14, vpY + 14, 210, 26);
      ctx.textAlign = 'left';
      ctx.font = '800 11px JetBrains Mono, monospace';
      ctx.fillStyle = '#070b14';
      ctx.fillText('👑 FIRST-TO-SNAP DAILY CROWN', vpX + 22, vpY + 31);
    }

    if (snapAndGreetStamp && snapAndGreetStamp.ok) {
      const sgY = isFirstToSnapToday ? vpY + 46 : vpY + 14;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
      ctx.fillRect(vpX + 14, sgY, vpW - 28, 44);
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 2;
      ctx.strokeRect(vpX + 14, sgY, vpW - 28, 44);
      ctx.textAlign = 'left';
      ctx.font = '800 11px JetBrains Mono, monospace';
      ctx.fillStyle = '#f472b6';
      ctx.fillText(String(snapAndGreetStamp.stampTitle || '🤝 SNAP & GREET STAMP').slice(0, 44), vpX + 22, sgY + 17);
      ctx.font = '600 10px Inter, sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(String(snapAndGreetStamp.promptText || '').slice(0, 56), vpX + 22, sgY + 35);
    }

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
    const walkTag = landmark && landmark.walkingLabel ? landmark.walkingLabel : '~55m · 1 min walk';
    const zoneId = landmark && landmark.zone ? landmark.zone.zoneId : 'ZONE_300M';
    ctx.fillText(`${walkTag} • ~300m Chat Privacy (${zoneId})`, vpX, footY + 24);

    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    const badge = landmark ? landmark.badge : 'Harbour Sunset Crew';
    ctx.fillText(`Explorer: ${String(explorerNickname).slice(0, 20)}  •  Badge: ${badge}`, vpX, footY + 48);

    ctx.font = '700 12px JetBrains Mono, monospace';
    ctx.fillStyle = theme.accent;
    ctx.fillText(`SpotQuest by NetHustle  •  ${timestampStr}`, vpX, footY + 74);

    return {
      ok: true,
      exifStripped: true,
      zoneId,
      frameTheme: frameThemeKey,
      stickerKey,
      colorFilterKey,
      isFirstToSnapToday,
      hasSnapAndGreetStamp: Boolean(snapAndGreetStamp && snapAndGreetStamp.ok),
      isGoldenHour: Boolean(goldenHourStatus && goldenHourStatus.isGoldenHour),
    };
  }

  function renderExplorerPassportCanvas({
    canvas,
    landmarks = [],
    completedIds = [],
    explorerNickname = 'Explorer',
    totalXp = 0,
    trailFinisherSeals = [],
    activeTrailProgress = null,
    walkingProgress = null,
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

    const sealCount = Array.isArray(trailFinisherSeals) ? trailFinisherSeals.length : 0;
    const sealBadge = sealCount > 0
      ? `🏅 Trail Finisher Seals: ${sealCount}`
      : activeTrailProgress && activeTrailProgress.hasActiveTrail
      ? `🥾 Trail: ${activeTrailProgress.completedCount}/${activeTrailProgress.totalCount}`
      : '🥾 #trail= Ready';
    const walkText = walkingProgress && typeof walkingProgress.totalMetersWalked === 'number'
      ? `${walkingProgress.walkingBadgeIcon || '🥾'} ${walkingProgress.totalMetersWalked}m (~${walkingProgress.estimatedSteps || 0} steps • ${walkingProgress.walkingBadgeTitle || 'Trailhead Starter'})`
      : '🥾 0m Walked • Trailhead Starter';
    ctx.font = '700 11.5px JetBrains Mono, monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`Stamps: ${completedIds.length}/${landmarks.length} • XP: ${totalXp} • ${walkText} • ${sealBadge}`, 28, 70);

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
      ctx.fillText(lm.walkingLabel || lm.district, x + 12, y + 76);

      ctx.font = '700 11px JetBrains Mono, monospace';
      ctx.fillStyle = unlocked ? '#facc15' : '#64748b';
      ctx.fillText(lm.badge.slice(0, 20), x + 12, y + 104);
    });

    ctx.font = '700 12px JetBrains Mono, monospace';
    ctx.fillStyle = '#f472b6';
    ctx.fillText('SpotQuest by NetHustle • Make money, Legally, NEVER HARM ANY HUMAN', 28, h - 22);

    return {
      ok: true,
      stampsCount: completedIds.length,
      totalLandmarks: landmarks.length,
      trailFinisherSealsCount: Array.isArray(trailFinisherSeals) ? trailFinisherSeals.length : 0,
    };
  }

  // POD2B-502: Shareable Neighborhood Explorer Rank & Weekly Recap Card Canvas Renderer
  function renderExplorerRecapCardCanvas({
    canvas,
    recap = {},
    timestampStr = '2026-11-28 11:36 HKT',
  }) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      return { ok: false, reason: 'NO_CANVAS_CONTEXT' };
    }
    const ctx = canvas.getContext('2d');
    const w = canvas.width || 680;
    const h = canvas.height || 360;

    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#070b14');
    bgGrad.addColorStop(0.55, '#0f172a');
    bgGrad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    const nick = String(recap.explorerNickname || 'Explorer').slice(0, 18);
    const rankTitle = String(recap.rankTitle || 'Neighborhood Stroller');
    const rankIcon = String(recap.rankIcon || '🚶');

    ctx.textAlign = 'left';
    ctx.font = '800 22px Inter, sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(`${rankIcon} NEIGHBORHOOD EXPLORER RECAP — ${nick}`, 28, 48);

    ctx.font = '700 14px JetBrains Mono, monospace';
    ctx.fillStyle = '#facc15';
    ctx.fillText(`CURRENT RANK: ${rankTitle.toUpperCase()}  •  TOTAL XP: ${recap.totalXp || 0}`, 28, 76);

    const metrics = [
      { label: '<=200m Walking Mini-Missions', val: `${recap.miniMissionsCompleted || 0} Completed`, color: '#4ade80' },
      { label: 'City-Wide Big Missions', val: `${recap.bigMissionsCompleted || 0} / ${recap.totalBigMissions || 6} Unlocked`, color: '#38bdf8' },
      { label: 'First-to-Snap Daily Crowns', val: `${recap.crownsEarned || 0} Crown(s)`, color: '#facc15' },
      { label: 'Verified Zero-PII Crew', val: `${recap.crewConnected || 0} Connected`, color: '#f472b6' },
    ];

    const boxW = Math.floor((w - 72) / 2);
    const boxH = 88;
    metrics.forEach((m, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 28 + col * (boxW + 16);
      const y = 102 + row * (boxH + 14);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(x, y, boxW, boxH);
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, boxW, boxH);

      ctx.font = '700 12px Inter, sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(m.label, x + 14, y + 30);

      ctx.font = '800 20px JetBrains Mono, monospace';
      ctx.fillStyle = m.color;
      ctx.fillText(m.val, x + 14, y + 64);
    });

    ctx.font = '700 11px JetBrains Mono, monospace';
    ctx.fillStyle = '#4ade80';
    ctx.fillText(`SpotQuest v2.1.0 by NetHustle • Zero-EXIF & 300m Privacy Verified • ${timestampStr}`, 28, h - 22);

    return {
      ok: true,
      rankTitle,
      totalXp: recap.totalXp || 0,
      miniMissionsCompleted: recap.miniMissionsCompleted || 0,
      bigMissionsCompleted: recap.bigMissionsCompleted || 0,
    };
  }


  // POD2B-802: "Weekend Explorer Crew" Friend Leaderboard Card Canvas Renderer (Zero PII, Zero Exact GPS, Zero-EXIF)
  function renderCrewLeaderboardCardCanvas({
    canvas,
    standings = {},
    timestampStr = '2026-11-28 11:36 HKT',
  }) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      return { ok: false, reason: 'NO_CANVAS_CONTEXT' };
    }
    const ctx = canvas.getContext('2d');
    const w = canvas.width || 680;
    const h = canvas.height || 360;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#070b14');
    grad.addColorStop(0.5, '#111827');
    grad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    const entries = Array.isArray(standings.entries) ? standings.entries : [];
    ctx.textAlign = 'left';
    ctx.font = '800 21px Inter, sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('👥 WEEKEND EXPLORER CREW LEADERBOARD', 28, 46);

    ctx.font = '700 12px JetBrains Mono, monospace';
    ctx.fillStyle = '#38bdf8';
    const subText = standings.honestEmptyCrew
      ? 'Solo Explorer Mode (0 synthetic bots — redeem a Friend Code in Step 3 to add real crew!)'
      : `Verified Crew Standings (${entries.length} Explorers • FNV-1a Signed • 300m Fuzzy Zone Privacy)`;
    ctx.fillText(subText, 28, 70);

    const maxRows = Math.min(4, Math.max(1, entries.length));
    const rowH = 54;
    for (let i = 0; i < maxRows; i++) {
      const e = entries[i];
      const y = 88 + i * (rowH + 8);
      ctx.fillStyle = e.isSelf ? 'rgba(56, 189, 248, 0.16)' : 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(28, y, w - 56, rowH);
      ctx.strokeStyle = i === 0 ? '#facc15' : e.isSelf ? '#38bdf8' : '#334155';
      ctx.lineWidth = i === 0 ? 2.5 : 1.5;
      ctx.strokeRect(28, y, w - 56, rowH);

      const medal = i === 0 ? '🥇 #1' : i === 1 ? '🥈 #2' : i === 2 ? '🥉 #3' : `#${i + 1}`;
      ctx.font = '800 15px JetBrains Mono, monospace';
      ctx.fillStyle = i === 0 ? '#facc15' : '#f8fafc';
      ctx.fillText(medal, 42, y + 33);

      ctx.font = '800 15px Inter, sans-serif';
      ctx.fillStyle = '#f8fafc';
      const tagLabel = `${e.rankIcon || '🚶'} ${e.nickname}${e.isSelf ? ' (You)' : ''} • ${e.rankTitle || 'Scout'}`;
      ctx.fillText(tagLabel.slice(0, 38), 112, y + 24);

      ctx.font = '600 11px JetBrains Mono, monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`Fuzzy Zone: ${e.zoneTag || 'LOCAL_300M'} • Zero Exact GPS`, 112, y + 43);

      ctx.textAlign = 'right';
      ctx.font = '800 15px JetBrains Mono, monospace';
      ctx.fillStyle = '#4ade80';
      ctx.fillText(`${e.totalXp || 0} XP (${e.completedCount || 0} spots)`, w - 44, y + 33);
      ctx.textAlign = 'left';
    }

    ctx.font = '700 11px JetBrains Mono, monospace';
    ctx.fillStyle = '#4ade80';
    ctx.fillText(`SpotQuest v2.1.0 by NetHustle • Zero-EXIF & Zero-PII Crew Card • ${timestampStr}`, 28, h - 20);

    return {
      ok: true,
      renderedCount: maxRows,
      honestEmptyCrew: Boolean(standings.honestEmptyCrew),
      zeroSyntheticPeers: true,
      exifStripped: true,
    };
  }


  // POD2B-1001: "Weekend 3x3 Neighborhood Bingo" Card Canvas Renderer (<=200m Walking Prompts, Zero-EXIF, Zero-PII)
  function renderNeighborhoodBingoCardCanvas({
    canvas,
    bingoBoard = {},
    explorerNickname = 'Explorer',
    timestampStr = '2026-11-28 11:36 HKT',
  }) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      return { ok: false, reason: 'NO_CANVAS_CONTEXT' };
    }
    const ctx = canvas.getContext('2d');
    const w = canvas.width || 680;
    const h = canvas.height || 420;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#070b14');
    grad.addColorStop(0.5, '#0f172a');
    grad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    const squares = Array.isArray(bingoBoard.squares) ? bingoBoard.squares : [];
    const checkedCount = Number(bingoBoard.checkedCount) || 0;
    const linesCount = Number(bingoBoard.bingoLinesCompleted) || 0;

    ctx.textAlign = 'left';
    ctx.font = '800 20px Inter, sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(`🎲 WEEKEND 3x3 NEIGHBORHOOD BINGO — ${String(explorerNickname || 'Explorer').slice(0, 16)}`, 28, 42);

    ctx.font = '700 12px JetBrains Mono, monospace';
    ctx.fillStyle = linesCount > 0 ? '#facc15' : '#38bdf8';
    const statusText = linesCount > 0
      ? `🏆 BINGO UNLOCKED! (${linesCount} Line${linesCount > 1 ? 's' : ''} • ${checkedCount}/9 Squares Stamped • <=200m Walk)`
      : `🥾 ${checkedCount}/9 Walking Prompts Stamped (Complete any 3-in-a-row within <=200m!)`;
    ctx.fillText(statusText, 28, 64);

    const cols = 3;
    const cellW = Math.floor((w - 76) / cols);
    const cellH = 92;
    for (let i = 0; i < 9; i++) {
      const sq = squares[i] || { icon: '📍', title: `Spot #${i + 1}`, prompt: '<=200m Walk', checked: false };
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = 28 + c * (cellW + 10);
      const y = 80 + r * (cellH + 10);

      ctx.fillStyle = sq.checked ? 'rgba(74, 222, 128, 0.16)' : 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(x, y, cellW, cellH);
      ctx.strokeStyle = sq.checked ? '#4ade80' : '#334155';
      ctx.lineWidth = sq.checked ? 2.5 : 1.5;
      ctx.strokeRect(x, y, cellW, cellH);

      ctx.font = '800 13px JetBrains Mono, monospace';
      ctx.fillStyle = sq.checked ? '#4ade80' : '#94a3b8';
      ctx.fillText(sq.checked ? '✓ STAMPED' : '○ <=200M WALK', x + 10, y + 22);

      ctx.font = '800 13.5px Inter, sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`${sq.icon || '📍'} ${String(sq.title || '').slice(0, 19)}`, x + 10, y + 48);

      ctx.font = '600 10.5px Inter, sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(String(sq.prompt || '').slice(0, 28), x + 10, y + 72);
    }

    ctx.font = '700 11px JetBrains Mono, monospace';
    ctx.fillStyle = '#4ade80';
    ctx.fillText(`SpotQuest v2.1.0 by NetHustle • Zero-EXIF 3x3 Walking Bingo • ${timestampStr}`, 28, h - 18);

    return {
      ok: true,
      renderedSquares: 9,
      checkedCount,
      bingoLinesCompleted: linesCount,
      exifStripped: true,
      zeroPii: true,
    };
  }

  function renderFriendCodeQrCanvas({ canvas, codeString = 'SQ-CREW-0000', nickname = 'Explorer' }) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      return { ok: false, reason: 'NO_CANVAS_CONTEXT' };
    }
    const ctx = canvas.getContext('2d');
    const w = canvas.width || 136;
    const h = canvas.height || 136;
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    const gridN = 11;
    const pad = 12;
    const cell = Math.floor((w - pad * 2) / gridN);
    let hash = 2166136261;
    const seedStr = `${codeString}:${nickname}`;
    for (let i = 0; i < seedStr.length; i++) {
      hash ^= seedStr.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }

    for (let r = 0; r < gridN; r++) {
      for (let c = 0; c < gridN; c++) {
        const isFinder =
          (r < 3 && c < 3) ||
          (r < 3 && c >= gridN - 3) ||
          (r >= gridN - 3 && c < 3);
        const bitIdx = (r * gridN + c) % 31;
        const bitOn = isFinder || (((hash >>> bitIdx) ^ (r * 7 + c * 13)) & 1) === 1;
        if (bitOn) {
          ctx.fillStyle = isFinder ? '#38bdf8' : '#4ade80';
          ctx.fillRect(pad + c * cell, pad + r * cell, cell - 1, cell - 1);
        }
      }
    }
    return { ok: true, codeString };
  }

  function exportSpotCardDataUrl(canvas) {
    if (!canvas || typeof canvas.toDataURL !== 'function') return '';
    return canvas.toDataURL('image/png');
  }

  global.SpotArViewfinder = Object.freeze({
    SNAP_AND_GREET_PROMPTS,
    createSnapAndGreetStamp,
    AR_FRAME_THEMES,
    AR_STICKERS,
    AR_COLOR_FILTERS,
    cycleArSticker,
    renderSpotCardCanvas,
    renderExplorerPassportCanvas,
    renderExplorerRecapCardCanvas,
    renderCrewLeaderboardCardCanvas,
    renderNeighborhoodBingoCardCanvas,
    renderFriendCodeQrCanvas,
    exportSpotCardDataUrl,
  });
})(typeof window !== 'undefined' ? window : globalThis);
