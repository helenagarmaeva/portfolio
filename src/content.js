// Add contact links and case assets when supplied. An empty URL deliberately
// leaves a button without navigation.
const russianContent = {
  portrait: './photo-enhanced.webp',
  portraitAlt: 'Елена Гармаева',
  contacts: {
    cv: './HGarmaevaCV.pdf',
    telegram: 'https://t.me/hgrmv',
    linkedin: 'https://www.linkedin.com/in/helena-garmaeva/',
  },
  projects: [
    {
      title: 'ТПК КОСМОСПРЭЙ',
      description: 'Product Design / B2B / E-commerce / Brand Identity',
      cover: './cosmospray.png', url: './cosmospray.html',
    },
    {
      title: 'ДельтаБезопасность',
      description: 'Product Design / B2B / Dashboard',
      cover: './delta.png', url: './delta.html',
    },
    {
      title: 'Solok Cosmetics',
      description: 'Product Design / B2C / E-commerce / Brand Identity',
      cover: './solok.png', url: './solok.html',
    },
    {
      title: 'Дубовая Роща',
      description: 'Illustration / Graphic Design / Social Impact',
      cover: './dubovaya.png', url: './shelter.html',
    },
  ],
};

const englishProjects = [
  { title: 'TPK COSMOSPRAY', description: 'Product Design / B2B / E-commerce / Brand Identity', url: './cosmospray-en.html' },
  { title: 'Delta Security', description: 'Product Design / B2B / Dashboard', url: './delta-en.html' },
  { title: 'Solok Cosmetics', description: 'Product Design / B2C / E-commerce / Brand Identity', url: './solok-en.html' },
  { title: 'Dubovaya Roshcha', description: 'Illustration / Graphic Design / Social Impact', url: './shelter-en.html' },
];

export const content = document.documentElement.lang === 'en' ? {
  ...russianContent,
  contacts: { ...russianContent.contacts, cv: './HGarmaevaCVEng.pdf' },
  portraitAlt: 'Helena Garmaeva',
  projects: russianContent.projects.map((project, index) => ({ ...project, ...englishProjects[index] })),
} : russianContent;
