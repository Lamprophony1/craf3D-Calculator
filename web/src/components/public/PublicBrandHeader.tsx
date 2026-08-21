import { PORTACELULAR_PRODUCT } from '../../config/portacelularProduct';

export function PublicBrandHeader() {
  const product = PORTACELULAR_PRODUCT;

  return (
    <header className="public-product-header">
      <div className="public-product-container public-product-header__inner">
        <a className="public-product-brand-lockup" href="#main-content" aria-label="Ir al instructivo del portacelular">
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
        </a>
      </div>
    </header>
  );
}
