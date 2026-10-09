/* =========================================================
   THE FOOD HAVEN — script.js
   Vanilla JavaScript. No frameworks, no libraries.

   TABLE OF CONTENTS
   01. Helpers & State
   02. Theme (Dark / Light)
   03. Header, Mobile Nav & Scroll State
   04. Reveal on Scroll
   05. Animated Counters
   06. Menu Data
   07. Menu Rendering, Filtering & Search
   08. Shopping Cart
   09. Cart Drawer & Checkout
   10. Order Confirmation
   11. Countdown Timer
   12. Gallery Lightbox
   13. Reviews Slider
   14. Reservation Form Validation
   15. Back to Top
   16. Toast
   17. Init
   ========================================================= */

(function () {
  'use strict';

  /* =========================================================
     01. HELPERS & STATE
     ========================================================= */

  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Format a number as Pakistani Rupees: 1299 -> "Rs. 1,299" */
  function formatPrice(value) {
    return 'Rs. ' + Number(value).toLocaleString('en-US');
  }

  /* Escape user-supplied / data strings before injecting into HTML */
  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* Lock / unlock page scroll (used by drawer, mobile nav, lightbox) */
  let scrollLocks = 0;
  function lockScroll() {
    scrollLocks++;
    document.body.style.overflow = 'hidden';
  }
  function unlockScroll() {
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (scrollLocks === 0) document.body.style.overflow = '';
  }

  /* localStorage safe wrappers (private mode / disabled storage) */
  const store = {
    get(key) {
      try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
    }
  };

  /* Delivery rules */
  const DELIVERY_FEE = 150;
  const FREE_DELIVERY_THRESHOLD = 1500;

  /* Cart lives in memory — no page refresh required */
  const cart = new Map(); // id -> { item, qty }

  /* Element cache */
  const els = {};


  /* =========================================================
     02. THEME (DARK / LIGHT)
     ========================================================= */

  const THEME_KEY = 'tfh-theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    store.set(THEME_KEY, theme);

    const btn = els.themeToggle;
    if (btn) {
      btn.setAttribute(
        'aria-label',
        theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
      );
    }
  }

  function initTheme() {
    const saved = store.get(THEME_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (prefersDark ? 'dark' : 'light'));

    els.themeToggle.addEventListener('click', function () {
      const current = document.documentElement.getAttribute('data-theme');
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }


  /* =========================================================
     03. HEADER, MOBILE NAV & SCROLL STATE
     ========================================================= */

  function initHeader() {
    const header = els.header;
    const nav = els.nav;
    const hamburger = els.hamburger;
    const navOverlay = els.navOverlay;
    const navLinks = $$('.nav__link');

    /* --- Shrink / solidify header on scroll --- */
    function onScroll() {
      header.classList.toggle('is-scrolled', window.scrollY > 40);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    /* --- Mobile menu open / close --- */
    function openNav() {
      nav.classList.add('is-open');
      hamburger.classList.add('is-active');
      hamburger.setAttribute('aria-expanded', 'true');
      navOverlay.classList.add('is-open');
      lockScroll();
    }

    function closeNav() {
      if (!nav.classList.contains('is-open')) return;
      nav.classList.remove('is-open');
      hamburger.classList.remove('is-active');
      hamburger.setAttribute('aria-expanded', 'false');
      navOverlay.classList.remove('is-open');
      unlockScroll();
    }

    hamburger.addEventListener('click', function () {
      nav.classList.contains('is-open') ? closeNav() : openNav();
    });

    navOverlay.addEventListener('click', closeNav);

    /* Close the panel when any nav link is tapped */
    navLinks.forEach(function (link) {
      link.addEventListener('click', closeNav);
    });

    /* Close on Escape */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeNav();
    });

    /* Close when resizing up to desktop */
    window.addEventListener('resize', function () {
      if (window.innerWidth > 992) closeNav();
    });

    /* --- Highlight active nav link while scrolling --- */
    const sections = navLinks
      .map(function (link) {
        const id = link.getAttribute('href');
        return id && id.startsWith('#') ? document.querySelector(id) : null;
      })
      .filter(Boolean);

    if (sections.length && 'IntersectionObserver' in window) {
      const spy = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            const id = '#' + entry.target.id;
            navLinks.forEach(function (link) {
              link.classList.toggle('is-active', link.getAttribute('href') === id);
            });
          });
        },
        { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
      );
      sections.forEach(function (sec) { spy.observe(sec); });
    }
  }


  /* =========================================================
     04. REVEAL ON SCROLL
     ========================================================= */

  function initReveal() {
    const items = $$('.reveal');
    if (!items.length) return;

    /* No IntersectionObserver or reduced motion → just show everything */
    if (!('IntersectionObserver' in window) || prefersReducedMotion) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    const observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
    );

    items.forEach(function (el) { observer.observe(el); });
  }


  /* =========================================================
     05. ANIMATED COUNTERS
     ========================================================= */

  function animateCounter(el) {
    const target   = parseFloat(el.dataset.count || '0');
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const suffix   = el.dataset.suffix || '';
    const duration = 1700;

    if (prefersReducedMotion) {
      el.textContent = target.toFixed(decimals) + suffix;
      return;
    }

    const start = performance.now();

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      /* easeOutCubic */
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = (target * eased).toFixed(decimals) + suffix;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target.toFixed(decimals) + suffix;
    }

    requestAnimationFrame(step);
  }

  function initCounters() {
    const counters = $$('.stat__num');
    if (!counters.length) return;

    if (!('IntersectionObserver' in window)) {
      counters.forEach(animateCounter);
      return;
    }

    const observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          animateCounter(entry.target);
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.5 }
    );

    counters.forEach(function (el) { observer.observe(el); });
  }


  /* =========================================================
     06. MENU DATA
     ========================================================= */

  const MENU = [
    /* ---------- STARTERS ---------- */
    {
      id: 's1', cat: 'starters', name: 'Crispy Chicken Wings',
      desc: 'Golden fried wings tossed in our smoky honey-chilli glaze.',
      price: 649, rating: 4.7,
      img: 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?auto=format&fit=crop&w=600&q=70'
    },
    {
      id: 's2', cat: 'starters', name: 'Loaded Nachos',
      desc: 'Crisp tortilla chips with cheese sauce, salsa and jalapeños.',
      price: 599, rating: 4.6,
      img: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=600&q=70'
    },
    {
      id: 's3', cat: 'starters', name: 'Mozzarella Sticks',
      desc: 'Breaded mozzarella fried till golden, served with marinara.',
      price: 549, rating: 4.7,
      img: 'https://images.unsplash.com/photo-1531749668029-2db88e4276c7?auto=format&fit=crop&w=600&q=70'
    },

    /* ---------- BURGERS ---------- */
    {
      id: 'b1', cat: 'burgers', name: 'Classic Beef Burger',
      desc: 'Juicy beef patty, fresh vegetables, cheese and our signature sauce.',
      price: 899, rating: 4.9, badge: 'Best Seller',
      img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=70'
    },
    {
      id: 'b2', cat: 'burgers', name: 'Crispy Chicken Burger',
      desc: 'Buttermilk-fried chicken fillet, lettuce and creamy mayo.',
      price: 799, rating: 4.8,
      img: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=600&q=70'
    },
    {
      id: 'b3', cat: 'burgers', name: 'Double Cheese Smash',
      desc: 'Two smashed patties, double cheddar and caramelised onions.',
      price: 1199, rating: 4.9, badge: 'Chef Pick',
      img: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=600&q=70'
    },

    /* ---------- PIZZA ---------- */
    {
      id: 'p1', cat: 'pizza', name: 'Cheese Loaded Pizza',
      desc: 'Fresh mozzarella, premium cheese and delicious toppings.',
      price: 1299, rating: 4.9, badge: 'Popular',
      img: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=70'
    },
    {
      id: 'p2', cat: 'pizza', name: 'Chicken Tikka Pizza',
      desc: 'Spiced chicken tikka, onions, capsicum and a chilli drizzle.',
      price: 1399, rating: 4.8,
      img: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=70'
    },
    {
      id: 'p3', cat: 'pizza', name: 'Pepperoni Feast',
      desc: 'Generous pepperoni, mozzarella and our slow-cooked tomato base.',
      price: 1449, rating: 4.8,
      img: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=600&q=70'
    },

    /* ---------- MAIN COURSE ---------- */
    {
      id: 'mc1', cat: 'main', name: 'Grilled Chicken Steak',
      desc: 'Flame-grilled chicken breast with herb butter and seasonal veggies.',
      price: 1499, rating: 4.8, badge: 'Chef Pick',
      img: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=600&q=70'
    },
    {
      id: 'mc2', cat: 'main', name: 'Beef Tenderloin',
      desc: 'Pan-seared tenderloin with red wine reduction and mashed potato.',
      price: 2199, rating: 4.9,
      img: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=70'
    },
    {
      id: 'mc3', cat: 'main', name: 'Butter Chicken',
      desc: 'Tender chicken in a rich, creamy tomato and butter gravy.',
      price: 1299, rating: 4.8,
      img: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=70'
    },
    {
      id: 'mc4', cat: 'main', name: 'Grilled Fish Fillet',
      desc: 'Lemon-butter fish fillet served with sautéed greens.',
      price: 1699, rating: 4.7,
      img: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=70'
    },

    /* ---------- PASTA ---------- */
    {
      id: 'pa1', cat: 'pasta', name: 'Chicken Alfredo Pasta',
      desc: 'Creamy Alfredo sauce with grilled chicken and parmesan.',
      price: 1099, rating: 4.8, badge: 'Popular',
      img: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=600&q=70'
    },
    {
      id: 'pa2', cat: 'pasta', name: 'Spaghetti Bolognese',
      desc: 'Slow-simmered beef ragu over al dente spaghetti.',
      price: 1149, rating: 4.7,
      img: 'https://images.unsplash.com/photo-1551892374-ecf8754cf8b0?auto=format&fit=crop&w=600&q=70'
    },
    {
      id: 'pa3', cat: 'pasta', name: 'Penne Arrabbiata',
      desc: 'Spicy tomato and garlic sauce with fresh basil and chilli.',
      price: 999, rating: 4.6,
      img: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&w=600&q=70'
    },

    /* ---------- DESSERTS ---------- */
    {
      id: 'd1', cat: 'desserts', name: 'Chocolate Lava Cake',
      desc: 'Warm chocolate cake with a molten centre and vanilla ice cream.',
      price: 649, rating: 4.9, badge: 'Best Seller',
      img: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=600&q=70'
    },
    {
      id: 'd2', cat: 'desserts', name: 'New York Cheesecake',
      desc: 'Creamy baked cheesecake on a buttery biscuit base.',
      price: 699, rating: 4.8,
      img: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=600&q=70'
    },
    {
      id: 'd3', cat: 'desserts', name: 'Tiramisu',
      desc: 'Espresso-soaked ladyfingers layered with mascarpone cream.',
      price: 749, rating: 4.8,
      img: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=600&q=70'
    },

    /* ---------- DRINKS ---------- */
    {
      id: 'dr1', cat: 'drinks', name: 'Signature Cold Coffee',
      desc: 'Chilled espresso blended with milk, ice and a hint of cocoa.',
      price: 449, rating: 4.8,
      img: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=70'
    },
    {
      id: 'dr2', cat: 'drinks', name: 'Fresh Mango Shake',
      desc: 'Thick seasonal mango blended with chilled milk.',
      price: 399, rating: 4.7,
      img: 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?auto=format&fit=crop&w=600&q=70'
    },
    {
      id: 'dr3', cat: 'drinks', name: 'Lemon Mint Cooler',
      desc: 'Fresh lemon, mint and crushed ice — refreshingly tart.',
      price: 329, rating: 4.6,
      img: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&w=600&q=70'
    }
  ];

  /* Fast lookup by id — used by cart and Chef's Favorites buttons */
  const MENU_BY_ID = MENU.reduce(function (acc, item) {
    acc[item.id] = item;
    return acc;
  }, {});


  /* =========================================================
     07. MENU RENDERING, FILTERING & SEARCH
     ========================================================= */

  const menuState = {
    category: 'all',
    query: ''
  };

  /* Build a single menu card */
  function createMenuCard(item) {
    const card = document.createElement('article');
    card.className = 'menu-card';
    card.dataset.id = item.id;

    const badgeHTML = item.badge
      ? '<span class="menu-card__badge">' + escapeHTML(item.badge) + '</span>'
      : '';

    card.innerHTML =
      '<div class="menu-card__media">' +
        '<img src="' + item.img + '" alt="' + escapeHTML(item.name) + '" loading="lazy" width="600" height="450">' +
        badgeHTML +
        '<span class="menu-card__rating">★ ' + item.rating.toFixed(1) + '</span>' +
      '</div>' +
      '<div class="menu-card__body">' +
        '<h3 class="menu-card__title">' + escapeHTML(item.name) + '</h3>' +
        '<p class="menu-card__desc">' + escapeHTML(item.desc) + '</p>' +
        '<div class="menu-card__foot">' +
          '<span class="menu-card__price">' + formatPrice(item.price) + '</span>' +
          '<button class="menu-card__add" type="button" data-add="' + item.id + '" ' +
                  'aria-label="Add ' + escapeHTML(item.name) + ' to cart">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
                 'stroke-linecap="round" aria-hidden="true" width="15" height="15">' +
              '<path d="M12 5v14M5 12h14"/>' +
            '</svg>Add' +
          '</button>' +
        '</div>' +
      '</div>';

    return card;
  }

  /* Apply the current category + search query, then repaint the grid */
  function renderMenu() {
    const grid  = els.menuGrid;
    const empty = els.menuEmpty;
    const query = menuState.query.trim().toLowerCase();

    const results = MENU.filter(function (item) {
      const matchesCategory =
        menuState.category === 'all' || item.cat === menuState.category;

      const matchesQuery =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.desc.toLowerCase().includes(query) ||
        item.cat.toLowerCase().includes(query);

      return matchesCategory && matchesQuery;
    });

    grid.innerHTML = '';

    if (!results.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    /* Staggered entrance animation */
    const frag = document.createDocumentFragment();
    results.forEach(function (item, i) {
      const card = createMenuCard(item);
      card.style.animationDelay = Math.min(i * 45, 400) + 'ms';
      frag.appendChild(card);
    });
    grid.appendChild(frag);
  }

  function setCategory(cat) {
    menuState.category = cat;

    $$('.filter').forEach(function (btn) {
      const isActive = btn.dataset.cat === cat;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    renderMenu();
  }

  function initMenu() {
    /* Category buttons */
    els.menuFilters.addEventListener('click', function (e) {
      const btn = e.target.closest('.filter');
      if (!btn) return;
      setCategory(btn.dataset.cat);
    });

    /* Search box */
    let searchTimer = null;
    els.menuSearch.addEventListener('input', function (e) {
      const value = e.target.value;
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(function () {
        menuState.query = value;
        renderMenu();
      }, 160);
    });

    /* Footer "Our Menu" links jump to a category */
    $$('[data-goto-cat]').forEach(function (link) {
      link.addEventListener('click', function () {
        setCategory(link.dataset.gotoCat);
      });
    });

    renderMenu();
  }


  /* =========================================================
     08. SHOPPING CART
     ========================================================= */

  function addToCart(id) {
    const item = MENU_BY_ID[id];
    if (!item) return;

    if (cart.has(id)) {
      cart.get(id).qty += 1;
    } else {
      cart.set(id, { item: item, qty: 1 });
    }

    updateCartUI();
    bumpCartBadge();
    showToast(item.name + ' added to cart');
  }

  function removeFromCart(id) {
    cart.delete(id);
    updateCartUI();
  }

  function changeQty(id, delta) {
    const entry = cart.get(id);
    if (!entry) return;

    entry.qty += delta;

    if (entry.qty <= 0) {
      cart.delete(id);
    }

    updateCartUI();
  }

  function cartCount() {
    let count = 0;
    cart.forEach(function (entry) { count += entry.qty; });
    return count;
  }

  function cartSubtotal() {
    let subtotal = 0;
    cart.forEach(function (entry) {
      subtotal += entry.item.price * entry.qty;
    });
    return subtotal;
  }

  function deliveryFee(subtotal) {
    if (subtotal === 0) return 0;
    return subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  }

  /* Repaint cart items, totals and badge */
  function updateCartUI() {
    const list   = els.cartItems;
    const empty  = els.cartEmpty;
    const count  = cartCount();

    /* Badge */
    els.cartCount.textContent = count;

    /* Item list */
    list.innerHTML = '';

    if (cart.size === 0) {
      empty.hidden = false;
      els.proceedBtn.disabled = true;
    } else {
      empty.hidden = true;
      els.proceedBtn.disabled = false;

      const frag = document.createDocumentFragment();

      cart.forEach(function (entry, id) {
        const item = entry.item;

        const row = document.createElement('div');
        row.className = 'cart-item';
        row.innerHTML =
          '<img class="cart-item__img" src="' + item.img + '" alt="' +
            escapeHTML(item.name) + '" loading="lazy" width="64" height="64">' +

          '<div class="cart-item__info">' +
            '<span class="cart-item__title">' + escapeHTML(item.name) + '</span>' +
            '<span class="cart-item__price">' + formatPrice(item.price) + '</span>' +

            '<div class="qty">' +
              '<button class="qty__btn" type="button" data-qty="-1" data-id="' + id + '" ' +
                      'aria-label="Decrease quantity of ' + escapeHTML(item.name) + '">−</button>' +
              '<span class="qty__val" aria-live="polite">' + entry.qty + '</span>' +
              '<button class="qty__btn" type="button" data-qty="1" data-id="' + id + '" ' +
                      'aria-label="Increase quantity of ' + escapeHTML(item.name) + '">+</button>' +
            '</div>' +
          '</div>' +

          '<button class="cart-item__remove" type="button" data-remove="' + id + '" ' +
                  'aria-label="Remove ' + escapeHTML(item.name) + ' from cart">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
                 'stroke-linecap="round" aria-hidden="true">' +
              '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>' +
            '</svg>' +
          '</button>';

        frag.appendChild(row);
      });

      list.appendChild(frag);
    }

    /* Totals */
    const subtotal = cartSubtotal();
    const fee = deliveryFee(subtotal);
    const total = subtotal + fee;

    els.cartSubtotal.textContent = formatPrice(subtotal);
    els.cartDelivery.textContent = fee === 0 && subtotal > 0
      ? 'Free'
      : formatPrice(fee);
    els.cartTotal.textContent = formatPrice(total);
  }

  function bumpCartBadge() {
    const badge = els.cartCount;
    badge.classList.remove('bump');
    /* force reflow so the animation can replay */
    void badge.offsetWidth;
    badge.classList.add('bump');
  }

  /* Delegated clicks: menu grid, favorites, cart drawer */
  function initCartEvents() {
    document.addEventListener('click', function (e) {

      /* Add to cart (menu cards + Chef's Favorites buttons) */
      const addBtn = e.target.closest('[data-add]');
      if (addBtn) {
        addToCart(addBtn.dataset.add);
        return;
      }

      /* Quantity +/- */
      const qtyBtn = e.target.closest('[data-qty]');
      if (qtyBtn) {
        changeQty(qtyBtn.dataset.id, parseInt(qtyBtn.dataset.qty, 10));
        return;
      }

      /* Remove item */
      const removeBtn = e.target.closest('[data-remove]');
      if (removeBtn) {
        removeFromCart(removeBtn.dataset.remove);
        return;
      }
    });

    updateCartUI();
  }


  /* =========================================================
     09. CART DRAWER & CHECKOUT
     ========================================================= */

  function openDrawer() {
    els.cartOverlay.classList.add('is-open');
    els.cartDrawer.classList.add('is-open');
    els.cartDrawer.setAttribute('aria-hidden', 'false');
    lockScroll();
    /* focus the close button for keyboard users */
    els.cartClose.focus({ preventScroll: true });
  }

  function closeDrawer() {
    els.cartOverlay.classList.remove('is-open');
    els.cartDrawer.classList.remove('is-open');
    els.cartDrawer.setAttribute('aria-hidden', 'true');
    unlockScroll();
  }

  function showCheckoutView() {
    els.cartView.hidden = true;
    els.checkoutForm.hidden = false;
    els.successView.hidden = true;
    els.cartFoot.hidden = false;
  }

  function showCartView() {
    els.cartView.hidden = false;
    els.checkoutForm.hidden = true;
    els.successView.hidden = true;
    els.cartFoot.hidden = false;
  }

  function initDrawer() {
    /* Always keep overlays in the DOM flow; CSS handles the transitions */
    els.cartOverlay.removeAttribute('hidden');
    els.navOverlay.removeAttribute('hidden');
    els.lightbox.removeAttribute('hidden');

    els.cartToggle.addEventListener('click', openDrawer);
    els.cartClose.addEventListener('click', closeDrawer);
    els.cartOverlay.addEventListener('click', closeDrawer);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && els.cartDrawer.classList.contains('is-open')) {
        closeDrawer();
      }
    });

    els.proceedBtn.addEventListener('click', function () {
      if (cart.size === 0) return;
      showCheckoutView();
      els.cName.focus({ preventScroll: true });
    });

    els.backToCart.addEventListener('click', showCartView);
    els.successDone.addEventListener('click', function () {
      showCartView();
      closeDrawer();
    });

    els.checkoutForm.addEventListener('submit', handleCheckoutSubmit);
  }


  /* =========================================================
     10. ORDER CONFIRMATION
     ========================================================= */

  function makeOrderId() {
    const stamp = Date.now().toString().slice(-6);
    const rand = Math.floor(Math.random() * 90 + 10);
    return 'FH-' + stamp + rand;
  }

  function handleCheckoutSubmit(e) {
    e.preventDefault();

    if (cart.size === 0) return;

    /* --- Validate --- */
    let valid = true;

    valid = validateField(els.cName,    validateName)  && valid;
    valid = validateField(els.cPhone,   validatePhone) && valid;
    valid = validateField(els.cAddress, validateRequired) && valid;

    if (!valid) {
      const firstError = els.checkoutForm.querySelector('.has-error input, .has-error textarea');
      if (firstError) firstError.focus({ preventScroll: true });
      return;
    }

    /* --- Build the "order" --- */
    const paymentInput = els.checkoutForm.querySelector('input[name="payment"]:checked');
    const payment = paymentInput ? paymentInput.value : 'Cash on Delivery';

    const subtotal = cartSubtotal();
    const fee = deliveryFee(subtotal);
    const total = subtotal + fee;

    const order = {
      id: makeOrderId(),
      name: els.cName.value.trim(),
      phone: els.cPhone.value.trim(),
      address: els.cAddress.value.trim(),
      notes: els.cNotes.value.trim(),
      payment: payment,
      subtotal: subtotal,
      delivery: fee,
      total: total,
      items: Array.from(cart.values()).map(function (entry) {
        return {
          name: entry.item.name,
          qty: entry.qty,
          price: entry.item.price
        };
      })
    };

    /* Front-end only — logged for demonstration. No backend call. */
    console.log('Order placed:', order);

    /* --- Show confirmation --- */
    els.successName.textContent  = order.name;
    els.successId.textContent    = order.id;
    els.successPay.textContent   = order.payment;
    els.successTotal.textContent = formatPrice(order.total);

    els.cartView.hidden = true;
    els.checkoutForm.hidden = true;
    els.successView.hidden = false;
    els.cartFoot.hidden = true;

    /* --- Reset --- */
    cart.clear();
    updateCartUI();
    els.checkoutForm.reset();
    clearAllErrors(els.checkoutForm);
  }


  /* =========================================================
     11. COUNTDOWN TIMER
     ========================================================= */

  function initCountdown() {
    const daysEl  = els.cdDays;
    const hoursEl = els.cdHours;
    const minsEl  = els.cdMins;
    const secsEl  = els.cdSecs;
    if (!daysEl) return;

    /* Target: the upcoming Sunday at 23:59:59 local time */
    function getTarget() {
      const now = new Date();
      const target = new Date(now);
      const daysUntilSunday = (7 - now.getDay()) % 7;
      target.setDate(now.getDate() + daysUntilSunday);
      target.setHours(23, 59, 59, 999);

      /* If already past it, roll to next week */
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 7);
      }
      return target;
    }

    let target = getTarget();

    function pad(n) {
      return String(n).padStart(2, '0');
    }

    function tick() {
      const now = Date.now();
      let diff = target.getTime() - now;

      /* Restart the week if it expires while the page is open */
      if (diff <= 0) {
        target = getTarget();
        diff = target.getTime() - now;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const days    = Math.floor(totalSeconds / 86400);
      const hours   = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      daysEl.textContent  = pad(days);
      hoursEl.textContent = pad(hours);
      minsEl.textContent  = pad(minutes);
      secsEl.textContent  = pad(seconds);
    }

    tick();
    setInterval(tick, 1000);
  }


  /* =========================================================
     12. GALLERY LIGHTBOX
     ========================================================= */

  const lightbox = {
    items: [],
    index: 0,
    lastFocused: null,

    open(index) {
      this.index = index;
      this.render();
      els.lightbox.classList.add('is-open');
      els.lightbox.setAttribute('aria-hidden', 'false');
      lockScroll();
      els.lbClose.focus({ preventScroll: true });
    },

    close() {
      els.lightbox.classList.remove('is-open');
      els.lightbox.setAttribute('aria-hidden', 'true');
      unlockScroll();
      if (this.lastFocused) this.lastFocused.focus({ preventScroll: true });
    },

    next() {
      this.index = (this.index + 1) % this.items.length;
      this.render();
    },

    prev() {
      this.index = (this.index - 1 + this.items.length) % this.items.length;
      this.render();
    },

    render() {
      const item = this.items[this.index];
      if (!item) return;

      const img = els.lbImage;
      img.src = item.src;
      img.alt = item.alt;
      els.lbCaption.textContent = item.alt;
    }
  };

  function initLightbox() {
    const buttons = $$('.gallery__item');
    if (!buttons.length) return;

    lightbox.items = buttons.map(function (btn) {
      const img = btn.querySelector('img');
      return {
        src: btn.dataset.src || (img ? img.src : ''),
        alt: img ? img.alt : ''
      };
    });

    buttons.forEach(function (btn, i) {
      btn.addEventListener('click', function () {
        lightbox.lastFocused = btn;
        lightbox.open(i);
      });
    });

    els.lbClose.addEventListener('click', function () { lightbox.close(); });
    els.lbNext.addEventListener('click', function () { lightbox.next(); });
    els.lbPrev.addEventListener('click', function () { lightbox.prev(); });

    /* Click the dark backdrop to close */
    els.lightbox.addEventListener('click', function (e) {
      if (e.target === els.lightbox) lightbox.close();
    });

    /* Keyboard support */
    document.addEventListener('keydown', function (e) {
      if (!els.lightbox.classList.contains('is-open')) return;

      if (e.key === 'Escape')     lightbox.close();
      if (e.key === 'ArrowRight') lightbox.next();
      if (e.key === 'ArrowLeft')  lightbox.prev();
    });

    /* Touch swipe */
    let touchStartX = 0;
    els.lightbox.addEventListener('touchstart', function (e) {
      touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });

    els.lightbox.addEventListener('touchend', function (e) {
      const delta = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(delta) < 60) return;
      delta < 0 ? lightbox.next() : lightbox.prev();
    }, { passive: true });
  }


  /* =========================================================
     13. REVIEWS SLIDER
     ========================================================= */

  function initSlider() {
    const track = els.reviewTrack;
    const dotsWrap = els.reviewDots;
    if (!track) return;

    const slides = $$('.review', track);
    if (!slides.length) return;

    let index = 0;
    let autoplayTimer = null;
    let isPaused = false;
    const AUTOPLAY_MS = 6000;

    /* --- Build dots --- */
    slides.forEach(function (_, i) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', 'Go to review ' + (i + 1));
      if (i === 0) dot.classList.add('is-active');
      dot.addEventListener('click', function () { goTo(i); });
      dotsWrap.appendChild(dot);
    });

    const dots = $$('button', dotsWrap);

    function goTo(i) {
      index = (i + slides.length) % slides.length;
      track.style.transform = 'translateX(-' + (index * 100) + '%)';

      dots.forEach(function (dot, di) {
        const active = di === index;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }

    function next() { goTo(index + 1); }
    function prev() { goTo(index - 1); }

    els.reviewNext.addEventListener('click', function () { next(); restart(); });
    els.reviewPrev.addEventListener('click', function () { prev(); restart(); });

    /* --- Autoplay --- */
    function start() {
      if (prefersReducedMotion) return;
      stop();
      autoplayTimer = setInterval(function () {
        if (!isPaused) next();
      }, AUTOPLAY_MS);
    }
    function stop() {
      if (autoplayTimer) clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
    function restart() { stop(); start(); }

    /* Pause on hover / focus / hidden tab */
    const slider = els.reviewSlider;
    slider.addEventListener('mouseenter', function () { isPaused = true; });
    slider.addEventListener('mouseleave', function () { isPaused = false; });
    slider.addEventListener('focusin',    function () { isPaused = true; });
    slider.addEventListener('focusout',   function () { isPaused = false; });

    document.addEventListener('visibilitychange', function () {
      document.hidden ? stop() : start();
    });

    /* --- Touch swipe --- */
    let startX = 0;
    slider.addEventListener('touchstart', function (e) {
      startX = e.changedTouches[0].clientX;
    }, { passive: true });

    slider.addEventListener('touchend', function (e) {
      const delta = e.changedTouches[0].clientX - startX;
      if (Math.abs(delta) < 50) return;
      delta < 0 ? next() : prev();
      restart();
    }, { passive: true });

    goTo(0);
    start();
  }


  /* =========================================================
     14. RESERVATION FORM VALIDATION
     ========================================================= */

  /* --- Reusable validators --- */

  function validateRequired(value) {
    return value.trim().length > 0 ? '' : 'This field is required.';
  }

  function validateName(value) {
    const v = value.trim();
    if (!v) return 'Please enter your full name.';
    if (v.length < 3) return 'Name must be at least 3 characters.';
    if (!/^[A-Za-z\u00C0-\u024F\u0600-\u06FF\s.'-]+$/.test(v)) {
      return 'Please enter a valid name.';
    }
    return '';
  }

  function validatePhone(value) {
    const v = value.trim();
    if (!v) return 'Please enter your phone number.';
    const digits = v.replace(/\D/g, '');
    if (digits.length < 10) return 'Phone number must be at least 10 digits.';
    if (digits.length > 15) return 'Phone number is too long.';
    if (!/^[+]?[\d\s().-]+$/.test(v)) return 'Please enter a valid phone number.';
    return '';
  }

  function validateEmail(value) {
    const v = value.trim();
    if (!v) return 'Please enter your email address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
      return 'Please enter a valid email address.';
    }
    return '';
  }

  function validateDate(value) {
    if (!value) return 'Please select a date.';
    const chosen = new Date(value + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(chosen.getTime())) return 'Please select a valid date.';
    if (chosen < today) return 'Please choose today or a future date.';
    return '';
  }

  function validateTime(value) {
    if (!value) return 'Please select a time.';
    return '';
  }

  function validateGuests(value) {
    if (!value) return 'Please select the number of guests.';
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 1) return 'Please select at least 1 guest.';
    return '';
  }

  /* --- Field-level helpers --- */

  function setFieldError(input, message) {
    const field = input.closest('.field');
    const errorEl = field ? field.querySelector('.error') : null;

    if (field) field.classList.toggle('has-error', Boolean(message));
    if (errorEl) errorEl.textContent = message || '';

    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function validateField(input, validator) {
    const message = validator(input.value);
    setFieldError(input, message);
    return !message;
  }

  function clearAllErrors(form) {
    $$('.field', form).forEach(function (field) {
      field.classList.remove('has-error');
    });
    $$('.error', form).forEach(function (el) {
      el.textContent = '';
    });
    $$('[aria-invalid]', form).forEach(function (el) {
      el.removeAttribute('aria-invalid');
    });
  }

  /* --- Reservation form --- */

  function initReservationForm() {
    const form = els.reservationForm;
    if (!form) return;

    const name   = $('#rName');
    const phone  = $('#rPhone');
    const email  = $('#rEmail');
    const date   = $('#rDate');
    const time   = $('#rTime');
    const guests = $('#rGuests');

    /* Prevent past dates in the picker */
    const today = new Date();
    const iso = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
    date.min = iso;

    /* Live validation once a field has been touched */
    const validators = [
      [name,   validateName],
      [phone,  validatePhone],
      [email,  validateEmail],
      [date,   validateDate],
      [time,   validateTime],
      [guests, validateGuests]
    ];

    validators.forEach(function (pair) {
      const input = pair[0];
      const validator = pair[1];

      input.addEventListener('blur', function () {
        if (input.value.trim() !== '') validateField(input, validator);
      });

      input.addEventListener('input', function () {
        if (input.closest('.field').classList.contains('has-error')) {
          validateField(input, validator);
        }
      });

      input.addEventListener('change', function () {
        if (input.closest('.field').classList.contains('has-error')) {
          validateField(input, validator);
        }
      });
    });

    /* Submit */
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      let valid = true;
      validators.forEach(function (pair) {
        valid = validateField(pair[0], pair[1]) && valid;
      });

      if (!valid) {
        const firstError = form.querySelector('.has-error input, .has-error select');
        if (firstError) firstError.focus({ preventScroll: true });
        return;
      }

      /* Front-end only — no backend request */
      const data = {
        name:   name.value.trim(),
        phone:  phone.value.trim(),
        email:  email.value.trim(),
        date:   date.value,
        time:   time.value,
        guests: guests.value,
        request: $('#rRequest').value.trim()
      };

      console.log('Reservation request:', data);

      /* Success message */
      const success = els.reservationSuccess;
      success.hidden = false;

      /* Reset the form and clear validation styling */
      form.reset();
      clearAllErrors(form);

      showToast('Reservation request received!');

      /* Auto-hide the success message after a while */
      window.setTimeout(function () {
        success.hidden = true;
      }, 8000);
    });
  }


  /* =========================================================
     15. BACK TO TOP
     ========================================================= */

  function initBackToTop() {
    const btn = els.backToTop;
    if (!btn) return;

    function toggle() {
      btn.classList.toggle('is-visible', window.scrollY > 500);
    }

    toggle();
    window.addEventListener('scroll', toggle, { passive: true });

    btn.addEventListener('click', function () {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
    });
  }


  /* =========================================================
     16. TOAST
     ========================================================= */

  let toastTimer = null;

  function showToast(message) {
    const toast = els.toast;
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('is-visible');

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 2600);
  }


  /* =========================================================
     17. INIT
     ========================================================= */

  function cacheElements() {
    els.header       = $('#header');
    els.nav          = $('#nav');
    els.hamburger    = $('#hamburger');
    els.navOverlay   = $('#navOverlay');
    els.themeToggle  = $('#themeToggle');

    els.cartToggle   = $('#cartToggle');
    els.cartCount    = $('#cartCount');
    els.cartDrawer   = $('#cartDrawer');
    els.cartOverlay  = $('#cartOverlay');
    els.cartClose    = $('#cartClose');
    els.cartItems    = $('#cartItems');
    els.cartEmpty    = $('#cartEmpty');
    els.cartView     = $('#cartView');
    els.cartSubtotal = $('#cartSubtotal');
    els.cartDelivery = $('#cartDelivery');
    els.cartTotal    = $('#cartTotal');
    els.cartFoot     = $('#cartFoot');
    els.proceedBtn   = $('#proceedBtn');

    els.checkoutForm = $('#checkoutForm');
    els.backToCart   = $('#backToCart');
    els.cName        = $('#cName');
    els.cPhone       = $('#cPhone');
    els.cAddress     = $('#cAddress');
    els.cNotes       = $('#cNotes');

    els.successView  = $('#successView');
    els.successName  = $('#successName');
    els.successId    = $('#successId');
    els.successPay   = $('#successPay');
    els.successTotal = $('#successTotal');
    els.successDone  = $('#successDone');

    els.menuGrid     = $('#menuGrid');
    els.menuEmpty    = $('#menuEmpty');
    els.menuFilters  = $('#menuFilters');
    els.menuSearch   = $('#menuSearch');

    els.cdDays       = $('#cdDays');
    els.cdHours      = $('#cdHours');
    els.cdMins       = $('#cdMins');
    els.cdSecs       = $('#cdSecs');

    els.lightbox     = $('#lightbox');
    els.lbImage      = $('#lbImage');
    els.lbCaption    = $('#lbCaption');
    els.lbClose      = $('#lbClose');
    els.lbPrev       = $('#lbPrev');
    els.lbNext       = $('#lbNext');

    els.reviewSlider = $('#reviewSlider');
    els.reviewTrack  = $('#reviewTrack');
    els.reviewDots   = $('#reviewDots');
    els.reviewPrev   = $('#reviewPrev');
    els.reviewNext   = $('#reviewNext');

    els.reservationForm    = $('#reservationForm');
    els.reservationSuccess = $('#reservationSuccess');

    els.backToTop    = $('#backToTop');
    els.toast        = $('#toast');
  }

  function init() {
    cacheElements();

    initTheme();
    initHeader();
    initReveal();
    initCounters();
    initMenu();
    initCartEvents();
    initDrawer();
    initCountdown();
    initLightbox();
    initSlider();
    initReservationForm();
    initBackToTop();
  }

  /* Run once the DOM is ready (script is deferred, but be safe) */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();