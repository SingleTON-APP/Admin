Нужно создать полноценную заготовку веб-панели администрирования и модерации для существующего мессенджера.

Главная цель этого этапа — не реализовать весь backend админки, а создать качественный, расширяемый frontend-каркас: структуру проекта, дизайн-систему, навигацию, страницы, компоненты, mock-данные и слой работы с будущим API.

В дальнейшем эта админка будет активно расширяться, поэтому архитектура должна быть рассчитана на добавление новых разделов без необходимости переписывать существующие компоненты.

## 1. Сначала изучи существующий проект

Перед изменениями:

* изучи структуру репозитория;
* определи используемый frontend stack;
* посмотри существующие компоненты, стили, eslint/prettier/typescript-конфигурацию;
* посмотри существующую систему авторизации;
* найди модели/типы пользователя, чатов, сообщений, файлов и других сущностей;
* выясни, какие API уже существуют;
* не дублируй существующую инфраструктуру;
* не меняй архитектуру основного приложения без необходимости;
* не ломай существующий frontend.

Если проект уже использует определённые библиотеки компонентов, router, state manager, query library и т. п. — используй существующий стек.

Не нужно ради админки переписывать проект на другой framework.

Перед началом реализации кратко опиши найденную структуру и предложи, где лучше расположить admin-приложение.

---

# 2. Назначение панели

Это внутренняя панель управления мессенджером.

Через неё в будущем должны выполняться:

* управление пользователями;
* просмотр профилей;
* блокировка/разблокировка пользователей;
* moderation actions;
* просмотр жалоб;
* просмотр чатов;
* просмотр сообщений;
* поиск сообщений;
* удаление запрещённого контента;
* просмотр вложений;
* управление группами/каналами;
* управление ролями;
* управление администраторами;
* просмотр истории действий администраторов;
* мониторинг состояния сервисов;
* просмотр общей статистики;
* просмотр технической информации;
* управление некоторыми глобальными настройками приложения.

Сейчас для большинства функций можно использовать mock data.

---

# 3. Общий дизайн

Админка должна выглядеть как современный internal admin tool.

Не делать дизайн похожим на:

* игровой сайт;
* лендинг;
* маркетинговую страницу;
* Material UI demo;
* дешёвую bootstrap-админку.

Ориентир:

современная минималистичная SaaS / infrastructure / moderation console.

Интерфейс должен быть плотным по информации, но не перегруженным.

Desktop-first.

Основной сценарий использования:

1920×1080 и 2560×1440.

При этом интерфейс не должен разваливаться на ноутбуках.

---

# 4. Цветовая схема

Основная тема — dark.

Пример направления:

background:
#0B0D10

surface:
#111419

surface-secondary:
#171B21

border:
#242A33

text-primary:
#F3F4F6

text-secondary:
#9CA3AF

accent:
спокойный blue / indigo

success:
green

warning:
orange / amber

danger:
red

Не использовать слишком яркие neon-цвета.

Красный использовать в основном для:

* ban;
* delete;
* security alerts;
* destructive actions.

Цвета должны быть вынесены в theme/tokens, а не раскиданы случайными hex по компонентам.

Подготовить дизайн так, чтобы позже можно было добавить light theme.

---

# 5. Layout

Основной layout:

┌─────────────────────────────────────────────┐
│ sidebar │ topbar                            │
│         ├───────────────────────────────────│
│         │                                   │
│         │ content                           │
│         │                                   │
└─────────────────────────────────────────────┘

## Sidebar

Фиксированный sidebar слева.

Пример разделов:

Overview

Moderation

* Reports
* Moderation Queue

Users

* Users
* Admins
* Roles

Communication

* Chats
* Groups
* Channels
* Messages

Content

* Media
* Files

Security

* Sessions
* Bans
* Audit Log

System

* Services
* Statistics
* Settings

Sidebar должен:

* иметь icons;
* поддерживать nested sections;
* подсвечивать активный route;
* сворачиваться;
* сохранять compact mode;
* показывать название продукта сверху.

Например:

Hub Admin

или

Messenger Admin

Название желательно вынести в config.

---

# 6. Topbar

Topbar должен содержать:

* breadcrumbs;
* global search;
* notification icon placeholder;
* текущего администратора;
* avatar;
* role;
* dropdown account menu.

Global Search в будущем должен искать:

* user ID;
* username;
* email;
* phone;
* chat ID;
* message ID;
* report ID.

