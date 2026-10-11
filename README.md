# Хвостик

Адаптивный сайт с интерактивной SVG-собачкой. При наведении курсора или фокусе с клавиатуры она виляет хвостом и зажмуривает глаза. Клик, Enter или касание включают и выключают радостное состояние. Поддерживается системная настройка уменьшения анимации.

## Разработка

Требуется Node.js 22.12+ (в облачной среде проверен Node.js 24) и npm.

```bash
npm ci
npm run dev -- --port 5173 --strictPort
```

## Сборка

```bash
npm run build
npm run preview -- --port 4173 --strictPort
```

Готовые статические файлы находятся в `dist/`. Серверные сервисы и секреты не требуются. Шрифт Manrope загружается через Google Fonts; при недоступности используется системный шрифт.

## Публикация на GitHub Pages

В настройках репозитория откройте **Settings → Pages → Build and deployment → Source** и выберите **GitHub Actions**. Workflow `Publish website to GitHub Pages` собирает и публикует сайт при каждом обновлении `main`. Его также можно запустить вручную: **Actions → Publish website to GitHub Pages → Run workflow**.

После успешной публикации адрес сайта: https://lenputka.github.io/portfolio/ .
