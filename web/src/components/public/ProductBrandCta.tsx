import { Layers3, MessageCircle, Palette, Sparkles } from 'lucide-react';
import { PORTACELULAR_PRODUCT } from '../../config/portacelularProduct';
import { InstagramIcon } from './InstagramIcon';

const attributeIcons = [Palette, Layers3, Sparkles] as const;

export function ProductAttributesSection() {
  const { productStory } = PORTACELULAR_PRODUCT;

  return (
    <section className="public-product-story" id="marca-craf3d" aria-labelledby="product-story-title" tabIndex={-1}>
      <div className="public-product-container public-product-story__inner">
        <div className="public-product-story__heading">
          <p className="public-product-eyebrow">UNA PIEZA CON TU IDEA</p>
          <h2 id="product-story-title">{productStory.title}</h2>
        </div>

        <div className="public-product-attributes">
          {productStory.attributes.map((attribute, index) => {
            const Icon = attributeIcons[index];
            return (
              <article className="public-product-attribute" key={attribute.title}>
                <span className="public-product-attribute__index" aria-hidden="true">0{index + 1}</span>
                <Icon aria-hidden="true" size={30} strokeWidth={1.8} />
                <h3>{attribute.title}</h3>
                <p>{attribute.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function ProductBrandCta() {
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
            <MessageCircle aria-hidden="true" size={21} />
            {product.finalCta.whatsappLabel}
          </a>
          <a
            className="public-product-button public-product-button--inverted"
            href={product.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <InstagramIcon size={21} />
            {product.finalCta.instagramLabel}
          </a>
        </div>
      </div>
    </section>
  );
}
