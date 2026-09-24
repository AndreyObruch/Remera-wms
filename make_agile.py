# make_agile.py — генерация Agile-плана проекта в формате xlsx
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

OUT = r"C:\Users\user\Projects\REMERA\Remera-wms\WMS_REMERA_Agile.xlsx"
wb = openpyxl.Workbook()

header_font = Font(bold=True, color="FFFFFF", size=12)
header_fill = PatternFill("solid", fgColor="1e40af")
subhead_fill = PatternFill("solid", fgColor="3b82f6")
subhead_font = Font(bold=True, color="FFFFFF", size=11)
total_fill = PatternFill("solid", fgColor="dbeafe")
total_font = Font(bold=True, color="1e40af")
title_font = Font(bold=True, size=14, color="0f172a")
muted_font = Font(italic=True, color="64748b")
thin = Side(border_style="thin", color="cbd5e1")
border = Border(left=thin, right=thin, top=thin, bottom=thin)
center = Alignment(horizontal="center", vertical="center", wrap_text=True)
left_wrap = Alignment(horizontal="left", vertical="center", wrap_text=True)

def style_row(ws, row, ncols, fill=None, font=None, align=center):
    for c in range(1, ncols + 1):
        cell = ws.cell(row=row, column=c)
        if fill: cell.fill = fill
        if font: cell.font = font
        cell.alignment = align
        cell.border = border

def set_widths(ws, widths):
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w

# ---------- ЛИСТ 1: Канбан и команда ----------
ws1 = wb.active
ws1.title = "Канбан и команда"
ws1.merge_cells("A1:H1")
ws1["A1"] = "Проект: Интеллектуальная система управления складом (WMS)"
ws1["A1"].font = title_font
for i, h in enumerate(["Участник", "Роль", "Зона ответственности", "Backlog", "In Progress", "Review", "Done", "Статус"], 1):
    ws1.cell(row=3, column=i, value=h)
style_row(ws1, 3, 8, header_fill, header_font)
team = [
    ["Андрей", "Разработчик, технический директор", "Код, интеграции, демо-стенд", "JWT refresh, ABC-XYZ", "api/notify.js, guide.html", "—", "MVP-ядро, CSV ↔ 1С, CSV-приёмка", "в работе"],
    ["Qwen", "ИИ-ассистент", "Архитектура, тесты, документация", "ABC-XYZ, промпты уведомлений", "guide.html под актуальный UI", "—", "Аналитика (точка заказа), DOSSIER.md, AGILE.md", "в работе"],
    ["Директор", "Заказчик", "Приёмка, пороги автопроводок, пилот", "Согласование порога автопроводок", "—", "—", "PIN выданы, роли утверждены", "пилот"],
    ["Бухгалтер", "Пилот-пользователь", "Сверка с 1С", "—", "—", "—", "Выгрузка CSV протестирована", "готов"],
]
for r, row in enumerate(team, 4):
    for c, v in enumerate(row, 1):
        cell = ws1.cell(row=r, column=c, value=v)
        cell.alignment = left_wrap if c <= 3 else center
        cell.border = border
set_widths(ws1, [14, 28, 36, 28, 28, 14, 40, 14])

