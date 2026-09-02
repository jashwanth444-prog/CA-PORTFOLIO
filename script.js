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
      if (!rafId) {
        lastFrameTime = performance.now();
        rafId = requestAnimationFrame(videoLoop);
      }
    }
  });

  // Guard: if anything triggers play(), immediately re-pause.
  // On mobile the browser may attempt autoplay; we always want scroll-controlled frames.
  video.addEventListener('play', function () {
    if (videoReady && !videoError) {
      video.pause();
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
      if (!rafId) {
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

  // RAF loop — smooth video scrubbing.
  // Identical on desktop, tablet and mobile. Uses the same exponential
  // smoothing so the animation timeline is device-independent.
  function videoLoop() {
    if (!videoReady || videoError) return;

    var now = performance.now();
    var dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    // Re-pause guard — if the video somehow started playing, stop it.
    if (!video.paused) video.pause();

    var diff = targetTime - currentTime;
    if (Math.abs(diff) > 0.0001) {
      currentTime += diff * (1 - Math.exp(-dt * 10));
      video.currentTime = currentTime;
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
    if (videoReady && !videoError && !prefersReducedMotion) {
      targetTime = progress * videoDuration;
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

    // Retry video setup if metadata already loaded
    if (video && video.readyState >= 1) {
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
