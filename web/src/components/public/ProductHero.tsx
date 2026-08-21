import { useState, type MouseEvent } from 'react';
import { ArrowDown, RotateCw, Smartphone } from 'lucide-react';
import { PORTACELULAR_PRODUCT } from '../../config/portacelularProduct';

function scrollToSection(event: MouseEvent<HTMLAnchorElement>, targetId: string) {
  const target = document.getElementById(targetId);
  if (!target) return;

  event.preventDefault();
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  window.history.replaceState(null, '', `#${targetId}`);
}

function ProductPlaceholderGraphic() {
  return (
    <figure className="public-product-hero-visual public-product-hero-visual--placeholder">
      <div className="public-product-hero-visual__frame-marks" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <svg
        className="public-product-hero-visual__illustration"
        viewBox="0 0 520 620"
        role="img"
        aria-labelledby="portacelular-placeholder-title portacelular-placeholder-description"
      >
        <title id="portacelular-placeholder-title">Representación gráfica del portacelular 2 en 1</title>
        <desc id="portacelular-placeholder-description">
          Un celular apoyado sobre una pieza plegable con una rueda lateral giratoria.
        </desc>
        <path className="product-graphic-keyring" d="M220 56c0-22 18-40 40-40s40 18 40 40-18 40-40 40-40-18-40-40Z" />
        <path className="product-graphic-strap" d="M244 92h32v70h-32z" />
        <rect className="product-graphic-phone" x="132" y="132" width="256" height="356" rx="24" />
        <rect className="product-graphic-screen" x="154" y="169" width="212" height="271" rx="8" />
        <path className="product-graphic-support" d="M88 470h254l94 108H182L88 470Z" />
        <path className="product-graphic-support-line" d="m177 488 75 90M342 470l-90 108" />
        <g className="product-graphic-wheel" transform="translate(395 458)">
          <circle r="68" />
          <circle r="22" />
          <path d="M0-52v22M0 30v22M-52 0h22M30 0h22M-37-37l16 16M21 21l16 16M37-37 21-21M-37 37l16-16" />
        </g>
      </svg>
      <figcaption className="public-product-hero-visual__caption">
        <span>Dos funciones, una sola pieza</span>
        <span className="public-product-hero-visual__modes" aria-label="Celular y movimiento giratorio">
          <Smartphone aria-hidden="true" size={22} />
          <span aria-hidden="true">+</span>
          <RotateCw aria-hidden="true" size={22} />
        </span>
      </figcaption>
    </figure>
  );
}

function ProductHeroVisual() {
  const { imageSrc, imageAlt } = PORTACELULAR_PRODUCT.hero;
  const [imageFailed, setImageFailed] = useState(false);
  if (!imageSrc || imageFailed) return <ProductPlaceholderGraphic />;

  return (
    <figure className="public-product-hero-visual">
      <img src={imageSrc} alt={imageAlt} width="960" height="1200" fetchPriority="high" onError={() => setImageFailed(true)} />
    </figure>
  );
}

export function ProductHero() {
  const { hero } = PORTACELULAR_PRODUCT;

  return (
    <section className="public-product-hero" aria-labelledby="portacelular-title">
      <div className="public-product-container public-product-hero__inner">
        <div className="public-product-hero__copy">
          <p className="public-product-eyebrow">{hero.eyebrow}</p>
          <h1 id="portacelular-title">{hero.title}</h1>
          <p className="public-product-hero__lead">{hero.description}</p>
          <div className="public-product-hero__actions" aria-label="Acciones principales">
            <a
              className="public-product-button public-product-button--primary"
              href="#modo-portacelular"
              onClick={event => scrollToSection(event, 'modo-portacelular')}
            >
              {hero.primaryCta}
              <ArrowDown aria-hidden="true" size={20} />
            </a>
            <a
              className="public-product-button public-product-button--inverted"
              href="#marca-craf3d"
              onClick={event => scrollToSection(event, 'marca-craf3d')}
            >
              {hero.secondaryCta}
            </a>
          </div>
        </div>

        <ProductHeroVisual />
      </div>
    </section>
  );
}