# ---------- ЛИСТ 2: Спринты ----------
ws2 = wb.create_sheet("Спринты")
ws2.merge_cells("A1:E1")
ws2["A1"] = "Проект: Интеллектуальная система управления складом (WMS)"
ws2["A1"].font = title_font
ws2["A2"] = "Бюджет: 0 руб. · Команда: 2 человека · Срок: 7 недель (3 спринта × 2 недели + 1 неделя приёмка)"
ws2["A2"].font = muted_font
sprints = [
    ("SPRINT 1 (недели 1–2): уведомления и документация", [
        ["1.1", "Обновить guide.html под актуальные функции", "Qwen + Андрей", "guide.html совпадает с UI", "Чек-лист 8/8, 0 расхождений"],
        ["1.2", "Подключить email-сервис и верификацию домена", "Андрей", "Работающая отправка с домена", "Письмо < 60 сек, deliverability ≥ 95%"],
        ["1.3", "Модуль api/notify.js: сигнал при запасе ≤ 1 дня, дроссель 6ч", "Qwen + Андрей", "Письмо директору о дефиците", "100% «красных» позиций, дублей = 0"],
    ], "Итог спринта: директор узнаёт о дефиците ≤ 5 минут без захода в систему"),
    ("SPRINT 2 (недели 3–4): QR-инвентаризация", [
        ["2.1", "Генератор QR-наклеек на 108 позиций", "Qwen", "/qr.html, печатный лист", "108/108 читаются смартфоном"],
        ["2.2", "Сканер наклейки в чате (камера + jsQR)", "Андрей", "Скан в чате", "≤ 2 сек, точность ≥ 95% (20 сканов)"],
        ["2.3", "Автоподстановка кода после скана", "Андрей", "Скан заполняет конструктор", "Путь «скан → отправка» ≤ 15 сек, ручных = 0"],
    ], "Итог спринта: рапорт работника 15 сек вместо 40 (−62%)"),
    ("SPRINT 3 (недели 5–6): безопасность и автоматизация", [
        ["3.1", "JWT вместо PIN (TTL 8 часов)", "Андрей", "Истекающие сессии", "100% истекают, протухших = 0"],
        ["3.2", "Автопроводки ниже порога (< 5% дневной нормы)", "Qwen + Андрей", "Рутина без директора", "≥ 70% рапортов авто, отмен ≤ 1%"],
        ["3.3", "ABC-XYZ анализ в «Аналитике»", "Qwen", "Отчёт оборачиваемости", "Покрытие 100%, ≥ 1 решение о закупке"],
    ], "Итог спринта: время директора на рутину −70%, бесконечных сессий = 0"),
    ("SPRINT 4 (неделя 7+): пилот и приёмка", [
        ["4.1", "Пилот 2 недели на производстве", "Директор + Андрей", "Система в ежедневной работе", "≥ 70% рапортов через WMS"],
        ["4.2", "Подготовка защиты: питч, демо-стенд", "Андрей + Qwen", "Питч + живое демо", "Демо без единого сбоя"],
        ["4.3", "Приёмка и передача в эксплуатацию", "Директор", "Подписанный акт", "Приёмка завершена"],
    ], "Итог спринта: система принята, эффекты измерены на живых данных"),
]
r = 4
for title, rows, total in sprints:
    ws2.merge_cells(start_row=r, start_column=1, end_row=r, end_column=5)
    ws2.cell(row=r, column=1, value=title)
    style_row(ws2, r, 5, subhead_fill, subhead_font, Alignment(horizontal="left", vertical="center"))
    r += 1
    for c, h in enumerate(["№", "Задача", "Ответственный", "Результат", "KPI спринта"], 1):
        ws2.cell(row=r, column=c, value=h)
    style_row(ws2, r, 5, header_fill, header_font)
    r += 1
    for row in rows:
        for c, v in enumerate(row, 1):
            cell = ws2.cell(row=r, column=c, value=v)
            cell.border = border
            cell.alignment = center if c == 1 else left_wrap
        r += 1
    ws2.merge_cells(start_row=r, start_column=1, end_row=r, end_column=5)
    ws2.cell(row=r, column=1, value=total)
    style_row(ws2, r, 5, total_fill, total_font, Alignment(horizontal="left", vertical="center"))
    r += 2
set_widths(ws2, [6, 44, 22, 32, 44])

# ---------- ЛИСТ 3: KPI ----------
ws3 = wb.create_sheet("KPI")
ws3.merge_cells("A1:E1")
ws3["A1"] = "KPI по категориям · Интеллектуальная WMS"
ws3["A1"].font = title_font
for c, h in enumerate(["Категория", "KPI", "Целевое значение", "Как измеряем", "Спринт"], 1):
    ws3.cell(row=3, column=c, value=h)
