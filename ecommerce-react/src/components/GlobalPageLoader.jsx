import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { API_LOADING_EVENT, getPendingApiRequestCount } from '../api/client';

const PHASE_VISIBLE_MS = 350;
const EXIT_FADE_MS = 140;

export default function GlobalPageLoader() {
  const location = useLocation();
  const [visible, setVisible] = useState(true);
  const [phase, setPhase] = useState('logo');
  const visibleRef = useRef(true);
  const visibleSinceRef = useRef(Date.now());
  const hideTimerRef = useRef(null);
  const routeTimerRef = useRef(null);
  const welcomeTimerRef = useRef(null);
  const exitTimerRef = useRef(null);
  const previousLocationKeyRef = useRef(location.key);

  function clearTimer(timerRef) {
    if (!timerRef.current) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function showWelcomeThenHide() {
    clearTimer(hideTimerRef);
    clearTimer(routeTimerRef);
    clearTimer(welcomeTimerRef);
    clearTimer(exitTimerRef);
    setPhase('welcome');

    welcomeTimerRef.current = window.setTimeout(() => {
      if (getPendingApiRequestCount() === 0) {
        setPhase('leaving');
        exitTimerRef.current = window.setTimeout(() => {
          visibleRef.current = false;
          setVisible(false);
        }, EXIT_FADE_MS);
      } else {
        setPhase('logo');
      }
    }, PHASE_VISIBLE_MS - EXIT_FADE_MS);
  }

  function showLogo(resetStartTime = false) {
    clearTimer(hideTimerRef);
    clearTimer(routeTimerRef);
    clearTimer(welcomeTimerRef);
    clearTimer(exitTimerRef);
    setPhase('logo');

    if (!visibleRef.current || resetStartTime) {
      visibleSinceRef.current = Date.now();
    }
    if (!visibleRef.current) {
      visibleRef.current = true;
      setVisible(true);
    }
  }

  useEffect(() => {
    function scheduleHide() {
      clearTimer(hideTimerRef);
      clearTimer(routeTimerRef);
      const elapsed = Date.now() - visibleSinceRef.current;
      const delay = Math.max(0, PHASE_VISIBLE_MS - elapsed);

      hideTimerRef.current = window.setTimeout(() => {
        if (getPendingApiRequestCount() === 0) {
          showWelcomeThenHide();
        }
      }, delay);
    }

    function updateLoader(event) {
      const pending = Number(event?.detail?.pending ?? getPendingApiRequestCount());
      if (pending > 0) showLogo();
      else scheduleHide();
    }

    window.addEventListener(API_LOADING_EVENT, updateLoader);
    updateLoader();

    return () => {
      clearTimer(hideTimerRef);
      clearTimer(routeTimerRef);
      clearTimer(welcomeTimerRef);
      clearTimer(exitTimerRef);
      window.removeEventListener(API_LOADING_EVENT, updateLoader);
    };
  }, []);

  useEffect(() => {
    if (previousLocationKeyRef.current === location.key) {
      return undefined;
    }
    previousLocationKeyRef.current = location.key;

    showLogo(true);

    routeTimerRef.current = window.setTimeout(() => {
      if (getPendingApiRequestCount() === 0) {
        showWelcomeThenHide();
      }
    }, PHASE_VISIBLE_MS);

    return () => {
      clearTimer(routeTimerRef);
    };
  }, [location.key]);

  if (!visible) return null;

  const isWelcomePhase = phase !== 'logo';

  return (
    <div
      className={`global-page-loader is-${phase}`}
      role="status"
      aria-live="polite"
      aria-label={isWelcomePhase ? 'Welcome to Messara Living' : 'Loading Messara Living'}
    >
      <div className="global-page-loader-stage">
        <div className="global-page-loader-frame" aria-hidden="true">
          <div className="global-page-loader-logo-panel">
            <img src="/messaraliving-logo.png" alt="" />
          </div>
        </div>
        <span className="global-page-loader-welcome">Welcome to Messara Living</span>
      </div>
    </div>
  );
}
