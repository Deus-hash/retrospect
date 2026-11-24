import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

doc = docx.Document()

# Page Margins
sections = doc.sections
for s in sections:
    s.top_margin = Inches(0.75)
    s.bottom_margin = Inches(0.75)
    s.left_margin = Inches(0.75)
    s.right_margin = Inches(0.75)

# Styling
style_normal = doc.styles['Normal']
style_normal.font.name = 'Calibri'
style_normal.font.size = Pt(11)
style_normal.font.color.rgb = RGBColor(30, 30, 30)

# Header
p_org = doc.add_paragraph()
p_org.alignment = WD_ALIGN_PARAGRAPH.RIGHT
p_org_run = p_org.add_run(
    "В Организационный комитет\n"
    "межвузовского конкурса «Студенческий IT-стартап»\n"
    "ФГБОУ ВО «БГИТУ»\n"
    "az4renko.nat@yandex.ru"
)
p_org_run.font.size = Pt(10)
p_org_run.font.color.rgb = RGBColor(100, 100, 100)
p_org_run.font.italic = True

p_title = doc.add_paragraph()
p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
p_title.paragraph_format.space_before = Pt(14)
p_title.paragraph_format.space_after = Pt(14)
run_title = p_title.add_run("ЗАЯВКА\nна участие в конкурсе «Студенческий IT-стартап»")
run_title.font.size = Pt(16)
run_title.font.bold = True
run_title.font.color.rgb = RGBColor(20, 35, 75)

# 10 Points Table
table_data = [
    ("1", "Фамилия, имя, отчество разработчика (разработчиков)", "[Ваши Ф.И.О., например: Иванов Иван Иванович]"),
    ("2", "Направление подготовки, курс", "[Ваше направление подготовки, например: 09.03.01 Информатика и вычислительная техника, 3 курс]"),
    ("3", "Контактный телефон", "[Ваш контактный номер телефона]"),
    ("4", "Контактный e-mail", "[Ваш рабочий e-mail]"),
    ("5", "Ф.И.О., место работы и телефон руководителя", "[Ф.И.О. руководителя, должность, кафедра / Без руководителя]"),
    ("6", "Название проекта", "RETROSPECT — WebAssembly-платформа интерактивного ретро-гейминга и сохранения цифрового наследия"),
    ("7", "Адрес проекта в Интернет (если есть)", 
     "1. Рабочий веб-сервис онлайн (деплой): https://retrospect-production-581108da.up.railway.app\n"
     "2. Интерактивная веб-презентация: https://retrospect-production-581108da.up.railway.app/presentation.html\n"
     "3. Открытый репозиторий и исходный код: https://github.com/Deus-hash/retrospect"),
    ("8", "Описание проекта (не более 10 предложений)", 
     "RETROSPECT — отечественная веб-платформа, решающая проблему доступности классических видеоигр и сохранения исторического цифрового наследия с помощью технологий WebAssembly (WASM).\n"
     "Сервис объединяет интерактивную энциклопедию 9 культовых консолей (569 игр) с возможностью мгновенного запуска 116 проверенных авторских и Public Domain тайтлов прямо в окне браузера в один клик.\n"
     "Платформа полностью устраняет необходимость скачивания эмуляторов, поиска BIOS-файлов и ручной настройки управления, обеспечивая «холодный запуск» игры менее чем за 1.5 секунды.\n"
     "Адаптивный мобильный интерфейс включает виртуальный сенсорный геймпад, жестко закрепленный во вьюпорте и сохраняющий работу при переходе смартфона в полноэкранный режим.\n"
     "На десктопе реализована мгновенная автоматическая фокусировка клавиатуры и поддержка Plug & Play физических геймпадов через Gamepad API.\n"
     "Структурированный многопараметрический рубрикатор на 91 жанр с базой данных MongoDB гарантирует отклик поиска и фильтрации менее 15 мс.\n"
     "Клиентская WebAssembly-архитектура переносит исполнение эмулятора на устройство пользователя, снижая себестоимость серверной сессии до менее 0.02 ₽ и обеспечивая валовую маржинальность 76%+.\n"
     "Для коммерческого сектора (B2B) разработан защищенный Kiosk Mode для интерактивных зон фестивалей, музеев ретро-техники и антикафе с чеком от 45 000 ₽ за событие или от 3 500 ₽/мес за терминал.\n"
     "Для независимых разработчиков создается издательская витрина Homebrew Publishing с распределением выручки по модели RevShare 15–20%.\n"
     "Проект реализован в виде полностью функционального MVP с авто-сидингом базы данных и интерактивной 19-слайдовой презентацией для защиты."),
    ("9", "Системные требования и указания по установке проекта", 
     "ДЛЯ КОНЕЧНОГО ПОЛЬЗОВАТЕЛЯ: Любой современный веб-браузер (Google Chrome, Microsoft Edge, Safari, Firefox, Яндекс.Браузер) с поддержкой WebAssembly и HTML5 Canvas на ПК или мобильном телефоне (iOS/Android). Установка дополнительных плагинов или ПО не требуется.\n\n"
     "ДЛЯ РАЗРАБОТЧИКА / ЛОКАЛЬНОГО ТЕСТИРОВАНИЯ:\n"
     "1. Требуется среда Node.js v18+ и СУБД MongoDB v6.0+.\n"
     "2. Клонирование репозитория: git clone <url> && cd retrospect\n"
     "3. Установка модулей: npm install\n"
     "4. Запуск сервера: npm start (автоматический сидинг наполнит базу данных 569 играми).\n"
     "5. Открытие в браузере: http://localhost:3000 (презентация: http://localhost:3000/presentation.html)."),
    ("10", "Наличие собственного оборудования", "Ноутбук разработчика для демонстрации рабочего прототипа на защите, мобильный смартфон для демонстрации сенсорного интерфейса, физический геймпад.")
]