Сейчас сделать UI + mock functionality.

Поддержать shortcut:

Ctrl + K

или

Cmd + K.

---

# 7. Dashboard / Overview

Route:

/admin

Сделать основной dashboard.

Карточки:

* Total users
* Active users 24h
* New users 24h
* Online now
* Messages 24h
* Active chats
* Reports open
* Banned users

Также:

график активности пользователей;

график количества сообщений;

динамика регистраций;

Moderation Queue;

Recent Reports;

Recent Admin Actions;

System Status.

System Status примерно:

API                  Healthy
Auth                 Healthy
WebSocket            Healthy
PostgreSQL           Healthy
Redis                Healthy
Object Storage       Healthy

Для mock-data иногда показывать degraded, чтобы компоненты всех состояний были видны.

---

# 8. Users

Route:

/admin/users

Основная таблица пользователей.

Колонки:

* avatar;
* display name;
* username;
* user ID;
* email;
* phone, если существует;
* status;
* online/offline;
* registered;
* last active;
* reports count;
* role;
* actions.

Функции интерфейса:

* search;
* filters;
* pagination;
* sorting;
* column configuration;
* bulk selection;
* export placeholder.

Filters:

status:

* active;
* banned;
* deleted;
* suspended.

registration date;

last active;

role;

has reports;

verified.

Клик по пользователю должен вести:

/admin/users/:id

---

# 9. User Details

Страница пользователя должна быть очень информативной.

Header:

avatar

Display Name

@username

User ID

status badges

кнопки:

Actions

Suspend

Ban

Критичные actions не должны быть огромными красными кнопками посреди интерфейса.

Разнести по contextual menus / danger zone.

Вкладки:

Overview
Activity
Chats
Messages
Reports
Sessions
Media
Moderation History

## Overview

Показать:

* ID;
* username;
* email;
* phone;
* registration date;
* last seen;
* current status;
* IP placeholder;
* device count;
* session count;
* reports;
* sent messages;
* uploaded files.

## Activity

Сделать timeline:

LOGIN
LOGOUT
MESSAGE_SENT
PROFILE_UPDATED
FILE_UPLOADED
SESSION_CREATED

## Moderation History

Показывать:

date

admin

action

reason

duration

comment.

---

# 10. Reports

Route:

/admin/reports

Это один из основных разделов.

Таблица:

* report ID;
* type;
* reporter;
* target;
* reason;
* created;
* priority;
* status;
* assigned moderator.

Statuses:

New
In Review
Resolved
Rejected

Priority:

Low
Medium
High
Critical

Report types:

USER
MESSAGE
CHAT
GROUP
MEDIA

Клик:

/admin/reports/:id

---

# 11. Report Details

Сделать layout для работы модератора.

Слева:

информация о жалобе.

Центр:

контекст нарушения.

Например:

message before

reported message

message after.

Справа:

информация о пользователе / target.

Actions:

No violation

Warn

Delete content

Mute

Suspend

Ban

Escalate

Каждое moderation action должно в будущем принимать:

reason;

internal comment;

duration;

evidence;

confirmation.

Сейчас можно сделать modal UI.

---

# 12. Chats

Route:

/admin/chats

Таблица:

Chat ID
Type
Members
Messages
Created
Last activity
Reports
Status

Types:

DM
GROUP
CHANNEL

Поиск:

chat ID

user

title.

---

# 13. Chat Viewer

Route:

/admin/chats/:id

Сделать интерфейс просмотра чата.

Layout примерно как messenger:

---

## chat information

messages
messages
messages
--------

Но это read-only moderation viewer.

Каждое сообщение:

* avatar;
* username;
* user ID tooltip;
* timestamp;
* message ID;
* text;
* attachment;
* edited;
* deleted;
* moderation flags.

Context menu:

Copy Message ID

Open User

View Context

View Raw Data

Delete Message

Moderation Action

Не реализовывать возможность отправлять сообщения от администратора.

---

# 14. Messages

Route:

/admin/messages

Глобальный поиск сообщений.

Фильтры:

* user;
* chat;
* date;
* message ID;
* contains media;
* deleted;
* reported;
* edited.

Результат должен показывать context и позволять перейти:

к пользователю;

к чату;

к report.

---

# 15. Groups / Channels

Разделы:

/admin/groups
/admin/channels

Таблица:

name

ID

owner

members/subscribers

