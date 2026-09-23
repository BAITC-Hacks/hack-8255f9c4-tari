# OrgLens — разделение проекта на 3 участников

Проект остаётся одним приложением и одним GitHub-репозиторием. Архивы участников содержат разные части одного проекта: распаковывайте их **в корень клона**, рядом с package.json. Отдельный архив не является самостоятельным приложением.

## Кто за что отвечает

| Участник | Зона | Файлы |
| --- | --- | --- |
| 1 | Интерфейс | app/page.tsx, app/layout.tsx, app/globals.css, postcss.config.mjs |
| 2 | AI и серверный API | lib/ai/provider.ts, lib/ai/analyze.ts, app/api/analyze/route.ts, app/api/config/route.ts, app/api/demo/route.ts, tests/provider.test.ts, scripts/api-smoke.mjs |
| 3 | Документы, проверка доказательств и сборка проекта | lib/documents/*, lib/schema.ts, lib/evidence.ts, lib/errors.ts, lib/demo/report.json, public/demo/*, tests/core.test.ts, package.json, package-lock.json, конфигурация, инструкции и scripts/dev.mjs |

Полные списки — `team/participant-1.txt`, `team/participant-2.txt`, `team/participant-3.txt`. Каждый файл закреплён только за одним участником.

- Участник 1 отвечает за загрузку, dashboard, вкладки, отображение цитат и адаптивность.
- Участник 2 отвечает за вызовы AI, извлечение сущностей, смысловое сравнение, прогресс и ошибки API.
- Участник 3 отвечает за parsing PDF/DOCX, номера пунктов и страниц, проверку цитат, демопример и запуск всего приложения. Он также объединяет изменения команды.

## Вариант А: вы хотите загрузить готовый код тремя отдельными коммитами

Используйте этот порядок, если GitHub-репозиторий пока пустой. На GitHub создайте **один пустой репозиторий без README, .gitignore и лицензии**, добавьте двух остальных участников как collaborators. Адрес репозитория ниже замените настоящим; команды с `ССЫЛКА_НА_РЕПОЗИТОРИЙ` не запускайте буквально.

Каждый участник делает коммит со своего компьютера и своего GitHub-аккаунта. Мы не подменяем авторство и не создаём коммиты от имени других людей. Код подготовлен с помощью AI; разбиение показывает, кто отвечает за проверку и дальнейшую доработку части проекта.

### Сначала участник 3: основа

1. Клонировать пустой репозиторий:

```sh
git clone ССЫЛКА_НА_РЕПОЗИТОРИЙ ai-org-analyzer
cd ai-org-analyzer
```

2. Распаковать `participant-3-documents-core.zip` **прямо в эту папку**. Например, путь должен стать `ai-org-analyzer/lib/schema.ts`, а не `ai-org-analyzer/participant-3/lib/schema.ts`.
3. Выполнить:

```sh
git branch -M main
git add --pathspec-from-file=team/participant-3.txt
git diff --cached --stat
git commit -m "Add document parsing, evidence validation and project foundation"
git push -u origin main
```

После этого основа на GitHub есть. На этом промежуточном шаге приложение ещё не собирается: нужно добавить обе остальные части.

### Затем участник 1: интерфейс

Клонировать тот же репозиторий в собственную папку, перейти в неё и создать ветку:

```sh
git clone ССЫЛКА_НА_РЕПОЗИТОРИЙ ai-org-analyzer
cd ai-org-analyzer
git switch -c feature/interface
```

Распаковать `participant-1-interface.zip` в корень клона, затем:

```sh
git add --pathspec-from-file=team/participant-1.txt
git diff --cached --stat
git commit -m "Add Russian analysis dashboard and evidence interface"
git push -u origin feature/interface
```

На GitHub нажать **Compare & pull request**, выбрать `main` как base и создать Pull Request. Участник 3 проверяет список файлов и объединяет его через **Merge pull request**.

### Участник 2: AI и API

После появления основы можно работать одновременно с участником 1:

```sh
git clone ССЫЛКА_НА_РЕПОЗИТОРИЙ ai-org-analyzer
cd ai-org-analyzer
git switch -c feature/ai-api
```

Распаковать `participant-2-ai-api.zip` в корень клона, затем:

```sh
git add --pathspec-from-file=team/participant-2.txt
git diff --cached --stat
git commit -m "Add AI comparison pipeline and server API"
git push -u origin feature/ai-api
```

Создать Pull Request в `main`. Участник 3 объединяет его. После объединения **обеих частей** можно запускать и проверять приложение.

### Все получают собранную версию

```sh
git switch main
git pull --ff-only origin main
npm install
npm run dev
```

Открыть http://127.0.0.1:3000 и нажать «Открыть пример». Для фиксированного деморежима скопировать `.env.example` в `.env.local`, как описано в README. Для настоящего AI каждый участник настраивает свой локальный файл.

Проверку сборки после объединения выполняет участник 3:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:api
```

Команды предназначены для терминала в папке проекта. Нужен Git, поддерживающий `git switch` и `--pathspec-from-file` (Git 2.25+).

## Вариант Б: весь проект уже загружен на GitHub

Не загружайте архивы поверх более свежих изменений. Все клонируют **полный** репозиторий. Каждый создаёт свою рабочую ветку от актуального `main`, изменяет свои файлы, проверяет их и открывает Pull Request:

```sh
git switch main
git pull --ff-only origin main
git switch -c feature/название-реальной-задачи
```

После изменений, например для участника 1:

```sh
git add --pathspec-from-file=team/participant-1.txt
git diff --cached
git commit -m "Describe the actual interface change"
git push -u origin HEAD
```

Заменяйте имя ветки и сообщение на свою реальную задачу. Для участника 2/3 используйте соответствующий список. Если создали новый файл, добавьте его явно и согласуйте обновление списка с участником 3. Если изменений нет, Git не создаст обычный коммит — не нужны пустые коммиты ради количества.

## Как не конфликтовать

1. Не меняйте файлы другого участника без согласования.
2. `lib/schema.ts` — общий формат данных. Его меняет участник 3 после обсуждения с участниками 1 и 2.
3. `package.json` и `package-lock.json` меняет участник 3. Если нужна библиотека, попросите его добавить её отдельным коммитом; остальные после `git pull` выполняют `npm install`.
4. Коммитьте только свою часть через списки, а не `git add .`.
5. Ветки создавайте от актуального `main`; для новой задачи создавайте новую ветку. Работайте с локальными клонами, не с одной общей папкой на трёх компьютерах.
6. `.env.local`, `node_modules`, `.next`, `.git` не пересылаются в архивах и не добавляются в коммиты. Настоящих ключей в подготовленных архивах нет.
7. Если Git пишет, что не знает автора, настройте на своём компьютере своё имя и email из своего GitHub-аккаунта. Не используйте имя другого участника.

Разделение не меняет работу приложения. Никаких GitHub-публикаций, push или коммитов от имени команды автоматически не выполнено.
