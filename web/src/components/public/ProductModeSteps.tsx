import { ArrowDownRight } from 'lucide-react';
import { PORTACELULAR_PRODUCT } from '../../config/portacelularProduct';

export function ProductModeSteps() {
  return (
    <nav className="public-product-modes" aria-label="Accesos rápidos a los dos modos">
      <div className="public-product-container public-product-modes__inner">
        {PORTACELULAR_PRODUCT.modes.map(mode => (
          <a className="public-product-mode-link" href={`#${mode.id}`} key={mode.id}>
            <span className="public-product-mode-link__number" aria-hidden="true">{mode.number}</span>
            <span className="public-product-mode-link__copy">
              <strong>{mode.summaryTitle}</strong>
              <span>{mode.summary}</span>
            </span>
            <ArrowDownRight aria-hidden="true" size={24} />
          </a>
        ))}
      </div>
    </nav>
  );
}

