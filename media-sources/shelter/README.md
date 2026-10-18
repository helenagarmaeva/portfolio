# Фотографии кейса приюта

Оригиналы PNG сохранены без изменений. `calendar.png` — источник главного фото;
результат обычной обработки без ИИ — `public/shelter/calendar-clean.webp`.
Размер 1920 × 1281 px и композиция сохранены. Двусторонний фильтр подавляет
мелкий шум с сохранением контуров, unsharp повышает локальную чёткость.
Альфа-канал отдельно извлекается из оригинала и возвращается после обработки без изменений; результат сохраняется lossless.

Из корня репозитория, с установленным FFmpeg с libwebp:

```bash
ffmpeg -hide_banner -loglevel error -y \
  -i media-sources/shelter/calendar.png \
  -filter_complex '[0:v]split=2[photo][alpha];[alpha]alphaextract[mask];[photo]format=yuv444p,bilateral=sigmaS=2:sigmaR=0.04:planes=7,unsharp=5:5:0.5:5:5:0,format=rgb24[clean];[clean][mask]alphamerge,format=bgra[out]' \
  -map '[out]' \
  -frames:v 1 -c:v libwebp -lossless 1 -compression_level 6 \
  public/shelter/calendar-clean.webp
```

Сборка сайта не требует FFmpeg: готовый WebP уже сохранён в репозитории.
