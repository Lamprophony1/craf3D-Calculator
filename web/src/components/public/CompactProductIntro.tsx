import { PORTACELULAR_PRODUCT } from '../../config/portacelularProduct';

export function CompactProductIntro() {
  const { intro } = PORTACELULAR_PRODUCT;

  return (
    <section className="public-product-intro" aria-labelledby="portacelular-title">
      <div className="public-product-container public-product-intro__inner">
        <p className="public-product-eyebrow">{intro.eyebrow}</p>
        <h1 id="portacelular-title">{intro.title}</h1>
        <p className="public-product-intro__lead">{intro.description}</p>
      </div>
    </section>
  );
}
