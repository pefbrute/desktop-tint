# Пост-мортем: Почему фильтры экрана в GNOME роняют фреймбуфер на Wayland и как мы это починили

Если вы работаете за монитором по вечерам или стараетесь снизить цифровую усталость глаз, то наверняка пробовали **грейскейл (чёрно-белый режим)** или **тёплые янтарные тинты (Amber/Sepia)** на Linux.

Однако пользователи Ubuntu и GNOME Shell часто сталкиваются с раздражающим багом в популярных расширениях вроде **Tint All**, **Desaturate All** или **GNOME Bedtime Mode**:

> ⚡ **Проблема отвала фильтра в Telegram:**  
> Вы включаете фильтр экрана. Всё работает. Но стоит открыть **Telegram Desktop**, перейти в любой канал или кликнуть на видео — и весь цветной фильтр моментально отключается! Переключаетесь на другое окно — фильтр возвращается. Возвращаетесь в Telegram — снова сброс в полноцвет.

Если заглянуть в системные логи через `journalctl -f /usr/bin/gnome-shell`, там будет бесконечно повторяться ошибка GPU:

```text
gnome-shell: Failed to create offscreen effect framebuffer:
             Failed to create texture 2d due to size/format constraints
```

Многие годы на форумах писали, что это «неисправимый баг Mutter/Wayland». В этой статье я подробно разберу **техническую причину**, почему падали классические расширения, и как устроен **[Desktop Tint](https://github.com/pefbrute/desktop-tint)** — открытое расширение для GNOME на GLSL-шейдерах, работающее без единого сбоя.

---

## 🔍 Разбор анатомии бага (Root Cause)

### Ловушка полноэкранного OffscreenEffect

Классические расширения применяют обесцвечивание, вешая стандартный Clutter-эффект (`Clutter.DesaturateEffect`) напрямую на корень всей графической сцены — `Main.uiGroup`.

Так как `Clutter.DesaturateEffect` наследуется от `Clutter.OffscreenEffect`, GNOME Shell вынужден выделять **полноэкранную GPU-текстуру (FBO)** размером со все ваши мониторы на каждый кадр:

```text
КЛАССИЧЕСКАЯ АРХИТЕКТУРА (ПАДАЕТ):

┌─────────────────────────────────────────────────────────────┐
│ Вся графическая сцена рабочего стола (Main.uiGroup)          │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────▼───────────────┐
               │ Offscreen Texture #1          │  <-- Огромный FBO на все мониторы
               │ (DesaturateEffect)            │      (Отваливается при фокусе Telegram!)
               └───────────────┬───────────────┘
                               │
               ┌───────────────▼───────────────┐
               │ Финальный вывод на экран      │
               └───────────────────────────────┘
```

### Что происходит при фокусе Telegram / Qt6

Telegram Desktop написан на **Qt 6 / 5.15**. При переходе по чатам и воспроизведении медиа Qt инициирует частые подповерхностные обновления Wayland (sub-surface updates), перерасчёт повреждённых областей (damage regions) и масштабирование HiDPI.

В этот момент Mutter пересчитывает объем отрисовки `Main.uiGroup`. Выделение огромной многомониторной текстуры Cogl (`cogl_texture_2d_new_with_size`) завершается с ошибкой `NULL`, и Clutter **молча пропускает проход рендеринга**. 

Эффект формально остаётся прикреплённым к актору, но экран возвращается в исходный цвет.

---

## 💡 Решение: Поакторный однопроходный GLSL-движок

В **Desktop Tint** мы полностью отказались от эффекта на весь `uiGroup` и перешли на поакторную архитектуру (per-actor design):

```text
АРХИТЕКТУРА DESKTOP TINT (СТАБИЛЬНО):

┌─────────────────────────────────────────────────────────────┐
│ Отдельные элементы интерфейса                               │
├─────────────────┬──────────────────┬────────────────────────┤
│ MetaWindowActor │ Main.panel       │ _backgroundGroup       │
│ (Окна программ) │ (Верхняя панель) │ (Обои рабочего стола)  │
└────────┬────────┴────────┬─────────┴──────────┬─────────────┘
         │                 │                    │
┌────────▼────────┐┌───────▼────────┐┌──────────▼──────────┐
│ Single-Pass GLSL││ Single-Pass GLSL││ Single-Pass GLSL    │ <-- Маленькие FBO размером
│ (Desat + Tint)  ││ (Desat + Tint)  ││ (Desat + Tint)      │     строго с само окно!
└────────┬────────┘└───────┬────────┘└──────────┬──────────┘
         │                 │                    │
┌────────▼─────────────────▼────────────────────▼────────────┐
│ Финальный вывод на экран (Стабильно 60+ FPS)                │
└─────────────────────────────────────────────────────────────┘
```

### 1. Единый GLSL-шейдер (`Shell.GLSLEffect`)

Вместо каскада нескольких эффектов мы написали единый фрагментный GLSL-шейдер, выполняющий обесцвечивание по стандарту ITU-R BT.709 и смешивание цветов за **один проход GPU**:

```glsl
#ifndef DESKTOP_TINT_UNIFORMS
#define DESKTOP_TINT_UNIFORMS
uniform float u_intensity;
uniform float u_desat;
uniform vec3  u_tint;
uniform float u_tint_mix;
#endif

// Вычисление яркости (luma) по стандартам BT.709
float luma   = dot(cogl_color_out.rgb, vec3(0.2126, 0.7152, 0.0722));
vec3  desatd = mix(cogl_color_out.rgb, vec3(luma), u_desat * u_intensity);

// Однопроходное наложение цветового тинта
vec3  tinted = desatd * u_tint;
cogl_color_out.rgb = mix(desatd, tinted, u_tint_mix * u_intensity);
```

> 💡 **Нюанс с `#ifndef`:**  
> Объявление `uniform` обязательно оборачивается в `#ifndef DESKTOP_TINT_UNIFORMS`. Без этого линкер Cogl при создании нескольких экземпляров шейдера выдаёт ошибку `u_intensity redeclared`, и окна становятся прозрачными.

---

### 2. Поакторный связыватель

Экземпляры шейдера создаются динамически для каждого актора:
- Каждое окно приложения (`MetaWindowActor`)
- Верхняя панель (`Main.panel`)
- Обои рабочего стола (`Main.layoutManager._backgroundGroup`)
- Обзор рабочих столов (`Main.overview._overview`)
- Боковые панели (`right-dock`, Dash)

Размер текстуры для любого окна не превышает физический размер самого окна — GPU **никогда не превышает лимиты памяти**.

---

## 🛠️ Сниппет для разработчиков расширений GNOME

Если вы делаете своё расширение под GNOME Shell и вам нужен лёгкий обесцвечивающий эффект, вот готовый класс на GJS:

```javascript
const { GObject, Shell } = imports.gi;

const SHADER_DECL = `
#ifndef DESAT_SHADER_UNIFORMS
#define DESAT_SHADER_UNIFORMS
uniform float u_factor;
#endif
`;

const SHADER_CODE = `
float luma = dot(cogl_color_out.rgb, vec3(0.2126, 0.7152, 0.0722));
cogl_color_out.rgb = mix(cogl_color_out.rgb, vec3(luma), u_factor);
`;

var LightweightDesatEffect = GObject.registerClass(
class LightweightDesatEffect extends Shell.GLSLEffect {
    _init() {
        super._init();
        this.add_glsl_snippet(Shell.SnippetHook.FRAGMENT, SHADER_DECL, SHADER_CODE, false);
        this._uFactor = this.get_uniform_location('u_factor');
        this._factor = 1.0;
    }

    setFactor(factor) {
        this._factor = factor;
        this.queue_repaint();
    }

    vfunc_paint_target(nodeOrCtx, paintCtxOrUndef) {
        this.set_uniform_float(this._uFactor, 1, [this._factor]);
        if (paintCtxOrUndef !== undefined)
            super.vfunc_paint_target(nodeOrCtx, paintCtxOrUndef);
        else
            super.vfunc_paint_target(nodeOrCtx);
    }
});
```

---

## ✨ Возможности Desktop Tint

- 🎨 **6 Пресетов:** Выключен, Amber (тёплый ночной), Green (ретро CRT), Cyan, Sepia, Grayscale (полный Ч/Б).
- 🎛️ **Управление колесом мыши:** Наведите курсор на иконку в панели и покрутите колесико — интенсивность плавно изменится от 5% до 100%.
- 🖥️ **Экранный OSD:** Покажет текущий режим и процент сглаживания.
- ⚠ **Аварийный сброс (Emergency Reset):** Мгновенная кнопка сброса настроек в меню.
- ⚙️ **Совместимость:** Поддержка GNOME 42, 43, 44, 45 и 46+ (Ubuntu 22.04 / 24.04, Wayland & X11).

---

## 🚀 Быстрая установка в 1 команду

Установить расширение можно одной командой в терминале:

```bash
curl -fsSL https://raw.githubusercontent.com/pefbrute/desktop-tint/main/install.sh | bash
```

Репозиторий на GitHub:  
👉 **[pefbrute/desktop-tint (GitHub)](https://github.com/pefbrute/desktop-tint)**

*Буду рад звёздам на GitHub и фидбеку по работе на разных видеокартах и дистрибутивах!*
