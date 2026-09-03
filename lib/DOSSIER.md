# ДОСЬЕ v2 · WMS «РЕМЕРА» v2.0 «ВНУТРЕННИЙ КОНТУР»
Обновлено: 2026-09-03, после Фазы-Ремонт. Единый документ проекта.

## 0. ЖЕЛЕЗНЫЕ ПРАВИЛА
0.1. ОДНА команда на ответ. Никаких «сделай А, потом Б».
0.2. ВСЕГДА готовый файл на замену: полный текст + точный путь. Без фрагментов.
0.3. БЕЗ переноса в новый чат. После каждого закрытого этапа Qwen присылает
     обновлённый DOSSIER.md готовым файлом: что сделано / что впереди.
0.4. Футер каждого ответа: «📊 Заполненность: ~X% | Сжатие: [Активно/Неактивно]».
0.5. К каждому деплою — готовый текст коммита.
0.6. Точные пути: C:\Users\user\REMERA\Remera-wms\...
0.7. build-маркер в api/debug.js = индикатор свежести деплоя (сейчас debug-10;
     файл временный, удаляется в уборке).

## 1. ЦЕЛЬ (критерий готовности v2)
1.1. Работник с телефона без VPN: сайт → PIN → рапорт во внутреннем чате.
1.2. Директор: очередь → «Провести» → серверный остаток меняется.
1.3. MAX и Телеграм НЕ ИСПОЛЬЗУЮТСЯ ВООБЩЕ (требование заказчика).
1.4. Данные — только внутри проекта (Vercel Blob private).
1.5. Эволюция: роль бухгалтера (чтение: остатки + журнал движений) — Фаза B.

