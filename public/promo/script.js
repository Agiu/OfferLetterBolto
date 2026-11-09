(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- Background words ---------- */
  const glyphs = document.querySelector('[data-glyphs]');
  if (glyphs) {
    const words = ['START DATE', 'FLSA EXEMPT', 'I-9', 'OFFER SENT', 'TEMPLATE', 'SIGNED', 'PAYROLL GROUP',
      'REPORTS TO', 'HYBRID', 'W-2', '1099', 'SALARY', 'EQUITY', 'REVIEWED', '$', '✓', 'DRAFT', 'READY'];
    const spans = [];
    for (let i = 0; i < 70; i++) {
      const s = document.createElement('span');
      s.textContent = words[i % words.length];
      s.style.left = `${(i * 37) % 100}%`;
      s.style.top = `${((i * 53) % 100) * 0.95}%`;
      glyphs.appendChild(s);
      spans.push(s);
    }
    if (!reduce) {
      setInterval(() => {
        const s = spans[Math.floor(Math.random() * spans.length)];
        s.classList.add('lit');
        setTimeout(() => s.classList.remove('lit'), 1600);
      }, 220);
    }
  }

  /* ---------- The journey, played out in the hero ---------- */
  const stage = document.querySelector('.stage');
  if (stage) {
    const $ = (s) => stage.querySelector(s);
    const appSteps = [...stage.querySelectorAll('.app-steps li')];
    const strip = [...document.querySelectorAll('.steps li')];
    const cards = [...stage.querySelectorAll('.tpl-card')];
    const track = $('.tpl-track');
    const tplName = $('[data-tpl-name]');
    const sheet = $('.sheet');
    const scroll = $('[data-scroll]');
    const fields = [...stage.querySelectorAll('.f')];
    const dots = [...stage.querySelectorAll('.dot')];
    const bar = $('.bar');
    const stepEl = $('[data-step]');
    const countEl = $('[data-count]');
    const fillEl = $('[data-fill]');
    const reviewScroll = $('[data-review-scroll]');
    const note = $('[data-note]');
    const notePh = $('[data-note-ph]');
    const labels = fields.map((f) => f.textContent);
    const sectionOf = ['Employment details', 'Employment details', 'Employment details', 'Compensation', 'Employment details', 'Employment details'];
    const startPos = cards.map((c) => +c.dataset.pos);

    let visible = true;
    new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(stage);
    // Waits, and holds while the stage is off screen so nobody misses a step.
    const pause = async (ms) => {
      await wait(ms);
      while (!visible) await wait(250);
    };
    const press = async (el) => {
      el.classList.add('pressed');
      await wait(180);
      el.classList.remove('pressed');
    };

    /** Which step is current: the header inside the stage and the strip under the hero follow. */
    const setStep = (current) => {
      appSteps.forEach((li, i) => {
        li.classList.toggle('done', i < current);
        li.classList.toggle('current', i === current);
      });
      strip.forEach((li, i) => li.classList.toggle('lit', i <= Math.min(current, 3)));
    };
    const setScene = (name) => (stage.dataset.at = name);

    // Set-up scene: dots beside each field, the bar, and keeping the field being typed in view.
    const placeDots = () => {
      const top = sheet.getBoundingClientRect().top;
      fields.forEach((f, i) => {
        const r = f.getBoundingClientRect();
        dots[i].style.top = `${r.top - top + r.height / 2 - 5}px`;
      });
    };
    const update = () => {
      const filled = fields.filter((f) => f.classList.contains('filled')).length;
      const first = fields.findIndex((f) => !f.classList.contains('filled'));
      stepEl.textContent = first === -1 ? 'Ready to review' : sectionOf[first];
      countEl.textContent = first === -1 ? 'Everything’s filled in' : `${filled} of ${fields.length} filled`;
      fillEl.style.width = `${(filled / fields.length) * 100}%`;
      bar.classList.toggle('ready', first === -1);
      dots.forEach((d, i) => d.classList.toggle('on', fields[i].classList.contains('filled')));
      placeDots();
    };
    const follow = (field) => {
      const view = scroll.parentElement.clientHeight;
      const fieldTop = field.offsetTop + sheet.offsetTop;
      const offset = Math.max(0, fieldTop - view * 0.4);
      scroll.style.transform = `translateY(${-offset}px)`;
    };

    const reset = () => {
      track.classList.add('no-anim');
      cards.forEach((c, i) => (c.dataset.pos = startPos[i]));
      tplName.textContent = 'Concise Full-time';
      void track.offsetWidth;
      track.classList.remove('no-anim');
      fields.forEach((f, i) => {
        f.classList.remove('filled', 'typing');
        f.textContent = labels[i];
      });
      scroll.style.transform = '';
      reviewScroll.style.transition = 'none';
      reviewScroll.style.transform = '';
      void reviewScroll.offsetWidth;
      reviewScroll.style.transition = '';
      note.textContent = '';
      notePh.hidden = false;
      $('[data-modal-title]').textContent = 'Sending to Priya';
      $('[data-modal-sending]').hidden = false;
      $('[data-modal-sent]').hidden = true;
      $('[data-modal-btn]').hidden = true;
      update();
    };

    const showFinished = () => {
      // Reduced motion: one still frame, the letter filled in and ready to review.
      fields.forEach((f) => {
        f.textContent = f.dataset.v;
        f.classList.add('filled');
      });
      setScene('setup');
      setStep(1);
      strip.forEach((li) => li.classList.add('lit'));
      update();
    };

    const play = async () => {
      for (;;) {
        reset();

        // 1. Pick template: flip from Concise to Standard, then Continue.
        setScene('template');
        setStep(0);
        await pause(1500);
        cards.forEach((c) => (c.dataset.pos = +c.dataset.pos - 1));
        await pause(500);
        tplName.textContent = 'Standard Full-time';
        await pause(1100);
        await press($('[data-continue]'));
        await pause(250);

        // 2. Set up letter: the blue shrinks into the header; type into each field in turn.
        setScene('setup');
        setStep(1);
        await pause(900);
        placeDots();
        for (const f of fields) {
          follow(f);
          f.classList.add('typing');
          f.textContent = '';
          placeDots();
          await pause(260);
          for (const ch of f.dataset.v) {
            f.textContent += ch;
            placeDots();
            await wait(45 + Math.random() * 40);
          }
          await pause(240);
          f.classList.remove('typing');
          f.classList.add('filled');
          update();
          await pause(320);
        }
        await pause(1400);
        await press($('[data-review]'));
        await pause(200);

        // 3. Review letter: the blue fills the stage; read down the letter, add a note.
        setScene('review');
        setStep(2);
        await pause(1500);
        const view = reviewScroll.parentElement.clientHeight;
        const travel = Math.max(0, reviewScroll.scrollHeight + 24 - view + 16);
        reviewScroll.style.transform = `translateY(${-travel}px)`;
        await pause(2900);
        notePh.hidden = true;
        for (const ch of 'So excited to have you on the team, Priya!') {
          note.textContent += ch;
          await wait(40 + Math.random() * 30);
        }
        await pause(700);
        await press($('[data-send]'));

        // 4. Send: the modal shows progress, then the timeline closes.
        setScene('send');
        setStep(3);
        await pause(1900);
        $('[data-modal-title]').textContent = 'Offer letter sent to Priya';
        $('[data-modal-sending]').hidden = true;
        $('[data-modal-sent]').hidden = false;
        $('[data-modal-btn]').hidden = false;
        setStep(4);
        await pause(3400);
      }
    };

    if (reduce) showFinished();
    else play();
    window.addEventListener('resize', placeDots);
    document.fonts?.ready.then(placeDots);
  }

  /* ---------- Feature tabs (auto-advance, like the site's feature list) ---------- */
  const feature = document.querySelector('.feature');
  if (feature) {
    const tabs = [...feature.querySelectorAll('[role="tab"]')];
    const panels = [...feature.querySelectorAll('[data-panel]')];
    const DURATION = 6000;
    feature.style.setProperty('--feature-ms', `${DURATION}ms`);
    let current = 0;
    let timer;
    const select = (i, focus = false) => {
      current = i;
      tabs.forEach((t, j) => {
        t.setAttribute('aria-selected', String(j === i));
        t.tabIndex = j === i ? 0 : -1;
        // Restart the progress line.
        const p = t.querySelector('.feature-progress');
        p.style.animation = 'none';
        void p.offsetWidth;
        p.style.animation = '';
      });
      panels.forEach((p, j) => p.classList.toggle('is-on', j === i));
      if (focus) tabs[i].focus();
      schedule();
    };
    const schedule = () => {
      clearTimeout(timer);
      if (!reduce && !feature.classList.contains('paused')) timer = setTimeout(() => select((current + 1) % tabs.length), DURATION);
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i));
      t.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); select((i + 1) % tabs.length, true); }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); select((i - 1 + tabs.length) % tabs.length, true); }
      });
    });
    // Pause while the pointer or focus is on it, so it doesn't move under someone reading.
    const pause = () => { feature.classList.add('paused'); clearTimeout(timer); };
    const resume = () => { feature.classList.remove('paused'); schedule(); };
    feature.addEventListener('mouseenter', pause);
    feature.addEventListener('mouseleave', resume);
    feature.addEventListener('focusin', pause);
    feature.addEventListener('focusout', (e) => { if (!feature.contains(e.relatedTarget)) resume(); });
    select(0);
  }

  /* ---------- Nav: white on the blue hero, paper once past it ---------- */
  const nav = document.querySelector('[data-nav]');
  const hero = document.querySelector('.hero');
  if (nav && hero) {
    const onScroll = () => {
      nav.classList.toggle('on-hero', hero.getBoundingClientRect().bottom > nav.offsetHeight);
      nav.classList.toggle('nav-solid', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Callouts drift with the pointer ---------- */
  const chips = [...document.querySelectorAll('.chip[data-depth]')];
  if (hero && chips.length && !reduce && window.matchMedia('(pointer: fine)').matches) {
    hero.addEventListener('pointermove', (e) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      chips.forEach((chip) => {
        const d = +chip.dataset.depth;
        chip.style.setProperty('--px', `${(-x * d).toFixed(1)}px`);
        chip.style.setProperty('--py', `${(-y * d).toFixed(1)}px`);
      });
    });
  }

  /* ---------- Key hints ---------- */
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === 'f') document.getElementById('journey')?.scrollIntoView();
    if (k === 't') document.getElementById('cta')?.scrollIntoView();
  });

  /* ---------- Reveal on scroll ---------- */
  if (!reduce && 'IntersectionObserver' in window) {
    const els = document.querySelectorAll('.section .section-title, .section .section-sub, .card, .feature, .compare-row, .steps li');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach((el) => { el.classList.add('reveal'); io.observe(el); });
  }
})();
