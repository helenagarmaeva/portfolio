// Add contact links and case assets when supplied. An empty URL deliberately
// leaves a button without navigation.
const russianContent = {
  portrait: './photo-enhanced.webp',
  portraitAlt: 'Елена Гармаева',
  contacts: {
    cv: './HelenagrmvCV.pdf',
    telegram: 'https://t.me/hgrmv',
    linkedin: 'https://www.linkedin.com/in/helena-garmaeva/',
  },
  projects: [
    {
      title: 'ТПК КОСМОСПРЭЙ — корпоративный сайт',
      description: 'Web, В2В, E-com, Graphic design',
      cover: './cosmospray.png', url: '',
    },
    {
      title: 'Сервис ДельтаБезопасность — комплексный B2B-дашборд',
      description: 'Web, В2В, Dashboard',
      cover: './delta.png', url: '',
    },
    {
      title: 'SOLOK COSMETICS — интернет-магазин натуральной косметики',
      description: 'Web, В2С, E-com, Graphic design',
      cover: './solok.png', url: '',
    },
    {
      title: 'Приют для собак «Дубовая Роща» — волонтерские проекты',
      description: 'Illustration, Graphic design',
      cover: './dubovaya.png', url: '',
    },
  ],
};

const englishProjects = [
  { title: 'TPK COSMOSPRAY — corporate website', description: 'Web, B2B, E-com, Graphic design' },
  { title: 'Delta Security — comprehensive B2B dashboard', description: 'Web, B2B, Dashboard' },
  { title: 'SOLOK COSMETICS — natural cosmetics online store', description: 'Web, B2C, E-com, Graphic design' },
  { title: 'Dubovaya Roshcha dog shelter — volunteer projects', description: 'Illustration, Graphic design' },
];

export const content = document.documentElement.lang === 'en' ? {
  ...russianContent,
  contacts: { ...russianContent.contacts, cv: './HelenagrmvCVEng.pdf' },
  portraitAlt: 'Helena Garmaeva',
  projects: russianContent.projects.map((project, index) => ({ ...project, ...englishProjects[index] })),
} : russianContent;
