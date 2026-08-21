export type ProductGifMedia = {
  kind: 'gif';
  src: string;
  staticSrc: string;
  alt: string;
  width: 600;
  height: 800;
  loading: 'eager' | 'lazy';
  fetchPriority?: 'high';
  fit: 'cover' | 'contain';
};

export type PortacelularMode = {
  id: 'modo-portacelular' | 'modo-antistress';
  eyebrow: string;
  title: string;
  description: string;
  quickSteps: string;
  steps: readonly string[];
  media: ProductGifMedia;
};

export const PORTACELULAR_PRODUCT = {
  path: '/portacelular',

  metadata: {
    title: 'Portacelular 2 en 1 | CRAF 3D',
    description: 'Aprendé a montar el portacelular personalizado de CRAF 3D y descubrí su ruedita antiestrés.',
    themeColor: '#9f3500'
  },

  brandName: 'CRAF 3D',
  brandSubtitle: 'Impresión 3D a medida',
  logoSrc: '/branding/logo-master.jpg',

  instagramHandle: '@craf.3d',
  instagramUrl: 'https://www.instagram.com/craf.3d/',

  whatsappNumber: '595973427508',
  whatsappUrl:
    'https://wa.me/595973427508?text=Hola%20CRAF%203D%2C%20vi%20el%20portacelular%20y%20quiero%20consultar%20por%20un%20producto%20personalizado.',

  intro: {
    eyebrow: 'PORTACELULAR 2 EN 1',
    title: 'Tu llavero tiene dos modos',
    description: 'Mirá cómo usarlo en segundos.'
  },

  modes: [
    {
      id: 'modo-portacelular',
      eyebrow: '01 · PORTACELULAR',
      title: 'Abrilo y apoyá tu celular',
      description: 'Desplegá el soporte, acomodá el ángulo y apoyá el teléfono.',
      quickSteps: 'Abrí · acomodá · apoyá',
      steps: [
        'Desplegá el soporte.',
        'Acomodá el ángulo.',
        'Apoyá el teléfono.'
      ],
      media: {
        kind: 'gif',
        src: '/media/portacelular/montaje-portacelular.gif',
        staticSrc: '/media/portacelular/montaje-portacelular-static.jpg',
        alt: 'Secuencia que muestra cómo abrir el llavero y usarlo como portacelular',
        width: 600,
        height: 800,
        loading: 'eager',
        fetchPriority: 'high',
        fit: 'cover'
      }
    },
    {
      id: 'modo-antistress',
      eyebrow: '02 · ANTIESTRÉS',
      title: 'Girá la ruedita con el pulgar',
      description: 'Un movimiento simple para mantener las manos ocupadas.',
      quickSteps: 'Sostené · girá · repetí',
      steps: [
        'Sostené la pieza con comodidad.',
        'Apoyá el pulgar sobre la ruedita.',
        'Girá suavemente y repetí el movimiento.'
      ],
      media: {
        kind: 'gif',
        src: '/media/portacelular/rueda-antistres.gif',
        staticSrc: '/media/portacelular/rueda-antistres-static.jpg',
        alt: 'Secuencia que muestra el movimiento de la ruedita antiestrés',
        width: 600,
        height: 800,
        loading: 'lazy',
        fit: 'contain'
      }
    }
  ] satisfies readonly PortacelularMode[],

  finalCta: {
    eyebrow: 'HECHO POR CRAF 3D',
    title: '¿Te gustó? Lo personalizamos para vos.',
    description: 'Elegí nombre, colores o temática y creamos una pieza a medida.',
    whatsappLabel: 'Quiero uno personalizado',
    instagramLabel: 'Ver más trabajos'
  }
} as const;
