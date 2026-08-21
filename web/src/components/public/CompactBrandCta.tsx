import { MessageCircle } from 'lucide-react';
import { PORTACELULAR_PRODUCT } from '../../config/portacelularProduct';
import { InstagramIcon } from './InstagramIcon';

export function CompactBrandCta() {
  const product = PORTACELULAR_PRODUCT;

  return (
    <section className="public-product-final-cta" aria-labelledby="product-final-cta-title">
      <div className="public-product-container public-product-final-cta__inner">
        <div className="public-product-final-cta__copy">
          <p className="public-product-eyebrow">{product.finalCta.eyebrow}</p>
          <h2 id="product-final-cta-title">{product.finalCta.title}</h2>
          <p>{product.finalCta.description}</p>
          <span className="public-product-final-cta__handle">{product.instagramHandle}</span>
        </div>

        <div className="public-product-final-cta__actions" aria-label="Contactar a CRAF 3D">
          <a
            className="public-product-button public-product-button--primary"
            href={product.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle aria-hidden="true" size={20} />
            {product.finalCta.whatsappLabel}
          </a>
          <a
            className="public-product-button public-product-button--secondary"
            href={product.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <InstagramIcon size={20} />
            {product.finalCta.instagramLabel}
          </a>
        </div>
      </div>
    </section>
  );
}
