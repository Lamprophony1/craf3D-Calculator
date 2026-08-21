import { useEffect, useState } from 'react';
import { ImageOff, Pause, Play } from 'lucide-react';
import type { PortacelularMode } from '../../config/portacelularProduct';

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function ProductGif({ mode }: { mode: PortacelularMode }) {
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(prefersReducedMotion);
  const { media } = mode;

  useEffect(() => {
    if (!window.matchMedia) return;

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handlePreference = (event: MediaQueryListEvent) => {
      if (event.matches) setPaused(true);
    };

    query.addEventListener?.('change', handlePreference);
    return () => query.removeEventListener?.('change', handlePreference);
  }, []);

  if (failed) {
    return (
      <div className="public-product-gif-fallback" role="status">
        <ImageOff aria-hidden="true" size={24} />
        <p>No pudimos cargar la animación. Seguí los pasos en texto.</p>
      </div>
    );
  }

  return (
    <>
      <div className={`public-product-gif-frame public-product-gif-frame--${media.fit}`}>
        <img
          src={paused ? media.staticSrc : media.src}
          alt={media.alt}
          width={media.width}
          height={media.height}
          loading={media.loading}
          decoding="async"
          fetchPriority={media.fetchPriority}
          onError={() => setFailed(true)}
        />
      </div>
      <div className="public-product-gif-caption">
        <p>{mode.quickSteps}</p>
        <button
          className="public-product-motion-toggle"
          type="button"
          aria-pressed={paused}
          aria-label={`${paused ? 'Reproducir' : 'Pausar'} animación: ${mode.title}`}
          onClick={() => setPaused(value => !value)}
        >
          {paused ? <Play aria-hidden="true" size={17} /> : <Pause aria-hidden="true" size={17} />}
          {paused ? 'Reproducir' : 'Pausar'}
        </button>
      </div>
    </>
  );
}

export function ProductGifSection({ mode }: { mode: PortacelularMode }) {
  return (
    <section
      className={`public-product-gif-section public-product-gif-section--${mode.id}`}
      id={mode.id}
      aria-labelledby={`${mode.id}-title`}
    >
      <div className="public-product-container public-product-gif-section__inner">
        <div className="public-product-gif-section__copy">
          <p className="public-product-eyebrow">{mode.eyebrow}</p>
          <h2 id={`${mode.id}-title`}>{mode.title}</h2>
          <p className="public-product-gif-section__lead">{mode.description}</p>
        </div>

        <div className="public-product-gif-section__media">
          <ProductGif mode={mode} />
          <details className="public-product-text-instructions">
            <summary>Ver pasos en texto</summary>
            <ol>
              {mode.steps.map(step => <li key={step}>{step}</li>)}
            </ol>
          </details>
        </div>
      </div>
    </section>
  );
}
