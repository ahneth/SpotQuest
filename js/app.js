// Version: 1.1.0 | Last Modified: 2026-11-23 01:15 HKT | Build: 20261123_0115
// Module: js/app.js — Guided 3-Step Controller, Interactive Map Clicks, Live Camera/Upload & Instant Toast Feedback (Kai Lindqvist 17)
(function (global) {
  'use strict';

  let uploadedImg = null;
  let cameraStream = null;
  let cameraVideoEl = null;
  let cameraRafId = null;
  let toastTimer = null;

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
    const n = Math.min(3, Math.max(1, Number(stepNum) || 1));
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

    // 1. Header XP pill
    const xpPill = document.getElementById('sqXpBadge');
    if (xpPill) {
      xpPill.textContent = `⭐ ${state.totalXp} XP • ${state.completedMissions.length}/${landmarks.length}`;
    }

    // 2. Stepper tabs & visible screen
    [1, 2, 3].forEach((n) => {
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

    // 4. Screen 1: Map Canvas & Selected Spot Hero Card
    const mapCanvas = document.getElementById('sqMapCanvas');
    if (mapCanvas) {
      global.SpotMapRadar.renderNeighborhoodRadar(
        mapCanvas,
        landmarks,
        activeLm.id,
        state.completedMissions
      );
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
          global.SpotState.saveState({ selectedLandmarkId: lm.id, lastMissionCompletedId: null });
          showToast(`📍 Selected ${lm.name}`);
          renderUI();
        });
        spotGrid.appendChild(btn);
      });
    }

    // 5. Screen 2: AR Viewfinder, Sticker Pills, Frame Pills & Celebration Box
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

    // 6. Screen 3: Local Lounge
    renderLounge(activeLm, isUnlocked);
  }

  function renderLounge(activeLm, isUnlocked) {
    const lockedCard = document.getElementById('sqLoungeLockedCard');
    const unlockedArea = document.getElementById('sqLoungeUnlockedArea');
    const titleEl = document.getElementById('sqLoungeSpotTitle');
    if (titleEl) titleEl.textContent = `${activeLm.name} — 4h Local Lounge`;

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
        'You unlocked this landmark lounge! Tap a quick-reply chip above or type a hello below. Messages auto-delete after 4 hours (zero fake bots).'
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
      showToast(`Message blocked (${res.reason}). Keep chat friendly & zero PII!`);
      return;
    }
    global.SpotAudio.playCue('tap');
    showToast('💬 Posted to 4-hour landmark lounge!');
    renderUI();
  }

  function bindEvents() {
    if (typeof document === 'undefined') return;

    // Stepper tabs
    [1, 2, 3].forEach((n) => {
      const tab = document.getElementById(`sqStepTab${n}`);
      if (tab) {
        tab.addEventListener('click', () => {
          global.SpotAudio.playCue('tap');
          setActiveStep(n);
        });
      }
    });

    // Interactive Map Canvas click!
    const mapCanvas = document.getElementById('sqMapCanvas');
    if (mapCanvas) {
      mapCanvas.addEventListener('click', (e) => {
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
          global.SpotState.saveState({ selectedLandmarkId: hitId, lastMissionCompletedId: null });
          showToast(`📍 Selected ${lm ? lm.name : hitId}! Tap "Start AR Photo Mission" below.`);
          renderUI();
        } else {
          showToast('Tap directly on a glowing pink/blue pin on the map to pick a spot!');
        }
      });
    }

    // Near Me Geolocation button
    const btnNearMe = document.getElementById('btnFindNearMe');
    if (btnNearMe) {
      btnNearMe.addEventListener('click', () => {
        global.SpotAudio.playCue('tap');
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          showToast('📍 Location unavailable — showing Hong Kong public landmarks!');
          return;
        }
        showToast('📍 Checking your 300m fuzzy zone...');
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const nearest = global.SpotGeoPrivacy.findNearestLandmark(
              pos.coords.latitude,
              pos.coords.longitude
            );
            global.SpotState.saveState({ selectedLandmarkId: nearest.landmark.id });
            showToast(`📍 Nearest spot: ${nearest.landmark.shortName} (300m privacy mask active)`);
            renderUI();
          },
          () => {
            showToast('📍 GPS off — pick any glowing landmark pin on the map!');
          },
          { timeout: 5000 }
        );
      });
    }

    // Start Mission -> Step 2
    const btnStartMission = document.getElementById('btnStartMissionHere');
    if (btnStartMission) {
      btnStartMission.addEventListener('click', () => {
        global.SpotAudio.playCue('tap');
        setActiveStep(2);
        showToast('📸 Pick Live Camera, Upload Photo, or Neon Scene, then hit SNAP!');
      });
    }

    // Back to Map button
    const btnBackMap = document.getElementById('btnBackToMap');
    if (btnBackMap) {
      btnBackMap.addEventListener('click', () => {
        global.SpotAudio.playCue('tap');
        setActiveStep(1);
      });
    }

    // Photo source controls (Live Camera / Upload Photo / Neon Scene)
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

    // Tap AR Viewfinder Canvas to reposition AR Sticker!
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

    // Big Shutter Button: Flash + Sound + XP + Unlock Lounge!
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

        // Trigger camera shutter flash
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

        showToast(`🎉 Mission Complete! +${activeLm.xpReward} XP & ${activeLm.shortName} Lounge Unlocked!`);
        renderUI();
      });
    }

    // Download SpotCard PNG
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

    // Enter Unlocked Lounge button -> Step 3
    const btnGoLounge = document.getElementById('btnEnterUnlockedLounge');
    if (btnGoLounge) {
      btnGoLounge.addEventListener('click', () => {
        global.SpotAudio.playCue('tap');
        setActiveStep(3);
      });
    }

    // Go Complete Mission button on Locked Lounge -> Step 2
    const btnUnlockNow = document.getElementById('btnUnlockFromLounge');
    if (btnUnlockNow) {
      btnUnlockNow.addEventListener('click', () => {
        global.SpotAudio.playCue('tap');
        setActiveStep(2);
      });
    }

    // Post message to lounge (button + Enter key)
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

    // Nickname input
    const nickInput = document.getElementById('sqNicknameInput');
    if (nickInput) {
      nickInput.addEventListener('change', (e) => {
        const clean = String(e.target.value || 'Explorer').trim().slice(0, 24) || 'Explorer';
        global.SpotState.saveState({ explorerNickname: clean });
        showToast(`Handle updated to ${clean}`);
        renderUI();
      });
    }

    // Audio mute toggle
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

    // Safety Modal + Speed Simulator
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

    // SpotQuest Plus Modal
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
  });

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
