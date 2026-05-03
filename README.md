# spendy-pwa

## Структура проекта

```
spendy-pwa/
├── .github/workflows/
│   └── deploy.yml              # CI/CD: сборка и деплой на GitHub Pages при пуше в main
├── public/
│   ├── icon.svg                # Исходная иконка приложения (источник для генерации PNG)
│   ├── favicon.ico             # Фавиконка браузера
│   └── .nojekyll               # Отключает Jekyll на GitHub Pages (нужен для папок с _)
├── src/
│   ├── main.tsx                # Точка входа React
│   ├── App.tsx                 # Корневой компонент, баннер обновления PWA
│   ├── App.css                 # Стили
│   └── vite-env.d.ts           # Типы Vite и vite-plugin-pwa
├── index.html                  # HTML-шаблон
├── vite.config.ts              # Конфиг Vite: base-путь, PWA-плагин, манифест
├── pwa-assets.config.ts        # Конфиг генератора иконок из icon.svg
├── tsconfig.json               # Проверка typescript типов во время компиляции
├── tsconfig.app.json           # TypeScript для src/
├── tsconfig.node.json          # TypeScript для vite.config.ts и pwa-assets.config.ts
└── package.json                # Зависимости; postinstall генерирует PNG-иконки
```

> PNG-иконки в `public/` не хранятся в git — они генерируются автоматически при `npm install`.

## Локальная разработка

```bash
npm install
npm run dev
```

> **Важно:** в dev-режиме Service Worker не регистрируется. Баннер обновления и установка на телефон не работают.

## Проверка PWA-функций локально

Для тестирования Service Worker, установки на телефон и баннера обновления нужен production-билд:

```bash
npm run build && npm run preview
```

## Деплой

Пуш в ветку `main` автоматически запускает деплой на GitHub Pages через GitHub Actions.

Приложение доступно по адресу: https://ivan-legostin.github.io/spendy-pwa/