## 2. АРХИТЕКТУРА (текущая)
2.1. Деплой: GitHub → Vercel (Hobby). Env применяются ТОЛЬКО со следующим деплоем.
2.2. ЖИВОЙ ДОМЕН: https://remera-wms-bvii.vercel.app («bvii» — две i;
     источник правды — Vercel → Domains; код ходит по относительным /api/*).
2.3. Чат: /chat.html — вход по PIN, лента, поллинг 6 с, индикатор-точка,
     у директора очередь «Провести/Отклонить» (вызывает /api/approve — создать).
2.4. API: auth.js — работает; chat.js v2 — работает (серверные логи);
     debug.js — ВРЕМЕННЫЙ (debug-10); создать: approve.js, stock.js (Фаза 2).
2.5. Логика: lib/core.js — проверен, полностью рабочий (команды, 4 слоя защиты,
     номенклатура, нормы). lib/store.js — на сервере v8; v10 выдан, ждёт коммита.
2.6. Хранилище: Vercel Blob `remera-private` (Private, fra1).
     SDK @vercel/blob = "latest". ВАЖНО: новый SDK требует access:'private'
     во ВСЕХ операциях (put и get).
2.7. v1 legacy НЕ ТРОГАЕМ: index.html, style.css, js/* (браузерный SQLite).
     Бейдж «учебная БД» — в Фазе 4.

## 3. МОДЕЛЬ ДАННЫХ (wms2/state.json в Blob)
{ version, stock:{CODE:qty}, pending:[...], movements:[...], messages:[...] }
message: {id, ts, role(worker|director|system), author, text, kind(msg|cmd|reply)}
pending: {id, ts, author, role, op, label, type, sign, code, name, qty, status}
approve → movements + корректировка stock по sign
(receipt/production +1; consumption/sale −1).

## 4. ENV (Vercel → Settings → Environment Variables)
4.1. WORKER_PIN=1234, DIRECTOR_PIN=5678 (сменены на человеко-читаемые).
4.2. PRIV_READ_WRITE_TOKEN, PRIV_STORE_ID, PRIV_WEBHOOK_PUBLIC_KEY — приватный store.
4.3. Старые BLOB_* — ИСЧЕЗЛИ (автоудалились после Delete Store старого
     remera-wms-bvii-blob).
4.4. MAX_BOT_TOKEN / TELEGRAM_* — УДАЛИТЬ в уборке.

## 5. КАРТА ФАЙЛОВ (текущие версии)
C:\Users\user\REMERA\Remera-wms
│ index.html, style.css, vercel.json, package.json (@vercel/blob "latest"),
│ DOSSIER.md (этот файл), chat.html (мгновенный poll, телеметрия, анти-дубли)
├─ api\  auth.js (раб.), chat.js (v2, логи), debug.js (врем., debug-10)
│        создать: approve.js, stock.js
├─ lib\  core.js (раб.), store.js (v10 ждёт коммита / на сервере v8)
└─ js\   (10 файлов v1 — не трогать)

## 6. СДЕЛАНО (хронология)
6.1. Фаза-Ремонт A: старый store remera-wms-bvii-blob удалён; bot-файлы
     api/telegram.js и api/max.js удалены из репо; SDK поднят до latest через
     Redeploy without cache; store.js v8 (access:'private') — хранилище живо
     (debug-9: selfTest ok, loadState ok); lib/core.js проверен (debug-10 ok);
     PIN сменены; chat.html обновлён; chat.js v2 (детальные логи).
6.2. Диагноз «Unexpected end of JSON input» (пустой/битый state.json) →
     выдан store.js v10 (fallback defaultState) — ждёт коммита.

## 7. УРОКИ (ошибка → причина → решение)
7.1. «access must be "public"» на SDK 0.27 → 0.27 не знает private →
     SDK latest + Redeploy without cache.
7.2. «get is not a function» → в build-кэше старый SDK; без lockfile кэш
     не инвалидируется → Redeploy without cache.
7.3. Новый SDK: access ОБЯЗАТЕЛЕН во всех операциях → access:'private' в blobOpts().
7.4. 500 FUNCTION_INVOCATION_FAILED → createRequire(import.meta.url) на верхнем
     уровне модуля → только внутри try-catch.
7.5. «Unexpected end of JSON input» → пустой/битый state.json → loadState:
     пустое/битое = defaultState (zero-downtime).
7.6. Env-переменные «под замком» → созданы подключением store → снимаются
     через Delete Store.
7.7. Env — только со следующим деплоем.
7.8. bvli/bvii → домен смотреть в Vercel → Domains.
7.9. GitHub Desktop «No local changes» = файл локально не перезаписан.
7.10. build-маркер debug.js показывает, доехал ли коммит.

## 8. РИСКИ
Blob без транзакций (ок для 2–3 пользователей); Hobby-лимиты достаточны;
PIN = MVP (JWT в Фазе 5); зарубежные облака — канал работает.

## 9. ДОРОЖНАЯ КАРТА (что впереди)
ШАГ 1 (ближайший): коммит lib/store.js v10 (файл и текст коммита выданы
в предыдущем ответе) → push → сквозной тест Фаза 1:
  • работник (1234): /расход 5 PA-F → в ленте сообщение + «✅ Принято…»;
  • директор (инкогнито, 5678): команда+ответ в ленте, жёлтая карточка очереди.
  (Кнопка «Провести» до Фазы 2 не работает — это ожидаемо.)
ШАГ 2 (уборка): удалить api/debug.js (коммит); удалить Env MAX_BOT_TOKEN/TELEGRAM_*.
ФАЗА 2: api/approve.js (провести/отклонить → movements + stock по sign);
api/stock.js; тест проводки (остаток меняется).
ФАЗА B: ACCOUNTANT_PIN + интерфейс бухгалтера (чтение: остатки + журнал).
ФАЗА 3: уведомления (Resend — ОТКРЫТЫЙ ВОПРОС, решить с заказчиком).
ФАЗА 4: импорт 1С (CSV → stock); бейдж «учебная БД» на v1.
ФАЗА 5: QR-инвентаризация; анализ поставщиков; «мёртвый груз»/«деньги в обороте»; JWT.

## 10. РЕГЛАМЕНТ ДОСЬЕ
Переноса в новый чат НЕТ. После каждого закрытого этапа (сквозной тест,
Фаза 2, Фаза B…) Qwen присылает обновлённый DOSSIER.md готовым файлом на замену.