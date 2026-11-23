// Version: 1.2.0 | Last Modified: 2026-11-23 11:08 HKT | Build: 20261123_1108
// Module: js/app.js — Guided 4-Tab Controller (60dvh OSM Map, AR Photo, Client-Server Lounge & PingPod, Explorer Passport) & Interactive Control Audit (Kai Lindqvist 17)
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

  function getActiveLandmark() {
    const state = global.SpotState.getState();
    const landmarks = global.SpotGeoPrivacy.getCuratedLandmarks();
    return landmarks.find((l) => l.id === state.selectedLandmarkId) || landmarks[0];
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
    global.SpotArViewfinder.renderSpotCardCanvas({
      canvas: arCanvas,
      landmark: activeLm,
      frameThemeKey: state.arFrameStyle,
      stickerKey: state.arStickerKey,
      stickerPos: state.stickerPos,
      explorerNickname: state.explorerNickname,
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
    if (iconEl) iconEl.setAttribute('href', uri);
    if (appleEl) appleEl.setAttribute('href', uri);
    if (brandImg) brandImg.setAttribute('src', uri);
  }

  function renderUI() {
    if (typeof document === 'undefined') return;
    const state = global.SpotState.getState();
    const landmarks = global.SpotGeoPrivacy.getCuratedLandmarks();
    const activeLm = getActiveLandmark();
    const isUnlocked = global.SpotState.isLandmarkUnlocked(activeLm.id);

    // 1. Header XP & Honest Server Connection Badge
    const xpPill = document.getElementById('sqXpBadge');
    if (xpPill) {
      xpPill.textContent = `⭐ ${state.totalXp} XP • ${state.completedMissions.length}/${landmarks.length}`;
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

    // 4. Screen 1: Large 60dvh Interactive OSM Map Canvas & Selected Spot Card
    const mapCanvas = document.getElementById('sqMapCanvas');
    if (mapCanvas) {
      global.SpotMapRadar.renderNeighborhoodRadar(
        mapCanvas,
        landmarks,
        activeLm.id,
        state.completedMissions,
        {
          centerLat: state.mapCenterLat,
          centerLon: state.mapCenterLon,
          zoom: state.mapZoom,
          tileMode: state.mapTileMode,
          onTileLoaded: () => {
            if (global.SpotState.getState().activeStep === 1) {
              global.SpotMapRadar.renderNeighborhoodRadar(
                mapCanvas,
                landmarks,
                activeLm.id,
                state.completedMissions,
                {
                  centerLat: global.SpotState.getState().mapCenterLat,
                  centerLon: global.SpotState.getState().mapCenterLon,
                  zoom: global.SpotState.getState().mapZoom,
                  tileMode: global.SpotState.getState().mapTileMode,
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

    const spotNameEl = document.getElementById('sqSelectedSpotName');
    const spotPromptEl = document.getElementById('sqSelectedSpotPrompt');
    const spotMetaEl = document.getElementById('sqSelectedSpotMeta');
    const btnStartMission = document.getElementById('btnStartMissionHere');
    if (spotNameEl) spotNameEl.textContent = activeLm.name;
    if (spotPromptEl) spotPromptEl.textContent = activeLm.missionPrompt;
    if (spotMetaEl) {
      spotMetaEl.textContent = `${activeLm.district} • ${activeLm.category} • +${activeLm.xpReward} XP • ~300m Privacy Zone`;
    }
    if (btnStartMission) {
      btnStartMission.textContent = isUnlocked
        ? `📸 Snap Another Photo at ${activeLm.shortName} →`
        : `📸 Start AR Photo Mission at ${activeLm.shortName} →`;
    }

    const spotGrid = document.getElementById('sqSpotChipGrid');
    if (spotGrid) {
      while (spotGrid.firstChild) spotGrid.removeChild(spotGrid.firstChild);
      landmarks.forEach((lm) => {
        const done = state.completedMissions.includes(lm.id);
        const btn = createSafeEl(
          'button',
          `sq-spot-chip${lm.id === activeLm.id ? ' is-selected' : ''}`
        );
        btn.type = 'button';
        btn.appendChild(createSafeEl('span', '', `${done ? '✅ ' : '📍 '}${lm.shortName}`));
        btn.appendChild(
          createSafeEl('span', 'sq-spot-chip-sub', `${lm.district} • +${lm.xpReward} XP`)
        );
        btn.addEventListener('click', () => {
          global.SpotAudio.playCue('tap');
          global.SpotState.saveState({
            selectedLandmarkId: lm.id,
            mapCenterLat: lm.lat,
            mapCenterLon: lm.lon,
            lastMissionCompletedId: null,
          });
          showToast(`📍 Centered map on ${lm.name}`);
          renderUI();
        });
        spotGrid.appendChild(btn);
      });
    }

    // 5. Screen 2: AR Viewfinder
    const arMissionBanner = document.getElementById('sqArMissionBanner');
    if (arMissionBanner) {
      arMissionBanner.textContent = `Mission at ${activeLm.name}: ${activeLm.missionPrompt}`;
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

    // 6. Screen 3: Local Lounge & PingPod Group Mission
    renderLounge(activeLm, isUnlocked, connStatus);

    // 7. Screen 4: Explorer Passport
    const passportCanvas = document.getElementById('sqPassportCanvas');
    if (passportCanvas) {
      global.SpotArViewfinder.renderExplorerPassportCanvas({
        canvas: passportCanvas,
        landmarks,
        completedIds: state.completedMissions,
        explorerNickname: state.explorerNickname,
        totalXp: state.totalXp,
      });
    }
  }

  function renderLounge(activeLm, isUnlocked, connStatus) {
    const lockedCard = document.getElementById('sqLoungeLockedCard');
    const unlockedArea = document.getElementById('sqLoungeUnlockedArea');
    const titleEl = document.getElementById('sqLoungeSpotTitle');
    const peerBannerEl = document.getElementById('sqHonestPeerBanner');
    if (titleEl) titleEl.textContent = `${activeLm.name} — 4h Local Lounge`;

    if (peerBannerEl) {
      peerBannerEl.textContent = connStatus.isLiveServer
        ? `🟢 Connected to live zone room (${activeLm.zone.zoneId}) • ${connStatus.livePeerCount} explorers online right now.`
        : `⚪ 0 other live explorers in ${activeLm.zone.zoneId} right now (Local/Offline Mode — zero synthetic bots). Connect a Cloudflare Worker backend in Server Settings or invite a friend!`;
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

    // PingPod 3-6 Person Group Mission Status
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
      'btnToggleAudio',
      'btnOpenSafetyModal',
      'btnOpenPlusModal',
      'sqStepTab1',
      'sqStepTab2',
      'sqStepTab3',
      'sqStepTab4',
      'btnFindNearMe',
      'btnZoomInMap',
      'btnZoomOutMap',
      'btnToggleMapTiles',
      'btnStartMissionHere',
      'btnBackToMap',
      'btnSourceCamera',
      'btnSourceUpload',
      'btnSourceScene',
      'btnSnapSpotCard',
      'btnDownloadSpotCard',
      'btnEnterUnlockedLounge',
      'btnUnlockFromLounge',
      'btnStartPingPod',
      'btnLeavePingPod',
      'btnPostLoungeMsg',
      'btnDownloadPassport',
      'btnConnectServer',
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
          const lm = global.SpotGeoPrivacy.getCuratedLandmarks().find((l) => l.id === hitId);
          global.SpotAudio.playCue('tap');
          global.SpotState.saveState({
            selectedLandmarkId: hitId,
            mapCenterLat: lm ? lm.lat : 22.305,
            mapCenterLon: lm ? lm.lon : 114.175,
            lastMissionCompletedId: null,
          });
          showToast(`📍 Selected ${lm ? lm.name : hitId}! Tap "Start AR Photo Mission" below.`);
          renderUI();
        } else {
          showToast('Drag to pan the map, or tap any glowing pin to select a spot!');
        }
      });
    }

    // Map Zoom In / Zoom Out / Tile Toggle
    const btnZoomIn = document.getElementById('btnZoomInMap');
    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => {
        const z = Math.min(16, (global.SpotState.getState().mapZoom || 12) + 1);
        global.SpotAudio.playCue('tap');
        global.SpotState.saveState({ mapZoom: z });
        showToast(`🔍 Map Zoom: Level ${z}`);
        renderUI();
      });
    }
    const btnZoomOut = document.getElementById('btnZoomOutMap');
    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => {
        const z = Math.max(11, (global.SpotState.getState().mapZoom || 12) - 1);
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

    // Near Me Geolocation button
    const btnNearMe = document.getElementById('btnFindNearMe');
    if (btnNearMe) {
      btnNearMe.addEventListener('click', () => {
        global.SpotAudio.playCue('tap');
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          showToast('📍 Geolocation unavailable — showing Hong Kong public landmarks!');
          return;
        }
        showToast('📍 Locating your 300m fuzzy privacy zone...');
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const nearest = global.SpotGeoPrivacy.findNearestLandmark(
              pos.coords.latitude,
              pos.coords.longitude
            );
            global.SpotState.saveState({
              selectedLandmarkId: nearest.landmark.id,
              mapCenterLat: nearest.landmark.lat,
              mapCenterLon: nearest.landmark.lon,
              mapZoom: 14,
            });
            showToast(`📍 Nearest spot: ${nearest.landmark.shortName} (300m privacy mask active)`);
            renderUI();
          },
          () => {
            showToast('📍 GPS permission off — drag the map or tap any glowing pin!');
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
        showToast('📸 Pick Live Camera, Upload Photo, or Neon Scene, then hit SNAP!');
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
        drawCurrentArFrame();

        const flash = document.getElementById('sqFlashOverlay');
        if (flash) {
          flash.classList.add('is-flashing');
          setTimeout(() => flash.classList.remove('is-flashing'), 90);
        }

        const dataUrl = global.SpotArViewfinder.exportSpotCardDataUrl(
          document.getElementById('sqArCanvas')
        );
        global.SpotState.recordCompletedMission({
          landmarkId: activeLm.id,
          zoneId: activeLm.zone.zoneId,
          xpReward: activeLm.xpReward,
          badge: activeLm.badge,
          cardDataUrl: dataUrl,
        });
        global.SpotAudio.playCue('shutter');
        setTimeout(() => global.SpotAudio.playCue('unlock'), 120);

        const xpPill = document.getElementById('sqXpBadge');
        if (xpPill) {
          xpPill.classList.add('is-pop');
          setTimeout(() => xpPill.classList.remove('is-pop'), 350);
        }

        showToast(`🎉 Stamp Unlocked! +${activeLm.xpReward} XP & ${activeLm.shortName} Lounge Opened!`);
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

    // PingPod 1-Tap Create/Join & Leave
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

    // Passport PNG Exporter (POD2B-202)
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

    // Live Backend Connection Config in Safety/Server Modal
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

    const nickInput = document.getElementById('sqNicknameInput');
    if (nickInput) {
      nickInput.addEventListener('change', (e) => {
        const clean = String(e.target.value || 'Explorer').trim().slice(0, 24) || 'Explorer';
        global.SpotState.saveState({ explorerNickname: clean });
        showToast(`Handle updated to ${clean}`);
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
