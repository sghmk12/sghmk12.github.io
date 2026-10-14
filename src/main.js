import '@fontsource/cormorant-garamond/500.css';
import './style.css';
import { initFluid } from './fluid.js';

document.documentElement.classList.add('js');

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* Mark the current page in the nav ------------------------------------ */
const page = $('.site-header')?.dataset.page;
$$(`[data-nav="${page}"]`).forEach((a) => a.setAttribute('aria-current', 'page'));

/* Header: hide on scroll down, reappear (with a solid bar) on scroll up -- */
{
  const header = $('.site-header');
  let lastY = window.scrollY;
  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    const goingDown = y > lastY;
    const pastHero = y > header.offsetHeight;
    header.classList.toggle('is-hidden', goingDown && pastHero && !document.body.classList.contains('menu-open'));
    header.classList.toggle('is-solid', !goingDown && pastHero);
    if (y <= 0) header.classList.remove('is-solid');
    lastY = y;
    ticking = false;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    },
    { passive: true },
  );
}

/* Mobile menu ------------------------------------------------------- */
{
  const btn = $('.menu-toggle');
  const menu = $('#mobile-menu');
  const setOpen = (open) => {
    btn.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    document.body.classList.toggle('menu-open', open);
  };
  btn.addEventListener('click', () => setOpen(btn.getAttribute('aria-expanded') !== 'true'));
  // Same-page links (e.g. #interests) don't navigate, so close the menu ourselves.
  menu.addEventListener('click', (e) => e.target.closest('a') && setOpen(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      btn.focus();
    }
  });
  window.matchMedia('(min-width: 768px)').addEventListener('change', (e) => e.matches && setOpen(false));
}

/* Scroll reveal ----------------------------------------------------- */
{
  const items = $$('.reveal');
  // Stagger siblings that enter together (e.g. hero words, list items).
  $$('.hero .reveal').forEach((el, i) => el.style.setProperty('--delay', `${0.1 + i * 0.12}s`));
  $$('.interest-grid .reveal').forEach((el) => {
    const i = [...el.parentElement.children].indexOf(el);
    el.style.setProperty('--delay', `${i * 0.08}s`);
  });
  // The mosaic staggers along each row so a full row ripples in left to right.
  $$('.life-grid .reveal').forEach((el) => {
    const i = [...el.parentElement.children].indexOf(el);
    el.style.setProperty('--delay', `${(i % 6) * 0.05}s`);
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    items.forEach((el) => io.observe(el));
  } else {
    items.forEach((el) => el.classList.add('is-in'));
  }
}

/* Marquee: fill the track with enough copies to loop seamlessly ------- */
{
  const track = $('.marquee__track');
  if (track) {
    const item = () => {
      const span = document.createElement('span');
      span.className = 'marquee__item';
      span.innerHTML = 'Get in touch <span class="marquee__star">✺</span>';
      return span;
    };
    // Two identical halves; the CSS animation shifts by -50% for a perfect loop.
    const half = Math.max(3, Math.ceil(window.innerWidth / 380));
    for (let i = 0; i < half * 2; i++) track.append(item());
  }
}

/* Contact form ------------------------------------------------------ */
{
  const form = $('.contact-form');
  if (form) {
    const status = $('.form-status', form);
    const say = (msg, isError = false) => {
      status.textContent = msg;
      status.classList.toggle('is-error', isError);
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let firstInvalid = null;
      $$('input, textarea', form).forEach((field) => {
        const ok = field.checkValidity() && field.value.trim() !== '';
        field.setAttribute('aria-invalid', String(!ok));
        if (!ok && !firstInvalid) firstInvalid = field;
      });
      if (firstInvalid) {
        say('Please fill in all required fields.', true);
        firstInvalid.focus();
        return;
      }

      const data = Object.fromEntries(new FormData(form));
      const endpoint = form.dataset.endpoint;

      if (!endpoint) {
        const subject = encodeURIComponent(`Hello from ${data.firstName} ${data.lastName}`);
        const body = encodeURIComponent(`${data.message}\n\n— ${data.firstName} ${data.lastName} (${data.email})`);
        window.location.href = `mailto:${form.dataset.mailto}?subject=${subject}&body=${body}`;
        say('Opening your email app…');
        return;
      }

      const btn = $('button[type="submit"]', form);
      btn.disabled = true;
      say('Sending…');
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(res.statusText);
        form.reset();
        say('Thank you! I’ll be in touch soon.');
      } catch {
        say('Something went wrong. Please try again or email me directly.', true);
      } finally {
        btn.disabled = false;
      }
    });

    form.addEventListener('input', (e) => e.target.removeAttribute('aria-invalid'));
  }
}

/* Lightbox: click a photo to see it whole ---------------------------- */
{
  // Each photo is wrapped in <a class="zoom" href="…-full.webp" data-avif="…-full.avif">,
  // so without JS the link simply opens the uncropped image.
  const links = $$('a.zoom');
  if (links.length) {
    const dialog = document.createElement('dialog');
    dialog.className = 'lightbox';
    dialog.innerHTML =
      '<button class="lightbox__close" type="button" aria-label="Close">×</button>' +
      '<picture><source type="image/avif" /><img alt="" decoding="async" /></picture>';
    document.body.append(dialog);
    const source = $('source', dialog);
    const photo = $('img', dialog);

    links.forEach((link) =>
      link.addEventListener('click', (e) => {
        e.preventDefault();
        // AVIF candidate first, so the browser chooses between the two once.
        source.srcset = link.dataset.avif;
        photo.src = link.href;
        photo.alt = $('img', link).alt;
        dialog.setAttribute('aria-label', photo.alt);
        dialog.showModal();
      }),
    );
    photo.addEventListener('load', () => photo.classList.add('is-loaded'));
    // Anywhere but the photo itself (the dimmed backdrop, the margins, the
    // close button) dismisses it; Esc works too, built into <dialog>.
    dialog.addEventListener('click', (e) => {
      if (e.target !== photo) dialog.close();
    });
    // Clear the photo so the next one never flashes the previous image.
    dialog.addEventListener('close', () => {
      photo.classList.remove('is-loaded');
      photo.removeAttribute('src');
      source.removeAttribute('srcset');
    });
  }
}

/* Background -------------------------------------------------------- */
initFluid($('.fluid-bg'));
