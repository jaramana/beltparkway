// Changes each pinned picture as a step's card rises, marks the current section
// in the nav, and opens the nav's menu on phones.

(function () {
  function each(selector, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), fn);
  }

  var stories = Array.prototype.map.call(document.querySelectorAll('.story'), function (story) {
    return {
      steps: Array.prototype.slice.call(story.querySelectorAll('.step')),
      layers: Array.prototype.slice.call(story.querySelectorAll('.layer')),
      current: null
    };
  });

  var links = Array.prototype.slice.call(document.querySelectorAll('.site-nav-links > li > a'));
  var targets = links.map(function (link) {
    return document.querySelector(link.getAttribute('href'));
  });

  function show(entry, name) {
    if (name === entry.current) return;
    entry.current = name;
    entry.layers.forEach(function (layer) {
      layer.classList.toggle('on', layer.dataset.layer === name);
    });
  }

  // A step takes over as its card comes up from the bottom of the window.
  function updateStories() {
    var line = window.innerHeight * 0.94;
    stories.forEach(function (entry) {
      var active = entry.steps[0];
      entry.steps.forEach(function (step) {
        if (step.firstElementChild.getBoundingClientRect().top <= line) active = step;
      });
      show(entry, active.dataset.show);
      entry.steps.forEach(function (step) { step.classList.toggle('active', step === active); });
    });
  }

  function updateNav() {
    var line = window.innerHeight * 0.4;
    var active = -1;
    targets.forEach(function (target, i) {
      if (target && target.getBoundingClientRect().top <= line) active = i;
    });
    links.forEach(function (link, i) {
      if (i === active) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  function update() {
    updateStories();
    updateNav();
  }

  var queued = false;
  window.addEventListener('scroll', function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; update(); });
  }, { passive: true });
  window.addEventListener('resize', update);
  update();

  // The phone menu opens as a sheet under the nav and locks the page behind it.
  // Escape, a tap outside the nav, a chosen link or a wider window closes it.
  var nav = document.querySelector('.site-nav');
  var toggle = document.querySelector('.site-nav-toggle');
  var wide = window.matchMedia('(min-width: 58.01rem)');
  function setOpen(open) {
    if (open) nav.style.setProperty('--sheet-top', nav.getBoundingClientRect().bottom + 'px');
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('menu-locked', open);
  }
  toggle.addEventListener('click', function () {
    setOpen(!nav.classList.contains('open'));
  });
  nav.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); toggle.focus(); }
  });
  document.addEventListener('click', function (e) {
    if (nav.classList.contains('open') && !nav.contains(e.target)) setOpen(false);
  });
  wide.addEventListener('change', function () { if (wide.matches) setOpen(false); });

  // A chosen link closes the phone menu and the dropdown first, so the page can
  // scroll. The dropdown can open again once the pointer has left it.
  var sub = document.querySelector('.has-sub');
  each('.site-nav-links a', function (link) {
    link.addEventListener('click', function () {
      setOpen(false);
      link.blur();
      if (sub.contains(link)) sub.classList.add('shut');
    });
  });
  sub.addEventListener('mouseleave', function () { sub.classList.remove('shut'); });

  // A chosen link jumps straight to its section, then re-aligns while lazy
  // images above it load, unless the reader scrolls first.
  var settling = 0;
  function jump(target) {
    target.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  ['wheel', 'touchstart', 'keydown'].forEach(function (type) {
    window.addEventListener(type, function () { settling++; }, { passive: true });
  });
  each('.site-nav-links a, .cover-next a', function (link) {
    link.addEventListener('click', function (event) {
      var target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      history.pushState(null, '', link.getAttribute('href'));
      var ticket = ++settling;
      jump(target);
      [120, 400, 900].forEach(function (ms) {
        setTimeout(function () { if (ticket === settling) jump(target); }, ms);
      });
    });
  });

  // The clip's own button plays it with sound. It pauses once scrolled out of view.
  var clip = document.querySelector('.clip');
  if (clip) {
    var video = clip.querySelector('video');
    video.controls = false;
    clip.querySelector('.clip-play').addEventListener('click', function () {
      clip.classList.add('playing');
      video.controls = true;
      video.play();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) video.pause();
      }).observe(video);
    }
  }

  // The map pictures tilt in CSS. Each overlay's labels come out of its SVG and are
  // drawn upright, at the spot where the tilted map carries their anchor point.
  if (window.DOMMatrix && window.fetch) (function () {
    var NS = 'http://www.w3.org/2000/svg';
    var sets = [];

    // Where a point in the SVG lands on screen, relative to the layer, once tilted.
    function project(img, box, x, y) {
      var w = img.offsetWidth, h = img.offsetHeight;
      var s = Math.max(w / box[0], h / box[1]);
      var style = getComputedStyle(img);
      var pos = style.objectPosition.split(' ').map(parseFloat);
      var px = img.offsetLeft + (w - box[0] * s) * pos[0] / 100 + x * s;
      var py = img.offsetTop + (h - box[1] * s) * pos[1] / 100 + y * s;
      var origin = style.transformOrigin.split(' ').map(parseFloat);
      var ox = img.offsetLeft + origin[0], oy = img.offsetTop + origin[1];
      var p = new DOMMatrix(style.transform).transformPoint(new DOMPoint(px - ox, py - oy, 0, 1));
      return { x: ox + p.x / p.w, y: oy + p.y / p.w, s: s };
    }

    // Only the label set for the picture the browser shows at this width is drawn.
    function place(set) {
      var on = !set.media || matchMedia(set.media).matches;
      if (on && set.after) on = !matchMedia(set.after).matches;
      set.svg.style.display = on ? '' : 'none';
      if (!on) return;
      var layer = set.img.closest('.layer');
      set.svg.setAttribute('viewBox', '0 0 ' + layer.offsetWidth + ' ' + layer.offsetHeight);
      set.labels.forEach(function (label) {
        var p = project(set.img, set.box, label.x, label.y);
        var el = label.el;
        el.setAttribute('font-size', (label.size * p.s).toFixed(1));
        el.setAttribute('stroke-width', (label.stroke * p.s).toFixed(1));
        if (label.turn) el.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ') rotate(' + label.turn + ')');
        else { el.setAttribute('x', p.x.toFixed(1)); el.setAttribute('y', p.y.toFixed(1)); }
      });
    }

    // Swaps one SVG for a copy without its text, and keeps the text as labels.
    function lift(img, url, media, after, swap) {
      fetch(url).then(function (r) { return r.text(); }).then(function (text) {
        var art = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
        var box = art.getAttribute('viewBox').split(' ').slice(2).map(Number);
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class', 'flat-labels');
        svg.setAttribute('aria-hidden', 'true');
        var labels = Array.prototype.map.call(art.querySelectorAll('text'), function (t) {
          var label = { size: +t.getAttribute('font-size'), stroke: +(t.getAttribute('stroke-width') || 0) };
          var m = /translate\(([-\d.]+),([-\d.]+)\)\s*rotate\(([-\d.]+)\)/.exec(t.getAttribute('transform') || '');
          if (m) { label.x = +m[1]; label.y = +m[2]; label.turn = +m[3]; }
          else { label.x = +t.getAttribute('x'); label.y = +t.getAttribute('y'); }
          t.parentNode.removeChild(t);
          label.el = document.importNode(t, true);
          label.el.removeAttribute('transform');
          svg.appendChild(label.el);
          return label;
        });
        swap(URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(art)], { type: 'image/svg+xml' })));
        img.closest('.layer').appendChild(svg);
        var set = { img: img, box: box, svg: svg, labels: labels, media: media, after: after };
        sets.push(set);
        if (img.complete) place(set);
        img.addEventListener('load', function () { place(set); });
      });
    }

    each('.stage .layer picture', function (picture) {
      var img = picture.querySelector('img');
      var sources = Array.prototype.slice.call(picture.querySelectorAll('source'));
      sources.forEach(function (source) {
        var url = source.getAttribute('srcset');
        if (/\.svg$/.test(url)) lift(img, url, source.media, null, function (blob) { source.srcset = blob; });
      });
      var url = img.getAttribute('src');
      var after = sources.map(function (s) { return s.media; }).join(', ') || null;
      if (/\.svg$/.test(url)) lift(img, url, null, after, function (blob) { img.src = blob; });
    });

    var timer;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { sets.forEach(place); }, 100);
    });
  })();

})();