created

messages

reports

status.

Detail page:

Overview

Members

Moderators

Messages

Reports

Settings

Audit history.

---

# 16. Media

Route:

/admin/media

Сделать media browser.

Типы:

images

video

audio

voice

documents

other.

Карточка:

preview;

file ID;

owner;

size;

MIME type;

upload date;

source chat;

reports.

Подготовить поддержку безопасного просмотра медиа.

Не подгружать автоматически потенциально опасные HTML/SVG/executable файлы.

---

# 17. Ban Management

Route:

/admin/bans

Таблица:

target

type

reason

created by

created at

expires at

status.

Типы могут быть:

Permanent

Temporary

Suspension

Mute.

Добавить mock UI:

Create Ban

Revoke Ban

Extend Ban.

Все destructive actions через confirmation modal.

---

# 18. Admins

Route:

/admin/admins

Показывать:

admin;

role;

permissions;

created;

last login;

status.

Detail:

Profile

Permissions

Sessions

Audit Log.

---

# 19. Roles / RBAC

Route:

/admin/roles

Подготовить UI RBAC.

Пример ролей:

Super Admin
Administrator
Moderator
Support
Read Only

Permissions сделать granular.

Примеры:

users.read
users.suspend
users.ban
users.delete

messages.read
messages.delete

reports.read
reports.resolve

groups.read
groups.manage

media.read
media.delete

admins.read
admins.manage

system.read
system.manage

audit.read

security.read

UI permissions сделать группами с checkbox.

На frontend должна быть абстракция:

can(permission)

Например:

can("users.ban")

Не размазывать проверки ролей строками по всему приложению.

---

# 20. Audit Log

Route:

/admin/audit

Очень важный раздел.

Любое административное действие в будущем должно логироваться.

Таблица:

timestamp

admin

action

target type

target ID

IP

result.

Пример actions:

USER_VIEWED
USER_BANNED
USER_UNBANNED
MESSAGE_DELETED
REPORT_RESOLVED
ROLE_CHANGED
ADMIN_CREATED
SETTING_CHANGED

Detail drawer должен показывать:

metadata;

reason;

request ID;

before;

after.

Для JSON сделать аккуратный JSON viewer.

---

# 21. Sessions / Security

Route:

/admin/security/sessions

Показывать пользовательские и административные sessions.

Поля:

user/admin;

session ID;

IP;

device;

OS;

browser/app;

country placeholder;

created;

last active;

expires.

Actions:

Revoke Session

Revoke All Sessions.

---

# 22. System

Route:

/admin/system

Карточки:

API
Auth
WebSocket
PostgreSQL
Redis
Object Storage
Workers

Показатели:

status

latency

uptime

version.

Подготовить UI для будущих metrics, но не пытаться самостоятельно реализовывать полноценный Prometheus/Grafana.

Можно сделать небольшие stat cards и sparkline placeholders.

---

# 23. Settings

Route:

/admin/settings

Разделить настройки по категориям:

General

Registration

Security

Moderation

Media

Limits

Maintenance.

Примеры будущих настроек:

registration enabled;

file upload limit;

maximum group size;

maximum message length;

invite enabled;

maintenance mode.

Сейчас только mock interface.

Для опасных настроек использовать отдельный Danger Zone.

---

# 24. UX для таблиц

Создать единый reusable DataTable.

Он должен поддерживать:

sorting;

filters;

pagination;

loading;

empty state;

error state;

row actions;

selection;

responsive column handling.

Не писать для каждой страницы отдельную самодельную таблицу с одинаковой логикой.

---

# 25. Общие компоненты

Создать reusable UI components примерно следующего уровня:

AppShell

Sidebar

Topbar

Breadcrumbs

PageHeader

DataTable

StatCard

StatusBadge

UserBadge

Avatar

FilterBar

SearchInput

DateRangePicker

ConfirmDialog

ActionDialog

Drawer

Tabs

EmptyState

ErrorState

LoadingState

JsonViewer

Timeline

PermissionGate

CopyButton

IDDisplay

Tooltip

DropdownMenu

Pagination

Toast/Notifications.

Если используемая UI library уже предоставляет эти элементы — создать thin wrapper там, где это оправдано.

---

# 26. Работа с ID

В админке постоянно будут использоваться длинные ID.

Создать компонент:

<IDDisplay />

Который:

показывает сокращённое значение;

по hover показывает полностью;

