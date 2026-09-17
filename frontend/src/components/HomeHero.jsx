import { useEffect, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import '../styles/home-hero.css';

// Temporary stand-in clip (rotating dot-matrix globe) so the crossfade loop
// has something real to play against - swap for actual Rent It footage
// (equipment handoffs, tool close-ups, whatever fits) whenever it's ready.
const VIDEO_SRC = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260912_104036_bd6924f6-3c8e-417e-8465-6d03c8c2e9e6.mp4';
const POSTER_SRC = 'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/82e7eb75-c65f-490a-99b5-f3d1cad54200.webp';

function Arrow() {
  return (
    <svg className="rh-arw" viewBox="0 0 12 10" fill="none" aria-hidden="true">
      <path d="M0.8 5h10M7.1 1.4 10.9 5l-3.8 3.6" stroke="currentColor"
        strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Drives the shared html.rh-anim / .rh-go entrance state. Navbar's `isHome`
// variant reads the same two classes on document.documentElement, so a
// single mount effect here also animates the logo/nav-links/action pills
// that live in that separate component - mirroring how the source spec's
// one inline script animated both its <header> and its hero content.
function useEntrance() {
  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const root = document.documentElement;
    let bootTimer = null;
    let safetyTimer = null;
    let started = false;

    function onEnd(e) {
      if (e.animationName === 'rh-pillIn' && e.target.classList.contains('rh-btn-ghost')) {
        clean();
      }
    }

    function clean() {
      if (safetyTimer) clearTimeout(safetyTimer);
      root.removeEventListener('animationend', onEnd, true);
      root.classList.remove('rh-anim', 'rh-go');
    }

    function start() {
      if (started) return;
      started = true;
      if (bootTimer) clearTimeout(bootTimer);
      root.addEventListener('animationend', onEnd, true);
      safetyTimer = setTimeout(clean, 2600);
      // rAF so the browser paints the hidden `rh-anim` resting state on at
      // least one frame before `rh-go` starts the animations off it.
      requestAnimationFrame(() => root.classList.add('rh-go'));
    }

    root.classList.add('rh-anim');
    bootTimer = setTimeout(start, 900);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(start, start);
    } else {
      start();
    }

    return clean;
  }, []);
}

// Two <video> elements pointed at the same source, cross-faded just before
// the loop point so the source clip's non-matching first/last frame never
// shows as a visible seam. See HomeHero build notes.
function useVideoCrossfade(videoARef, videoBRef) {
  useEffect(() => {
    const A = videoARef.current;
    const B = videoBRef.current;
    if (!A || !B) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      A.removeAttribute('autoplay');
      A.pause();
      B.pause();
      try { A.currentTime = 0; } catch { /* autoplay may have already advanced a frame */ }
      return;
    }

    const FADE = 0.9;
    let cur = A;
    let nxt = B;
    let swapping = false;

    function play(v) {
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    }
    play(A);

    function tick() {
      if (swapping || !cur.duration) return;
      if (cur.duration - cur.currentTime > FADE) return;

      swapping = true;
      const out = cur;
      nxt.currentTime = 0;
      play(nxt);
      nxt.classList.add('is-active');
      out.classList.remove('is-active');
      const tmp = cur; cur = nxt; nxt = tmp;

      setTimeout(() => {
        out.pause();
        out.currentTime = 0;
        swapping = false;
      }, FADE * 1000 + 100);
    }

    A.addEventListener('timeupdate', tick);
    B.addEventListener('timeupdate', tick);
    return () => {
      A.removeEventListener('timeupdate', tick);
      B.removeEventListener('timeupdate', tick);
    };
  }, [videoARef, videoBRef]);
}

export default function HomeHero() {
  const videoARef = useRef(null);
  const videoBRef = useRef(null);

  useEntrance();
  useVideoCrossfade(videoARef, videoBRef);

  return (
    <section className="rh-hero">
      <div
        className="rh-bg"
        role="img"
        aria-label="Placeholder background: a stylised globe of Earth rendered as a purple dot matrix against a starfield, slowly rotating - swap for real Rent It footage"
      >
        <video
          ref={videoARef}
          className="rh-bg-video is-active"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-hidden="true"
          poster={POSTER_SRC}
        >
          <source src={VIDEO_SRC} type="video/mp4" />
        </video>
        <video
          ref={videoBRef}
          className="rh-bg-video"
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-hidden="true"
          poster={POSTER_SRC}
        >
          <source src={VIDEO_SRC} type="video/mp4" />
        </video>
      </div>

      <div className="rh-fade" aria-hidden="true"></div>

      <div className="rh-hero-inner">
        <h1>
          <span className="rh-ln"><span className="rh-ln-i">Rent the right tool.</span></span>
          <span className="rh-ln"><span className="rh-ln-i">right when you need it.</span></span>
        </h1>
        <p className="rh-sub">
          Rent It connects neighbors who own equipment with people who need it — for a day, a
          weekend, or a whole project. No buying, no clutter, no problem.
        </p>
        <div className="rh-ctas">
          <Link to="/marketplace" className="rh-btn rh-btn-lg rh-btn-primary">
            Browse the Marketplace
            <Arrow />
          </Link>
          <Link to="/list-item" className="rh-btn rh-btn-lg rh-btn-ghost">
            List Your Equipment
            <Arrow />
          </Link>
        </div>
      </div>
    </section>
  );
}
