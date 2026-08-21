export type PortacelularMode = {
  id: 'modo-portacelular' | 'modo-antistress';
  number: '01' | '02';
  eyebrow: string;
  summaryTitle: string;
  summary: string;
  title: string;
  description: string;
  placeholder: string;
  steps: readonly string[];
  video: {
    src: string | null;
    poster: string | null;
    captions: string | null;
  };
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

  hero: {
    eyebrow: 'PORTACELULAR 2 EN 1',
    title: 'De llavero a portacelular. Y todavía tiene un truco más.',
    description: 'Mirá cómo montarlo en segundos y descubrí su ruedita antiestrés.',
    primaryCta: 'Ver cómo funciona',
    secondaryCta: 'Conocer CRAF 3D',
    imageSrc: null as string | null,
    imageAlt: 'Portacelular tipo llavero 2 en 1 de CRAF 3D'
  },

  modes: [
    {
      id: 'modo-portacelular',
      number: '01',
      eyebrow: 'MODO PORTACELULAR',
      summaryTitle: 'Modo portacelular',
      summary: 'Abrilo y apoyá tu celular.',
      title: 'Montalo en segundos',
      description: 'Abrí el soporte, acomodá el ángulo y apoyá tu celular.',
      placeholder: 'Video de montaje en preparación',
      steps: [
        'Abrí el soporte.',
        'Acomodá la posición.',
        'Apoyá tu celular.'
      ],
      video: {
        src: null,
        poster: null,
        captions: null
      }
    },
    {
      id: 'modo-antistress',
      number: '02',
      eyebrow: 'MODO ANTIESTRÉS',
      summaryTitle: 'Modo antiestrés',
      summary: 'Giralo suavemente con el pulgar.',
      title: 'También es una ruedita antiestrés',
      description: 'Girala suavemente con el pulgar cuando quieras mantener las manos ocupadas.',
      placeholder: 'Video de la ruedita antiestrés en preparación',
      steps: [
        'Sostené la pieza con comodidad.',
        'Apoyá el pulgar sobre la ruedita.',
        'Girala suavemente a tu ritmo.'
      ],
      video: {
        src: null,
        poster: null,
        captions: null
      }
    }
  ] satisfies readonly PortacelularMode[],

  productStory: {
    title: 'Diseñado para ser distinto',
    attributes: [
      {
        title: 'Personalizable',
        description: 'Elegí colores, nombre, número o temática.'
      },
      {
        title: 'Impreso en 3D',
        description: 'Fabricado capa por capa con atención al detalle.'
      },
      {
        title: 'Hecho a medida',
        description: 'Ideal para regalos, eventos, marcas y recuerdos.'
      }
    ]
  },

  finalCta: {
    eyebrow: 'HECHO POR CRAF 3D',
    title: '¿Querés uno personalizado?',
    description: 'Creamos productos, regalos y recuerdos en impresión 3D adaptados a tu idea.',
    whatsappLabel: 'Consultar por WhatsApp',
    instagramLabel: 'Ver más trabajos en Instagram'
  }
} as const;

