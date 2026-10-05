# Agent Shell CLI

Основа агентной CLI-оболочки в стиле Claude Code. **ИИ по умолчанию отключён.**

Есть несколько сохраняемых чатов, скиллы `SKILL.md`, MCP по stdio и HTTP,
работа с файлами и терминалом через Allow / Deny / Always allow.
Под ответами агента отображаются токены, скорость и время работы.

## Запуск

Нужен Node.js 22 или новее.

```sh
git clone https://github.com/carapuzland/agent-shell-cli.git
cd agent-shell-cli
npm ci
npm run build
node dist/cli.js
```

`npm link` добавляет локальную команду `agent-shell`.

## Основные команды

```text
/help
/health
/doctor
/limits
/new Мой проект
/chats
/chat <id>
/history
/permissions
/skills create review
/skills use review
/mcp
/exit
```

Чаты сохраняют отдельную историю и выбранные скиллы. `/clear` очищает экран,
не удаляя сообщения. Пути с пробелами можно заключать в кавычки.

## Подключение провайдера

Ключ задаётся в переменной окружения до запуска оболочки. В настройках
сохраняется только имя переменной, не значение ключа.

```powershell
$env:ANTHROPIC_API_KEY = 'ваш-ключ'
node dist/cli.js
```

Затем внутри CLI:

```text
/provider set {"kind":"anthropic","model":"ИМЯ_МОДЕЛИ","keyEnv":"ANTHROPIC_API_KEY"}
/provider set {"kind":"openai","model":"ИМЯ_МОДЕЛИ","keyEnv":"OPENAI_API_KEY"}
/provider set {"kind":"openai","model":"local-model","baseUrl":"http://localhost:1234/v1"}
/provider set {"kind":"codex"}
/provider set {"kind":"claude","model":"sonnet"}
/provider disable
```

Кастомный провайдер должен поддерживать OpenAI-совместимый Chat Completions API.
Codex и Claude CLI устанавливаются и авторизуются отдельно. Они используются
для текстовых ответов; автономные вызовы инструментов оболочки доступны через
API-адаптеры. Делегирование внешнему CLI требует разрешения и имеет отдельные
ограничения безопасности — подробности в [полном README](README.md).

## Разрешения и расширения

```text
/read README.md
/write {"path":"notes.txt","content":"Привет\n"}
/run git status
/permissions reset
/skills add "C:\my-skills\review"
/mcp add local {"transport":"http","url":"http://localhost:3000/mcp"}
/mcp connect local
/mcp tools local
```

Запись показывает diff до разрешения. Always allow сохраняется для конкретной
операции и ресурса; его можно отозвать. При неинтерактивном запуске новые
запросы разрешения отклоняются. Это механизм согласования, а не системная песочница.

`/limits` показывает расход токенов по сессии, чату и провайдеру. Локальный
бюджет задаётся через `/provider budget 100000`. Если точный счётчик или
лимиты аккаунта недоступны, это явно отмечается. Скорость — измеренная
пропускная способность ответа; определение и метод оценки описаны в README.

Данные хранятся вне репозитория; `/config` показывает каталог. Для отдельного
профиля задайте `AGENT_SHELL_HOME`. Один каталог предназначен для одного
одновременно работающего экземпляра оболочки.

MIT. Подробная архитектура, настройка MCP, ограничения и проверки —
в [README.md](README.md).