по click позволяет скопировать ID.

Пример:

usr_8f3c...92bd

[copy]

Использовать такой компонент для:

User ID
Message ID
Chat ID
Report ID
Session ID
File ID.

---

# 27. Mock architecture

Mock-data нельзя писать огромными объектами непосредственно внутри page components.

Создать структуру вида:

mocks/
users.ts
chats.ts
reports.ts
messages.ts
admins.ts
system.ts

Или использовать mock service layer.

Страницы не должны знать, реальные данные они получают или mock.

Например:

services/
users.service.ts
chats.service.ts
reports.service.ts
moderation.service.ts

На первом этапе service может возвращать mock data.

Позже его можно заменить HTTP-вызовами.

---

# 28. API architecture

Создать заготовку API client.

Например:

api/
client
users
chats
reports
moderation
admin
system

Не хардкодить fetch прямо внутри React components.

Заложить:

loading;

errors;

pagination;

filters;

AbortSignal/cancellation;

401;

403;

429;

5xx.

Не придумывать реальные backend endpoints, если их ещё нет.

Можно определить frontend interfaces / service contracts.

---

# 29. Типизация

Использовать TypeScript.

Создать нормальные types/interfaces.

Например:

User

UserStatus

AdminUser

AdminRole

Permission

Chat

Message

Report

ModerationAction

Ban

Session

AuditEvent

MediaFile

ServiceStatus.

Не использовать `any`, кроме действительно неизбежных мест.

---

# 30. URL и состояние

Фильтры таблиц желательно хранить в URL query params.

Например:

/admin/users?status=banned&page=2&search=test

Это позволит:

копировать ссылку;

возвращаться назад;

перезагружать страницу без потери фильтра.

---

# 31. Состояния интерфейса

Каждая крупная страница должна нормально выглядеть при:

loading;

empty;

error;

permission denied;

normal data.

Не ограничиваться happy path.

---

# 32. Confirmation UX

Опасные действия:

Ban User
Delete Message
Delete Media
Revoke Session
Remove Admin
Change Role

должны требовать подтверждения.

Для особо опасных действий можно использовать подтверждение вводом текста.

Например:

Type BAN to confirm.

Но применять это только для действительно серьёзных операций.

---

# 33. Reason

Moderation actions должны требовать reason.

Создать переиспользуемый ActionDialog.

Например:

Ban User

Duration:
[ 7 days ]

Reason:
[ Spam ]

Internal note:
[ ................. ]

Cancel

Confirm Ban

Поддержать future reason presets.

---

# 34. Accessibility

Не игнорировать accessibility.

Нужно:

keyboard navigation;

focus states;

labels;

aria attributes там, где необходимо;

достаточный contrast;

не использовать цвет как единственный показатель состояния.

---

# 35. Performance

Не тащить огромные зависимости ради одной маленькой функции.

Для больших таблиц структура должна позволять в будущем добавить virtualization.

Не загружать одновременно весь список пользователей/сообщений.

API contract должен предполагать server-side pagination.

---

# 36. Security архитектура frontend

Frontend не является security boundary.

Не считать скрытую кнопку защитой.

Permissions в UI нужны только для UX.

Backend впоследствии обязан отдельно проверять каждое административное действие.

Не помещать secrets/API keys в frontend.

Не сохранять чувствительные admin credentials в localStorage без необходимости.

---

# 37. Routing

Пример структуры:

/admin

/admin/users
/admin/users/:id

/admin/reports
/admin/reports/:id

/admin/chats
/admin/chats/:id

/admin/messages

/admin/groups
/admin/groups/:id

/admin/channels
/admin/channels/:id

/admin/media

/admin/bans

/admin/admins
/admin/admins/:id

/admin/roles
/admin/roles/:id

/admin/audit

/admin/security/sessions

/admin/system

/admin/settings

Создать route config централизованно.

Sidebar желательно генерировать из route/navigation config, а не дублировать вручную.

---

# 38. Структура проекта

Не обязательно буквально следовать следующей структуре, если существующий проект организован иначе, но архитектура должна иметь аналогичное разделение:

admin/
app/
pages/
components/
features/
entities/
services/
api/
hooks/
mocks/
types/
utils/
config/
styles/

Не создавать гигантскую папку components с сотней несвязанных файлов.

Предпочитать feature/domain architecture.

Например:

features/
users/
moderation/
reports/
chats/
admin-access/
system/

