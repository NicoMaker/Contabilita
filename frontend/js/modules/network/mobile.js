// ═══════════════════════════════════════════════════════════════
// MOBILE.JS — Gestione menu hamburger e sidebar mobile
//
// Responsabilità:
//   • Crea il bottone hamburger e l'overlay nel DOM
//   • Apre / chiude la sidebar su mobile (≤ 768px)
//   • Chiude la sidebar cliccando fuori (overlay)
//   • Chiude la sidebar premendo Escape
//   • Chiude la sidebar dopo aver selezionato una voce nav
//   • Swipe-to-open / swipe-to-close (touch)
//   • Si disattiva automaticamente sopra i 768px
// ═══════════════════════════════════════════════════════════════

(function () {
  "use strict";

  /* ─── COSTANTI ─────────────────────────────────────────────── */
  const MOBILE_BP = 768;           // breakpoint px (deve corrispondere al CSS)
  const SWIPE_OPEN_ZONE  = 24;     // px dal bordo sinistro che attiva lo swipe-open
  const SWIPE_THRESHOLD  = 60;     // px di swipe minimo per aprire/chiudere
  const SWIPE_VELOCITY   = 0.3;    // px/ms minima per considerare lo swipe veloce

  /* ─── STATO ────────────────────────────────────────────────── */
  let _sidebarOpen = false;

  /* ─── ELEMENTI ─────────────────────────────────────────────── */
  let sidebar, overlay, hamburger;

  /* ─── INIT ─────────────────────────────────────────────────── */
  function init() {
    sidebar  = document.querySelector(".sidebar");
    if (!sidebar) return;

    _createOverlay();
    _createHamburger();
    _bindNavItems();
    _bindKeyboard();
    _bindSwipe();
    _bindResize();
  }

  /* ─── CREA OVERLAY ─────────────────────────────────────────── */
  function _createOverlay() {
    overlay = document.querySelector(".sidebar-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "sidebar-overlay";
      document.body.appendChild(overlay);
    }
    overlay.addEventListener("click", closeSidebar);
  }

  /* ─── CREA HAMBURGER ───────────────────────────────────────── */
  function _createHamburger() {
    hamburger = document.querySelector(".hamburger");
    if (!hamburger) {
      hamburger = document.createElement("button");
      hamburger.className = "hamburger";
      hamburger.setAttribute("aria-label", "Apri menu");
      hamburger.setAttribute("aria-expanded", "false");
      hamburger.setAttribute("type", "button");

      // SVG a tre linee / X
      hamburger.innerHTML = `
        <svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
          <line x1="2" y1="4"  x2="16" y2="4"  class="hb-top"/>
          <line x1="2" y1="9"  x2="16" y2="9"  class="hb-mid"/>
          <line x1="2" y1="14" x2="16" y2="14" class="hb-bot"/>
        </svg>`;

      // Inserisce il hamburger come primo figlio della topbar
      const topbar = document.querySelector(".topbar");
      if (topbar) topbar.insertBefore(hamburger, topbar.firstChild);
      else document.body.appendChild(hamburger);
    }

    hamburger.addEventListener("click", toggleSidebar);
  }

  /* ─── BIND VOCI NAV ────────────────────────────────────────── */
  // Chiude la sidebar quando l'utente tocca una voce su mobile
  function _bindNavItems() {
    document.querySelectorAll(".nav-item").forEach((el) => {
      el.addEventListener("click", () => {
        if (isMobile()) closeSidebar();
      });
    });
  }

  /* ─── KEYBOARD ─────────────────────────────────────────────── */
  function _bindKeyboard() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && _sidebarOpen && isMobile()) closeSidebar();
    });
  }

  /* ─── RESIZE ───────────────────────────────────────────────── */
  function _bindResize() {
    let _resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(_resizeTimer);
      _resizeTimer = setTimeout(() => {
        if (!isMobile() && _sidebarOpen) {
          // Torna a desktop: rimuovi stato mobile senza animazione
          _setSidebarOpen(false, true);
        }
      }, 150);
    });
  }

  /* ─── SWIPE ────────────────────────────────────────────────── */
  function _bindSwipe() {
    let startX = 0, startY = 0, startTime = 0;
    let tracking = false;

    document.addEventListener("touchstart", (e) => {
      if (!isMobile()) return;
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();

      // Swipe-open: solo se inizia nel bordo sinistro
      if (!_sidebarOpen && startX <= SWIPE_OPEN_ZONE) {
        tracking = true;
      }
      // Swipe-close: qualsiasi punto quando sidebar è aperta
      if (_sidebarOpen) {
        tracking = true;
      }
    }, { passive: true });

    document.addEventListener("touchend", (e) => {
      if (!isMobile() || !tracking) return;
      tracking = false;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const dt = Date.now() - startTime;
      const velocity = Math.abs(dx) / dt;

      // Ignora swipe prevalentemente verticali
      if (Math.abs(dy) > Math.abs(dx) * 1.2) return;

      const isFast = velocity > SWIPE_VELOCITY;

      if (!_sidebarOpen && dx > 0 && (dx > SWIPE_THRESHOLD || isFast)) {
        openSidebar();
      } else if (_sidebarOpen && dx < 0 && (Math.abs(dx) > SWIPE_THRESHOLD || isFast)) {
        closeSidebar();
      }
    }, { passive: true });
  }

  /* ─── HELPERS ──────────────────────────────────────────────── */
  function isMobile() {
    return window.innerWidth <= MOBILE_BP;
  }

  /* ─── OPEN / CLOSE / TOGGLE ────────────────────────────────── */
  function openSidebar() {
    _setSidebarOpen(true);
  }

  function closeSidebar() {
    _setSidebarOpen(false);
  }

  function toggleSidebar() {
    _setSidebarOpen(!_sidebarOpen);
  }

  /**
   * _setSidebarOpen(open, instant)
   * @param {boolean} open    - true = apri, false = chiudi
   * @param {boolean} instant - se true salta le transizioni CSS
   */
  function _setSidebarOpen(open, instant) {
    _sidebarOpen = open;

    if (instant) {
      sidebar.style.transition = "none";
      overlay.style.transition = "none";
    }

    if (open) {
      sidebar.classList.add("open");
      overlay.classList.add("visible");
      document.body.style.overflow = "hidden"; // blocca scroll body
    } else {
      sidebar.classList.remove("open");
      overlay.classList.remove("visible");
      document.body.style.overflow = "";       // ripristina scroll
    }

    if (hamburger) {
      hamburger.setAttribute("aria-expanded", open ? "true" : "false");
      hamburger.setAttribute("aria-label", open ? "Chiudi menu" : "Apri menu");
      _updateHamburgerIcon(open);
    }

    if (instant) {
      // Forza reflow poi ripristina le transizioni
      // eslint-disable-next-line no-unused-expressions
      sidebar.offsetHeight;
      overlay.offsetHeight;
      sidebar.style.transition = "";
      overlay.style.transition = "";
    }
  }

  /* ─── ICONA HAMBURGER (3 linee ↔ X) ───────────────────────── */
  function _updateHamburgerIcon(open) {
    if (!hamburger) return;
    const svg = hamburger.querySelector("svg");
    if (!svg) return;

    if (open) {
      // Trasforma in × usando transform CSS inline
      svg.querySelector(".hb-top").setAttribute("x1", "3");
      svg.querySelector(".hb-top").setAttribute("y1", "3");
      svg.querySelector(".hb-top").setAttribute("x2", "15");
      svg.querySelector(".hb-top").setAttribute("y2", "15");

      svg.querySelector(".hb-mid").style.opacity = "0";

      svg.querySelector(".hb-bot").setAttribute("x1", "15");
      svg.querySelector(".hb-bot").setAttribute("y1", "3");
      svg.querySelector(".hb-bot").setAttribute("x2", "3");
      svg.querySelector(".hb-bot").setAttribute("y2", "15");
    } else {
      svg.querySelector(".hb-top").setAttribute("x1", "2");
      svg.querySelector(".hb-top").setAttribute("y1", "4");
      svg.querySelector(".hb-top").setAttribute("x2", "16");
      svg.querySelector(".hb-top").setAttribute("y2", "4");

      svg.querySelector(".hb-mid").style.opacity = "1";

      svg.querySelector(".hb-bot").setAttribute("x1", "2");
      svg.querySelector(".hb-bot").setAttribute("y1", "14");
      svg.querySelector(".hb-bot").setAttribute("x2", "16");
      svg.querySelector(".hb-bot").setAttribute("y2", "14");
    }
  }

  /* ─── ESPOSIZIONE PUBBLICA ─────────────────────────────────── */
  window.mobileSidebar = {
    open:   openSidebar,
    close:  closeSidebar,
    toggle: toggleSidebar,
    isOpen: () => _sidebarOpen,
  };

  /* ─── AUTO-INIT ────────────────────────────────────────────── */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();