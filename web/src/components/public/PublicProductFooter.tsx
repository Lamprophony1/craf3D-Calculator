import { PORTACELULAR_PRODUCT } from '../../config/portacelularProduct';
import { InstagramIcon } from './InstagramIcon';

export function PublicProductFooter() {
  const product = PORTACELULAR_PRODUCT;

  return (
    <footer className="public-product-footer">
      <div className="public-product-container public-product-footer__inner">
        <div>
          <strong>{product.brandName}</strong>
          <span>{product.brandSubtitle}</span>
        </div>
        <a href={product.instagramUrl} target="_blank" rel="noopener noreferrer">
          <InstagramIcon size={19} />
          {product.instagramHandle}
        </a>
      </div>
    </footer>
  );
}
