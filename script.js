/* ========================================
   MERIDIAN & STONE — Website Script
   ======================================== */

(function () {
  'use strict';

  // ========================================
  // REDUCED MOTION CHECK
  // ========================================
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ========================================
  // HEADER SCROLL STATE
  // ========================================
  var header = document.getElementById('header');

  function updateHeader() {
    if (window.scrollY > 60) {
      header.classList.add('header--scrolled');
    } else {
      header.classList.remove('header--scrolled');
    }

    // Header: transparent over hero, white everywhere else
    var heroEl = document.getElementById('hero');
    if (heroEl) {
      var heroEnd = heroEl.offsetTop + heroEl.offsetHeight;
      if (window.scrollY < heroEnd - 60) {
        header.classList.add('header--hero');
      } else {
        header.classList.remove('header--hero');
      }
    }

  }

  // ========================================
  // MOBILE NAVIGATION
  // ========================================
  var burgerBtn = document.getElementById('burgerBtn');
  var mobileNav = document.getElementById('mobileNav');

  function toggleMobileNav() {
    var isOpen = mobileNav.classList.contains('active');
    mobileNav.classList.toggle('active');
    burgerBtn.classList.toggle('active');
    burgerBtn.setAttribute('aria-expanded', !isOpen);
    document.body.style.overflow = isOpen ? '' : 'hidden';
  }

  burgerBtn.addEventListener('click', toggleMobileNav);

  mobileNav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      if (mobileNav.classList.contains('active')) {
        toggleMobileNav();
      }
    });
  });

  // ========================================
  // HERO — SCROLL-CONTROLLED VIDEO
  // ========================================
  var heroSection = document.getElementById('hero');
  var video = document.getElementById('heroVideo');
  var heroFallback = document.getElementById('heroFallback');
  var heroProgressBar = document.getElementById('heroProgressBar');
  var heroScrollIndicator = document.getElementById('heroScrollIndicator');
  var scrollCounter = document.getElementById('scrollCounter');

  var videoReady = false;
  var videoDuration = 0;
  var currentTime = 0;
  var targetTime = 0;
  var lastFrameTime = performance.now();
  var rafId = null;
  var videoError = false;

  // ========================================
  // MOBILE/TABLET FRAME-SEQUENCE ENGINE
  // ========================================
  // On mobile/tablet, video seeking produces visible still-frame lag.
  // Instead, we pre-extract 240 JPEG frames and render them to a canvas
  // based on scroll position. Desktop continues using the video element.
  var TOTAL_FRAMES = 240;
  var FRAME_PATH = '/frames/frame_';
  var useFrameSequence = window.matchMedia('(max-width: 1023px)').matches;
  var canvas = document.getElementById('heroCanvas');
  var ctx = canvas ? canvas.getContext('2d') : null;
  var frameImages = [];           // Array of Image objects (indexed 0–239)
  var frameLoaded = [];           // Boolean tracking load state per frame
  var currentFrameIdx = -1;       // Currently rendered frame index
  var targetFrameIdx = 0;         // Frame we want to show
  var frameReadyCount = 0;        // How many frames have loaded
  var FRAMES_TO_PRELOAD = 12;     // Preload window around current frame

  // Activate frame-sequence mode on mobile/tablet
  if (useFrameSequence && canvas && ctx) {
    video.style.display = 'none';   // Hide video element on mobile
    canvas.style.display = 'block'; // Show canvas on mobile
  }

  // Load a single frame by index (0–239)
  function loadFrame(idx) {
    if (idx < 0 || idx >= TOTAL_FRAMES) return;
    if (frameImages[idx]) return; // Already loaded or loading
    frameImages[idx] = new Image();
    frameLoaded[idx] = false;
    // Frame filenames: frame_0001.jpg through frame_0240.jpg
    var num = idx + 1;
    var name = num < 10 ? '000' + num : num < 100 ? '0' + num : '' + num;
    frameImages[idx].src = FRAME_PATH + name + '.jpg';
    frameImages[idx].onload = function () {
      frameLoaded[idx] = true;
      frameReadyCount++;
      // Render immediately if this is the current target
      if (idx === targetFrameIdx && idx !== currentFrameIdx) {
        renderFrame(idx);
      }
    };
  }

  // Preload frames around the current position
  function preloadAround(idx) {
    var half = Math.floor(FRAMES_TO_PRELOAD / 2);
    for (var i = idx - half; i <= idx + half; i++) {
      loadFrame(i);
    }
  }

  // Find the nearest already-loaded frame to idx (search outward)
  function nearestLoadedFrame(idx) {
    if (frameLoaded[idx]) return idx;
    for (var d = 1; d < TOTAL_FRAMES; d++) {
      if (idx - d >= 0 && frameLoaded[idx - d]) return idx - d;
      if (idx + d < TOTAL_FRAMES && frameLoaded[idx + d]) return idx + d;
    }
    return -1; // Nothing loaded yet
  }

  // Render a frame to the canvas with object-fit: cover behavior
  function renderFrame(idx) {
    // If the exact frame isn't loaded, render the nearest loaded one as a placeholder
    var renderIdx = idx;
    if (!ctx || !frameImages[idx] || !frameLoaded[idx]) {
      renderIdx = nearestLoadedFrame(idx);
      if (renderIdx < 0) return; // Nothing loaded at all yet
    }
    var img = frameImages[renderIdx];
    var cw = canvas.width;
    var ch = canvas.height;
    var iw = img.naturalWidth;
    var ih = img.naturalHeight;

    // Calculate cover dimensions (same as CSS object-fit: cover)
    var scale = Math.max(cw / iw, ch / ih);
    var sw = cw / scale;
    var sh = ch / scale;
    var sx = (iw - sw) / 2;
    var sy = (ih - sh) / 2;

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
    currentFrameIdx = idx;
  }

  // Resize canvas to match viewport
  function resizeCanvas() {
    if (!canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    // Re-render current frame at new size
    if (currentFrameIdx >= 0) renderFrame(currentFrameIdx);
  }

  // Content state elements
  var states = [];
  for (var i = 1; i <= 6; i++) {
    states.push(document.getElementById('hs' + i));
  }
  var currentState = -1;
  var pendingExit = null;
  var exitTimer = null;
  var overlayEl = document.querySelector('.hero__overlay-gradient');

  // Sub-reveal items per state
  var state3Items = document.querySelectorAll('.hs__expertise-item');
  var state4Stats = document.querySelectorAll('.hs__stat');
  var state5Steps = document.querySelectorAll('.hs__approach-step');

  // Video loaded — pause immediately so scroll controls all frame advancement.
  // Mobile browsers will auto-play muted video on load; we must prevent that
  // so currentTime assignments from scroll position are the sole frame controller.
  video.addEventListener('loadedmetadata', function () {
    if (video.duration && isFinite(video.duration)) {
      video.pause();
      video.currentTime = 0;
      videoReady = true;
      videoDuration = video.duration;
      video.style.opacity = '1';
      if (heroFallback) heroFallback.style.opacity = '0';
      // Only start video RAF on desktop; mobile uses frame-sequence RAF
      if (!useFrameSequence && !rafId) {
        lastFrameTime = performance.now();
        rafId = requestAnimationFrame(videoLoop);
      }
    }
  });

  // Mobile fallback: some browsers (esp. iOS Safari) fire canplay after
  // loadedmetadata but before enough data is buffered for smooth seeking.
  // If videoReady was set by loadedmetadata this is a no-op; otherwise it
  // catches the late-arriving metadata.
  video.addEventListener('canplay', function () {
    if (!videoReady && video.duration && isFinite(video.duration)) {
      video.pause();
      videoReady = true;
      videoDuration = video.duration;
      video.style.opacity = '1';
      if (heroFallback) heroFallback.style.opacity = '0';
      if (!useFrameSequence && !rafId) {
        lastFrameTime = performance.now();
        rafId = requestAnimationFrame(videoLoop);
      }
    }
  });

  video.addEventListener('error', function () {
    videoError = true;
    video.style.display = 'none';
  });

  video.querySelectorAll('source').forEach(function (src) {
    src.addEventListener('error', function () {
      videoError = true;
      video.style.display = 'none';
    });
  });

  // Fallback timeout
  setTimeout(function () {
    if (!videoReady && !videoError) {
      video.style.opacity = '0';
    }
  }, 3000);

  // RAF loop — smooth video scrubbing (desktop) / frame rendering (mobile).
  function videoLoop() {
    var now = performance.now();
    lastFrameTime = now;

    if (useFrameSequence && ctx) {
      // MOBILE/TABLET: render frame directly from scroll position.
      // No smoothing needed — frame index is derived directly from scroll
      // progress, so it tracks instantly with no lag.
      // Always attempt render — handles both new scroll targets AND frames
      // that finished loading since the last RAF tick.
      if (targetFrameIdx !== currentFrameIdx) {
        renderFrame(targetFrameIdx);
        preloadAround(targetFrameIdx);
      }
    } else {
      // DESKTOP: seek video toward scroll-mapped time.
      if (!videoReady || videoError) return;
      var diff = targetTime - currentTime;
      if (Math.abs(diff) > 0.0001) {
        currentTime += diff * 0.5;
        video.currentTime = currentTime;
      }
    }

    rafId = requestAnimationFrame(videoLoop);
  }

  // Scroll progress within the hero section
  function getHeroProgress() {
    var rect = heroSection.getBoundingClientRect();
    var scrollable = heroSection.offsetHeight - window.innerHeight;
    var scrolled = -rect.top;
    return Math.max(0, Math.min(1, scrolled / scrollable));
  }

  // Determine which content state to show (6 states)
  function getTargetState(progress) {
    if (progress < 0.20) return 0;    // state 1: hero intro        (0–20%)  → 0–2s
    if (progress < 0.40) return 1;    // state 2: ambitious businesses (20–40%) → 2–4s
    if (progress < 0.60) return 2;    // state 3: expertise          (40–60%) → 4–6s
    if (progress < 0.80) return 3;    // state 4: stats              (60–80%) → 6–8s
    if (progress < 1.00) return 4;    // state 5: approach           (80–100%)→ 8–10s
    return 5;                          // state 6: final CTA          (100%)
  }

  // Sub-reveal items progressively within a state
  function revealItems(items, stateProgress, stagger) {
    items.forEach(function (item, idx) {
      var threshold = 0.08 + idx * stagger;
      if (stateProgress > threshold) {
        item.classList.add('revealed');
      } else {
        item.classList.remove('revealed');
      }
    });
  }

  // Main scroll handler
  function handleHeroScroll() {
    var progress = getHeroProgress();

    // Update video target
    if (!prefersReducedMotion) {
      if (useFrameSequence) {
        // MOBILE/TABLET: compute frame index directly from progress.
        // No smoothing — frame tracks scroll position 1:1 for instant response.
        targetFrameIdx = Math.round(progress * (TOTAL_FRAMES - 1));
      } else if (videoReady && !videoError) {
        // DESKTOP: map scroll to video time.
        targetTime = progress * videoDuration;
      }
    }

    // Update progress bar
    if (heroProgressBar) {
      heroProgressBar.style.width = (progress * 100) + '%';
    }

    // Update scroll indicator visibility
    if (heroScrollIndicator) {
      if (progress > 0.15) {
        heroScrollIndicator.classList.add('hidden');
      } else {
        heroScrollIndicator.classList.remove('hidden');
      }
    }

    // Update section counter
    if (scrollCounter) {
      var section = Math.min(6, Math.max(1, Math.ceil(progress * 6)));
      var s = section < 10 ? '0' + section : '' + section;
      scrollCounter.textContent = s + ' / 06';
    }

    // Determine active state
    var targetIdx = getTargetState(progress);

    if (targetIdx !== currentState) {
      // Cancel any pending exit from a rapid transition
      if (exitTimer) {
        clearTimeout(exitTimer);
        exitTimer = null;
      }
      if (pendingExit) {
        pendingExit.classList.remove('active');
        pendingExit.classList.add('exit');
        pendingExit = null;
      }

      // Activate new state immediately
      if (targetIdx >= 0 && states[targetIdx]) {
        states[targetIdx].classList.remove('exit');
        states[targetIdx].classList.add('active');
      }

      // Schedule old state exit for crossfade overlap
      if (currentState >= 0 && states[currentState] && currentState !== targetIdx) {
        var oldStateEl = states[currentState];
        pendingExit = oldStateEl;
        exitTimer = setTimeout(function () {
          if (pendingExit === oldStateEl) {
            oldStateEl.classList.remove('active');
            oldStateEl.classList.add('exit');
            pendingExit = null;
          }
          exitTimer = null;
        }, 220);
      }

      currentState = targetIdx;

      // Adapt overlay gradient per state for optimal readability
      if (overlayEl && targetIdx >= 0) {
        var stateOverlays = [
          'linear-gradient(90deg, rgba(2,11,22,0.88) 0%, rgba(2,11,22,0.55) 38%, rgba(2,11,22,0.18) 72%, rgba(2,11,22,0.05) 100%)',
          'linear-gradient(90deg, rgba(2,11,22,0.80) 0%, rgba(2,11,22,0.45) 40%, rgba(2,11,22,0.10) 75%, rgba(2,11,22,0.02) 100%)',
          'linear-gradient(90deg, rgba(2,11,22,0.84) 0%, rgba(2,11,22,0.50) 40%, rgba(2,11,22,0.14) 73%, rgba(2,11,22,0.03) 100%)',
          'linear-gradient(90deg, rgba(2,11,22,0.88) 0%, rgba(2,11,22,0.58) 35%, rgba(2,11,22,0.22) 68%, rgba(2,11,22,0.08) 100%)',
          'linear-gradient(90deg, rgba(2,11,22,0.82) 0%, rgba(2,11,22,0.48) 42%, rgba(2,11,22,0.10) 76%, rgba(2,11,22,0.02) 100%)',
          'linear-gradient(90deg, rgba(2,11,22,0.55) 0%, rgba(2,11,22,0.62) 50%, rgba(2,11,22,0.55) 100%)'
        ];
        overlayEl.style.background = stateOverlays[targetIdx] || stateOverlays[0];
      }
    }

    // Sub-reveal within active state
    if (targetIdx >= 0) {
      var stateStarts = [0, 0.20, 0.40, 0.60, 0.80, 1.0];
      var stateEnds   = [0.20, 0.40, 0.60, 0.80, 1.0, 1.01]; // state 6 end >1 to avoid div-by-zero
      var sp = (progress - stateStarts[targetIdx]) / (stateEnds[targetIdx] - stateStarts[targetIdx]);
      sp = Math.max(0, Math.min(1, sp));

      if (targetIdx === 2) revealItems(state3Items, sp, 0.12);
      if (targetIdx === 3) revealItems(state4Stats, sp, 0.10);
      if (targetIdx === 4) revealItems(state5Steps, sp, 0.12);
    }
  }

  // ========================================
  // SECTION REVEAL ANIMATIONS
  // ========================================
  function initRevealObserver() {
    if (prefersReducedMotion) {
      document.querySelectorAll('.anim-reveal').forEach(function (el) {
        el.classList.add('visible');
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.15,
      rootMargin: '0px 0px -60px 0px'
    });

    document.querySelectorAll('.anim-reveal').forEach(function (el) {
      observer.observe(el);
    });
  }

  // ========================================
  // APPROACH LINE ANIMATION
  // ========================================
  function initApproachLine() {
    var line = document.querySelector('.approach-light__line');
    if (!line) return;

    if (prefersReducedMotion) {
      line.classList.add('animate');
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          line.classList.add('animate');
          observer.unobserve(line);
        }
      });
    }, { threshold: 0.5 });

    observer.observe(line);
  }

  // ========================================
  // PASSIVE SCROLL HANDLER
  // ========================================
  // Single scroll handler — fires on all platforms (desktop, tablet, mobile).
  // The scroll event fires reliably on every modern browser including iOS Safari.
  // No touchmove backup: a separate touchmove listener would double-fire
  // handleHeroScroll() alongside scroll, causing redundant currentTime seeks
  // that make the mobile animation feel faster/jumpier than desktop.
  // The RAF videoLoop() smooths all interpolation identically on every device.
  function onScroll() {
    updateHeader();
    handleHeroScroll();
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  // ========================================
  // SMOOTH SCROLL FOR ANCHOR LINKS
  // ========================================
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;
      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ========================================
  // INITIALIZATION
  // ========================================
  function init() {
    updateHeader();
    initRevealObserver();
    initApproachLine();

    // Handle reduced motion
    if (prefersReducedMotion) {
      // Show first state immediately
      if (states[0]) states[0].classList.add('active');
      state3Items.forEach(function (i) { i.classList.add('revealed'); });
      state4Stats.forEach(function (i) { i.classList.add('revealed'); });
      state5Steps.forEach(function (i) { i.classList.add('revealed'); });
    }

    // Initialize frame-sequence on mobile/tablet
    if (useFrameSequence && canvas && ctx) {
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      // Preload first batch of frames immediately
      preloadAround(0);
      // Start RAF loop for frame rendering
      if (!rafId) {
        lastFrameTime = performance.now();
        rafId = requestAnimationFrame(videoLoop);
      }
    }

    // Retry video setup if metadata already loaded (desktop)
    if (!useFrameSequence && video && video.readyState >= 1) {
      video.pause();
      videoReady = true;
      videoDuration = video.duration;
      currentTime = video.currentTime;
      lastFrameTime = performance.now();
      rafId = requestAnimationFrame(videoLoop);
    }

    // Cinematic entrance — brief delay before first state appears
    if (!prefersReducedMotion) {
      setTimeout(function () {
        handleHeroScroll();
      }, 450);
    } else {
      handleHeroScroll();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
