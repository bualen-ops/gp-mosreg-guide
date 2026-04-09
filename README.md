# Pocket Guide (mobile)

Мини-справочник по объектам из Excel-файла для просмотра на телефоне.

## Что делает

- Берет данные из `/Users/alenbubnovskiy/Downloads/Реестр_Вводных_2026.xlsx`
- Формирует `data.json`
- Открывает `index.html` с:
  - поиском по названию/типу/коду
  - фильтром по региону (ОМСУ)
  - карточкой краткой справки

## Быстрый запуск

1) Сгенерировать JSON:

```bash
python3 build_data.py
```

2) Запустить локальный сервер:

```bash
python3 -m http.server 8080
```

3) Открыть:

- на компьютере: `http://localhost:8080`
- с телефона в той же сети: `http://<IP-вашего-Mac>:8080`

## Обновление данных

Если Excel обновился, снова выполните:

```bash
python3 build_data.py
```

и перезагрузите страницу.

## Финальный деплой (gp.mosreg.alenos.ru)

Подготовлены файлы:

- `deploy_vvod26.sh` — деплой скрипт
- `nginx.vvod26.conf` — nginx конфиг

Перед деплоем:

1) DNS A-запись:

- `gp.mosreg.alenos.ru -> 5.42.116.238`

2) Рабочий SSH:

```bash
ssh timeweb-n8n "echo ok"
```

Деплой одной командой:

```bash
chmod +x deploy_vvod26.sh
./deploy_vvod26.sh
```

Проверка:

```bash
curl -I http://gp.mosreg.alenos.ru
curl -I https://gp.mosreg.alenos.ru
```
