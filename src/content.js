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
      title: 'ТПК КОСМОСПРЭЙ',
      description: 'Web, В2В, E-com, Graphic design',
      cover: './cosmospray.png', url: '',
    },
    {
      title: 'ДельтаБезопасность',
      description: 'Web, В2В, Dashboard',
      cover: './delta.png', url: './delta.html',
    },
    {
      title: 'Solok Cosmetics',
      description: 'Web, В2С, E-com, Graphic design',
      cover: './solok.png', url: './solok.html',
    },
    {
      title: 'Приют для собак «Дубовая Роща»',
      description: 'Illustration, Graphic design',
      cover: './dubovaya.png', url: '',
    },
  ],
};

const englishProjects = [
  { title: 'TPK COSMOSPRAY', description: 'Web, B2B, E-com, Graphic design' },
  { title: 'Delta Security', description: 'Web, B2B, Dashboard', url: './delta-en.html' },
  { title: 'Solok Cosmetics', description: 'Web, B2C, E-com, Graphic design', url: './solok-en.html' },
  { title: 'Dubovaya Roshcha dog shelter', description: 'Illustration, Graphic design' },
];

export const content = document.documentElement.lang === 'en' ? {
  ...russianContent,
  contacts: { ...russianContent.contacts, cv: './HelenagrmvCVEng.pdf' },
  portraitAlt: 'Helena Garmaeva',
  projects: russianContent.projects.map((project, index) => ({ ...project, ...englishProjects[index] })),
} : russianContent;