---

# 39. Данные

Создай реалистичные mock data:

20-50 пользователей;

несколько banned;

несколько suspended;

online/offline;

несколько администраторов;

10-20 reports;

несколько групп;

несколько чатов;

messages с text/media;

audit events;

system status.

Не использовать везде:

John Doe
[test@test.com](mailto:test@test.com)
Lorem ipsum.

Mock-данные должны выглядеть как реальные данные мессенджера.

---

# 40. Детали интерфейса

Использовать:

hover states;

tooltips;

skeleton loaders;

toast notifications;

context menus;

drawers;

modals;

badges;

subtle animations.

Animations должны быть короткими и ненавязчивыми.

Не использовать тяжёлые page transitions.

---

# 41. Responsive

Основная цель — desktop.

На маленьких экранах:

sidebar collapses;

таблицы могут горизонтально скроллиться;

важные controls не должны пропадать.

Не нужно превращать сложную admin console в идеально мобильное приложение.

---

# 42. Что НЕ делать сейчас

Не нужно:

реализовывать настоящий ban endpoint;

удалять реальные сообщения;

лезть напрямую в PostgreSQL;

подключаться напрямую к Redis;

делать admin actions через client-side DB queries;

делать собственную authentication систему, если она уже есть;

переписывать backend;

внедрять Grafana внутрь приложения;

строить сложную систему analytics;

реализовывать ML moderation;

делать fake backend, который потом придётся выбрасывать.

Нужен frontend foundation, готовый для подключения настоящего API.

---

# 43. Качество кода

Требования:

TypeScript strict-friendly;

минимум дублирования;

понятные имена;

не создавать компоненты на 1000+ строк;

бизнес-логику выносить из JSX;

использовать reusable hooks/components;

не использовать magic strings там, где подходят enum/constants;

не создавать лишних abstractions только ради архитектуры.

Баланс между чистотой и практичностью.

---

# 44. README

Добавить документацию для admin frontend.

В README описать:

как запустить;

где находятся routes;

где mock data;

где API services;

как добавить новую admin page;

как добавить пункт sidebar;

как добавить permission;

как заменить mock service на реальный endpoint;

как устроена дизайн-система.

Это важно: следующий разработчик/AI-агент должен быстро понимать архитектуру.

---

# 45. Developer-friendly architecture

Проект будет дальше дорабатываться AI coding agents, поэтому архитектура должна быть максимально очевидной.

Предпочитать:

явные типы;

простую структуру;

понятные barrel exports только там, где они реально полезны;

маленькие компоненты;

понятные service contracts;

central navigation config;

central permission config;

central route config;

central theme tokens.

Избегать скрытой магии.

---

# 46. Результат первого этапа

В конце должны реально открываться и выглядеть законченными хотя бы следующие страницы:

Dashboard

Users

User Details

Reports

Report Details

Chats

Chat Viewer

Audit Log

System Status

Settings.

Остальные разделы можно реализовать как более простые страницы-заготовки, но navigation и архитектура под них должны существовать.

Все основные страницы должны использовать mock data и быть кликабельны между собой.

Например:

Report → User

Report → Message

Message → Chat

Chat → User

User → Reports.

Это должно создавать ощущение единой админ-панели, а не набора независимых экранов.

---

# 47. Финальная проверка

После реализации:

1. Запусти lint.
2. Запусти TypeScript typecheck.
3. Запусти существующие tests, если они есть.
4. Собери production build.
5. Исправь найденные ошибки.
6. Проверь основные routes.
7. Проверь отсутствие console errors.
8. Проверь navigation.
9. Проверь dark theme.
10. Проверь loading/empty/error states хотя бы на основных страницах.

Не отключай eslint/typescript checks ради успешной сборки.

---

# 48. Отчёт после работы

После завершения дай короткий отчёт:

### Added

Что было добавлено.

### Architecture

Как устроена admin frontend архитектура.

### Routes

Какие routes появились.

### Mocks/API

Где mock data и как позже подключать backend.

### Permissions

Как устроена система permissions.

### TODO

Что имеет смысл реализовать следующим этапом.

### Files

Перечисли основные созданные/изменённые файлы.

Если во время анализа существующего проекта выяснится, что какая-либо часть этого задания конфликтует с текущей архитектурой, не ломай проект ради буквального выполнения задания. Адаптируй решение под существующую кодовую базу и объясни принятое решение.
