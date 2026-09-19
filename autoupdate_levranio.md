# Автообновление Enggraph на Mini PC

## Назначение

Установка Enggraph на Mini PC (`leosrv`) настроена на проверку новых Docker-образов один раз в 24 часа и их автоматическое применение.

Upstream-проект:

- https://github.com/oberon-systems/enggraph

Используемые Docker-образы загружаются из GitHub Container Registry (GHCR), из upstream-репозитория, с тегом `latest`.

## Установка на Mini PC

Каталог проекта:

`/opt/levrangit/enggraph`

Локальная конфигурация хранится в:

`/opt/levrangit/enggraph/.env`

Файл `.env` является локальным и содержит настройки конкретной установки и секреты. Механизм автообновления **не изменяет и не заменяет** этот файл.

Данные PostgreSQL хранятся в Docker volume и не удаляются в процессе обновления.

Caddy установлен и управляется отдельно через systemd. Механизм обновления Enggraph его не изменяет.

## Скрипт обновления

Скрипт обновления:

`/usr/local/sbin/enggraph-update.sh`

Он выполняет:

1. Переходит в каталог `/opt/levrangit/enggraph`.
2. Запускает `docker compose pull` для проверки и загрузки новых Docker-образов.
3. Запускает `docker compose up -d`.
4. Записывает результат в:
   `/opt/levrangit/enggraph/enggraph-update.log`

Если образ изменился, Docker Compose автоматически пересоздаёт соответствующий контейнер. Например, если обновился образ `mcp-server`, старый контейнер `mcp-server` заменяется контейнером с новым образом и автоматически запускается.

Если новых образов нет, существующие контейнеры продолжают работать.

## Сервис systemd

Сервис:

`enggraph-update.service`

Он запускает:

`/usr/local/sbin/enggraph-update.sh`

Сервис использует:

`User=leo`

и:

`WorkingDirectory=/opt/levrangit/enggraph`

Это сервис типа `Type=oneshot`, поэтому после успешного выполнения состояние `inactive (dead)` является нормальным. Успешное выполнение имеет:

`status=0/SUCCESS`

## Таймер systemd

Таймер:

`enggraph-update.timer`

Текущее расписание:

- первый запуск: через 10 минут после загрузки Mini PC;
- последующие запуски: каждые 24 часа;
- `Persistent=true`: если Mini PC был выключен в момент запланированного запуска, systemd может выполнить пропущенную проверку после включения компьютера.

Таймер включён и в нормальном состоянии должен показывать:

`Active: active (waiting)`

Проверка:

```bash
systemctl status enggraph-update.timer --no-pager
systemctl list-timers enggraph-update.timer --no-pager
```

## Ручное обновление

Чтобы немедленно запустить обновление:

```bash
sudo systemctl start enggraph-update.service
```

Затем проверить:

```bash
systemctl status enggraph-update.service --no-pager
```

После успешного запуска oneshot-сервис обычно возвращается в состояние `inactive (dead)` с результатом `status=0/SUCCESS`.

## Журнал обновлений

Последние операции обновления записываются в:

`/opt/levrangit/enggraph/enggraph-update.log`

Посмотреть последние записи:

```bash
tail -50 /opt/levrangit/enggraph/enggraph-update.log
```

## Важная особенность архитектуры

Mini PC **не выполняет слепой `git pull` для обновления работающего Enggraph**.

Обновление работающей установки выполняется через Docker-образы, опубликованные upstream-проектом Enggraph. Это сделано намеренно:

- локальный `.env` остаётся без изменений;
- локальные данные PostgreSQL остаются без изменений;
- локальная конфигурация Caddy остаётся без изменений;
- обновляются только Docker-образы и соответствующие контейнеры;
- Mini PC получает опубликованные upstream-релизы контейнеров.

Upstream workflow публикации Docker-образов отправляет образы в GHCR в рамках workflow релизов/тегов. Поэтому появление нового коммита в upstream Git-репозитории не обязательно означает немедленное появление нового Docker-образа `latest`.

## Текущий публичный MCP endpoint

Используемый MCP endpoint:

`https://levranio.duckdns.org/mcp/enggraph`

Запросы приходят на Mini PC через HTTPS/Caddy, а затем передаются локальному шлюзу Enggraph.

Обновление `mcp-server` не требует ручного перезапуска. Если его Docker-образ изменился, команда `docker compose up -d` автоматически пересоздаёт и запускает новый контейнер `mcp-server`.

## Восстановление и диагностика

Если таймер не активен:

```bash
sudo systemctl enable --now enggraph-update.timer
```

Если обновление завершилось ошибкой:

```bash
systemctl status enggraph-update.service --no-pager
tail -100 /opt/levrangit/enggraph/enggraph-update.log
```

Не следует удалять Docker volume PostgreSQL в рамках обычной диагностики обновления.

## Конфигурация, созданная на Mini PC

Автоматическое обновление состоит из следующих systemd-файлов:

- `/usr/local/sbin/enggraph-update.sh`
- `/etc/systemd/system/enggraph-update.service`
- `/etc/systemd/system/enggraph-update.timer`

Эти файлы относятся к конфигурации развёртывания на Mini PC и автоматически не создаются upstream-репозиторием Enggraph.

## Принятое правило

Предусмотренная частота обновления — **один раз в сутки**, а не каждые несколько минут. Этого достаточно, поскольку upstream-проект публикует готовые Docker-образы через workflow релизов, а Mini PC не должен отслеживать каждый отдельный коммит исходного кода.
