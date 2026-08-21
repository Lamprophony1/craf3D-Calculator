import { useEffect, useRef, useState } from 'react';
import { Film, RotateCw, Smartphone, WifiOff } from 'lucide-react';
import type { PortacelularMode } from '../../config/portacelularProduct';

function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}

function ProductVideo({ mode }: { mode: PortacelularMode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const online = useOnlineStatus();
  const [shouldLoad, setShouldLoad] = useState(false);
  const [failed, setFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const hasVideo = Boolean(mode.video.src);

  useEffect(() => {
    setFailed(false);
    setShouldLoad(false);
    if (!mode.video.src || !online) return;

    if (!('IntersectionObserver' in window)) {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setShouldLoad(true);
        observer.disconnect();
      }
    }, { rootMargin: '320px 0px' });

    if (frameRef.current) observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, [mode.video.src, online]);

  useEffect(() => setPosterFailed(false), [mode.video.poster]);

  const showVideo = hasVideo && online && !failed;
  const placeholderMessage = hasVideo && !online
    ? 'Conectate a internet para reproducir el video'
    : failed
      ? 'No pudimos reproducir el video. Las instrucciones siguen disponibles debajo.'
      : mode.placeholder;

  return (
    <div className="public-product-video-frame" ref={frameRef}>
      {showVideo ? (
        <video
          aria-label={`Video: ${mode.title}`}
          controls
          playsInline
          preload="metadata"
          poster={mode.video.poster ?? undefined}
          src={shouldLoad ? mode.video.src ?? undefined : undefined}
          onError={() => setFailed(true)}
        >
          {mode.video.captions ? (
            <track default kind="captions" src={mode.video.captions} srcLang="es" label="Español" />
          ) : null}
          Tu navegador no puede reproducir este video. Usá las instrucciones en texto que aparecen debajo.
        </video>
      ) : (
        <div className="public-product-video-placeholder" role="img" aria-label={placeholderMessage}>
          {mode.video.poster && !posterFailed ? (
            <img src={mode.video.poster} alt="" width="864" height="1080" loading="lazy" onError={() => setPosterFailed(true)} />
          ) : (
            <div className="public-product-video-placeholder__graphic" aria-hidden="true">
              {hasVideo && !online ? <WifiOff size={44} /> : mode.number === '01' ? <Smartphone size={48} /> : <RotateCw size={48} />}
              <Film size={28} />
            </div>
          )}
          <p>{placeholderMessage}</p>
          <span>{mode.number} · CRAF 3D</span>
        </div>
      )}
    </div>
  );
}

export function ProductVideoSection({ mode }: { mode: PortacelularMode }) {
  return (
    <section className={`public-product-video-section public-product-video-section--${mode.number}`} id={mode.id} aria-labelledby={`${mode.id}-title`} tabIndex={-1}>
      <div className="public-product-container public-product-video-section__inner">
        <div className="public-product-video-section__copy">
          <div className="public-product-scene-marker" aria-hidden="true">
            <span>{mode.number}</span>
            <i />
            <i />
            <i />
          </div>
          <p className="public-product-eyebrow">{mode.eyebrow}</p>
          <h2 id={`${mode.id}-title`}>{mode.title}</h2>
          <p className="public-product-video-section__lead">{mode.description}</p>
        </div>

        <div className="public-product-video-section__media">
          <ProductVideo mode={mode} />
          <div className="public-product-text-instructions" aria-labelledby={`${mode.id}-instructions-title`}>
            <h3 id={`${mode.id}-instructions-title`}>Ver instrucciones en texto</h3>
            <ol>
              {mode.steps.map(step => <li key={step}>{step}</li>)}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