style_row(ws3, 3, 5, header_fill, header_font)
kpis = [
    ["Продуктовые", "Время рапорта работника", "15 сек", "Лог системы", "2"],
    ["Продуктовые", "Доля рапортов через WMS", "≥ 70%", "Журнал за пилот", "4"],
    ["Продуктовые", "Путь «скан → отправка»", "≤ 15 сек", "Контрольные рапорты", "2"],
    ["Операционные", "Время «сигнал → заказ»", "30 мин", "Журнал + лог заявок", "1"],
    ["Операционные", "Простои из-за дефицита за 3 мес", "0", "Журнал производства", "4"],
    ["Технические", "Доступность системы", "≥ 99%", "Лог Vercel", "1–4"],
    ["Технические", "Распознавание QR", "≤ 2 сек, ≥ 95%", "20 тест-сканов", "2"],
    ["Технические", "Безопасность сессий по TTL", "100%", "Автотест", "3"],
    ["Экономические", "Замороженные средства в запасах", "−15–20%", "Оценка запасов", "4"],
    ["Экономические", "Ошибки ввода данных", "−90%", "Журнал против бумаги", "4"],
]
for i, row in enumerate(kpis, 4):
    for c, v in enumerate(row, 1):
        cell = ws3.cell(row=i, column=c, value=v)
        cell.border = border
        cell.alignment = center if c in (1, 5) else left_wrap
r = 4 + len(kpis) + 1
ws3.merge_cells(start_row=r, start_column=1, end_row=r, end_column=5)
ws3.cell(row=r, column=1, value="ГЛАВНЫЕ KPI СПРИНТОВ")
style_row(ws3, r, 5, subhead_fill, subhead_font, Alignment(horizontal="left"))
r += 1
for c, h in enumerate(["Спринт", "Главный KPI", "Целевое значение", "", ""], 1):
    ws3.cell(row=r, column=c, value=h)
style_row(ws3, r, 5, header_fill, header_font)
r += 1
for row in [
    ["Sprint 1", "Директор знает о дефиците", "≤ 5 минут без захода в систему"],
    ["Sprint 2", "Рапорт работника", "15 секунд"],
    ["Sprint 3", "Операций без директора", "≥ 70%"],
    ["Sprint 4", "Система принята", "Акт подписан, простоев = 0"],
]:
    for c, v in enumerate(row, 1):
        cell = ws3.cell(row=r, column=c, value=v)
        cell.border = border
        cell.alignment = left_wrap
    ws3.merge_cells(start_row=r, start_column=3, end_row=r, end_column=5)
    r += 1
r += 1
ws3.merge_cells(start_row=r, start_column=1, end_row=r, end_column=5)
ws3.cell(row=r, column=1, value="ОБЩИЙ KPI ПРОЕКТА: базлайн AS-IS → цель TO-BE")
style_row(ws3, r, 5, PatternFill("solid", fgColor="22c55e"), Font(bold=True, color="FFFFFF"), Alignment(horizontal="left"))
r += 1
for c, h in enumerate(["Метрика", "Базлайн (AS-IS)", "Цель (TO-BE)", "", ""], 1):
    ws3.cell(row=r, column=c, value=h)
style_row(ws3, r, 5, header_fill, header_font)
r += 1
for row in [
    ["Простои из-за дефицита за 3 месяца", "до 2 (экспертная оценка)", "0"],
    ["Время рапорта работника", "40 сек", "15 сек (−62%)"],
    ["Время «сигнал → заказ»", "3 дня", "30 минут"],
    ["Замороженные деньги в запасах", "текущий уровень", "−15–20%"],
    ["Ошибки ввода данных", "100% (база)", "−90%"],
    ["Доступность / аудит-след", "—", "≥ 99% / 100% операций"],
]:
    for c, v in enumerate(row, 1):
        cell = ws3.cell(row=r, column=c, value=v)
        cell.border = border
        cell.alignment = left_wrap
    ws3.merge_cells(start_row=r, start_column=3, end_row=r, end_column=5)
    r += 1
set_widths(ws3, [16, 38, 28, 24, 14])

wb.save(OUT)
print("ГОТОВО:", OUT)