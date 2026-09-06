# ДОСЬЕ · WMS «РЕМЕРА» v2.0 «ВНУТРЕННИЙ КОНТУР»
Обновлено: 2026-09-06. Закрыт этап: сквозной тест Фаза 1 (работник + директор).

## 0. ПРАВИЛА
0.1. Одна команда на ответ, пошагово.
0.2. Готовый файл на замену: полный текст + точный путь.
0.3. Без переноса в новый чат; после каждого закрытого этапа — обновлённый DOSSIER.md файлом.
0.4. Футер: «📊 Заполненность ~X% | Сжатие».
0.5. К деплою — готовый текст коммита.
0.6. Меньше комментариев, кратко и по делу (требование пользователя).

## 1. ЦЕЛЬ
Работник: телефон → PIN → рапорт в чате. Директор: очередь → «Провести» → остаток меняется.
Без MAX/Telegram. Данные — Vercel Blob private. Эволюция: роль бухгалтера.

## 2. АРХИТЕКТУРА
Домен: https://remera-wms-bvii.vercel.app (две i). Чат: /chat.html.
chat.html → /api/auth, /api/chat, (/api/approve, /api/stock — создать) → lib/core.js + lib/store.js → Blob remera-private.
SDK @vercel/blob latest: access:'private' во ВСЕХ операциях; allowOverwrite:true при перезаписи.
get() возвращает {statusCode, stream, headers, blob}; чтение тела: blob.blob.text() или new Response(blob.stream).text().

## 3. ДАННЫЕ (wms2/state.json)
{version, stock:{CODE:qty}, pending:[...], movements:[...], messages:[...]}
approve → movements + stock по sign (receipt/production +1; consumption/sale −1).

## 4. ENV
WORKER_PIN=1234, DIRECTOR_PIN=5678, PRIV_READ_WRITE_TOKEN, PRIV_STORE_ID, PRIV_WEBHOOK_PUBLIC_KEY.
Удалить в уборке: MAX_BOT_TOKEN, TELEGRAM_*.

## 5. ФАЙЛЫ
chat.html — рабочий (мгновенный poll, анти-дубли, сессия в localStorage).
api/auth.js — рабочий. api/chat.js v2 — рабочий (с логами).
lib/core.js — рабочий. lib/store.js v13 — рабочий (чтение починено).
api/debug.js (debug-11) — УДАЛИТЬ в уборке. Создать: api/approve.js, api/stock.js.

## 6. СДЕЛАНО
Ремонт: старый store удалён; bot-файлы удалены; SDK latest (Redeploy without cache);
store.js v8→v13; PIN 1234/5678; чат обновлён.
Сквозной тест 06.09: работник — команда+ответ в ленте; директор — лента+карточка очереди. ПРОЙДЕНО.

## 7. УРОКИ (кратко)
7.1 SDK 0.27 не знает private → latest.
7.2 Без lockfile build-кэш не инвалидируется → Redeploy without cache.
7.3 Новый SDK: access обязателен во всех операциях.
7.4 createRequire — только в try-catch (краш на верхнем уровне).
7.5 Пустой/битый state.json → defaultState.
7.6 Перезапись blob → allowOverwrite:true.
7.7 Форма get() нового SDK: тело в blob.blob / blob.stream.
7.8 Env — только со следующим деплоем.
7.9 «No local changes» = файл не перезаписан; проверять файл в списке изменений.
7.10 build-маркер debug.js = индикатор доезда коммита.
7.11 Locked Env снимаются через Delete Store.
7.12 Автовход через localStorage; смена роли — «Выйти»/инкогнито.

## 8. ДОРОЖНАЯ КАРТА
R5: удалить api/debug.js (коммит).
R6: удалить Env MAX_BOT_TOKEN/TELEGRAM_*.
Фаза 2: api/approve.js (Провести/Отклонить → movements + stock); api/stock.js; тест проводки.
Фаза B: ACCOUNTANT_PIN + вкладки «Остатки»/«Журнал» (чтение).
Фаза 3: уведомления (Resend — открытый вопрос). Фаза 4: импорт 1С, бейдж v1.
Фаза 5: QR, аналитика, JWT.

## 9. РИСКИ
Blob без транзакций (ок для 2–3 пользователей); PIN = MVP (JWT в Фазе 5).