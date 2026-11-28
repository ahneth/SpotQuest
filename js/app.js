// Version: 2.1.0 | Last Modified: 2026-11-28 11:36 HKT | Build: 20261128_1136
// Module: js/app.js — Guided 4-Tab Controller (60dvh OSM Map with Live Overpass <=200m Public POIs & Big Mission X/6 Progress Tracker, AR Photo Carousel & Color Filters, Client-Server Lounge + Hardened Friend Code/QR, Explorer Passport & Weekly Rank Recap Card) & 40-Control Gate G3 Audit (Kai Lindqvist 17)
(function (global) {
  'use strict';

  let uploadedImg = null;
  let cameraStream = null;
  let cameraVideoEl = null;
  let cameraRafId = null;
  let toastTimer = null;
  let isDraggingMap = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragMoved = false;

  function createSafeEl(tag, className = '', text = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null && text !== '') {
      el.textContent = String(text);
    }
    return el;
  }

  function showToast(message) {
    if (typeof document === 'undefined') return;
    const toast = document.getElementById('sqToast');
    if (!toast) return;
    toast.textContent = String(message);
    toast.classList.add('is-visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 2800);
  }

  function stopCameraLoop() {
    if (cameraRafId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(cameraRafId);
      cameraRafId = null;
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      cameraStream = null;
    }
    cameraVideoEl = null;
  }

  function getAllLandmarks() {
    const state = global.SpotState.getState();
    return global.SpotGeoPrivacy.getCuratedLandmarks(state.customLandmarks, {
      anchorLat: state.userAnchorLat,
      anchorLon: state.userAnchorLon,
      overpassMiniMissions: state.overpassMiniMissions,
    });
  }

  function getVisibleLandmarks() {
    const state = global.SpotState.getState();
    const all = getAllLandmarks();
    const catFiltered = global.SpotGeoPrivacy.filterLandmarksByCategory(all, state.missionCategoryFilter, state.completedMissions);
    const baseList = catFiltered.length > 0 ? catFiltered : all;
    if (state.missionMoodFilter && state.missionMoodFilter !== 'all') {
      const moodRes = global.SpotGeoPrivacy.filterMiniMissionsByMood(baseList, state.missionMoodFilter, 200);
      return moodRes.filteredMissions.length > 0 ? moodRes.filteredMissions : baseList;
    }
    return baseList;
  }

  function getActiveLandmark() {
    const state = global.SpotState.getState();
    const visible = getVisibleLandmarks();
    const all = getAllLandmarks();
    return (
      visible.find((l) => l.id === state.selectedLandmarkId) ||
      all.find((l) => l.id === state.selectedLandmarkId) ||
      visible[0] ||
      all[0]
    );
  }

  function drawCurrentArFrame() {
    if (typeof document === 'undefined') return;
    const arCanvas = document.getElementById('sqArCanvas');
    if (!arCanvas) return;
    const state = global.SpotState.getState();
    const activeLm = getActiveLandmark();
    let media = null;
    if (state.photoSourceMode === 'camera' && cameraVideoEl && cameraVideoEl.readyState >= 2) {
      media = cameraVideoEl;
    } else if (state.photoSourceMode === 'upload' && uploadedImg) {
      media = uploadedImg;
    }
    const hasCrown =
      Array.isArray(state.dailyFirstSnapCrowns) &&
      state.dailyFirstSnapCrowns.includes(activeLm.id);
    const peerNick =
      state.savedCrewList && state.savedCrewList[0]
        ? state.savedCrewList[0].nickname
        : state.snapAndGreetPeerNickname || 'Nearby Scout';
    const snapGreetObj = state.snapAndGreetEnabled
      ? global.SpotArViewfinder.createSnapAndGreetStamp({
          explorerNickname: state.explorerNickname,
          peerNickname: peerNick,
          landmarkName: activeLm.shortName || activeLm.name,
          promptIndex: state.snapAndGreetPromptIdx || 0,
        })
      : null;
    global.SpotArViewfinder.renderSpotCardCanvas({
      canvas: arCanvas,
      landmark: activeLm,
      frameThemeKey: state.arFrameStyle,
      stickerKey: state.arStickerKey,
      colorFilterKey: state.arColorFilter || 'natural',
      stickerPos: state.stickerPos,
      explorerNickname: state.explorerNickname,
      isFirstToSnapToday: hasCrown,
      snapAndGreetStamp: snapGreetObj,
      goldenHourStatus: global.SpotGeoPrivacy.evaluateLocalGoldenHour(new Date(), Boolean(state.goldenHourPreviewMode)),
      sourceMedia: media,
    });
  }

  function startLiveCamera() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('📷 Camera unavailable here — try "Upload Photo" or "Neon Scene"!');
      return;
    }
    stopCameraLoop();
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        cameraStream = stream;
        const video = document.createElement('video');
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        video.srcObject = stream;
        video.play().catch(() => {});
        cameraVideoEl = video;
        global.SpotState.saveState({ photoSourceMode: 'camera' });
        showToast('📷 Live Camera Active! Tap the photo to move your AR sticker.');
        const tick = () => {
          if (!cameraStream) return;
          drawCurrentArFrame();
          cameraRafId = requestAnimationFrame(tick);
        };
        cameraRafId = requestAnimationFrame(tick);
      })
      .catch(() => {
        showToast('📷 Camera permission denied — use "Upload Photo" or "Neon Scene"!');
      });
  }

  function setActiveStep(stepNum) {
    const n = Math.min(4, Math.max(1, Number(stepNum) || 1));
    if (n !== 2) stopCameraLoop();
    global.SpotState.saveState({ activeStep: n });
    renderUI();
  }

  function applyFavicon() {
    if (typeof document === 'undefined' || !global.SpotPro) return;
    const uri = global.SpotPro.getLogoDataUri();
    const iconEl = document.getElementById('sqFavicon');
    const appleEl = document.getElementById('sqAppleIcon');
    const brandImg = document.getElementById('sqBrandLogoImg');
    const manifestEl = document.getElementById('sqWebManifest');
    if (iconEl) iconEl.setAttribute('href', uri);
    if (appleEl) appleEl.setAttribute('href', uri);
    if (brandImg) brandImg.setAttribute('src', uri);
    if (manifestEl && typeof global.SpotPro.getWebAppManifestDataUri === 'function') {
      manifestEl.setAttribute('href', global.SpotPro.getWebAppManifestDataUri());
    }
  }

  function renderUI() {
    if (typeof document === 'undefined') return;
    const state = global.SpotState.getState();
    const allLandmarks = getAllLandmarks();
    const visibleLandmarks = getVisibleLandmarks();
    const activeLm = getActiveLandmark();
    const isUnlocked = global.SpotState.isLandmarkUnlocked(activeLm.id);
    const recap = global.SpotState.computeExplorerRankAndRecap(allLandmarks);

    // 1. Header XP, Rank Badge & Honest Server Connection Badge
    const xpPill = document.getElementById('sqXpBadge');
    if (xpPill) {
      xpPill.textContent = `${recap.rankIcon} ${recap.rankTitle} • ⭐ ${state.totalXp} XP`;
    }

    const connStatus = global.SpotLounge.getConnectionStatus();
    const connBadge = document.getElementById('sqConnStatusBadge');
    if (connBadge) {
      if (connStatus.isLiveServer) {
        connBadge.textContent = `🟢 Live Server (${connStatus.livePeerCount} in zone)`;
        connBadge.classList.add('is-live');
      } else {
        connBadge.textContent = '⚪ Offline / Local Mode (0 synthetic bots)';
        connBadge.classList.remove('is-live');
      }
    }

    // 2. Stepper tabs (1..4)
    [1, 2, 3, 4].forEach((n) => {
      const tab = document.getElementById(`sqStepTab${n}`);
      const screen = document.getElementById(`sqScreen${n}`);
      const isActive = state.activeStep === n;
      if (tab) tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (screen) {
        if (isActive) screen.removeAttribute('hidden');
        else screen.setAttribute('hidden', 'hidden');
      }
    });

    const step3Badge = document.getElementById('sqStep3Label');
    if (step3Badge) {
      step3Badge.textContent = isUnlocked ? '💬 3. Lounge (Open!)' : '🔒 3. Local Lounge';
    }

    // 3. Speed-lock safety alert
    const speedCheck = global.SpotGeoPrivacy.evaluateSpeedLockSafety(state.simulatedSpeedMps);
    const speedAlert = document.getElementById('sqSpeedLockAlert');
    const btnSnap = document.getElementById('btnSnapSpotCard');
    if (speedAlert) {
      if (!speedCheck.allowed) {
        speedAlert.removeAttribute('hidden');
        speedAlert.textContent = speedCheck.warning;
      } else {
        speedAlert.setAttribute('hidden', 'hidden');
      }
    }
    if (btnSnap) btnSnap.disabled = !speedCheck.allowed;

    // 4. FD-P0-20261124-01 Category Filter Buttons (Mini-Missions <=200m vs Big Missions vs All)
    const pwaBannerEl = document.getElementById('sqPwaInstallBanner');
    if (pwaBannerEl) {
      if (state.pwaBannerOpen) pwaBannerEl.removeAttribute('hidden');
      else pwaBannerEl.setAttribute('hidden', 'hidden');
    }

    const unvisitedMeta = global.SpotGeoPrivacy.filterUnvisitedNearbyMiniMissions(
      allLandmarks,
      state.completedMissions,
      200
    );
    const btnCatUnvisited = document.getElementById('btnCategoryUnvisitedMini');
    if (btnCatUnvisited) {
      btnCatUnvisited.textContent = `🆕 Unvisited Near Me (${unvisitedMeta.remainingCount} <=200m)`;
    }

    // POD2B-901: Update Cumulative Walking Distance Meter & Step-Goal Badge Pill
    const walkingProgress = global.SpotState.computeWalkingDistanceProgress(allLandmarks);
    const walkPillEl = document.getElementById('sqWalkingMeterPill');
    if (walkPillEl && walkingProgress) {
      walkPillEl.textContent = walkingProgress.summaryLabel;
    }

    // POD2B-1102: Update 7-Day Neighborhood Exploration Streak Counter Pill
    const streakInfo = global.SpotState.computeExplorationStreakStatus();
    const streakPillEl = document.getElementById('sqStreakCounterPill');
    if (streakPillEl && streakInfo) {
      streakPillEl.textContent = streakInfo.summaryLabel;
    }

    // FD-P0-20261128-01 & POD2B-1101: Render Prominent Global Mascot Hero Stage & Per-Step Mascot Companion Stages
    const activeMascot = global.SpotMascots.getMascot(state.selectedMascotId || 'mochi');
    const heroImg = document.getElementById('sqMascotHeroImg');
    if (heroImg) {
      heroImg.setAttribute('src', global.SpotMascots.getMascotDataUri(activeMascot.id, activeMascot.defaultExpression, 72));
    }
    const avatarRing = document.getElementById('sqMascotAvatarRing');
    if (avatarRing) {
      avatarRing.classList.toggle('is-reduced-motion', Boolean(state.reducedMotion));
    }
    const heroTitle = document.getElementById('sqMascotHeroTitle');
    if (heroTitle) {
      heroTitle.textContent = `${activeMascot.emoji} ${activeMascot.name} • ${activeMascot.archetype}`;
    }
    const heroSpeech = document.getElementById('sqMascotHeroSpeech');
    if (heroSpeech) {
      const stepKey = `step${state.currentStep || 1}`;
      heroSpeech.textContent = `"${global.SpotMascots.getMascotLine(activeMascot.id, 'spotquest', stepKey)}"`;
    }

    const mascotBtnMap = {
      pip: 'btnMascotPip',
      mochi: 'btnMascotMochi',
      kitsune: 'btnMascotKitsune',
      atlas: 'btnMascotAtlas',
    };
    Object.keys(mascotBtnMap).forEach((mKey) => {
      const mBtn = document.getElementById(mascotBtnMap[mKey]);
      if (mBtn) {
        const isSel = activeMascot.id === mKey;
        mBtn.setAttribute('aria-pressed', isSel ? 'true' : 'false');
        mBtn.classList.toggle('sq-btn-emerald', isSel);
      }
    });

    const btnReducedMotion = document.getElementById('btnToggleReducedMotion');
    if (btnReducedMotion) {
      btnReducedMotion.setAttribute('aria-pressed', state.reducedMotion ? 'true' : 'false');
      btnReducedMotion.textContent = state.reducedMotion ? '✨ Motion: Reduced' : '✨ Motion: On';
    }

    // Update Per-Step Prominent Mascot Avatars (Step 1 Mochi, Step 2 Selected Co-Star, Step 3 Atlas/Kitsune, Step 4 Atlas/Pip)
    const s1Img = document.getElementById('sqStep1MascotImg');
    if (s1Img) s1Img.setAttribute('src', global.SpotMascots.getMascotDataUri('mochi', 'happy', 64));
    const s2Img = document.getElementById('sqStep2MascotImg');
    if (s2Img) s2Img.setAttribute('src', global.SpotMascots.getMascotDataUri(activeMascot.id, 'hyped', 64));
    const s3Img = document.getElementById('sqStep3MascotImg');
    if (s3Img) s3Img.setAttribute('src', global.SpotMascots.getMascotDataUri('atlas', 'guardian', 64));
    const s4Img = document.getElementById('sqStep4MascotImg');
    if (s4Img) s4Img.setAttribute('src', global.SpotMascots.getMascotDataUri('pip', 'hyped', 64));

    const btnMascotAr = document.getElementById('btnToggleMascotArCoStar');
    if (btnMascotAr) {
      const arOn = state.mascotArCoStarEnabled !== false;
      btnMascotAr.setAttribute('aria-pressed', arOn ? 'true' : 'false');
      btnMascotAr.textContent = arOn
        ? `🐾 ${activeMascot.shortName} AR Co-Star (ON)`
        : `🐾 ${activeMascot.shortName} AR Co-Star (OFF)`;
    }

    // POD2B-1103: Update Step 1 Quick-Mood Mission Filter Pills
    const moodMap = {
      all: 'btnMoodAll',
      chill_walk: 'btnMoodChillWalk',
      photo_art: 'btnMoodPhotoArt',
      night_neon: 'btnMoodNightNeon',
    };
    const activeMood = state.missionMoodFilter || 'all';
    Object.keys(moodMap).forEach((mKey) => {
      const el = document.getElementById(moodMap[mKey]);
      if (el) el.setAttribute('aria-pressed', activeMood === mKey ? 'true' : 'false');
    });
    const moodStatusEl = document.getElementById('sqMoodFilterStatusText');
    if (moodStatusEl) {
      const moodRes = global.SpotGeoPrivacy.filterMiniMissionsByMood(allLandmarks, activeMood, 200);
      moodStatusEl.textContent = activeMood === 'all'
        ? 'All <=200m Walk Vibes Active'
        : `Mood: ${activeMood.replace('_', ' ').toUpperCase()} (${moodRes.matchCount} spots <=200m)`;
    }

    // POD2B-902: Update Covered / Rain-Safe Mini-Mission Chip Count
    const coveredMeta = global.SpotGeoPrivacy.filterCoveredRainSafeMiniMissions(allLandmarks, 200);
    const btnCatCovered = document.getElementById('btnCategoryCoveredMini');
    if (btnCatCovered) {
      btnCatCovered.textContent = `☔ Covered / Rain-Safe (${coveredMeta.coveredCount} <=200m)`;
    }

    const catMap = {
      mini: 'btnCategoryMini',
      unvisited_mini: 'btnCategoryUnvisitedMini',
      covered_mini: 'btnCategoryCoveredMini',
      big: 'btnCategoryBig',
      all: 'btnCategoryAll',
    };
    Object.entries(catMap).forEach(([key, btnId]) => {
      const el = document.getElementById(btnId);
      if (el) el.setAttribute('aria-pressed', state.missionCategoryFilter === key ? 'true' : 'false');
    });

    // POD2B-503: Big Mission Multi-Stop Progress Bar & Next-Stop Centering
    const bigProgress = global.SpotGeoPrivacy.computeBigMissionTrailProgress(
      allLandmarks,
      state.completedMissions
    );
    const bigProgressTextEl = document.getElementById('sqBigTrailProgressText');
    const bigProgressFillEl = document.getElementById('sqBigTrailProgressFill');
    const btnCenterNextBig = document.getElementById('btnCenterNextBigStop');
    if (bigProgressTextEl) {
      bigProgressTextEl.textContent = `🗺️ City-Wide Big Missions Progress: ${bigProgress.completedBig}/${bigProgress.totalBig} Unlocked (${bigProgress.percent}%)`;
    }
    if (bigProgressFillEl) {
      bigProgressFillEl.style.width = `${bigProgress.percent}%`;
    }
    if (btnCenterNextBig) {
      btnCenterNextBig.textContent = bigProgress.allCompleted
        ? '🏆 All 6/6 Big Missions Completed!'
        : `🎯 Center Next Stop: ${bigProgress.nextStopName} →`;
    }

    // POD2B-602 & POD2B-702: Custom Walking Trail (#trail=) Stop Check-In & Finisher Seal UI Status
    const customTrailStatusEl = document.getElementById('sqCustomTrailStatusText');
    const trailProg = global.SpotState.getCustomTrailProgress();
    if (customTrailStatusEl && trailProg.hasActiveTrail) {
      const sealTag = trailProg.isTrailFinished
        ? ' • 🏅 TRAIL FINISHER SEAL UNLOCKED!'
        : ` • ${trailProg.completedCount}/${trailProg.totalCount} Checked In (${trailProg.percent}%)`;
      customTrailStatusEl.textContent = `🥾 Active Trail: ${trailProg.title}${sealTag}`;
    }

    // POD2B-701: Golden Hour Bonus XP & Sunburst AR Stamp UI
    const btnGoldenHour = document.getElementById('btnToggleGoldenHourPreview');
    const ghStatus = global.SpotGeoPrivacy.evaluateLocalGoldenHour(new Date(), Boolean(state.goldenHourPreviewMode));
    if (btnGoldenHour) {
      btnGoldenHour.setAttribute('aria-pressed', ghStatus.isGoldenHour ? 'true' : 'false');
      btnGoldenHour.textContent = ghStatus.isGoldenHour
        ? '🌅 Golden Hour Sunburst (ON • +50% XP)'
        : '🌅 Golden Hour Sunburst (+50% XP)';
    }

    // POD2B-902: Covered / Rain-Day Neon Arcade AR Frame Toggle UI
    const btnRainFrame = document.getElementById('btnToggleRainDayArFrame');
    if (btnRainFrame) {
      const rainActive = Boolean(state.rainDayFramePreviewMode) || state.selectedFrameTheme === 'rain_neon_arcade';
      btnRainFrame.setAttribute('aria-pressed', rainActive ? 'true' : 'false');
      btnRainFrame.textContent = rainActive
        ? '☔ Rain-Day AR Frame (ON)'
        : '☔ Rain-Day AR Frame';
    }

    // POD2B-601: Snap & Greet 1-Tap AR Icebreaker Stamp UI
    const btnSnapGreet = document.getElementById('btnToggleSnapGreetStamp');
    const snapGreetStatusEl = document.getElementById('sqSnapGreetStatusText');
    if (btnSnapGreet) {
      btnSnapGreet.setAttribute('aria-pressed', state.snapAndGreetEnabled ? 'true' : 'false');
      btnSnapGreet.textContent = state.snapAndGreetEnabled
        ? '🤝 Snap & Greet Stamp (ON)'
        : '🤝 Snap & Greet Stamp (Off)';
    }
    if (snapGreetStatusEl) {
      const pIdx = Math.abs(Number(state.snapAndGreetPromptIdx) || 0) % global.SpotArViewfinder.SNAP_AND_GREET_PROMPTS.length;
      const promptStr = global.SpotArViewfinder.SNAP_AND_GREET_PROMPTS[pIdx];
      snapGreetStatusEl.textContent = state.snapAndGreetEnabled
        ? `🤝 Stamp Active: "${promptStr}"`
        : 'Dual-Explorer AR Icebreaker Frame ready (EXIF stripped • 300m chat floor)';
    }

    // POD2B-603: Muted Explorers Status Text
    const mutedTextEl = document.getElementById('sqMutedExplorersText');
    if (mutedTextEl) {
      const mutedList = global.SpotLounge.getMutedExplorers();
      mutedTextEl.textContent =
        mutedList.length > 0
          ? `Muted handles (${mutedList.length}): ${mutedList.join(', ')}`
          : 'Muted handles (0): None';
    }

    // 5. Screen 1: Large 60dvh Interactive OSM Map Canvas & Selected Spot Card
    const mapCanvas = document.getElementById('sqMapCanvas');
    if (mapCanvas) {
      global.SpotMapRadar.renderNeighborhoodRadar(
        mapCanvas,
        visibleLandmarks,
        activeLm.id,
        state.completedMissions,
        {
          centerLat: state.mapCenterLat,
          centerLon: state.mapCenterLon,
          anchorLat: state.userAnchorLat,
          anchorLon: state.userAnchorLon,
          zoom: state.mapZoom,
          tileMode: state.mapTileMode,
          categoryFilter: state.missionCategoryFilter,
          onTileLoaded: () => {
            if (global.SpotState.getState().activeStep === 1) {
              global.SpotMapRadar.renderNeighborhoodRadar(
                mapCanvas,
                getVisibleLandmarks(),
                activeLm.id,
                state.completedMissions,
                {
                  centerLat: global.SpotState.getState().mapCenterLat,
                  centerLon: global.SpotState.getState().mapCenterLon,
                  anchorLat: global.SpotState.getState().userAnchorLat,
                  anchorLon: global.SpotState.getState().userAnchorLon,
                  zoom: global.SpotState.getState().mapZoom,
                  tileMode: global.SpotState.getState().mapTileMode,
                  categoryFilter: global.SpotState.getState().missionCategoryFilter,
                }
              );
            }
          },
        }
      );
    }

    const btnTileMode = document.getElementById('btnToggleMapTiles');
    if (btnTileMode) {
      btnTileMode.textContent =
        state.mapTileMode === 'osm_streets' ? '🗺️ OSM Streets (On)' : '🌐 Vector Grid (Offline)';
    }

    const pulse = global.SpotLounge.getLandmarkActivityPulse(activeLm.id);
    const pulseBadgeEl = document.getElementById('sqSelectedSpotPulse');
    if (pulseBadgeEl) {
      pulseBadgeEl.textContent = pulse.dailyCheckInCount > 0
        ? `👑 ${pulse.dailyCheckInCount} real check-in(s) today (First: ${pulse.firstSnapExplorer})`
        : '👑 0 snaps today — be First-to-Snap for +50 Crown XP!';
    }

    const spotNameEl = document.getElementById('sqSelectedSpotName');
    const spotPromptEl = document.getElementById('sqSelectedSpotPrompt');
    const spotMetaEl = document.getElementById('sqSelectedSpotMeta');
    const btnStartMission = document.getElementById('btnStartMissionHere');
    if (spotNameEl) spotNameEl.textContent = activeLm.name;
    if (spotPromptEl) spotPromptEl.textContent = activeLm.missionPrompt;
    if (spotMetaEl) {
      const walkStr = activeLm.walkingLabel || `~${activeLm.distanceMeters || 65}m · 1 min walk`;
      spotMetaEl.textContent = `${walkStr} • ${activeLm.category} • +${activeLm.xpReward} XP`;
    }
    if (btnStartMission) {
      btnStartMission.textContent = isUnlocked
        ? `📸 Snap Another Photo at ${activeLm.shortName} →`
        : `📸 Start AR Mission (${activeLm.walkingLabel || '<=200m walk'}) →`;
    }

    const spotGrid = document.getElementById('sqSpotChipGrid');
    if (spotGrid) {
      while (spotGrid.firstChild) spotGrid.removeChild(spotGrid.firstChild);
      visibleLandmarks.forEach((lm) => {
        const done = state.completedMissions.includes(lm.id);
        const btn = createSafeEl(
          'button',
          `sq-spot-chip${lm.id === activeLm.id ? ' is-selected' : ''}`
        );
        btn.type = 'button';
        const iconPrefix = done ? '✅ ' : lm.missionCategory === 'mini' ? '🚶 ' : lm.isCustom ? '★ ' : '🗺️ ';
        btn.appendChild(createSafeEl('span', '', `${iconPrefix}${lm.shortName}`));
        btn.appendChild(
          createSafeEl('span', 'sq-spot-chip-sub', `${lm.walkingLabel || lm.district} • +${lm.xpReward} XP`)
        );
        btn.addEventListener('click', () => {
          global.SpotAudio.playCue('tap');
          const nextZoom = lm.missionCategory === 'mini' ? 16 : 13;
          global.SpotState.saveState({
            selectedLandmarkId: lm.id,
            mapCenterLat: lm.lat,
            mapCenterLon: lm.lon,
            mapZoom: nextZoom,
            lastMissionCompletedId: null,
          });
          showToast(`📍 Selected ${lm.name} (${lm.walkingLabel || lm.district})`);
          renderUI();
        });
        spotGrid.appendChild(btn);
      });
    }

    // 6. Screen 2: AR Viewfinder + POD2B-402 Sticker Carousel & Color-Grade Filters
    const arMissionBanner = document.getElementById('sqArMissionBanner');
    if (arMissionBanner) {
      arMissionBanner.textContent = `Mission at ${activeLm.name} (${activeLm.walkingLabel || '<=200m'}): ${activeLm.missionPrompt}`;
    }

    const curStickerObj =
      global.SpotArViewfinder.AR_STICKERS[state.arStickerKey] ||
      global.SpotArViewfinder.AR_STICKERS.compass;
    const activeStickerLabel = document.getElementById('sqActiveStickerLabel');
    if (activeStickerLabel) {
      activeStickerLabel.textContent = curStickerObj.label;
    }

    const stickerRow = document.getElementById('sqStickerRow');
    if (stickerRow) {
      while (stickerRow.firstChild) stickerRow.removeChild(stickerRow.firstChild);
      Object.entries(global.SpotArViewfinder.AR_STICKERS).forEach(([key, st]) => {
        const b = createSafeEl('button', 'sq-pill-btn', st.label);
        b.type = 'button';
        b.setAttribute('aria-pressed', state.arStickerKey === key ? 'true' : 'false');
        b.addEventListener('click', () => {
          global.SpotAudio.playCue('tap');
          global.SpotState.saveState({ arStickerKey: key });
          showToast(`Sticker switched to ${st.label}`);
          renderUI();
        });
        stickerRow.appendChild(b);
      });
    }

    const filterRow = document.getElementById('sqFilterRow');
    if (filterRow) {
      while (filterRow.firstChild) filterRow.removeChild(filterRow.firstChild);
      Object.entries(global.SpotArViewfinder.AR_COLOR_FILTERS).forEach(([key, flt]) => {
        const b = createSafeEl('button', 'sq-pill-btn', flt.label);
        b.type = 'button';
        b.setAttribute('aria-pressed', (state.arColorFilter || 'natural') === key ? 'true' : 'false');
        b.addEventListener('click', () => {
          global.SpotAudio.playCue('tap');
          global.SpotState.saveState({ arColorFilter: key });
          showToast(`Color Filter set to ${flt.label}`);
          renderUI();
        });
        filterRow.appendChild(b);
      });
    }

    const frameRow = document.getElementById('sqFrameRow');
    if (frameRow) {
      while (frameRow.firstChild) frameRow.removeChild(frameRow.firstChild);
      Object.entries(global.SpotArViewfinder.AR_FRAME_THEMES).forEach(([key, th]) => {
        const b = createSafeEl('button', 'sq-pill-btn', th.label);
        b.type = 'button';
        b.setAttribute('aria-pressed', state.arFrameStyle === key ? 'true' : 'false');
        b.addEventListener('click', () => {
          global.SpotAudio.playCue('tap');
          global.SpotState.saveState({ arFrameStyle: key });
          showToast(`Frame set to ${th.label}`);
          renderUI();
        });
        frameRow.appendChild(b);
      });
    }

    drawCurrentArFrame();

    const celBox = document.getElementById('sqCelebrationBox');
    if (celBox) {
      if (isUnlocked) celBox.removeAttribute('hidden');
      else celBox.setAttribute('hidden', 'hidden');
    }

    // 7. Screen 3: Local Lounge, PingPod & Hardened Friend Code / QR Connect
    renderLounge(activeLm, isUnlocked, connStatus);

    // 8. Screen 4: Explorer Passport & Neighborhood Explorer Rank / Weekly Recap Card (POD2B-502)
    const passportCanvas = document.getElementById('sqPassportCanvas');
    if (passportCanvas) {
      global.SpotArViewfinder.renderExplorerPassportCanvas({
        canvas: passportCanvas,
        landmarks: allLandmarks,
        completedIds: state.completedMissions,
        explorerNickname: state.explorerNickname,
        totalXp: state.totalXp,
        trailFinisherSeals: state.trailFinisherSeals,
        activeTrailProgress: trailProg,
        walkingProgress,
      });
    }

    const recapCanvas = document.getElementById('sqRecapCanvas');
    if (recapCanvas) {
      global.SpotArViewfinder.renderExplorerRecapCardCanvas({
        canvas: recapCanvas,
        recap,
      });
    }

    const crewCanvas = document.getElementById('sqCrewLeaderboardCanvas');
    if (crewCanvas) {
      const standings = global.SpotState.computeCrewLeaderboardStandings(allLandmarks);
      global.SpotArViewfinder.renderCrewLeaderboardCardCanvas({
        canvas: crewCanvas,
        standings,
      });
    }

    // POD2B-1001: Render Weekend 3x3 Neighborhood Bingo Card Canvas
    const bingoCanvas = document.getElementById('sqBingoCanvas');
    const bingoBoard = global.SpotState.computeNeighborhoodBingoBoard(allLandmarks);
    if (bingoCanvas) {
      global.SpotArViewfinder.renderNeighborhoodBingoCardCanvas({
        canvas: bingoCanvas,
        bingoBoard,
        explorerNickname: state.explorerNickname,
      });
    }

    // POD2B-1002: Render Offline SpotCard Polaroid Gallery Drawer
    const galleryInfo = global.SpotState.getSpotCardGallery();
    const btnToggleGallery = document.getElementById('btnToggleSpotCardGallery');
    if (btnToggleGallery) {
      btnToggleGallery.textContent = `🖼️ Polaroid Gallery (${galleryInfo.totalCards}/${galleryInfo.maxCards})`;
    }
    const galleryDrawerEl = document.getElementById('sqSpotCardGalleryDrawer');
    if (galleryDrawerEl) {
      if (state.galleryDrawerOpen) galleryDrawerEl.removeAttribute('hidden');
      else galleryDrawerEl.setAttribute('hidden', 'hidden');
    }
    const galleryStatusEl = document.getElementById('sqSpotCardGalleryStatusText');
    if (galleryStatusEl) {
      galleryStatusEl.textContent = galleryInfo.honestEmptyGallery
        ? '0/12 Polaroids saved locally — snap an AR mission in Step 2 to save your first Zero-EXIF Polaroid!'
        : `${galleryInfo.totalCards}/${galleryInfo.maxCards} Zero-EXIF Polaroids saved locally (Latest: ${galleryInfo.cards[0].landmarkName} • ${galleryInfo.cards[0].badge}).`;
    }
    const galleryGridEl = document.getElementById('sqSpotCardGalleryGrid');
    if (galleryGridEl) {
      while (galleryGridEl.firstChild) galleryGridEl.removeChild(galleryGridEl.firstChild);
      if (galleryInfo.honestEmptyGallery) {
        galleryGridEl.appendChild(
          createSafeEl('div', 'sq-badge sq-badge-cyan', '📷 Honest Empty Gallery: 0 Polaroids stored yet (Zero synthetic photos).')
        );
      } else {
        galleryInfo.cards.forEach((card) => {
          const itemEl = createSafeEl(
            'div',
            'sq-badge sq-badge-emerald',
            `📸 ${card.landmarkName} • ${card.badge} (${card.timestampStr})`
          );
          galleryGridEl.appendChild(itemEl);
        });
      }
    }
  }

  function renderLounge(activeLm, isUnlocked, connStatus) {
    const state = global.SpotState.getState();
    const lockedCard = document.getElementById('sqLoungeLockedCard');
    const unlockedArea = document.getElementById('sqLoungeUnlockedArea');
    const titleEl = document.getElementById('sqLoungeSpotTitle');
    const peerBannerEl = document.getElementById('sqHonestPeerBanner');
    if (titleEl) titleEl.textContent = `${activeLm.name} — 4h Local Lounge`;

    const pulse = global.SpotLounge.getLandmarkActivityPulse(activeLm.id);
    if (peerBannerEl) {
      peerBannerEl.textContent = connStatus.isLiveServer
        ? `🟢 Connected to live 300m zone room (${activeLm.zone.zoneId}) • ${connStatus.livePeerCount} explorers online • ${pulse.dailyCheckInCount} snaps today.`
        : `⚪ 0 other live explorers in ${activeLm.zone.zoneId} right now (Local/Offline Mode — 0 synthetic bots • ${pulse.dailyCheckInCount} local snap(s) today).`;
    }

    if (lockedCard && unlockedArea) {
      if (isUnlocked) {
        lockedCard.setAttribute('hidden', 'hidden');
        unlockedArea.removeAttribute('hidden');
      } else {
        lockedCard.removeAttribute('hidden');
        unlockedArea.setAttribute('hidden', 'hidden');
        return;
      }
    }

    const activePod = global.SpotLounge.getActivePingPod(activeLm.id);
    const podStatusEl = document.getElementById('sqPingPodStatusText');
    const btnPingPod = document.getElementById('btnStartPingPod');
    const btnLeavePod = document.getElementById('btnLeavePingPod');
    if (podStatusEl && btnPingPod && btnLeavePod) {
      if (activePod) {
        podStatusEl.textContent = `Active PingPod (${activePod.members.length}/${activePod.maxMembers} explorers: ${activePod.members.join(', ')}) • 60m TTL • Waiting for ${Math.max(0, activePod.minMembers - activePod.members.length)} more real nearby explorers (0 fake bots).`;
        btnPingPod.textContent = '✓ In PingPod Squad';
        btnLeavePod.removeAttribute('hidden');
      } else {
        podStatusEl.textContent = 'Form a 3–6 person 60-minute group photo mission at this public landmark.';
        btnPingPod.textContent = '🤝 Start 3–6 Person PingPod';
        btnLeavePod.setAttribute('hidden', 'hidden');
      }
    }

    const generated = global.SpotLounge.generateFriendCode({
      nickname: state.explorerNickname,
      zoneId: activeLm.zone.zoneId,
      badge: activeLm.badge,
    });
    const codeStr = generated.ok ? generated.code : 'SQ-EXPLORER-ZONE_300M-SAFE00';
    const invitePreviewEl = document.getElementById('sqLandmarkInvitePreviewText');
    if (invitePreviewEl) {
      const inv = global.SpotLounge.generateLandmarkInviteCard({
        landmarkName: activeLm.name,
        district: activeLm.walkingLabel || activeLm.district,
        zoneId: activeLm.zone.zoneId,
        nickname: state.explorerNickname,
      });
      if (inv.ok) invitePreviewEl.textContent = inv.inviteText;
    }

    const codeDisplayEl = document.getElementById('sqMyFriendCodeText');
    if (codeDisplayEl) {
      codeDisplayEl.textContent = codeStr;
    }
    const qrCanvas = document.getElementById('sqFriendQrCanvas');
    if (qrCanvas) {
      global.SpotArViewfinder.renderFriendCodeQrCanvas({
        canvas: qrCanvas,
        codeString: codeStr,
        nickname: state.explorerNickname,
      });
    }

    const crewListEl = document.getElementById('sqSavedCrewList');
    if (crewListEl) {
      while (crewListEl.firstChild) crewListEl.removeChild(crewListEl.firstChild);
      const crew = state.savedCrewList && state.savedCrewList.length
        ? state.savedCrewList
        : global.SpotLounge.getSavedCrew();
      if (!crew || crew.length === 0) {
        crewListEl.appendChild(
          createSafeEl('span', 'sq-badge', '0 saved crew members yet (exchange a verified Friend Code above)')
        );
      } else {
        crew.forEach((c) => {
          crewListEl.appendChild(
            createSafeEl('span', 'sq-badge sq-badge-emerald', `🤝 ${c.nickname} (${c.zoneTag})`)
          );
        });
      }
    }

    const quickRow = document.getElementById('sqQuickReplyRow');
    if (quickRow) {
      while (quickRow.firstChild) quickRow.removeChild(quickRow.firstChild);
      global.SpotLounge.ICEBREAKER_CHIPS.forEach((chipText) => {
        const btn = createSafeEl('button', 'sq-pill-btn', chipText);
        btn.type = 'button';
        btn.addEventListener('click', () => {
          postToCurrentLounge(chipText);
        });
        quickRow.appendChild(btn);
      });
    }

    const feedEl = document.getElementById('sqLoungeFeed');
    if (!feedEl) return;
    while (feedEl.firstChild) feedEl.removeChild(feedEl.firstChild);

    const messages = global.SpotLounge.getMessages(activeLm.id);
    if (messages.length === 0) {
      const empty = createSafeEl(
        'div',
        '',
        '0 explorers have posted in this 300m zone in the last 4 hours — share your SpotCard or drop the first real hello below! (Zero synthetic bots).'
      );
      empty.style.color = '#94a3b8';
      empty.style.fontSize = '0.84rem';
      empty.style.textAlign = 'center';
      empty.style.padding = '22px 10px';
      feedEl.appendChild(empty);
      return;
    }

    messages.forEach((m) => {
      const row = createSafeEl('div', 'sq-msg-item');
      const head = createSafeEl(
        'div',
        'sq-msg-head',
        `${m.nickname} • ${activeLm.district} (~300m) • Auto-deletes in 4h`
      );
      const body = createSafeEl('div', '', m.text);
      const actions = createSafeEl('div', 'sq-pill-row');
      actions.style.marginTop = '8px';

      const btnFriend = createSafeEl('button', 'sq-btn sq-btn-sm', '🤝 Add Friend');
      btnFriend.type = 'button';
      btnFriend.addEventListener('click', () => {
        global.SpotLounge.sendMutualFriendRequest(m.nickname, activeLm.id);
        global.SpotAudio.playCue('tap');
        btnFriend.textContent = '✓ Friend Request Sent';
        showToast(`🤝 Mutual friend request sent to ${m.nickname}!`);
      });

      const btnBlock = createSafeEl('button', 'sq-btn sq-btn-sm', '🚫 Block');
      btnBlock.type = 'button';
      btnBlock.addEventListener('click', () => {
        global.SpotLounge.blockUser(m.userId);
        showToast(`Blocked ${m.nickname}.`);
        renderUI();
      });

      const btnReport = createSafeEl('button', 'sq-btn sq-btn-sm', '🚩 Report');
      btnReport.type = 'button';
      btnReport.addEventListener('click', () => {
        global.SpotLounge.reportMessage(m.id);
        btnReport.textContent = '🚩 Reported';
        showToast('Message reported for safety review.');
      });

      actions.appendChild(btnFriend);
      actions.appendChild(btnBlock);
      actions.appendChild(btnReport);
      row.appendChild(head);
      row.appendChild(body);
      row.appendChild(actions);
      feedEl.appendChild(row);
    });
  }

  function postToCurrentLounge(rawText) {
    const state = global.SpotState.getState();
    const activeLm = getActiveLandmark();
    if (!global.SpotState.isLandmarkUnlocked(activeLm.id)) {
      showToast('📸 Complete the AR photo mission first to unlock this lounge!');
      return;
    }
    const res = global.SpotLounge.postMessage({
      landmarkId: activeLm.id,
      userId: 'local_explorer_1',
      nickname: state.explorerNickname,
      text: rawText,
      zoneId: activeLm.zone.zoneId,
    });
    if (!res.ok) {
      showToast(`Message blocked (${res.reason}). Phone numbers & unsafe text are filtered.`);
      return;
    }
    global.SpotAudio.playCue('tap');
    showToast('💬 Posted to 4-hour landmark lounge!');
    renderUI();
  }

  function verifyInteractiveControls() {
    const requiredButtonIds = [
      'btnTogglePwaBanner',
      'btnDismissPwaBanner',
      'btnToggleAudio',
      'btnOpenSafetyModal',
      'btnOpenPlusModal',
      'btnMascotPip',
      'btnMascotMochi',
      'btnMascotKitsune',
      'btnMascotAtlas',
      'btnToggleReducedMotion',
      'btnMoodAll',
      'btnMoodChillWalk',
      'btnMoodPhotoArt',
      'btnMoodNightNeon',
      'sqStepTab1',
      'sqStepTab2',
      'sqStepTab3',
      'sqStepTab4',
      'btnCategoryMini',
      'btnCategoryUnvisitedMini',
      'btnCategoryCoveredMini',
      'btnCategoryBig',
      'btnCategoryAll',
      'btnEnrichOverpassPois',
      'btnCenterNextBigStop',
      'btnBuildCustomTrailHash',
      'btnImportCustomTrailHash',
      'btnCheckInTrailStop',
      'btnFindNearMe',
      'btnZoomInMap',
      'btnZoomOutMap',
      'btnQuickCenterWalk',
      'btnToggleMapTiles',
      'btnToggleCustomSpotForm',
      'btnSubmitCustomSpot',
      'btnStartMissionHere',
      'btnBackToMap',
      'btnSourceCamera',
      'btnSourceUpload',
      'btnSourceScene',
      'btnToggleSnapGreetStamp',
      'btnCycleSnapGreetPrompt',
      'btnToggleGoldenHourPreview',
      'btnToggleRainDayArFrame',
      'btnToggleMascotArCoStar',
      'btnCycleMascotArCoStar',
      'btnPrevSticker',
      'btnNextSticker',
      'btnSnapSpotCard',
      'btnDownloadSpotCard',
      'btnEnterUnlockedLounge',
      'btnUnlockFromLounge',
      'btnStartPingPod',
      'btnLeavePingPod',
      'btnCopyFriendCode',
      'btnRedeemFriendCode',
      'btnCopyLandmarkInviteCard',
      'btnSendNearbyWave',
      'btnSpinIcebreakerPrompt',
      'btnToggleQuickMuteDrawer',
      'btnApplyQuickMute',
      'btnClearQuickMutes',
      'btnPostLoungeMsg',
      'btnDownloadPassport',
      'btnDownloadRecapCard',
      'btnDownloadCrewLeaderboard',
      'btnStampNextBingoSquare',
      'btnDownloadBingoCard',
      'btnToggleSpotCardGallery',
      'btnDownloadLatestGalleryCard',
      'btnClearSpotCardGallery',
      'btnCheckInDailyStreak',
      'btnConnectServer',
      'btnTestWorkerPing',
      'btnCloseSafetyModal',
      'btnClosePlusModal',
    ];
    if (typeof document === 'undefined') {
      return { ok: true, checkedCount: requiredButtonIds.length, missingIds: [] };
    }
    const missingIds = requiredButtonIds.filter((id) => !document.getElementById(id));
    return {
      ok: missingIds.length === 0,
      checkedCount: requiredButtonIds.length,
      missingIds,
    };
  }

  function bindEvents() {
    if (typeof document === 'undefined') return;

    [1, 2, 3, 4].forEach((n) => {
      const tab = document.getElementById(`sqStepTab${n}`);
      if (tab) {
        tab.addEventListener('click', () => {
          global.SpotAudio.playCue('tap');
          setActiveStep(n);
        });
      }
    });

    const setCategoryFilter = (catMode) => {
      const st = global.SpotState.getState();
      const all = getAllLandmarks();
      const subset = global.SpotGeoPrivacy.filterLandmarksByCategory(all, catMode, st.completedMissions);
      const firstLm = subset[0] || all[0];
      const nextZoom = catMode === 'mini' || catMode === 'unvisited_mini' || catMode === 'covered_mini' ? 16 : 12;
      global.SpotAudio.playCue('tap');
      global.SpotState.saveState({
        missionCategoryFilter: catMode,
        selectedLandmarkId: firstLm ? firstLm.id : st.selectedLandmarkId,
        mapCenterLat: catMode === 'mini' ? st.userAnchorLat : (firstLm ? firstLm.lat : st.mapCenterLat),
        mapCenterLon: catMode === 'mini' ? st.userAnchorLon : (firstLm ? firstLm.lon : st.mapCenterLon),
        mapZoom: nextZoom,
      });
      const label =
        catMode === 'mini'
          ? '🚶 Showing <=200m Walking Mini-Missions right around you!'
          : catMode === 'unvisited_mini'
          ? '🆕 Showing Unvisited Near Me (<=200m) Walking Mini-Missions!'
          : catMode === 'covered_mini'
          ? '☔ Showing Covered / Rain-Safe (<=200m) Public Walking Mini-Missions!'
          : catMode === 'big'
          ? '🗺️ Showing City-Wide Big Missions!'
          : '🌐 Showing All Mini & City Missions!';
      showToast(label);
      renderUI();
    };

    const btnCatMini = document.getElementById('btnCategoryMini');
    if (btnCatMini) btnCatMini.addEventListener('click', () => setCategoryFilter('mini'));
    const btnCatUnvisited = document.getElementById('btnCategoryUnvisitedMini');
    if (btnCatUnvisited) btnCatUnvisited.addEventListener('click', () => setCategoryFilter('unvisited_mini'));
    const btnCatCovered = document.getElementById('btnCategoryCoveredMini');
    if (btnCatCovered) btnCatCovered.addEventListener('click', () => setCategoryFilter('covered_mini'));
    const btnCatBig = document.getElementById('btnCategoryBig');
    if (btnCatBig) btnCatBig.addEventListener('click', () => setCategoryFilter('big'));
    const btnCatAll = document.getElementById('btnCategoryAll');
    if (btnCatAll) btnCatAll.addEventListener('click', () => setCategoryFilter('all'));

    // POD2B-501: Live Overpass OSM Public-POI <=200m Mini-Mission Enricher Button
    const btnEnrichOverpass = document.getElementById('btnEnrichOverpassPois');
    if (btnEnrichOverpass) {
      btnEnrichOverpass.addEventListener('click', () => {
        const st = global.SpotState.getState();
        global.SpotAudio.playCue('tap');
        showToast('🌍 Querying live Overpass OSM public POIs within 200m...');
        global.SpotGeoPrivacy
          .fetchNearbyOverpassMiniMissions(st.userAnchorLat, st.userAnchorLon, 200)
          .then((res) => {
            global.SpotState.setOverpassMiniMissions(res.missions, res.source);
            global.SpotState.saveState({ missionCategoryFilter: 'mini', mapZoom: 16 });
            const msg =
              res.source === 'overpass_osm_live'
                ? `🟢 Loaded ${res.missions.length} live Overpass OSM public POIs within 200m!`
                : `🚶 Loaded ${res.missions.length} walking Mini-Missions (<=200m deterministic fallback)!`;
            showToast(msg);
            renderUI();
          });
      });
    }

    // POD2B-503: 1-Tap Center Next City-Wide Big Mission Stop
    const btnCenterNextBig = document.getElementById('btnCenterNextBigStop');
    if (btnCenterNextBig) {
      btnCenterNextBig.addEventListener('click', () => {
        const st = global.SpotState.getState();
        const all = getAllLandmarks();
        const prog = global.SpotGeoPrivacy.computeBigMissionTrailProgress(all, st.completedMissions);
        const target = all.find((l) => l.id === prog.nextStopId) || all[0];
        global.SpotAudio.playCue('tap');
        global.SpotState.saveState({
          missionCategoryFilter: 'big',
          selectedLandmarkId: target.id,
          mapCenterLat: target.lat,
          mapCenterLon: target.lon,
          mapZoom: 14,
        });
        showToast(`🎯 Centered on Big Mission Stop: ${target.name} (${prog.completedBig}/${prog.totalBig} unlocked)`);
        renderUI();
      });
    }


    // POD2B-602: Build & Share Custom Walking Trail (#trail=) URL Hash
    const btnBuildTrail = document.getElementById('btnBuildCustomTrailHash');
    if (btnBuildTrail) {
      btnBuildTrail.addEventListener('click', () => {
        const st = global.SpotState.getState();
        const titleIn = document.getElementById('sqCustomTrailTitleInput');
        const rawTitle = titleIn ? titleIn.value : 'Harbour & Park 3-Stop Walk';
        const visible = getVisibleLandmarks();
        const candidateStops = visible.slice(0, 4).map((l) => l.id);
        const res = global.SpotGeoPrivacy.encodeCustomWalkingTrail({
          title: rawTitle,
          stopIds: candidateStops,
          creatorNickname: st.explorerNickname,
          confirmedPublicSafe: true,
        });
        if (!res.ok) {
          showToast(`⚠️ Cannot build #trail= link (${res.reason}).`);
          return;
        }
        global.SpotState.setActiveCustomTrail(res.trail);
        try {
          if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
            window.history.replaceState(null, '', res.hash);
          }
        } catch (_e) {}
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(res.hash).catch(() => {});
        }
        global.SpotAudio.playCue('unlock');
        showToast(`🔗 Shared ${res.trail.stopCount}-stop #trail= link (${res.trail.title})!`);
        renderUI();
      });
    }

    const btnImportTrail = document.getElementById('btnImportCustomTrailHash');
    if (btnImportTrail) {
      btnImportTrail.addEventListener('click', () => {
        const st = global.SpotState.getState();
        let hashCand = typeof window !== 'undefined' && window.location ? window.location.hash : '';
        if (!hashCand || !hashCand.includes('trail=')) {
          const fallbackEnc = global.SpotGeoPrivacy.encodeCustomWalkingTrail({
            title: document.getElementById('sqCustomTrailTitleInput')
              ? document.getElementById('sqCustomTrailTitleInput').value
              : 'Harbour & Park 3-Stop Walk',
            stopIds: getAllLandmarks().slice(0, 3).map((l) => l.id),
            creatorNickname: st.explorerNickname,
            confirmedPublicSafe: true,
          });
          hashCand = fallbackEnc.ok ? fallbackEnc.hash : '';
        }
        const dec = global.SpotGeoPrivacy.decodeCustomWalkingTrail(hashCand);
        if (!dec.ok) {
          showToast(`⚠️ Invalid #trail= link (${dec.reason}).`);
          return;
        }
        global.SpotState.setActiveCustomTrail(dec.trail);
        const firstStop = getAllLandmarks().find((l) => l.id === dec.trail.stopIds[0]) || getAllLandmarks()[0];
        global.SpotState.saveState({
          selectedLandmarkId: firstStop.id,
          mapCenterLat: firstStop.lat,
          mapCenterLon: firstStop.lon,
        });
        global.SpotAudio.playCue('unlock');
        showToast(`🥾 Loaded Custom Walking Trail: ${dec.trail.title} (${dec.trail.stopCount} public stops)!`);
        renderUI();
      });
    }

    // POD2B-601: "Snap & Greet" 1-Tap AR Icebreaker Stamp
    const btnToggleSnapGreet = document.getElementById('btnToggleSnapGreetStamp');
    if (btnToggleSnapGreet) {
      btnToggleSnapGreet.addEventListener('click', () => {
        const st = global.SpotState.getState();
        const peerNick =
          st.savedCrewList && st.savedCrewList[0]
            ? st.savedCrewList[0].nickname
            : 'Nearby Scout';
        const res = global.SpotState.toggleSnapAndGreetState(peerNick);
        global.SpotAudio.playCue('tap');
        showToast(
          res.snapAndGreetEnabled
            ? `🤝 Snap & Greet AR Stamp enabled (${st.explorerNickname} × ${res.snapAndGreetPeerNickname})!`
            : '🤝 Snap & Greet AR Stamp turned off.'
        );
        renderUI();
      });
    }

    const btnCycleSnapGreet = document.getElementById('btnCycleSnapGreetPrompt');
    if (btnCycleSnapGreet) {
      btnCycleSnapGreet.addEventListener('click', () => {
        const res = global.SpotState.cycleSnapAndGreetPrompt();
        const promptStr = global.SpotArViewfinder.SNAP_AND_GREET_PROMPTS[res.snapAndGreetPromptIdx];
        global.SpotAudio.playCue('tap');
        showToast(`💬 Icebreaker: ${promptStr}`);
        renderUI();
      });
    }

    // POD2B-603: Explorer Lounge "Nearby Wave" & Quick-Mute Controls
    const btnWave = document.getElementById('btnSendNearbyWave');
    if (btnWave) {
      btnWave.addEventListener('click', () => {
        const st = global.SpotState.getState();
        const lm = getActiveLandmark();
        const targetPeer =
          st.savedCrewList && st.savedCrewList[0]
            ? st.savedCrewList[0].nickname
            : 'Nearby Explorers';
        const res = global.SpotLounge.sendNearbyWave({
          landmarkId: lm.id,
          zoneId: lm.zone.zoneId,
          userId: 'local_explorer_1',
          nickname: st.explorerNickname,
          targetNickname: targetPeer,
        });
        if (!res.ok) {
          showToast(`⚠️ Wave blocked (${res.reason}).`);
          return;
        }
        global.SpotAudio.playCue('unlock');
        showToast(`👋 Friendly Nearby Wave sent to ${targetPeer} in ${lm.zone.zoneId}!`);
        renderUI();
      });
    }

    const btnToggleMuteDrawer = document.getElementById('btnToggleQuickMuteDrawer');
    const quickMuteDrawer = document.getElementById('sqQuickMuteDrawer');
    if (btnToggleMuteDrawer && quickMuteDrawer) {
      btnToggleMuteDrawer.addEventListener('click', () => {
        global.SpotAudio.playCue('tap');
        if (quickMuteDrawer.hasAttribute('hidden')) {
          quickMuteDrawer.removeAttribute('hidden');
        } else {
          quickMuteDrawer.setAttribute('hidden', 'hidden');
        }
      });
    }

    const btnApplyMute = document.getElementById('btnApplyQuickMute');
    if (btnApplyMute) {
      btnApplyMute.addEventListener('click', () => {
        const muteIn = document.getElementById('sqQuickMuteInput');
        const val = muteIn ? muteIn.value : '';
        const res = global.SpotLounge.muteExplorer(val);
        if (!res.ok) {
          showToast(`⚠️ Cannot mute handle (${res.reason}).`);
          return;
        }
        if (muteIn) muteIn.value = '';
        global.SpotAudio.playCue('tap');
        showToast(`🔇 Muted ${res.mutedHandle} in this 300m lounge.`);
        renderUI();
      });
    }

    const btnClearMutes = document.getElementById('btnClearQuickMutes');
    if (btnClearMutes) {
      btnClearMutes.addEventListener('click', () => {
        global.SpotLounge.clearMutedExplorers();
        global.SpotAudio.playCue('tap');
        showToast('↺ Cleared all muted handles.');
        renderUI();
      });
    }


    // POD2B-702: Interactive #trail= Stop Check-In & Finisher Seal
    const btnCheckInTrail = document.getElementById('btnCheckInTrailStop');
    if (btnCheckInTrail) {
      btnCheckInTrail.addEventListener('click', () => {
        const st = global.SpotState.getState();
        if (!st.activeCustomTrail) {
          const autoEnc = global.SpotGeoPrivacy.encodeCustomWalkingTrail({
            title: document.getElementById('sqCustomTrailTitleInput')
              ? document.getElementById('sqCustomTrailTitleInput').value
              : 'Harbour & Park 3-Stop Walk',
            stopIds: getAllLandmarks().slice(0, 3).map((l) => l.id),
            creatorNickname: st.explorerNickname,
            confirmedPublicSafe: true,
          });
          if (autoEnc.ok) global.SpotState.setActiveCustomTrail(autoEnc.trail);
        }
        const activeLm = getActiveLandmark();
        const res = global.SpotState.checkInCustomTrailStop(activeLm ? activeLm.id : null);
        if (!res.ok) {
          showToast(`⚠️ Trail Check-In status: ${res.reason}`);
          return;
        }
        global.SpotAudio.playCue('unlock');
        const msg = res.newlyEarnedSeal
          ? `🏅 ${res.sealTitle} Unlocked (+${res.xpAwarded} XP)! Check Step 4 Passport!`
          : `✅ Checked in #trail= stop (${res.progress.completedCount}/${res.progress.totalCount} • +${res.xpAwarded} XP)!`;
        showToast(msg);
        renderUI();
      });
    }

    // POD2B-701: Toggle Golden Hour Sunburst AR Stamp & +50% XP Preview
    const btnToggleGoldenHour = document.getElementById('btnToggleGoldenHourPreview');
    if (btnToggleGoldenHour) {
      btnToggleGoldenHour.addEventListener('click', () => {
        const res = global.SpotState.toggleGoldenHourPreview();
        global.SpotAudio.playCue('tap');
        showToast(
          res.goldenHourPreviewMode
            ? '🌅 Golden Hour Sunburst AR Stamp active (+50% Bonus XP on <=200m Mini-Missions)!'
            : '🌅 Golden Hour preview turned off (using local device clock).'
        );
        renderUI();
      });
    }

    // POD2B-703: 1-Tap Copy 300m Landmark Invite Card
    const btnCopyInvite = document.getElementById('btnCopyLandmarkInviteCard');
    if (btnCopyInvite) {
      btnCopyInvite.addEventListener('click', () => {
        const st = global.SpotState.getState();
        const lm = getActiveLandmark();
        const trailHash =
          typeof window !== 'undefined' && window.location && window.location.hash.startsWith('#trail=')
            ? window.location.hash
            : '';
        const inv = global.SpotLounge.generateLandmarkInviteCard({
          landmarkName: lm.name,
          district: lm.walkingLabel || lm.district,
          zoneId: lm.zone.zoneId,
          nickname: st.explorerNickname,
          trailHash,
        });
        if (!inv.ok) {
          showToast(`⚠️ Invite blocked (${inv.reason}).`);
          return;
        }
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(inv.inviteText).catch(() => {});
        }
        global.SpotAudio.playCue('unlock');
        showToast(`📋 Copied 300m Landmark Invite Card for ${inv.landmarkName} (Zero exact GPS)!`);
        renderUI();
      });
    }

    // Interactive Map Canvas: Drag-to-Pan + Click Pin Selection!
    const mapCanvas = document.getElementById('sqMapCanvas');
    if (mapCanvas) {
      mapCanvas.addEventListener('pointerdown', (e) => {
        isDraggingMap = true;
        dragMoved = false;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
      });
      mapCanvas.addEventListener('pointermove', (e) => {
        if (!isDraggingMap) return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          dragMoved = true;
          dragStartX = e.clientX;
          dragStartY = e.clientY;
          const st = global.SpotState.getState();
          const nextCenter = global.SpotMapRadar.panCenterByPixels(
            st.mapCenterLat,
            st.mapCenterLon,
            st.mapZoom,
            dx,
            dy
          );
          global.SpotState.saveState({
            mapCenterLat: nextCenter.centerLat,
            mapCenterLon: nextCenter.centerLon,
          });
          renderUI();
        }
      });
      mapCanvas.addEventListener('pointerup', () => {
        isDraggingMap = false;
      });
      mapCanvas.addEventListener('click', (e) => {
        if (dragMoved) return;
        const rect = mapCanvas.getBoundingClientRect();
        const scaleX = mapCanvas.width / (rect.width || mapCanvas.width);
        const scaleY = mapCanvas.height / (rect.height || mapCanvas.height);
        const cx = (e.clientX - rect.left) * scaleX;
        const cy = (e.clientY - rect.top) * scaleY;
        const hitId = global.SpotMapRadar.findLandmarkAtPoint(
          global.SpotMapRadar.getLastHitRegions(),
          cx,
          cy
        );
        if (hitId) {
          const lm = getAllLandmarks().find((l) => l.id === hitId);
          global.SpotAudio.playCue('tap');
          global.SpotState.saveState({
            selectedLandmarkId: hitId,
            mapCenterLat: lm ? lm.lat : 22.2938,
            mapCenterLon: lm ? lm.lon : 114.1712,
            lastMissionCompletedId: null,
          });
          showToast(`📍 Selected ${lm ? lm.name : hitId} (${lm ? lm.walkingLabel : '<=200m'})!`);
          renderUI();
        } else {
          showToast('Drag to pan the map, or tap any glowing pin to select a mission!');
        }
      });
    }

    const btnZoomIn = document.getElementById('btnZoomInMap');
    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => {
        const z = Math.min(18, (global.SpotState.getState().mapZoom || 16) + 1);
        global.SpotAudio.playCue('tap');
        global.SpotState.saveState({ mapZoom: z });
        showToast(`🔍 Map Zoom: Level ${z}`);
        renderUI();
      });
    }
    const btnZoomOut = document.getElementById('btnZoomOutMap');
    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => {
        const z = Math.max(11, (global.SpotState.getState().mapZoom || 16) - 1);
        global.SpotAudio.playCue('tap');
        global.SpotState.saveState({ mapZoom: z });
        showToast(`🔍 Map Zoom: Level ${z}`);
        renderUI();
      });
    }
    const btnTileMode = document.getElementById('btnToggleMapTiles');
    if (btnTileMode) {
      btnTileMode.addEventListener('click', () => {
        const cur = global.SpotState.getState().mapTileMode;
        const next = cur === 'osm_streets' ? 'vector_grid' : 'osm_streets';
        global.SpotAudio.playCue('tap');
        global.SpotState.saveState({ mapTileMode: next });
        showToast(next === 'osm_streets' ? '🗺️ Switched to OpenStreetMap Street Tiles' : '🌐 Switched to Offline Vector Grid');
        renderUI();
      });
    }

    const btnToggleCustomSpot = document.getElementById('btnToggleCustomSpotForm');
    const customSpotPanel = document.getElementById('sqCustomSpotPanel');
    if (btnToggleCustomSpot && customSpotPanel) {
      btnToggleCustomSpot.addEventListener('click', () => {
        global.SpotAudio.playCue('tap');
        const isHidden = customSpotPanel.hasAttribute('hidden');
        if (isHidden) customSpotPanel.removeAttribute('hidden');
        else customSpotPanel.setAttribute('hidden', 'hidden');
      });
    }

    const btnSubmitCustomSpot = document.getElementById('btnSubmitCustomSpot');
    if (btnSubmitCustomSpot) {
      btnSubmitCustomSpot.addEventListener('click', () => {
        const st = global.SpotState.getState();
        const nameEl = document.getElementById('sqCustomSpotNameInput');
        const distEl = document.getElementById('sqCustomSpotDistrictInput');
        const promptEl = document.getElementById('sqCustomSpotPromptInput');
        const checkEl = document.getElementById('sqCustomSpotPublicCheckbox');

        const res = global.SpotGeoPrivacy.createCustomPublicLandmark({
          name: nameEl ? nameEl.value : '',
          district: distEl ? distEl.value : 'Local Walk',
          missionPrompt: promptEl ? promptEl.value : 'Snap this public spot with an AR sticker!',
          lat: st.mapCenterLat || 22.2938,
          lon: st.mapCenterLon || 114.1712,
          confirmedPublicSafe: Boolean(checkEl && checkEl.checked),
          speedMetersPerSec: st.simulatedSpeedMps,
        });
        if (!res.ok) {
          showToast(`⚠️ Cannot pin spot (${res.reason}). Confirm safe public space & walking speed.`);
          return;
        }
        global.SpotState.addCustomLandmark(res.landmark);
        global.SpotAudio.playCue('unlock');
        if (nameEl) nameEl.value = '';
        if (promptEl) promptEl.value = '';
        if (customSpotPanel) customSpotPanel.setAttribute('hidden', 'hidden');
        showToast(`★ Pinned ${res.landmark.name} inside 300m privacy zone (${res.landmark.zone.zoneId})!`);
        renderUI();
      });
    }

    const btnNearMe = document.getElementById('btnFindNearMe');
    if (btnNearMe) {
      btnNearMe.addEventListener('click', () => {
        global.SpotAudio.playCue('tap');
        const st = global.SpotState.getState();
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          const mini = global.SpotGeoPrivacy.generateNearbyMiniMissions(st.mapCenterLat, st.mapCenterLon, 200);
          global.SpotState.saveState({
            userAnchorLat: st.mapCenterLat,
            userAnchorLon: st.mapCenterLon,
            missionCategoryFilter: 'mini',
            selectedLandmarkId: mini[0].id,
            mapZoom: 16,
          });
          showToast('🚶 Generated 4 walking Mini-Missions (<=200m) around map center!');
          renderUI();
          return;
        }
        showToast('📍 Locating your 200m walking zone (300m chat privacy mask active)...');
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const uLat = pos.coords.latitude;
            const uLon = pos.coords.longitude;
            const mini = global.SpotGeoPrivacy.generateNearbyMiniMissions(uLat, uLon, 200);
            global.SpotState.saveState({
              userAnchorLat: uLat,
              userAnchorLon: uLon,
              missionCategoryFilter: 'mini',
              selectedLandmarkId: mini[0].id,
              mapCenterLat: uLat,
              mapCenterLon: uLon,
              mapZoom: 16,
            });
            showToast(`🚶 Found 4 walking Mini-Missions within 200m (${mini[0].walkingLabel})!`);
            renderUI();
          },
          () => {
            const mini = global.SpotGeoPrivacy.generateNearbyMiniMissions(st.mapCenterLat, st.mapCenterLon, 200);
            global.SpotState.saveState({
              userAnchorLat: st.mapCenterLat,
              userAnchorLon: st.mapCenterLon,
              missionCategoryFilter: 'mini',
              selectedLandmarkId: mini[0].id,
              mapZoom: 16,
            });
            showToast('🚶 Centered 4 walking Mini-Missions (<=200m) around current map center!');
            renderUI();
          },
          { timeout: 5000 }
        );
      });
    }

    const btnStartMission = document.getElementById('btnStartMissionHere');
    if (btnStartMission) {
      btnStartMission.addEventListener('click', () => {
        global.SpotAudio.playCue('tap');
        setActiveStep(2);
        showToast('📸 Swipe AR stickers & color filters, then hit SNAP!');
      });
    }

    const btnBackMap = document.getElementById('btnBackToMap');
    if (btnBackMap) {
      btnBackMap.addEventListener('click', () => {
        global.SpotAudio.playCue('tap');
        setActiveStep(1);
      });
    }

    const btnLiveCam = document.getElementById('btnSourceCamera');
    if (btnLiveCam) btnLiveCam.addEventListener('click', startLiveCamera);

    const fileInput = document.getElementById('sqPhotoUploadInput');
    const btnUpload = document.getElementById('btnSourceUpload');
    if (btnUpload && fileInput) {
      btnUpload.addEventListener('click', () => {
        global.SpotAudio.playCue('tap');
        fileInput.click();
      });
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        stopCameraLoop();
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            uploadedImg = img;
            global.SpotState.saveState({ photoSourceMode: 'upload' });
            showToast('🖼️ Photo loaded! EXIF/GPS will be stripped on snap.');
            renderUI();
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }

    const btnScene = document.getElementById('btnSourceScene');
    if (btnScene) {
      btnScene.addEventListener('click', () => {
        stopCameraLoop();
        global.SpotAudio.playCue('tap');
        global.SpotState.saveState({ photoSourceMode: 'scene' });
        showToast('✨ Using Neon Landmark Scene! Tap the photo to move your AR sticker.');
        renderUI();
      });
    }

    const btnPrevSticker = document.getElementById('btnPrevSticker');
    if (btnPrevSticker) {
      btnPrevSticker.addEventListener('click', () => {
        const cur = global.SpotState.getState().arStickerKey;
        const nextKey = global.SpotArViewfinder.cycleArSticker(cur, -1);
        global.SpotAudio.playCue('tap');
        global.SpotState.saveState({ arStickerKey: nextKey });
        showToast(`Sticker: ${global.SpotArViewfinder.AR_STICKERS[nextKey].label}`);
        renderUI();
      });
    }
    const btnNextSticker = document.getElementById('btnNextSticker');
    if (btnNextSticker) {
      btnNextSticker.addEventListener('click', () => {
        const cur = global.SpotState.getState().arStickerKey;
        const nextKey = global.SpotArViewfinder.cycleArSticker(cur, 1);
        global.SpotAudio.playCue('tap');
        global.SpotState.saveState({ arStickerKey: nextKey });
        showToast(`Sticker: ${global.SpotArViewfinder.AR_STICKERS[nextKey].label}`);
        renderUI();
      });
    }

    const arCanvas = document.getElementById('sqArCanvas');
    if (arCanvas) {
      arCanvas.addEventListener('click', (e) => {
        const rect = arCanvas.getBoundingClientRect();
        const nx = (e.clientX - rect.left) / (rect.width || 1);
        const ny = (e.clientY - rect.top) / (rect.height || 1);
        global.SpotAudio.playCue('tap');
        global.SpotState.saveState({ stickerPos: { x: nx, y: Math.min(0.8, ny / 0.68) } });
        drawCurrentArFrame();
        showToast('✨ AR Sticker moved!');
      });
    }

    const btnSnap = document.getElementById('btnSnapSpotCard');
    if (btnSnap) {
      btnSnap.addEventListener('click', () => {
        const state = global.SpotState.getState();
        const speedCheck = global.SpotGeoPrivacy.evaluateSpeedLockSafety(state.simulatedSpeedMps);
        if (!speedCheck.allowed) {
          showToast('⚠️ Slow down to walking speed to snap AR missions!');
          return;
        }
        const activeLm = getActiveLandmark();

        const pulseRes = global.SpotLounge.recordDailyLandmarkSnap({
          landmarkId: activeLm.id,
          zoneId: activeLm.zone.zoneId,
          nickname: state.explorerNickname,
        });

        const flash = document.getElementById('sqFlashOverlay');
        if (flash) {
          flash.classList.add('is-flashing');
          setTimeout(() => flash.classList.remove('is-flashing'), 90);
        }

        const ghCheck = global.SpotGeoPrivacy.evaluateLocalGoldenHour(
          new Date(),
          Boolean(state.goldenHourPreviewMode)
        );
        const isGoldenMini = Boolean(ghCheck.isGoldenHour && activeLm.missionCategory !== 'big');
        drawCurrentArFrame();
        const arCanvasEl = document.getElementById('sqArCanvas');
        const snappedDataUrl = global.SpotArViewfinder.exportSpotCardDataUrl(arCanvasEl);
        global.SpotState.recordCompletedMission({
          landmarkId: activeLm.id,
          zoneId: activeLm.zone.zoneId,
          xpReward: activeLm.xpReward,
          badge: activeLm.badge,
          cardDataUrl: snappedDataUrl || 'captured',
          awardedFirstSnapCrown: pulseRes.isFirstToSnapToday,
          isGoldenHourBonus: isGoldenMini,
        });
        global.SpotState.addSpotCardToGallery({
          landmarkId: activeLm.id,
          landmarkName: activeLm.shortName || activeLm.name,
          badge: activeLm.badge,
          dataUrl: snappedDataUrl,
          timestampStr: global.SpotVersion.RELEASE_TIMESTAMP_HKT,
        });

        global.SpotAudio.playCue('shutter');
        setTimeout(() => global.SpotAudio.playCue('unlock'), 120);

        const xpPill = document.getElementById('sqXpBadge');
        if (xpPill) {
          xpPill.classList.add('is-pop');
          setTimeout(() => xpPill.classList.remove('is-pop'), 350);
        }

        const crownMsg = pulseRes.isFirstToSnapToday ? ' + 👑 First-to-Snap Daily Crown (+50 XP)!' : '!';
        showToast(`🎉 Stamp Unlocked! +${activeLm.xpReward} XP${crownMsg}`);
        renderUI();
      });
    }

    const btnDownload = document.getElementById('btnDownloadSpotCard');
    if (btnDownload) {
      btnDownload.addEventListener('click', () => {
        drawCurrentArFrame();
        const dataUrl = global.SpotArViewfinder.exportSpotCardDataUrl(
          document.getElementById('sqArCanvas')
        );
        if (!dataUrl) return;
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `SpotCard_${getActiveLandmark().shortName.replace(/\s+/g, '_')}.png`;
        a.click();
        global.SpotAudio.playCue('tap');
        showToast('⬇️ Zero-EXIF SpotCard PNG downloaded!');
      });
    }

    const btnGoLounge = document.getElementById('btnEnterUnlockedLounge');
    if (btnGoLounge) {
      btnGoLounge.addEventListener('click', () => {
        global.SpotAudio.playCue('tap');
        setActiveStep(3);
      });
    }

    const btnUnlockNow = document.getElementById('btnUnlockFromLounge');
    if (btnUnlockNow) {
      btnUnlockNow.addEventListener('click', () => {
        global.SpotAudio.playCue('tap');
        setActiveStep(2);
      });
    }

    const btnPingPod = document.getElementById('btnStartPingPod');
    if (btnPingPod) {
      btnPingPod.addEventListener('click', () => {
        const st = global.SpotState.getState();
        const lm = getActiveLandmark();
        global.SpotLounge.createOrJoinPingPod({
          landmarkId: lm.id,
          zoneId: lm.zone.zoneId,
          nickname: st.explorerNickname,
          missionTitle: `${lm.shortName} 3–6 Person Group SpotCard`,
        });
        global.SpotAudio.playCue('unlock');
        showToast(`🤝 Joined ${lm.shortName} PingPod (60m group mission)!`);
        renderUI();
      });
    }
    const btnLeavePod = document.getElementById('btnLeavePingPod');
    if (btnLeavePod) {
      btnLeavePod.addEventListener('click', () => {
        const st = global.SpotState.getState();
        const lm = getActiveLandmark();
        global.SpotLounge.leavePingPod(lm.id, st.explorerNickname);
        global.SpotAudio.playCue('tap');
        showToast('Left PingPod group mission.');
        renderUI();
      });
    }

    const btnCopyFriendCode = document.getElementById('btnCopyFriendCode');
    if (btnCopyFriendCode) {
      btnCopyFriendCode.addEventListener('click', () => {
        const st = global.SpotState.getState();
        const lm = getActiveLandmark();
        const gen = global.SpotLounge.generateFriendCode({
          nickname: st.explorerNickname,
          zoneId: lm.zone.zoneId,
          badge: lm.badge,
        });
        if (!gen.ok) {
          showToast(`⚠️ Friend Code blocked (${gen.reason}). Remove phone numbers from nickname.`);
          return;
        }
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(gen.code).catch(() => {});
        }
        global.SpotAudio.playCue('tap');
        showToast(`🪪 Friend Code copied: ${gen.code} (Zero PII, FNV-1a signed)`);
      });
    }

    const btnRedeemFriendCode = document.getElementById('btnRedeemFriendCode');
    if (btnRedeemFriendCode) {
      btnRedeemFriendCode.addEventListener('click', () => {
        const st = global.SpotState.getState();
        const inEl = document.getElementById('sqFriendCodeInput');
        const raw = inEl ? inEl.value : '';
        const res = global.SpotLounge.redeemFriendCode(raw, st.explorerNickname);
        if (!res.ok) {
          showToast(`⚠️ Friend Code rejected (${res.reason}). Signature & PII guard active.`);
          return;
        }
        global.SpotState.addSavedCrewMember(res.crewMember);
        global.SpotAudio.playCue('unlock');
        if (inEl) inEl.value = '';
        showToast(`🤝 Connected with ${res.crewMember.nickname} in Saved Crew List!`);
        renderUI();
      });
    }

    const msgInput = document.getElementById('sqLoungeMsgInput');
    const btnPost = document.getElementById('btnPostLoungeMsg');
    if (btnPost) {
      btnPost.addEventListener('click', () => {
        const val = msgInput ? msgInput.value : '';
        postToCurrentLounge(val);
        if (msgInput) msgInput.value = '';
      });
    }
    if (msgInput) {
      msgInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          postToCurrentLounge(msgInput.value);
          msgInput.value = '';
        }
      });
    }

    const btnDownloadPassport = document.getElementById('btnDownloadPassport');
    if (btnDownloadPassport) {
      btnDownloadPassport.addEventListener('click', () => {
        const pCanvas = document.getElementById('sqPassportCanvas');
        const dataUrl = global.SpotArViewfinder.exportSpotCardDataUrl(pCanvas);
        if (!dataUrl) return;
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `SpotQuest_Passport_${global.SpotVersion.BUILD_ID}.png`;
        a.click();
        global.SpotAudio.playCue('unlock');
        showToast('🛂 Explorer Passport PNG downloaded!');
      });
    }





    // FD-P0-20261128-01 & POD2B-1101: Mascot Hero Stage Selector, Reduced Motion & Step 2 Mascot AR Co-Star Overlay
    const mascotChoices = [
      { id: 'pip', btnId: 'btnMascotPip' },
      { id: 'mochi', btnId: 'btnMascotMochi' },
      { id: 'kitsune', btnId: 'btnMascotKitsune' },
      { id: 'atlas', btnId: 'btnMascotAtlas' },
    ];
    mascotChoices.forEach((mc) => {
      const b = document.getElementById(mc.btnId);
      if (b) {
        b.addEventListener('click', () => {
          global.SpotState.setSelectedMascotId(mc.id);
          const m = global.SpotMascots.getMascot(mc.id);
          global.SpotAudio.playCue('tap');
          showToast(`${m.emoji} ${m.name} selected as your SpotQuest Co-Star: "${m.catchphrase}"`);
          renderUI();
        });
      }
    });

    const btnReducedMotion = document.getElementById('btnToggleReducedMotion');
    if (btnReducedMotion) {
      btnReducedMotion.addEventListener('click', () => {
        const res = global.SpotState.toggleReducedMotion();
        global.SpotAudio.playCue('tap');
        showToast(res.reducedMotion ? '✨ Reduced Motion enabled (mascot idle bounce paused).' : '✨ Mascot animations enabled.');
        renderUI();
      });
    }

    const btnToggleMascotAr = document.getElementById('btnToggleMascotArCoStar');
    if (btnToggleMascotAr) {
      btnToggleMascotAr.addEventListener('click', () => {
        const res = global.SpotState.toggleMascotArCoStar();
        const m = global.SpotMascots.getMascot(res.selectedMascotId);
        global.SpotAudio.playCue('tap');
        showToast(
          res.mascotArCoStarEnabled
            ? `🐾 ${m.emoji} ${m.name} AR Co-Star sticker overlaid on your Zero-EXIF Viewfinder!`
            : '🐾 Mascot AR Co-Star overlay hidden.'
        );
        renderUI();
      });
    }

    const btnCycleMascotAr = document.getElementById('btnCycleMascotArCoStar');
    if (btnCycleMascotAr) {
      btnCycleMascotAr.addEventListener('click', () => {
        const res = global.SpotState.cycleSelectedMascotId();
        global.SpotState.toggleMascotArCoStar(true);
        const m = global.SpotMascots.getMascot(res.selectedMascotId);
        global.SpotAudio.playCue('tap');
        showToast(`🔄 Switched AR Co-Star to ${m.emoji} ${m.name}!`);
        renderUI();
      });
    }

    // POD2B-1103: Step 1 Quick-Mood Mission Filter Pills (Chill Walk / Photo Art / Night Neon)
    const moodButtons = [
      { key: 'all', id: 'btnMoodAll', label: '✨ All <=200m Walk Vibes active!' },
      { key: 'chill_walk', id: 'btnMoodChillWalk', label: '🌿 Chill Walk mood selected (parks, benches & cafe plazas <=200m)!' },
      { key: 'photo_art', id: 'btnMoodPhotoArt', label: '🎨 Photo Art mood selected (murals, facades & skyline geometry <=200m)!' },
      { key: 'night_neon', id: 'btnMoodNightNeon', label: '🌃 Night Neon mood selected (harbour glow & transit squares <=200m)!' },
    ];
    moodButtons.forEach((mb) => {
      const b = document.getElementById(mb.id);
      if (b) {
        b.addEventListener('click', () => {
          global.SpotState.setMissionMoodFilter(mb.key);
          const vis = getVisibleLandmarks();
          if (vis[0]) {
            global.SpotState.saveState({ selectedLandmarkId: vis[0].id });
          }
          global.SpotAudio.playCue('tap');
          showToast(mb.label);
          renderUI();
        });
      }
    });

    // POD2B-1102: 7-Day Neighborhood Exploration Streak Check-In Button
    const btnStreak = document.getElementById('btnCheckInDailyStreak');
    if (btnStreak) {
      btnStreak.addEventListener('click', () => {
        const res = global.SpotState.recordDailyExplorationStreak();
        global.SpotAudio.playCue('unlock');
        showToast(`🔥 Logged Daily <=200m Walk Streak (${res.streak.streakDays}/7d • ${res.streak.milestoneTitle} • +${res.xpAwarded} XP)!`);
        renderUI();
      });
    }

    // POD2B-1003: Step 1 Map "Quick-Center on My Walk" Floating Pill
    const btnQuickCenter = document.getElementById('btnQuickCenterWalk');
    if (btnQuickCenter) {
      btnQuickCenter.addEventListener('click', () => {
        const st = global.SpotState.getState();
        const minis = global.SpotGeoPrivacy.generateNearbyMiniMissions(st.userLat, st.userLon, 200);
        const firstMini = minis[0];
        global.SpotState.saveState({
          missionCategoryFilter: 'mini',
          selectedLandmarkId: firstMini ? firstMini.id : st.selectedLandmarkId,
          mapCenterLat: st.userLat,
          mapCenterLon: st.userLon,
          mapZoom: 16,
        });
        global.SpotAudio.playCue('tap');
        showToast('🎯 Quick-Centered map on your <=200m Walking Loop (Zoom 16)!');
        renderUI();
      });
    }

    // POD2B-1001: Stamp Next 3x3 Neighborhood Bingo Square & Export 3x3 Bingo PNG
    const btnStampBingo = document.getElementById('btnStampNextBingoSquare');
    if (btnStampBingo) {
      btnStampBingo.addEventListener('click', () => {
        const res = global.SpotState.stampNextBingoSquare();
        global.SpotAudio.playCue('unlock');
        if (res.alreadyFullHouse) {
          showToast('🏆 Full House! All 9/9 Weekend Neighborhood Bingo squares are already stamped!');
        } else {
          const lineMsg = res.board.hasBingo ? ` • 🏆 ${res.board.bingoLinesCompleted} BINGO LINE(S)!` : '';
          showToast(`🎯 Stamped "${res.stampedTitle}" (${res.board.checkedCount}/9 • +${res.xpAwarded} XP${lineMsg})!`);
        }
        renderUI();
      });
    }

    const btnDownloadBingo = document.getElementById('btnDownloadBingoCard');
    if (btnDownloadBingo) {
      btnDownloadBingo.addEventListener('click', () => {
        const bCanvas = document.getElementById('sqBingoCanvas');
        const dataUrl = global.SpotArViewfinder.exportSpotCardDataUrl(bCanvas);
        if (!dataUrl) return;
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `SpotQuest_3x3_Neighborhood_Bingo_${global.SpotVersion.BUILD_ID}.png`;
        a.click();
        global.SpotAudio.playCue('unlock');
        showToast('🎲 Weekend 3x3 Neighborhood Bingo PNG downloaded (Zero EXIF, Zero PII)!');
      });
    }

    // POD2B-1002: Toggle Offline SpotCard Polaroid Gallery Drawer, Re-Download Latest Polaroid & Clear Gallery
    const btnToggleGallery = document.getElementById('btnToggleSpotCardGallery');
    if (btnToggleGallery) {
      btnToggleGallery.addEventListener('click', () => {
        const res = global.SpotState.toggleSpotCardGalleryDrawer();
        global.SpotAudio.playCue('tap');
        showToast(res.galleryDrawerOpen ? '🖼️ Offline SpotCard Polaroid Gallery opened.' : '🖼️ Polaroid Gallery hidden.');
        renderUI();
      });
    }

    const btnDownloadLatestGallery = document.getElementById('btnDownloadLatestGalleryCard');
    if (btnDownloadLatestGallery) {
      btnDownloadLatestGallery.addEventListener('click', () => {
        const gal = global.SpotState.getSpotCardGallery();
        if (gal.honestEmptyGallery || !gal.cards[0]) {
          showToast('📷 Gallery is empty — snap an AR photo in Step 2 first!');
          return;
        }
        const latest = gal.cards[0];
        const a = document.createElement('a');
        a.href = latest.dataUrl;
        a.download = `SpotQuest_Polaroid_${latest.landmarkId}_${global.SpotVersion.BUILD_ID}.png`;
        a.click();
        global.SpotAudio.playCue('unlock');
        showToast(`⬇️ Re-downloaded Zero-EXIF Polaroid: ${latest.landmarkName}!`);
      });
    }

    const btnClearGallery = document.getElementById('btnClearSpotCardGallery');
    if (btnClearGallery) {
      btnClearGallery.addEventListener('click', () => {
        global.SpotState.clearSpotCardGallery();
        global.SpotAudio.playCue('tap');
        showToast('🗑️ Cleared local SpotCard Polaroid Gallery.');
        renderUI();
      });
    }

    // POD2B-902: Toggle Rain-Day Neon Arcade AR Frame & Rain-Safe Canopy Sticker
    const btnToggleRainFrame = document.getElementById('btnToggleRainDayArFrame');
    if (btnToggleRainFrame) {
      btnToggleRainFrame.addEventListener('click', () => {
        const res = global.SpotState.toggleRainDayArFrame();
        global.SpotAudio.playCue('tap');
        showToast(
          res.rainDayFramePreviewMode
            ? '☔ Rain-Day Neon Arcade AR Frame & Rain-Safe Seal active!'
            : '🌤️ Standard Neon Polaroid AR Frame restored.'
        );
        renderUI();
      });
    }

    // POD2B-903: Step 3 Lounge "Quick Icebreaker Prompt" Spinner
    const btnSpinIcebreaker = document.getElementById('btnSpinIcebreakerPrompt');
    if (btnSpinIcebreaker) {
      btnSpinIcebreaker.addEventListener('click', () => {
        const st = global.SpotState.getState();
        const res = global.SpotLounge.spinQuickIcebreakerPrompt(st.icebreakerSpinnerIndex || 0);
        global.SpotState.saveState({ icebreakerSpinnerIndex: res.nextIndex });
        const previewEl = document.getElementById('sqSpunIcebreakerText');
        if (previewEl) {
          previewEl.textContent = `🎲 Icebreaker (${res.nextIndex + 1}/${res.totalPrompts}): ${res.promptText}`;
        }
        const msgInput = document.getElementById('sqLoungeMsgInput');
        if (msgInput) {
          msgInput.value = res.promptText;
        }
        global.SpotAudio.playCue('tap');
        showToast('🎲 Spun a fresh 300m Lounge Icebreaker into your message box!');
      });
    }

    // POD2B-801: Toggle & Dismiss Standalone PWA Install Banner
    const btnTogglePwa = document.getElementById('btnTogglePwaBanner');
    if (btnTogglePwa) {
      btnTogglePwa.addEventListener('click', () => {
        const res = global.SpotState.togglePwaInstallBanner();
        global.SpotAudio.playCue('tap');
        const steps = global.SpotPro.getPwaInstallGuideSteps();
        showToast(res.pwaBannerOpen ? `📲 ${steps[0]}` : '📲 Install guide hidden.');
        renderUI();
      });
    }
    const btnDismissPwa = document.getElementById('btnDismissPwaBanner');
    if (btnDismissPwa) {
      btnDismissPwa.addEventListener('click', () => {
        global.SpotState.togglePwaInstallBanner(false);
        global.SpotAudio.playCue('tap');
        renderUI();
      });
    }

    // POD2B-802: Export Weekend Explorer Crew Leaderboard Card PNG
    const btnDownloadCrew = document.getElementById('btnDownloadCrewLeaderboard');
    if (btnDownloadCrew) {
      btnDownloadCrew.addEventListener('click', () => {
        const cCanvas = document.getElementById('sqCrewLeaderboardCanvas');
        const dataUrl = global.SpotArViewfinder.exportSpotCardDataUrl(cCanvas);
        if (!dataUrl) return;
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `SpotQuest_Crew_Leaderboard_${global.SpotVersion.BUILD_ID}.png`;
        a.click();
        global.SpotAudio.playCue('unlock');
        showToast('👥 Weekend Explorer Crew Leaderboard PNG downloaded (Zero PII, Zero Exact GPS)!');
      });
    }

    // POD2B-502: Export Weekly Explorer Rank Recap Card PNG
    const btnDownloadRecap = document.getElementById('btnDownloadRecapCard');
    if (btnDownloadRecap) {
      btnDownloadRecap.addEventListener('click', () => {
        const rCanvas = document.getElementById('sqRecapCanvas');
        const dataUrl = global.SpotArViewfinder.exportSpotCardDataUrl(rCanvas);
        if (!dataUrl) return;
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `SpotQuest_Weekly_Recap_${global.SpotVersion.BUILD_ID}.png`;
        a.click();
        global.SpotAudio.playCue('unlock');
        showToast('🏆 Explorer Rank & Weekly Recap PNG downloaded!');
      });
    }

    const btnConnectServer = document.getElementById('btnConnectServer');
    if (btnConnectServer) {
      btnConnectServer.addEventListener('click', () => {
        const urlIn = document.getElementById('sqApiUrlInput');
        const urlVal = urlIn ? String(urlIn.value || '').trim() : '';
        const lm = getActiveLandmark();
        global.SpotState.saveState({ apiEndpointUrl: urlVal });
        const res = global.SpotLounge.configureBackend(urlVal, lm.zone.zoneId, () => renderUI());
        global.SpotAudio.playCue('tap');
        showToast(
          urlVal
            ? `🌐 Backend set (${res.connectionState})`
            : '⚪ Switched to Local/Offline Mode (0 synthetic bots)'
        );
        renderUI();
      });
    }

    const btnTestWorkerPing = document.getElementById('btnTestWorkerPing');
    if (btnTestWorkerPing) {
      btnTestWorkerPing.addEventListener('click', () => {
        const urlIn = document.getElementById('sqApiUrlInput');
        const urlVal = urlIn ? String(urlIn.value || '').trim() : '';
        const lm = getActiveLandmark();
        const diagBox = document.getElementById('sqWorkerDiagnosticsOutput');
        const updateDiagUi = (diag) => {
          if (diagBox) diagBox.textContent = diag.summary;
          showToast(diag.summary);
        };
        const initialDiag = global.SpotLounge.runLiveDiagnostics(urlVal, lm.zone.zoneId, updateDiagUi);
        updateDiagUi(initialDiag);
        global.SpotAudio.playCue('tap');
      });
    }

    const nickInput = document.getElementById('sqNicknameInput');
    if (nickInput) {
      nickInput.addEventListener('change', (e) => {
        const raw = String(e.target.value || 'Explorer').trim().slice(0, 24) || 'Explorer';
        if (global.SpotLounge.containsBlockedSafetyContent(raw)) {
          showToast('⚠️ Nickname cannot contain phone numbers or unsafe content.');
          e.target.value = global.SpotState.getState().explorerNickname;
          return;
        }
        global.SpotState.saveState({ explorerNickname: raw });
        showToast(`Handle updated to ${raw}`);
        renderUI();
      });
    }

    const btnAudio = document.getElementById('btnToggleAudio');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        const nextMuted = !global.SpotAudio.isMuted();
        global.SpotAudio.setMuted(nextMuted);
        global.SpotState.saveState({ mutedAudio: nextMuted });
        btnAudio.textContent = nextMuted ? '🔇 Muted' : '🔊 Sound';
        showToast(nextMuted ? '🔇 Sound muted' : '🔊 Sound effects on');
      });
    }

    const btnOpenSafety = document.getElementById('btnOpenSafetyModal');
    const btnCloseSafety = document.getElementById('btnCloseSafetyModal');
    const safetyModal = document.getElementById('sqSafetyModalBackdrop');
    if (btnOpenSafety && safetyModal) {
      btnOpenSafety.addEventListener('click', () => safetyModal.removeAttribute('hidden'));
    }
    if (btnCloseSafety && safetyModal) {
      btnCloseSafety.addEventListener('click', () => safetyModal.setAttribute('hidden', 'hidden'));
    }
    const speedSel = document.getElementById('sqSpeedSimSelect');
    if (speedSel) {
      speedSel.addEventListener('change', (e) => {
        const v = Number(e.target.value);
        global.SpotState.saveState({ simulatedSpeedMps: v });
        showToast(v > 6.5 ? '⚠️ Vehicle speed simulated — AR missions paused!' : '🚶 Walking speed — AR missions active.');
        renderUI();
      });
    }

    const btnOpenPro = document.getElementById('btnOpenPlusModal');
    const btnClosePro = document.getElementById('btnClosePlusModal');
    const proModal = document.getElementById('sqPlusModalBackdrop');
    if (btnOpenPro && proModal) {
      btnOpenPro.addEventListener('click', () => proModal.removeAttribute('hidden'));
    }
    if (btnClosePro && proModal) {
      btnClosePro.addEventListener('click', () => proModal.setAttribute('hidden', 'hidden'));
    }
  }

  function initApp() {
    global.SpotState.loadState();
    if (typeof window !== 'undefined' && window.location && window.location.hash && window.location.hash.includes('trail=')) {
      const dec = global.SpotGeoPrivacy.decodeCustomWalkingTrail(window.location.hash);
      if (dec.ok) {
        global.SpotState.setActiveCustomTrail(dec.trail);
      }
    }
    applyFavicon();
    bindEvents();
    renderUI();
    return {
      ok: true,
      version: global.SpotVersion.VERSION,
      buildId: global.SpotVersion.BUILD_ID,
    };
  }

  global.SpotApp = Object.freeze({
    initApp,
    renderUI,
    setActiveStep,
    applyFavicon,
    showToast,
    verifyInteractiveControls,
  });

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
