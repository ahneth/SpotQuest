// Version: 2.1.0 | Last Modified: 2026-11-28 11:36 HKT | Build: 20261128_1136
// Module: js/mascots.js — Shared NetHustle Chibi-Vector Neon Pop Cartoon Mascots (Pip-Bolt, Snap-Mochi, Neon-Kitsune, Captain Atlas) per FD-P0-20261127-01, FD-P0-20261128-01 & POD2B-1101 (Aria Vance-Sato 14, Elena Park 16 & Kai Lindqvist 17)
(function (global) {
  'use strict';

  const CAST = Object.freeze({
    pip: Object.freeze({
      id: 'pip',
      name: 'Pip-Bolt',
      shortName: 'Pip',
      emoji: '⚡',
      archetype: 'The Hype Referee & Trail Spark',
      primaryColor: '#38bdf8',
      accentColor: '#facc15',
      cheekColor: '#fb7185',
      outlineColor: '#0f172a',
      defaultExpression: 'hyped',
      catchphrase: "Golden hour's glowing—let's walk <=200m and stamp your SpotCard!",
      stepRole: 'Step 2 Golden-Hour & 3x3 Bingo Hype Spark',
    }),
    mochi: Object.freeze({
      id: 'mochi',
      name: 'Snap-Mochi',
      shortName: 'Mochi',
      emoji: '📸',
      archetype: 'The Cozy Explorer & Crowd Analyst',
      primaryColor: '#f8fafc',
      accentColor: '#34d399',
      cheekColor: '#f472b6',
      outlineColor: '#0f172a',
      defaultExpression: 'happy',
      catchphrase: '200m away—easy stroll, cute snap! Pick a walk mood below!',
      stepRole: 'Step 1 <=200m Mini-Mission Guide & AR Co-Star',
    }),
    kitsune: Object.freeze({
      id: 'kitsune',
      name: 'Neon-Kitsune',
      shortName: 'Kitsune',
      emoji: '🦊',
      archetype: 'The Upset & Secret-Spot Trickster',
      primaryColor: '#a855f7',
      accentColor: '#ec4899',
      cheekColor: '#22d3ee',
      outlineColor: '#0f172a',
      defaultExpression: 'smirk',
      catchphrase: 'Night neon & covered arcades unlocked—show me your best angle!',
      stepRole: 'Night Neon Mood & Friend Code Crew Trickster',
    }),
    atlas: Object.freeze({
      id: 'atlas',
      name: 'Captain Atlas',
      shortName: 'Atlas',
      emoji: '🐢',
      archetype: 'The Chill Pacekeeper & Trophy Keeper',
      primaryColor: '#14b8a6',
      accentColor: '#f59e0b',
      cheekColor: '#38bdf8',
      outlineColor: '#0f172a',
      defaultExpression: 'proud',
      catchphrase: 'Public spots only, stay safe & say hi in the 300m Lounge!',
      stepRole: 'Step 3 Lounge Guardian & Step 4 Passport / 7-Day Streak Keeper',
    }),
  });

  const DIALOGUE_LINES = Object.freeze({
    pip: Object.freeze({
      default: "⚡ Pip-Bolt: Golden hour's glowing—let's walk <=200m and light up your 3x3 Bingo!",
      step1: '⚡ Pip-Bolt: Tap any <=200m pin or filter by Night Neon to spark an instant XP run!',
      step2: '⚡ Pip-Bolt: I am right on your AR Viewfinder! Snap now for +XP and Zero-EXIF safety!',
      step3: '⚡ Pip-Bolt: Spin an icebreaker or send a Nearby Wave to your 300m neighborhood crew!',
      step4: '⚡ Pip-Bolt: Stamp your 3x3 Neighborhood Bingo squares and export your PNG!',
    }),
    mochi: Object.freeze({
      default: '📸 Snap-Mochi: 200m away—easy stroll, cute snap! Zero tutorials needed!',
      step1: '📸 Snap-Mochi: Everything on this map is a gentle <=200m walk right outside your door!',
      step2: '📸 Snap-Mochi: Say cheese! My Mochi AR Co-Star sticker is posed on your Polaroid!',
      step3: '📸 Snap-Mochi: Cozy 300m Lounge unlocked—exchange FNV-1a Friend Codes with zero PII!',
      step4: '📸 Snap-Mochi: All your Zero-EXIF Polaroids live safely in your 12-slot offline gallery!',
    }),
    kitsune: Object.freeze({
      default: '🦊 Neon-Kitsune: Night neon unlocked—show me your secret architectural angle!',
      step1: '🦊 Neon-Kitsune: Try the Night Neon or Covered Rain-Safe filter for hidden <=200m gems!',
      step2: '🦊 Neon-Kitsune: Star shades on! Slap on the Cyber Glow or Rain-Day Arcade AR frame!',
      step3: '🦊 Neon-Kitsune: Scan or copy your zone Friend Code to rank up on the Crew Leaderboard!',
      step4: '🦊 Neon-Kitsune: Check out your Crew Leaderboard and 3x3 Bingo lines—pure neon flex!',
    }),
    atlas: Object.freeze({
      default: '🐢 Captain Atlas: Public spots only, stay safe, keep your 7-day walk streak alive!',
      step1: '🐢 Captain Atlas: Green 200m walking ring active—safe public parks and plazas only!',
      step2: '🐢 Captain Atlas: Every photo is redrawn on Canvas to strip 100% of raw EXIF & GPS data!',
      step3: '🐢 Captain Atlas: Your chat room is quantized to a 300m zone—phone numbers auto-blocked!',
      step4: '🐢 Captain Atlas: 7-Day Exploration Streak and Walking Distance Meter tracked 100% on-device!',
    }),
  });

  function getMascot(characterId = 'mochi') {
    const key = String(characterId || 'mochi').toLowerCase();
    return CAST[key] || CAST.mochi;
  }

  function listCast() {
    return [CAST.pip, CAST.mochi, CAST.kitsune, CAST.atlas];
  }

  function renderMascotSvg(characterId = 'mochi', expression = 'happy', sizePx = 76) {
    const m = getMascot(characterId);
    const sz = Math.max(32, Math.min(160, Number(sizePx) || 76));
    const expr = String(expression || m.defaultExpression).replace(/[^a-z_]/gi, '');

    let characterArt = '';
    if (m.id === 'pip') {
      characterArt =
        '<polygon points="88,78 112,62 98,88 115,84 86,102" fill="#facc15" stroke="#0f172a" stroke-width="3"/>' +
        '<polygon points="24,42 16,14 44,30" fill="#38bdf8" stroke="#0f172a" stroke-width="3"/>' +
        '<polygon points="96,42 104,14 76,30" fill="#38bdf8" stroke="#0f172a" stroke-width="3"/>' +
        '<line x1="60" y1="22" x2="60" y2="8" stroke="#0f172a" stroke-width="3"/>' +
        '<circle cx="60" cy="8" r="5" fill="#facc15" stroke="#0f172a" stroke-width="2.5"/>' +
        '<rect x="24" y="26" width="72" height="68" rx="34" fill="#38bdf8" stroke="#0f172a" stroke-width="3"/>' +
        '<path d="M20,56 A40,36 0 0,1 100,56" fill="none" stroke="#facc15" stroke-width="5"/>' +
        '<rect x="14" y="48" width="12" height="22" rx="6" fill="#facc15" stroke="#0f172a" stroke-width="3"/>' +
        '<rect x="94" y="48" width="12" height="22" rx="6" fill="#facc15" stroke="#0f172a" stroke-width="3"/>';
    } else if (m.id === 'mochi') {
      characterArt =
        '<circle cx="34" cy="34" r="14" fill="#f8fafc" stroke="#0f172a" stroke-width="3"/>' +
        '<circle cx="86" cy="34" r="14" fill="#f8fafc" stroke="#0f172a" stroke-width="3"/>' +
        '<rect x="24" y="30" width="72" height="66" rx="33" fill="#f8fafc" stroke="#0f172a" stroke-width="3"/>' +
        '<path d="M18,38 Q60,12 102,38 L94,44 Q60,26 26,44 Z" fill="#34d399" stroke="#0f172a" stroke-width="3"/>' +
        '<rect x="46" y="84" width="28" height="18" rx="5" fill="#f472b6" stroke="#0f172a" stroke-width="2.5"/>' +
        '<circle cx="60" cy="93" r="5" fill="#38bdf8" stroke="#0f172a" stroke-width="2"/>';
    } else if (m.id === 'kitsune') {
      characterArt =
        '<path d="M86,84 Q116,58 108,92 Q118,82 94,104 Z" fill="#ec4899" stroke="#0f172a" stroke-width="3"/>' +
        '<polygon points="24,46 12,10 46,28" fill="#a855f7" stroke="#0f172a" stroke-width="3"/>' +
        '<polygon points="96,46 108,10 74,28" fill="#a855f7" stroke="#0f172a" stroke-width="3"/>' +
        '<polygon points="28,42 18,18 42,30" fill="#ec4899"/>' +
        '<polygon points="92,42 102,18 78,30" fill="#ec4899"/>' +
        '<rect x="25" y="28" width="70" height="66" rx="32" fill="#a855f7" stroke="#0f172a" stroke-width="3"/>' +
        '<polygon points="32,46 42,38 52,46 48,58 36,58" fill="#22d3ee" stroke="#0f172a" stroke-width="2.5"/>' +
        '<polygon points="68,46 78,38 88,46 84,58 72,58" fill="#facc15" stroke="#0f172a" stroke-width="2.5"/>' +
        '<line x1="52" y1="48" x2="68" y2="48" stroke="#0f172a" stroke-width="3"/>';
    } else {
      characterArt =
        '<ellipse cx="60" cy="64" rx="42" ry="34" fill="#f59e0b" stroke="#0f172a" stroke-width="3"/>' +
        '<rect x="26" y="28" width="68" height="64" rx="32" fill="#14b8a6" stroke="#0f172a" stroke-width="3"/>' +
        '<path d="M28,78 Q60,92 92,78 L88,88 Q60,100 32,88 Z" fill="#38bdf8" stroke="#0f172a" stroke-width="2.5"/>' +
        '<circle cx="60" cy="92" r="8" fill="#facc15" stroke="#0f172a" stroke-width="2.5"/>';
    }

    const cheeks =
      '<ellipse cx="33" cy="65" rx="5.5" ry="3.2" fill="' + m.cheekColor + '"/>' +
      '<ellipse cx="87" cy="65" rx="5.5" ry="3.2" fill="' + m.cheekColor + '"/>';

    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="' +
      sz +
      '" height="' +
      sz +
      '" aria-hidden="true" data-mascot="' +
      m.id +
      '" data-expression="' +
      expr +
      '">' +
      '<circle cx="60" cy="60" r="56" fill="#0f172a" stroke="' +
      m.accentColor +
      '" stroke-width="4"/>' +
      characterArt +
      '<circle cx="44" cy="56" r="6.5" fill="#0f172a"/>' +
      '<circle cx="76" cy="56" r="6.5" fill="#0f172a"/>' +
      '<circle cx="42" cy="54" r="2.3" fill="#ffffff"/>' +
      '<circle cx="74" cy="54" r="2.3" fill="#ffffff"/>' +
      cheeks +
      '<path d="M51,67 Q60,75 69,67" fill="none" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/>' +
      '</svg>'
    );
  }

  function getMascotDataUri(characterId = 'mochi', expression = 'happy', sizePx = 76) {
    const svg = renderMascotSvg(characterId, expression, sizePx);
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function getMascotLine(characterId = 'mochi', appContext = 'spotquest', eventKey = 'default') {
    const m = getMascot(characterId);
    const lines = DIALOGUE_LINES[m.id] || DIALOGUE_LINES.mochi;
    const key = String(eventKey || 'default').toLowerCase();
    return lines[key] || lines.default || m.catchphrase;
  }

  // POD2B-1101 & FD-P0-20261128-01: Prominent Chibi Mascot AR Co-Star Sticker Overlay on 2D Canvas (Zero-EXIF)
  function drawMascotCanvasOverlay(ctx, characterId = 'mochi', x = 70, y = 340, sizePx = 88) {
    if (!ctx) return { ok: false, reason: 'NO_CTX' };
    const m = getMascot(characterId);
    const r = Math.round((Number(sizePx) || 88) / 2);

    ctx.save();
    ctx.translate(x, y);

    // Outer glowing badge disc
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = m.accentColor;
    ctx.stroke();

    // Character ears / hat / shell silhouette
    if (m.id === 'pip' || m.id === 'kitsune') {
      ctx.fillStyle = m.primaryColor;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-r * 0.65, -r * 0.35);
      ctx.lineTo(-r * 0.85, -r * 0.98);
      ctx.lineTo(-r * 0.2, -r * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(r * 0.65, -r * 0.35);
      ctx.lineTo(r * 0.85, -r * 0.98);
      ctx.lineTo(r * 0.2, -r * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Chibi rounded head
    ctx.beginPath();
    ctx.arc(0, 2, r * 0.68, 0, Math.PI * 2);
    ctx.fillStyle = m.primaryColor;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();

    if (m.id === 'mochi') {
      // Mint bucket hat
      ctx.beginPath();
      ctx.arc(0, -r * 0.22, r * 0.66, Math.PI, 0);
      ctx.fillStyle = '#34d399';
      ctx.fill();
      ctx.stroke();
    }

    // Oversized expressive eyes + specular highlights
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(-r * 0.26, -2, 4.5, 0, Math.PI * 2);
    ctx.arc(r * 0.26, -2, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-r * 0.29, -4, 1.8, 0, Math.PI * 2);
    ctx.arc(r * 0.23, -4, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Rosy cheeks
    ctx.fillStyle = m.cheekColor;
    ctx.beginPath();
    ctx.arc(-r * 0.42, 6, 4, 0, Math.PI * 2);
    ctx.arc(r * 0.42, 6, 4, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.beginPath();
    ctx.arc(0, 5, 7, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Co-Star Name Pill below mascot
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-r - 6, r - 10, (r + 6) * 2, 20);
    ctx.strokeStyle = m.accentColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(-r - 6, r - 10, (r + 6) * 2, 20);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${m.emoji} ${m.name.toUpperCase()}`, 0, r + 4);
    ctx.restore();

    return {
      ok: true,
      characterId: m.id,
      name: m.name,
      exifStripped: true,
      zeroPii: true,
    };
  }

  global.SpotMascots = Object.freeze({
    CAST,
    DIALOGUE_LINES,
    getMascot,
    listCast,
    renderMascotSvg,
    getMascotDataUri,
    getMascotLine,
    drawMascotCanvasOverlay,
  });
})(typeof window !== 'undefined' ? window : globalThis);