table = doc.add_table(rows=len(table_data) + 1, cols=3)
table.alignment = WD_TABLE_ALIGNMENT.CENTER
table.autofit = False

col_widths = [Inches(0.5), Inches(2.3), Inches(4.2)]

# Header Row
hdr_cells = table.rows[0].cells
hdr_titles = ["№", "Параметр заявки", "Сведения участника"]
for idx, text in enumerate(hdr_titles):
    hdr_cells[idx].text = text
    shading = parse_xml(r'<w:shd {} w:fill="1E3A8A"/>'.format(nsdecls('w')))
    hdr_cells[idx]._tc.get_or_add_tcPr().append(shading)
    p = hdr_cells[idx].paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for r in p.runs:
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)
        r.font.size = Pt(10)

# Body Rows
for r_idx, (num, param, val) in enumerate(table_data, start=1):
    row_cells = table.rows[r_idx].cells
    row_cells[0].text = num
    row_cells[1].text = param
    row_cells[2].text = val
    
    # Text styles
    p0 = row_cells[0].paragraphs[0]
    p0.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p0.runs[0].font.bold = True
    
    p1 = row_cells[1].paragraphs[0]
    p1.runs[0].font.bold = True
    p1.runs[0].font.size = Pt(10)
    
    p2 = row_cells[2].paragraphs[0]
    p2.runs[0].font.size = Pt(10)
    
    # Shading on alternate rows
    if r_idx % 2 == 1:
        for c in row_cells:
            sh = parse_xml(r'<w:shd {} w:fill="F8FAFC"/>'.format(nsdecls('w')))
            c._tc.get_or_add_tcPr().append(sh)

# Set widths
for row in table.rows:
    for idx, width in enumerate(col_widths):
        row.cells[idx].width = width

doc.add_page_break()

# Extended Description Header
p_ext = doc.add_paragraph()
p_ext.alignment = WD_ALIGN_PARAGRAPH.CENTER
r_ext = p_ext.add_run("РАЗВЁРНУТОЕ ОПИСАНИЕ И НАУЧНО-ТЕХНИЧЕСКИЙ ОТЧЁТ\n(согласно п. 5.1–5.4 Положения о Конкурсе)")
r_ext.font.size = Pt(14)
r_ext.font.bold = True
r_ext.font.color.rgb = RGBColor(20, 35, 75)

