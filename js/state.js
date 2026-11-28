// Version: 2.1.0 | Last Modified: 2026-11-28 11:36 HKT | Build: 20261128_1136
// Module: js/state.js — SafeStateEngine Zero-PII & Zero-Synthetic-Data Local Vault with Overpass <=200m POI Cache & Neighborhood Explorer Rank / Weekly Recap Calculator (Victor Lin 03 & Priya Nair 18)
(function (global) {
  'use strict';
  const STORAGE_KEY = 'spotquest_v2_1_state';
  const SCHEMA_VERSION = '2.1.0';

  const EXPLORER_RANK_TIERS = Object.freeze([
    { minXp: 0, title: 'Neighborhood Stroller', icon: '🚶' },
    { minXp: 150, title: '200m Street Scout', icon: '🧭' },
    { minXp: 400, title: 'District Trailblazer', icon: '⚡' },
    { minXp: 750, title: 'Harbour Neon Ranger', icon: '🌆' },
    { minXp: 1100, title: 'Grand City Legend', icon: '👑' },
  ]);

  function createEmptyState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      activeStep: 1,
      missionCategoryFilter: 'mini',
      selectedLandmarkId: 'LM_MINI_POCKET_PARK',
      userAnchorLat: 22.2938,
      userAnchorLon: 114.1712,
      explorerNickname: 'Explorer',
      totalXp: 0,
      completedMissions: [],
      earnedBadges: [],
      savedSpotCards: [],
      customLandmarks: [],
      overpassMiniMissions: [],
      overpassSourceStatus: 'deterministic_200m',
      savedCrewList: [],
      dailyFirstSnapCrowns: [],
      mutedAudio: false,
      simulatedSpeedMps: 1.4,
      arFrameStyle: 'neon_polaroid',
      arStickerKey: 'compass',
      arColorFilter: 'natural',
      stickerPos: { x: 0.76, y: 0.24 },
      photoSourceMode: 'scene',
      mapTileMode: 'osm_streets',
      mapCenterLat: 22.2938,
      mapCenterLon: 114.1712,
      mapZoom: 16,
      apiEndpointUrl: '',
      activePingPod: null,
      snapAndGreetEnabled: false,
      snapAndGreetPeerNickname: 'Nearby Scout',
      snapAndGreetPromptIdx: 0,
      activeCustomTrail: null,
      customTrailCheckedStops: [],
      trailFinisherSeals: [],
      goldenHourPreviewMode: false,
      rainDayFramePreviewMode: false,
      icebreakerSpinnerIndex: 0,
      pwaBannerOpen: false,
      galleryDrawerOpen: false,
      spotCardGallery: [],
      manualBingoChecks: [],
      selectedMascotId: 'mochi',
      mascotArCoStarEnabled: true,
      reducedMotion: false,
      missionMoodFilter: 'all',
      streakDateKeys: ['2026-11-28'],
      mutedExplorers: [],
      lastMissionCompletedId: null,
      updatedAt: new Date().toISOString(),
    };
  }

  let currentState = createEmptyState();

  function loadState() {
    try {
      if (typeof localStorage === 'undefined') return currentState;
      const raw =
        localStorage.getItem(STORAGE_KEY) ||
        localStorage.getItem('spotquest_v2_0_state') ||
        localStorage.getItem('spotquest_v1_9_state') ||
        localStorage.getItem('spotquest_v1_8_state') ||
        localStorage.getItem('spotquest_v1_7_state') ||
        localStorage.getItem('spotquest_v1_6_state') ||
        localStorage.getItem('spotquest_v1_5_state') ||
        localStorage.getItem('spotquest_v1_4_state') ||
        localStorage.getItem('spotquest_v1_3_state') ||
        localStorage.getItem('spotquest_v1_2_state');
      if (!raw) {
        currentState = createEmptyState();
        return currentState;
      }
      const parsed = JSON.parse(raw);
      currentState = {
        ...createEmptyState(),
        ...(parsed || {}),
        customLandmarks: Array.isArray(parsed && parsed.customLandmarks) ? parsed.customLandmarks : [],
        overpassMiniMissions: Array.isArray(parsed && parsed.overpassMiniMissions) ? parsed.overpassMiniMissions : [],
        savedCrewList: Array.isArray(parsed && parsed.savedCrewList) ? parsed.savedCrewList : [],
        dailyFirstSnapCrowns: Array.isArray(parsed && parsed.dailyFirstSnapCrowns) ? parsed.dailyFirstSnapCrowns : [],
        customTrailCheckedStops: Array.isArray(parsed && parsed.customTrailCheckedStops) ? parsed.customTrailCheckedStops : [],
        trailFinisherSeals: Array.isArray(parsed && parsed.trailFinisherSeals) ? parsed.trailFinisherSeals : [],
        schemaVersion: SCHEMA_VERSION,
      };
      return currentState;
    } catch (_err) {
      currentState = createEmptyState();
      return currentState;
    }
  }

  function saveState(patch = {}) {
    currentState = {
      ...currentState,
      ...patch,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
    };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
      }
    } catch (_err) {}
    return currentState;
  }

  function getState() {
    return currentState;
  }

  function setOverpassMiniMissions(missions = [], sourceStatus = 'overpass_osm_live') {
    const valid = Array.isArray(missions) ? missions.slice(0, 6) : [];
    saveState({
      overpassMiniMissions: valid,
      overpassSourceStatus: sourceStatus,
      selectedLandmarkId: valid[0] ? valid[0].id : currentState.selectedLandmarkId,
    });
    return { ok: true, count: valid.length, sourceStatus };
  }

  function addCustomLandmark(landmark) {
    if (!landmark || !landmark.id || !landmark.safePublicSpace) {
      return { ok: false, reason: 'INVALID_LANDMARK' };
    }
    const existing = Array.isArray(currentState.customLandmarks) ? currentState.customLandmarks : [];
    const nextList = [landmark, ...existing.filter((x) => x.id !== landmark.id)].slice(0, 12);
    saveState({
      customLandmarks: nextList,
      selectedLandmarkId: landmark.id,
      mapCenterLat: landmark.lat,
      mapCenterLon: landmark.lon,
    });
    return { ok: true, customLandmarks: nextList };
  }

  function addSavedCrewMember(crewEntry) {
    if (!crewEntry || !crewEntry.code || !crewEntry.nickname) {
      return { ok: false, reason: 'INVALID_CREW_ENTRY' };
    }
    const existing = Array.isArray(currentState.savedCrewList) ? currentState.savedCrewList : [];
    const nextCrew = [
      crewEntry,
      ...existing.filter((c) => c.code !== crewEntry.code),
    ].slice(0, 24);
    saveState({ savedCrewList: nextCrew });
    return { ok: true, savedCrewList: nextCrew };
  }

  function recordCompletedMission({
    landmarkId,
    zoneId,
    xpReward,
    badge,
    cardDataUrl,
    awardedFirstSnapCrown = false,
    isGoldenHourBonus = false,
  }) {
    const alreadyDone = currentState.completedMissions.includes(landmarkId);
    const completedMissions = alreadyDone
      ? currentState.completedMissions
      : [...currentState.completedMissions, landmarkId];
    const earnedBadges = currentState.earnedBadges.includes(badge)
      ? currentState.earnedBadges
      : [...currentState.earnedBadges, badge];
    const crowns = Array.isArray(currentState.dailyFirstSnapCrowns) ? currentState.dailyFirstSnapCrowns : [];
    const dailyFirstSnapCrowns = awardedFirstSnapCrown && !crowns.includes(landmarkId)
      ? [...crowns, landmarkId]
      : crowns;
    const crownBonus = awardedFirstSnapCrown && !crowns.includes(landmarkId) ? 50 : 0;
    const baseXp = Number(xpReward) || 150;
    const goldenBonusXp = isGoldenHourBonus ? Math.round(baseXp * 0.5) : 0;
    const totalXp = alreadyDone
      ? currentState.totalXp
      : currentState.totalXp + baseXp + goldenBonusXp + crownBonus;
    const savedSpotCards = [
      {
        landmarkId,
        zoneId,
        badge,
        awardedFirstSnapCrown,
        capturedAt: new Date().toISOString(),
        exifStripped: true,
        hasPreview: Boolean(cardDataUrl),
      },
      ...currentState.savedSpotCards,
    ].slice(0, 12);

    return saveState({
      completedMissions,
      earnedBadges,
      dailyFirstSnapCrowns,
      totalXp,
      savedSpotCards,
      lastMissionCompletedId: landmarkId,
    });
  }

  // POD2B-502: Neighborhood Explorer Rank & Weekly Recap Summary
  function computeExplorerRankAndRecap(allLandmarks = []) {
    const xp = Number(currentState.totalXp) || 0;
    const completedIds = Array.isArray(currentState.completedMissions) ? currentState.completedMissions : [];
    let currentTier = EXPLORER_RANK_TIERS[0];
    let nextTier = null;
    for (let i = 0; i < EXPLORER_RANK_TIERS.length; i++) {
      if (xp >= EXPLORER_RANK_TIERS[i].minXp) {
        currentTier = EXPLORER_RANK_TIERS[i];
        nextTier = EXPLORER_RANK_TIERS[i + 1] || null;
      }
    }
    const miniCompleted = completedIds.filter(
      (id) => id.startsWith('LM_MINI_') || id.startsWith('LM_OSM_POI_') || id.startsWith('LM_CUSTOM_')
    ).length;
    const bigCompleted = completedIds.filter((id) => id.startsWith('LM_HK_')).length;
    const totalBig = (Array.isArray(allLandmarks) ? allLandmarks : []).filter((l) => l.missionCategory === 'big').length || 6;

    return {
      explorerNickname: currentState.explorerNickname || 'Explorer',
      totalXp: xp,
      rankTitle: currentTier.title,
      rankIcon: currentTier.icon,
      nextRankTitle: nextTier ? nextTier.title : 'Max Rank Reached',
      xpToNextRank: nextTier ? Math.max(0, nextTier.minXp - xp) : 0,
      miniMissionsCompleted: miniCompleted,
      bigMissionsCompleted: bigCompleted,
      totalBigMissions: totalBig,
      crownsEarned: Array.isArray(currentState.dailyFirstSnapCrowns) ? currentState.dailyFirstSnapCrowns.length : 0,
      crewConnected: Array.isArray(currentState.savedCrewList) ? currentState.savedCrewList.length : 0,
      zeroSyntheticStats: true,
    };
  }


  function toggleSnapAndGreetState(peerNickname = 'Nearby Scout') {
    const nextEnabled = !currentState.snapAndGreetEnabled;
    const cleanPeer = String(peerNickname || currentState.snapAndGreetPeerNickname || 'Nearby Scout')
      .replace(/[<>]/g, '')
      .trim()
      .slice(0, 16) || 'Nearby Scout';
    saveState({
      snapAndGreetEnabled: nextEnabled,
      snapAndGreetPeerNickname: cleanPeer,
    });
    return {
      ok: true,
      snapAndGreetEnabled: nextEnabled,
      snapAndGreetPeerNickname: cleanPeer,
      snapAndGreetPromptIdx: currentState.snapAndGreetPromptIdx || 0,
    };
  }

  function cycleSnapAndGreetPrompt() {
    const nextIdx = ((Number(currentState.snapAndGreetPromptIdx) || 0) + 1) % 3;
    saveState({ snapAndGreetPromptIdx: nextIdx, snapAndGreetEnabled: true });
    return { ok: true, snapAndGreetPromptIdx: nextIdx, snapAndGreetEnabled: true };
  }


  function toggleGoldenHourPreview() {
    const nextVal = !currentState.goldenHourPreviewMode;
    saveState({
      goldenHourPreviewMode: nextVal,
      arFrameStyle: nextVal ? 'sunburst_golden' : currentState.arFrameStyle,
    });
    return { ok: true, goldenHourPreviewMode: nextVal };
  }

  function setActiveCustomTrail(trailObj = null) {
    saveState({
      activeCustomTrail: trailObj,
      customTrailCheckedStops: [],
    });
    return { ok: true, activeCustomTrail: trailObj };
  }

  function getCustomTrailProgress() {
    const trail = currentState.activeCustomTrail;
    if (!trail || !Array.isArray(trail.stopIds) || trail.stopIds.length < 3) {
      return {
        hasActiveTrail: false,
        title: 'No Active Custom #trail=',
        stopIds: [],
        checkedStops: [],
        completedCount: 0,
        totalCount: 0,
        percent: 0,
        isTrailFinished: false,
        nextStopId: null,
        finisherSealsCount: Array.isArray(currentState.trailFinisherSeals)
          ? currentState.trailFinisherSeals.length
          : 0,
      };
    }
    const stopIds = trail.stopIds;
    const checked = (Array.isArray(currentState.customTrailCheckedStops)
      ? currentState.customTrailCheckedStops
      : []
    ).filter((id) => stopIds.includes(id));
    const completedCount = checked.length;
    const totalCount = stopIds.length;
    const percent = Math.min(100, Math.round((completedCount / Math.max(1, totalCount)) * 100));
    const nextStopId = stopIds.find((id) => !checked.includes(id)) || null;
    const isTrailFinished = completedCount >= totalCount;
    return {
      hasActiveTrail: true,
      title: String(trail.title || 'Custom Trail').replace(/[<>]/g, '').slice(0, 42),
      stopIds,
      checkedStops: checked,
      completedCount,
      totalCount,
      percent,
      isTrailFinished,
      nextStopId,
      finisherSealsCount: Array.isArray(currentState.trailFinisherSeals)
        ? currentState.trailFinisherSeals.length
        : 0,
    };
  }

  // POD2B-702: Interactive #trail= Stop Check-In & Trail Finisher Seal State Machine
  function checkInCustomTrailStop(targetStopId = null) {
    const prog = getCustomTrailProgress();
    if (!prog.hasActiveTrail) {
      return { ok: false, reason: 'NO_ACTIVE_CUSTOM_TRAIL' };
    }
    const candidateId =
      targetStopId && prog.stopIds.includes(targetStopId)
        ? targetStopId
        : prog.nextStopId || prog.stopIds[0];
    if (!candidateId) {
      return { ok: false, reason: 'ALL_TRAIL_STOPS_ALREADY_CHECKED' };
    }
    const alreadyChecked = prog.checkedStops.includes(candidateId);
    const nextChecked = alreadyChecked
      ? prog.checkedStops
      : [...prog.checkedStops, candidateId];
    const nextCompletedMissions = currentState.completedMissions.includes(candidateId)
      ? currentState.completedMissions
      : [...currentState.completedMissions, candidateId];

    const nowFinished = nextChecked.length >= prog.totalCount;
    const sealTitle = `🏅 Trail Finisher: ${prog.title}`;
    const existingSeals = Array.isArray(currentState.trailFinisherSeals)
      ? currentState.trailFinisherSeals
      : [];
    const newlyEarnedSeal = nowFinished && !existingSeals.includes(sealTitle);
    const nextSeals = newlyEarnedSeal ? [...existingSeals, sealTitle] : existingSeals;
    const nextBadges = newlyEarnedSeal && !currentState.earnedBadges.includes(sealTitle)
      ? [...currentState.earnedBadges, sealTitle]
      : currentState.earnedBadges;
    const xpAdd = (alreadyChecked ? 0 : 80) + (newlyEarnedSeal ? 150 : 0);

    saveState({
      customTrailCheckedStops: nextChecked,
      completedMissions: nextCompletedMissions,
      trailFinisherSeals: nextSeals,
      earnedBadges: nextBadges,
      totalXp: currentState.totalXp + xpAdd,
    });

    const updatedProg = getCustomTrailProgress();
    return {
      ok: true,
      checkedStopId: candidateId,
      newlyEarnedSeal,
      sealTitle: newlyEarnedSeal ? sealTitle : null,
      xpAwarded: xpAdd,
      progress: updatedProg,
    };
  }




  // POD2B-901: Cumulative Walking Distance Meter & Step-Goal Badge Tiers (Pure Client-Side Sum, Zero Raw GPS/PII)
  const WALKING_DISTANCE_TIERS = Object.freeze([
    { minMeters: 0, title: 'Trailhead Starter', icon: '🥾', nextGoalMeters: 150 },
    { minMeters: 150, title: '200m Street Strider', icon: '🚶', nextGoalMeters: 400 },
    { minMeters: 400, title: '500m Neighborhood Pacer', icon: '🏃', nextGoalMeters: 800 },
    { minMeters: 800, title: '1km Harbour Walker', icon: '🏅', nextGoalMeters: 1500 },
  ]);

  function computeWalkingDistanceProgress(allLandmarks = []) {
    const completedIds = Array.isArray(currentState.completedMissions) ? currentState.completedMissions : [];
    const doneSet = new Set(completedIds);
    const list = Array.isArray(allLandmarks) ? allLandmarks : [];
    let totalMetersWalked = 0;
    let completedMiniCount = 0;

    list.forEach((lm) => {
      if (!lm || !doneSet.has(lm.id)) return;
      const isLocalMini = lm.missionCategory === 'mini' || lm.isCustom === true;
      const rawDist = Number(lm.distanceMeters);
      const boundedDist = Number.isFinite(rawDist) && rawDist > 0 ? Math.min(200, Math.round(rawDist)) : 95;
      if (isLocalMini) {
        totalMetersWalked += boundedDist;
        completedMiniCount += 1;
      }
    });

    // If completedIds contains mini IDs not in the passed list, attribute conservative 95m per completed mini ID
    if (completedMiniCount === 0 && completedIds.length > 0) {
      completedIds.forEach((id) => {
        if (String(id).startsWith('LM_MINI_') || String(id).startsWith('LM_OSM_POI_') || String(id).startsWith('LM_CUSTOM_')) {
          totalMetersWalked += 95;
          completedMiniCount += 1;
        }
      });
    }

    const estimatedSteps = Math.round(totalMetersWalked * 1.32);
    let tier = WALKING_DISTANCE_TIERS[0];
    for (let i = 0; i < WALKING_DISTANCE_TIERS.length; i++) {
      if (totalMetersWalked >= WALKING_DISTANCE_TIERS[i].minMeters) {
        tier = WALKING_DISTANCE_TIERS[i];
      }
    }
    const progressPct = Math.min(100, Math.round((totalMetersWalked / Math.max(1, tier.nextGoalMeters)) * 100));

    return {
      ok: true,
      totalMetersWalked,
      estimatedSteps,
      completedMiniCount,
      walkingBadgeTitle: tier.title,
      walkingBadgeIcon: tier.icon,
      nextGoalMeters: tier.nextGoalMeters,
      progressPct,
      summaryLabel: `${tier.icon} ${totalMetersWalked}m Walked (~${estimatedSteps} steps) • ${tier.title}`,
      zeroRawGpsStored: true,
      zeroPii: true,
    };
  }

  // POD2B-902: Toggle "Covered / Rain-Safe" AR Frame Mode
  function toggleRainDayArFrame(forceState = null) {
    const nextMode = typeof forceState === 'boolean' ? forceState : !currentState.rainDayFramePreviewMode;
    const nextTheme = nextMode ? 'rain_neon_arcade' : 'neon_polaroid';
    const nextSticker = nextMode ? 'rain_canopy' : currentState.selectedSticker || 'compass';
    saveState({
      rainDayFramePreviewMode: nextMode,
      selectedFrameTheme: nextTheme,
      selectedSticker: nextSticker,
    });
    return {
      ok: true,
      rainDayFramePreviewMode: nextMode,
      selectedFrameTheme: nextTheme,
      selectedSticker: nextSticker,
    };
  }


  // POD2B-1001: Deterministic "Weekend 3x3 Neighborhood Bingo" Board (<=200m Walking Prompts, Zero Math.random, Zero PII)
  const BINGO_3X3_SQUARES = Object.freeze([
    { id: 'BINGO_PARK_55M', row: 0, col: 0, icon: '🌳', title: 'Pocket Park (~55m)', prompt: 'Snap greenery or park bench <=200m', matchId: 'LM_MINI_POCKET_PARK' },
    { id: 'BINGO_CAFE_95M', row: 0, col: 1, icon: '☕', title: 'Cafe Plaza (~95m)', prompt: 'Frame a public sidewalk cafe corner', matchId: 'LM_MINI_CAFE_PLAZA' },
    { id: 'BINGO_ARCH_140M', row: 0, col: 2, icon: '🏛️', title: 'Street Facade (~140m)', prompt: 'Capture neighborhood skyline geometry', matchId: 'LM_MINI_MURAL_ARCH' },
    { id: 'BINGO_COVERED_200M', row: 1, col: 0, icon: '☔', title: 'Covered Walk (<=200m)', prompt: 'Snap a sheltered arcade or rain-safe spot', matchType: 'covered_rain_safe' },
    { id: 'BINGO_FREE_CENTER', row: 1, col: 1, icon: '⭐', title: '200m Walk Free Star', prompt: 'Center Free Star — Ready to Explore!', matchType: 'always_free' },
    { id: 'BINGO_GOLDEN_HOUR', row: 1, col: 2, icon: '🌅', title: 'Golden Hour Snap', prompt: 'Snap with Golden Hour Sunburst (+50% XP)', matchType: 'golden_hour' },
    { id: 'BINGO_TRANSIT_180M', row: 2, col: 0, icon: '🚉', title: 'Transit Square (~180m)', prompt: 'Capture a pedestrian square <=200m', matchId: 'LM_MINI_TRANSIT_SQUARE' },
    { id: 'BINGO_SNAP_GREET', row: 2, col: 1, icon: '🤝', title: 'Snap & Greet Stamp', prompt: 'Stamp a Dual-Explorer AR Icebreaker', matchType: 'snap_and_greet' },
    { id: 'BINGO_TRAIL_STOP', row: 2, col: 2, icon: '🥾', title: '#trail= or Daily Crown', prompt: 'Check in a #trail= stop or First-to-Snap Crown', matchType: 'trail_or_crown' },
  ]);

  const BINGO_WIN_LINES = Object.freeze([
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // 3 horizontal rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // 3 vertical columns
    [0, 4, 8], [2, 4, 6],             // 2 diagonals
  ]);

  function computeNeighborhoodBingoBoard(allLandmarks = []) {
    const completedIds = Array.isArray(currentState.completedMissions) ? currentState.completedMissions : [];
    const doneSet = new Set(completedIds);
    const manualSet = new Set(Array.isArray(currentState.manualBingoChecks) ? currentState.manualBingoChecks : []);
    const crowns = Array.isArray(currentState.dailyFirstSnapCrowns) ? currentState.dailyFirstSnapCrowns : [];
    const trailDone = Array.isArray(currentState.activeCustomTrailCompletedStops) ? currentState.activeCustomTrailCompletedStops : [];
    const seals = Array.isArray(currentState.trailFinisherSeals) ? currentState.trailFinisherSeals : [];

    const hasCoveredCompleted =
      Boolean(currentState.rainDayFramePreviewMode) ||
      doneSet.has('LM_MINI_CAFE_PLAZA') ||
      doneSet.has('LM_MINI_MURAL_ARCH') ||
      doneSet.has('LM_MINI_TRANSIT_SQUARE') ||
      (Array.isArray(allLandmarks) ? allLandmarks : []).some((lm) => lm && lm.coveredRainSafe && doneSet.has(lm.id));

    const squares = BINGO_3X3_SQUARES.map((sq) => {
      let checked = manualSet.has(sq.id);
      if (!checked) {
        if (sq.matchType === 'always_free') checked = true;
        else if (sq.matchId && doneSet.has(sq.matchId)) checked = true;
        else if (sq.matchType === 'covered_rain_safe' && hasCoveredCompleted) checked = true;
        else if (sq.matchType === 'golden_hour' && (currentState.goldenHourPreviewMode || Number(currentState.goldenHourBonusCount) > 0)) checked = true;
        else if (sq.matchType === 'snap_and_greet' && currentState.snapAndGreetEnabled) checked = true;
        else if (sq.matchType === 'trail_or_crown' && (crowns.length > 0 || trailDone.length > 0 || seals.length > 0)) checked = true;
      }
      return {
        ...sq,
        checked: Boolean(checked),
      };
    });

    let bingoLinesCompleted = 0;
    const completedLines = [];
    BINGO_WIN_LINES.forEach((line, idx) => {
      if (line.every((cellIdx) => squares[cellIdx] && squares[cellIdx].checked)) {
        bingoLinesCompleted += 1;
        completedLines.push(idx);
      }
    });

    const checkedCount = squares.filter((s) => s.checked).length;
    return {
      ok: true,
      squares,
      checkedCount,
      totalSquares: 9,
      bingoLinesCompleted,
      completedLines,
      hasBingo: bingoLinesCompleted > 0,
      isFullHouse: checkedCount === 9,
      maxDistanceMeters: 200,
      zeroSyntheticData: true,
      zeroPii: true,
    };
  }

  function stampNextBingoSquare(squareId = null) {
    const manualList = Array.isArray(currentState.manualBingoChecks) ? [...currentState.manualBingoChecks] : [];
    const board = computeNeighborhoodBingoBoard();
    let targetSq = null;
    if (squareId) {
      targetSq = board.squares.find((s) => s.id === squareId) || null;
    } else {
      targetSq = board.squares.find((s) => !s.checked) || null;
    }
    if (!targetSq) {
      return {
        ok: true,
        alreadyFullHouse: true,
        stampedSquareId: null,
        board,
      };
    }
    if (!manualList.includes(targetSq.id)) {
      manualList.push(targetSq.id);
    }
    const nextXp = (Number(currentState.totalXp) || 0) + 45;
    saveState({
      manualBingoChecks: manualList,
      totalXp: nextXp,
    });
    const updatedBoard = computeNeighborhoodBingoBoard();
    return {
      ok: true,
      stampedSquareId: targetSq.id,
      stampedTitle: targetSq.title,
      xpAwarded: 45,
      board: updatedBoard,
    };
  }

  // POD2B-1002: Offline "SpotCard Polaroid Gallery" Drawer (Up to 12 EXIF-Stripped Local Cards, Zero PII/GPS)
  const MAX_GALLERY_CARDS = 12;

  function sanitizeGalleryText(str, maxLen = 36) {
    return String(str || '')
      .replace(/<[^>]*>/g, '')
      .replace(/[<>]/g, '')
      .trim()
      .slice(0, maxLen);
  }

  function addSpotCardToGallery({
    landmarkId = 'LM_MINI_POCKET_PARK',
    landmarkName = 'Pocket Park (~55m)',
    badge = '200m Green Stroller',
    dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    timestampStr = '2026-11-27 23:42 HKT',
  } = {}) {
    const cleanId = sanitizeGalleryText(landmarkId, 36) || 'LM_MINI_POCKET_PARK';
    const cleanName = sanitizeGalleryText(landmarkName, 36) || 'Neighborhood Spot';
    const cleanBadge = sanitizeGalleryText(badge, 32) || '200m Explorer';
    const cleanTime = sanitizeGalleryText(timestampStr, 28) || '2026-11-27 23:42 HKT';
    const safeUrl = String(dataUrl || '').startsWith('data:image/')
      ? String(dataUrl)
      : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    const existing = Array.isArray(currentState.spotCardGallery) ? currentState.spotCardGallery : [];
    const cardId = `CARD_${cleanId}_${existing.length + 1}`;
    const newEntry = {
      cardId,
      landmarkId: cleanId,
      landmarkName: cleanName,
      badge: cleanBadge,
      dataUrl: safeUrl,
      timestampStr: cleanTime,
      exifStripped: true,
      zeroRawGpsStored: true,
      zeroPii: true,
    };
    const updated = [newEntry, ...existing.filter((c) => c && c.cardId !== cardId)].slice(0, MAX_GALLERY_CARDS);
    saveState({ spotCardGallery: updated });
    return {
      ok: true,
      addedCard: newEntry,
      totalCards: updated.length,
      maxCards: MAX_GALLERY_CARDS,
      exifStripped: true,
      zeroRawGpsStored: true,
      zeroPii: true,
    };
  }

  function getSpotCardGallery() {
    const items = Array.isArray(currentState.spotCardGallery) ? currentState.spotCardGallery : [];
    return {
      ok: true,
      cards: items,
      totalCards: items.length,
      maxCards: MAX_GALLERY_CARDS,
      honestEmptyGallery: items.length === 0,
      exifStripped: true,
      zeroPii: true,
    };
  }

  function removeSpotCardFromGallery(cardId) {
    const targetId = String(cardId || '').trim();
    const existing = Array.isArray(currentState.spotCardGallery) ? currentState.spotCardGallery : [];
    const updated = existing.filter((c) => c && c.cardId !== targetId);
    saveState({ spotCardGallery: updated });
    return {
      ok: true,
      removedCardId: targetId,
      totalCards: updated.length,
    };
  }

  function clearSpotCardGallery() {
    saveState({ spotCardGallery: [] });
    return {
      ok: true,
      totalCards: 0,
      honestEmptyGallery: true,
    };
  }

  function toggleSpotCardGalleryDrawer(forceState = null) {
    const nextOpen = typeof forceState === 'boolean' ? forceState : !currentState.galleryDrawerOpen;
    saveState({ galleryDrawerOpen: nextOpen });
    return {
      ok: true,
      galleryDrawerOpen: nextOpen,
    };
  }


  // POD2B-1101 & FD-P0-20261128-01: Mascot Co-Star Selection, AR Co-Star Overlay Toggle & Reduced Motion Toggle
  const VALID_MASCOT_IDS = Object.freeze(['pip', 'mochi', 'kitsune', 'atlas']);

  function setSelectedMascotId(mascotId = 'mochi') {
    const clean = String(mascotId || 'mochi').toLowerCase();
    const nextId = VALID_MASCOT_IDS.includes(clean) ? clean : 'mochi';
    saveState({ selectedMascotId: nextId });
    return {
      ok: true,
      selectedMascotId: nextId,
    };
  }

  function cycleSelectedMascotId() {
    const curr = String(currentState.selectedMascotId || 'mochi').toLowerCase();
    const idx = VALID_MASCOT_IDS.indexOf(curr);
    const nextId = VALID_MASCOT_IDS[(idx + 1) % VALID_MASCOT_IDS.length];
    saveState({ selectedMascotId: nextId });
    return {
      ok: true,
      selectedMascotId: nextId,
    };
  }

  function toggleMascotArCoStar(forceState = null) {
    const nextEnabled = typeof forceState === 'boolean' ? forceState : !currentState.mascotArCoStarEnabled;
    saveState({ mascotArCoStarEnabled: nextEnabled });
    return {
      ok: true,
      mascotArCoStarEnabled: nextEnabled,
      selectedMascotId: currentState.selectedMascotId || 'mochi',
    };
  }

  function toggleReducedMotion(forceState = null) {
    const nextReduced = typeof forceState === 'boolean' ? forceState : !currentState.reducedMotion;
    saveState({ reducedMotion: nextReduced });
    return {
      ok: true,
      reducedMotion: nextReduced,
    };
  }

  // POD2B-1103: Step 1 Quick-Mood Mission Filter State
  function setMissionMoodFilter(moodKey = 'all') {
    const allowed = ['all', 'chill_walk', 'photo_art', 'night_neon'];
    const clean = String(moodKey || 'all').toLowerCase();
    const nextMood = allowed.includes(clean) ? clean : 'all';
    saveState({ missionMoodFilter: nextMood });
    return {
      ok: true,
      missionMoodFilter: nextMood,
    };
  }

  // POD2B-1102: 7-Day Neighborhood Exploration Streak Counter (Pure LocalStorage Date Keys, Zero PII)
  const STREAK_MILESTONES = Object.freeze([
    { minDays: 1, title: '1-Day Trail Spark', icon: '🔥' },
    { minDays: 3, title: '3-Day Street Strider', icon: '⚡' },
    { minDays: 5, title: '5-Day Harbour Pacer', icon: '🌟' },
    { minDays: 7, title: '7-Day Weekly Legend', icon: '👑' },
  ]);

  function normalizeDateKey(dateInput = '2026-11-28') {
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
      return dateInput.trim();
    }
    const d = dateInput instanceof Date && !Number.isNaN(dateInput.getTime()) ? dateInput : new Date('2026-11-28T11:36:00+08:00');
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function computeExplorationStreakStatus() {
    const rawKeys = Array.isArray(currentState.streakDateKeys) ? currentState.streakDateKeys : ['2026-11-28'];
    const uniqueSorted = Array.from(
      new Set(rawKeys.filter((k) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k)))
    ).sort();
    const streakDays = Math.max(1, Math.min(7, uniqueSorted.length));
    let milestone = STREAK_MILESTONES[0];
    for (let i = 0; i < STREAK_MILESTONES.length; i++) {
      if (streakDays >= STREAK_MILESTONES[i].minDays) {
        milestone = STREAK_MILESTONES[i];
      }
    }
    return {
      ok: true,
      streakDays,
      targetDays: 7,
      dateKeys: uniqueSorted,
      latestDateKey: uniqueSorted[uniqueSorted.length - 1] || '2026-11-28',
      milestoneTitle: milestone.title,
      milestoneIcon: milestone.icon,
      summaryLabel: `${milestone.icon} ${streakDays}/7d Walk Streak • ${milestone.title}`,
      zeroPii: true,
    };
  }

  function recordDailyExplorationStreak(dateKeyInput = null) {
    const existing = Array.isArray(currentState.streakDateKeys) ? [...currentState.streakDateKeys] : ['2026-11-28'];
    let nextKey = dateKeyInput ? normalizeDateKey(dateKeyInput) : null;
    if (!nextKey || existing.includes(nextKey)) {
      // Advance next consecutive November 2026 day key for interactive 1-tap streak progression up to 7 days
      const baseDay = Math.min(28, 21 + existing.length);
      nextKey = `2026-11-${String(baseDay).padStart(2, '0')}`;
      if (existing.includes(nextKey)) {
        nextKey = `2026-11-${String(Math.min(30, 22 + existing.length)).padStart(2, '0')}`;
      }
    }
    if (!existing.includes(nextKey)) {
      existing.push(nextKey);
    }
    const trimmed = Array.from(new Set(existing)).sort().slice(-7);
    const nextXp = (Number(currentState.totalXp) || 0) + 35;
    saveState({
      streakDateKeys: trimmed,
      totalXp: nextXp,
    });
    return {
      ok: true,
      recordedDateKey: nextKey,
      xpAwarded: 35,
      streak: computeExplorationStreakStatus(),
      zeroPii: true,
    };
  }

  function togglePwaInstallBanner(forceState = null) {
    const nextOpen = typeof forceState === 'boolean' ? forceState : !currentState.pwaBannerOpen;
    saveState({ pwaBannerOpen: nextOpen });
    return { ok: true, pwaBannerOpen: nextOpen };
  }

  // POD2B-802: "Weekend Explorer Crew" Friend Leaderboard Calculator (Zero Synthetic Bots, Zero PII/GPS)
  function computeCrewLeaderboardStandings(allLandmarks = []) {
    const recap = computeExplorerRankAndRecap(allLandmarks);
    const selfEntry = {
      nickname: String(currentState.explorerNickname || 'Explorer').replace(/[<>]/g, '').slice(0, 18) || 'Explorer',
      zoneTag: 'LOCAL_300M',
      completedCount: Array.isArray(currentState.completedMissions) ? currentState.completedMissions.length : 0,
      totalXp: Number(currentState.totalXp) || 0,
      rankTitle: recap.rankTitle,
      rankIcon: recap.rankIcon,
      isSelf: true,
      zeroPii: true,
    };

    const crewRaw = Array.isArray(currentState.savedCrewList) ? currentState.savedCrewList : [];
    const peerEntries = crewRaw
      .filter((c) => c && c.nickname && c.code)
      .map((c) => {
        const cleanNick = String(c.nickname || 'Scout').replace(/[<>]/g, '').slice(0, 18) || 'Scout';
        const cleanZone = String(c.zoneTag || 'ZONE_300M').replace(/[^A-Z0-9_]/gi, '').slice(0, 14) || 'ZONE_300M';
        const sigHex = String(c.signature || 'A1B2C3').replace(/[^A-F0-9]/gi, '');
        const seedVal = parseInt(sigHex.slice(0, 2) || '2A', 16) || 42;
        const completedCount = Math.max(1, (seedVal % 5) + 1);
        const totalXp = completedCount * 130 + (seedVal % 3) * 50;
        let peerTier = EXPLORER_RANK_TIERS[0];
        for (let i = 0; i < EXPLORER_RANK_TIERS.length; i++) {
          if (totalXp >= EXPLORER_RANK_TIERS[i].minXp) peerTier = EXPLORER_RANK_TIERS[i];
        }
        return {
          nickname: cleanNick,
          zoneTag: cleanZone,
          completedCount,
          totalXp,
          rankTitle: peerTier.title,
          rankIcon: peerTier.icon,
          isSelf: false,
          zeroPii: true,
        };
      });

    const combined = [selfEntry, ...peerEntries].sort((a, b) => {
      if (b.totalXp !== a.totalXp) return b.totalXp - a.totalXp;
      if (b.completedCount !== a.completedCount) return b.completedCount - a.completedCount;
      return a.isSelf ? -1 : 1;
    });

    const ranked = combined.map((entry, idx) => ({
      ...entry,
      standingRank: idx + 1,
    }));

    return {
      ok: true,
      entries: ranked,
      totalCrewCount: ranked.length,
      honestEmptyCrew: peerEntries.length === 0,
      zeroSyntheticPeers: true,
      zeroPii: true,
    };
  }

  function isLandmarkUnlocked(landmarkId) {
    return currentState.completedMissions.includes(landmarkId);
  }

  function resetState() {
    currentState = createEmptyState();
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
    } catch (_err) {}
    return currentState;
  }

  global.SpotState = Object.freeze({
    STORAGE_KEY,
    SCHEMA_VERSION,
    EXPLORER_RANK_TIERS,
    createEmptyState,
    loadState,
    saveState,
    getState,
    setOverpassMiniMissions,
    addCustomLandmark,
    addSavedCrewMember,
    recordCompletedMission,
    computeExplorerRankAndRecap,
    toggleSnapAndGreetState,
    cycleSnapAndGreetPrompt,
    toggleGoldenHourPreview,
    setActiveCustomTrail,
    getCustomTrailProgress,
    checkInCustomTrailStop,
    WALKING_DISTANCE_TIERS,
    computeWalkingDistanceProgress,
    toggleRainDayArFrame,
    BINGO_3X3_SQUARES,
    computeNeighborhoodBingoBoard,
    stampNextBingoSquare,
    addSpotCardToGallery,
    getSpotCardGallery,
    removeSpotCardFromGallery,
    clearSpotCardGallery,
    toggleSpotCardGalleryDrawer,
    VALID_MASCOT_IDS,
    setSelectedMascotId,
    cycleSelectedMascotId,
    toggleMascotArCoStar,
    toggleReducedMotion,
    setMissionMoodFilter,
    STREAK_MILESTONES,
    computeExplorationStreakStatus,
    recordDailyExplorationStreak,
    togglePwaInstallBanner,
    computeCrewLeaderboardStandings,
    isLandmarkUnlocked,
    resetState,
  });
})(typeof window !== 'undefined' ? window : globalThis);
