import { PORTACELULAR_PRODUCT } from '../../config/portacelularProduct';
import { InstagramIcon } from './InstagramIcon';

export function PublicBrandHeader() {
  const product = PORTACELULAR_PRODUCT;

  return (
    <header className="public-product-header">
      <div className="public-product-container public-product-header__inner">
        <div className="public-product-brand-lockup">
          <img
            className="public-product-brand-lockup__logo"
            src={product.logoSrc}
            alt="Logo de CRAF 3D"
            width="1080"
            height="1080"
            decoding="async"
          />
          <span className="public-product-brand-lockup__copy">
            <strong>{product.brandName}</strong>
            <span>{product.brandSubtitle}</span>
          </span>
        </div>

        <nav aria-label="Red social de CRAF 3D">
          <a
            className="public-product-social-link"
            href={product.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir Instagram ${product.instagramHandle}`}
          >
            <InstagramIcon size={20} />
            <span>{product.instagramHandle}</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
