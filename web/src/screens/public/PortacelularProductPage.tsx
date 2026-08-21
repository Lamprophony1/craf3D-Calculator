import { useEffect } from 'react';
import { CompactBrandCta } from '../../components/public/CompactBrandCta';
import { CompactProductIntro } from '../../components/public/CompactProductIntro';
import { ProductGifSection } from '../../components/public/ProductGifSection';
import { PublicBrandHeader } from '../../components/public/PublicBrandHeader';
import { PublicProductFooter } from '../../components/public/PublicProductFooter';
import { PORTACELULAR_PRODUCT } from '../../config/portacelularProduct';

function ensureMetaDescription() {
  const existing = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (existing) return existing;

  const element = document.createElement('meta');
  element.name = 'description';
  document.head.append(element);
  return element;
}

function ensureThemeColor() {
  const existing = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (existing) return existing;

  const element = document.createElement('meta');
  element.name = 'theme-color';
  document.head.append(element);
  return element;
}

export function PortacelularProductPage() {
  useEffect(() => {
    const description = ensureMetaDescription();
    const themeColor = ensureThemeColor();
    const previous = {
      title: document.title,
      description: description.content,
      themeColor: themeColor.content
    };

    document.title = PORTACELULAR_PRODUCT.metadata.title;
    description.content = PORTACELULAR_PRODUCT.metadata.description;
    themeColor.content = PORTACELULAR_PRODUCT.metadata.themeColor;

    return () => {
      document.title = previous.title;
      description.content = previous.description;
      themeColor.content = previous.themeColor;
    };
  }, []);

  return (
    <div className="public-product-page">
      <a className="public-product-skip-link" href="#main-content">Saltar al contenido principal</a>
      <PublicBrandHeader />
      <main id="main-content" tabIndex={-1}>
        <CompactProductIntro />
        {PORTACELULAR_PRODUCT.modes.map(mode => <ProductGifSection mode={mode} key={mode.id} />)}
        <CompactBrandCta />
      </main>
      <PublicProductFooter />
    </div>
  );
}
