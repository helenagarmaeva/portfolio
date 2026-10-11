// Add contact links and case assets when supplied. An empty URL deliberately
// leaves a button without navigation.
const russianContent = {
  portrait: './IMG_1498.JPG',
  portraitAlt: 'Елена Гармаева',
  contacts: {
    cv: './ResumeEG.pdf',
    telegram: 'https://t.me/hgrmv',
    linkedin: 'https://www.linkedin.com/in/helena-garmaeva/',
  },
  projects: [
    {
      title: 'ТПК КОСМОСПРЭЙ — корпоративный сайт',
      description: 'Web, В2В, E-com, Graphic design',
      cover: './космоспрэй.png', url: '',
    },
    {
      title: 'Сервис ДельтаБезопасность — комплексный B2B-дашборд',
      description: 'Web, В2В, Dashboard',
      cover: './дельта.png', url: '',
    },
    {
      title: 'SOLOK COSMETICS — интернет-магазин натуральной косметики',
      description: 'Web, В2С, E-com, Graphic design',
      cover: './солок.png', url: '',
    },
    {
      title: 'Приют для собак «Дубовая Роща» — волонтерские проекты',
      description: 'Illustration, Graphic design',
      cover: './календарь.png', url: '',
    },
  ],
};

const englishProjects = [
  { title: 'TPK KOSMOSPRAY — corporate website', description: 'Web, B2B, E-com, Graphic design' },
  { title: 'Delta Security — comprehensive B2B dashboard', description: 'Web, B2B, Dashboard' },
  { title: 'SOLOK COSMETICS — natural cosmetics online store', description: 'Web, B2C, E-com, Graphic design' },
  { title: 'Dubovaya Roshcha dog shelter — volunteer projects', description: 'Illustration, Graphic design' },
];

export const content = document.documentElement.lang === 'en' ? {
  ...russianContent,
  portraitAlt: 'Helena Garmaeva',
  projects: russianContent.projects.map((project, index) => ({ ...project, ...englishProjects[index] })),
} : russianContent;