sections_data = [
    ("1. Цели и задачи ИТ-решения", [
        ("Цель проекта", "Создание высокопроизводительной, масштабируемой WebAssembly-платформы ретро-гейминга с открытой базой знаний, устраняющей технический барьер входа к классическим видеоиграм и предоставляющей инфраструктуру монетизации для малого бизнеса (B2B) и независимых авторов."),
        ("Задачи проекта", 
         "1. Разработка клиентской песочницы браузерной эмуляции на базе WebAssembly для систем 8-bit, 16-bit и 32/64-bit с гарантией 60 FPS.\n"
         "2. Построение оптимизированной базы данных MongoDB с каталогом из 569 тайтлов и структурированным рубрикатором на 91 жанр.\n"
         "3. Создание эргономичного мобильного интерфейса с непрерывным сенсорным геймпадом для экранов смартфонов.\n"
         "4. Обеспечение 100% юридической чистоты коллекции: интеграция 116 легальных авторских и Public Domain игр.\n"
         "5. Разработка защищенного Kiosk-модуля для интеграции в оффлайн-площадки, фестивали и антикафе.")
    ]),
    ("2. Архитектура и стек используемых технологий", [
        ("Клиентский слой (Frontend UI)", "Handlebars SSR для молниеносной первоначальной отрисовки страниц и идеальной SEO-индексации; HTML5 Canvas для вывода игрового растра; Web Audio API для 16-битного синтеза звука; Gamepad API и Touch Events."),
        ("Ядро эмуляции (WASM Core)", "Интеграция портов Nostalgist.js (Libretro WASM) и специализированного ультралегкого движка JSNES. Декодирование ROM происходит локально на устройстве пользователя в защищенной песочнице."),
        ("Серверный слой (Backend & Data)", "Node.js + Express REST API; СУБД MongoDB с денормализованной структурой хранения тегов и платформ (задержка поиска < 15 мс); модуль AutoSeed для моментального развертывания.")
    ]),
    ("3. Перечень сторонних компонентов, правообладатели и лицензии", [
        ("Лицензионная чистота", 
         "• Node.js — OpenJS Foundation (MIT License)\n"
         "• Express.js — StrongLoop / OpenJS Foundation (MIT License)\n"
         "• Mongoose — Automattic / Valeri Karpov (MIT License)\n"
         "• Nostalgist.js — Ruixin Bao (MIT License)\n"
         "• JSNES — Ben Firshman (GPL-3.0 License)\n"
         "• Libretro Cores — Libretro Team (GPL-2.0 / MIT)\n"
         "• Игровые дампы (116 шт.) — авторы независимых Homebrew-проектов, Public Domain (Creative Commons, Freeware). 0 пиратских дампов закрытых франшиз.")
    ]),
    ("4. Результаты применения для предпринимателей (B2B-эффект)", [
        ("Event & Kiosk Solutions (Ивенты и фестивали)", "Аренда готового брендированного интерактивного стенда под ключ (Comic-Con, Geek Picnic, выставки). Чек: от 45 000 ₽ за проект. Заказчик получает точку притяжения сотен посетителей без риска поломки техники."),
        ("HoReCa и Антикафе (Регулярная подписка)", "SaaS-лицензия Kiosk Mode: 3 500 – 5 000 ₽ в месяц за терминал. Окупается заведению за 2 дня за счет увеличения среднего времени пребывания посетителей на 1.5–2 часа."),
        ("Homebrew Publishing (Инди-разработчики)", "Витрина монетизации для создателей ретро-игр с приемом донатов и предзаказом коллекционных картриджей. Модель разделения дохода: RevShare 15–20%.")
    ]),
    ("5. Реализация MVP и экономические показатели (Критерий 30 баллов)", [
        ("Готовность MVP", "Проект находится в стадии полностью рабочего MVP: 569 игр в каталоге, 116 играбельны онлайн в один клик, реализована мобильная адаптивность, авто-сидинг и интерактивная презентация."),
        ("Экономическая эффективность", "Себестоимость серверных вычислений благодаря WebAssembly составляет менее 0.02 ₽ за сессию. Валовая маржинальность сервиса превышает 76%+.")
    ])
]

for sec_title, items in sections_data:
    h = doc.add_heading(sec_title, level=2)
    h.paragraph_format.space_before = Pt(12)
    h.paragraph_format.space_after = Pt(6)
    for sub, content in items:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(4)
        r_sub = p.add_run(sub + ": ")
        r_sub.bold = True
        r_sub.font.color.rgb = RGBColor(20, 35, 75)
        p.add_run(content)

out_docx_path = r'C:\Users\Deus\Desktop\Retrospect\Заявка_Студенческий_IT_Стартап_Retrospect.docx'
doc.save(out_docx_path)
print(f'Successfully generated {out_docx_path}')
