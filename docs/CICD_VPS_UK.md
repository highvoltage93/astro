# CI/CD: GitHub Actions → GHCR → VPS

## Що налаштовано в коді

Workflow `.github/workflows/publish-vps.yml` запускається на PR до `main`,
push у `main` та вручну через Actions. PR: TypeScript, регресійні тести,
production-збірки API, web і backup; без SSH і публікації образів.
Push у main: ті самі перевірки, потім публікація образів `sha-<повний SHA>`.
Деплой увімкнений лише коли repository variable `VPS_DEPLOY_ENABLED=true`.
Ручний запуск на іншій гілці не публікує і не деплоїть.

На GitHub: Settings → Rules → Rulesets для main (або Branch protection).
Вимагати Pull Request і успішний check **Release checks**, заборонити force push
і видалення main. Після першого запуску check стане доступний у списку.
Доступність правил залежить від тарифу/видимості репозиторію. Без правила
прямий push у main також запускає деплой: workflow не замінює захист гілки.
Самовільні зміни workflow прирівнюються до права на деплой; доступ до merge
мають лише довірені адміністратори. PR secrets не отримує.

## Одноразова підготовка сервера

Спочатку залишити `VPS_DEPLOY_ENABLED` відсутньою або `false`.
Після публікації змін отримати їх на VPS звичайним SSH користувачем ubuntu:

```bash
cd /opt/astro
sudo git pull --ff-only
sudo install -o root -g root -m 755 deploy/vps/deploy.sh /usr/local/sbin/astro-deploy
sudo install -o root -g root -m 755 deploy/vps/ssh-deploy-command.sh /usr/local/bin/astro-deploy-ssh
sudo adduser --disabled-password --gecos '' astro-deploy
sudo install -d -o root -g root -m 755 /home/astro-deploy/.ssh
sudo install -o root -g root -m 600 /dev/null /home/astro-deploy/.ssh/authorized_keys
sudo nano /etc/sudoers.d/astro-deploy
```

Якщо користувач або authorized_keys уже існує, не створювати/не обнуляти його
повторно. У sudoers додати лише:

```sudoers
astro-deploy ALL=(root) NOPASSWD: /usr/local/sbin/astro-deploy
```

```bash
sudo chmod 440 /etc/sudoers.d/astro-deploy
sudo visudo -cf /etc/sudoers.d/astro-deploy
```

Не додавати astro-deploy до docker/sudo груп. Цей користувач не повинен мати
права запису до `/opt/astro`, production .env/compose, Caddyfile чи встановлених
скриптів. Перевірити також права батьківських каталогів. Ubuntu залишається
окремим адміністративним доступом. Файли .env та .env.backup: root, режим 600.

На своєму комп'ютері створити **окремий**, не особистий SSH-ключ:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/zoria-actions -C zoria-actions
```

Для автоматизації ключ без passphrase; захист забезпечують GitHub Secrets і
forced command. Приватний ключ не надсилати в чат і не додавати до Git.
У `/home/astro-deploy/.ssh/authorized_keys` додати один рядок із публічним ключем:

```text
restrict,command="/usr/local/bin/astro-deploy-ssh" ssh-ed25519 AAAA... zoria-actions
```

SSH-сервер потребує доступу до root-owned authorized_keys від імені користувача:

```bash
sudo chmod 644 /home/astro-deploy/.ssh/authorized_keys
```

Файл містить лише публічний ключ; писати в нього може тільки root. Домашній
каталог теж не повинен дозволяти astro-deploy підмінити .ssh:

```bash
sudo chown root:root /home/astro-deploy
sudo chmod 755 /home/astro-deploy
```

## GHCR та бекап

### Тимчасовий локальний режим

За явним рішенням власника можна відкласти зовнішнє сховище. У production
`.env` додати рівно один рядок без лапок і пробілів:

```ini
BACKUP_MODE=local
```

Оновити `deploy/vps/compose.yaml` і встановлений `/usr/local/sbin/astro-deploy`
з поточної версії репозиторію. У local-режимі .env.backup та S3 не потрібні:
скрипт передає BACKUP_ENV_FILE=/dev/null і не завантажує backup-образ.
Він створює дамп у /var/backups/astro (каталог 700, файл 600, власник root),
перевіряє pg_dump, непорожній файл, pg_restore --list та читання всього вмісту
через pg_restore --file=/dev/null. Жодна з цих перевірок не відновлює БД.
Тільки після успіху файл перейменовується з .partial у .dump та починається
зупинка застосунку й міграція. Помилка зупиняє деплой; неповний .partial
можна видалити вручну після діагностики.

Це перевірка читабельності архіву, НЕ повний тест відновлення. Дамп не
зашифрований, зберігається тільки на VPS і не захищає від втрати цього сервера.
Копії автоматично не видаляються: контролювати вільне місце; при заповненні
диска бекап і деплой завершаться помилкою. Плановий run-backup.sh залишається
скриптом зовнішніх бекапів; local-режим тут діє лише перед деплоєм.

Щоб повернути обов'язковий зовнішній бекап, налаштувати .env.backup і змінити
рядок на BACKUP_MODE=offsite. За відсутності BACKUP_MODE використовується
offsite. Невідомий режим або дубль BACKUP_MODE блокує запуск.

### Зовнішній режим (offsite)

Спочатку вручну запустити workflow на main із вимкненим деплоєм. Дочекатися
успішних перевірок і трьох образів. Для приватних пакетів виконати на VPS
`sudo docker login ghcr.io -u <GitHub-login>` і ввести токен з `read:packages`
у password prompt. Не використовувати токен із правом запису або токен у команді.
Публічні образи не потребують login. Root Docker має бачити credentials.

До увімкнення деплою обов'язково налаштувати `.env.backup` і успішно виконати
незалежний зашифрований бекап через `run-backup.sh`. Потрібні S3-сумісне сховище,
age public recipient, credentials та URL моніторингу. Секретний age-ключ
зберігати поза VPS. `.deployed-tag` повинен відповідати поточній робочій версії;
її backup-образ має бути доступний. Відсутність бекапу блокує деплой, а не
перемикає його мовчки на ненадійний режим. Окремо провести тест відновлення.

## GitHub Secrets і запуск

Settings → Secrets and variables → Actions → Repository secrets:

| Secret | Значення |
| --- | --- |
| VPS_HOST | 185.126.114.180 |
| VPS_PORT | 22 |
| VPS_USER | astro-deploy |
| VPS_SSH_KEY | Повний вміст приватного ~/.ssh/zoria-actions |
| VPS_KNOWN_HOSTS | Перевірений рядок SSH host key сервера |

Host key не довіряти сліпо через ssh-keyscan. Через уже довірену SSH-сесію або
консоль провайдера отримати fingerprint:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
sudo cat /etc/ssh/ssh_host_ed25519_key.pub
```

VPS_KNOWN_HOSTS для порту 22: `185.126.114.180 ssh-ed25519 AAAA...` із ключем
цього сервера. Для іншого порту: `[185.126.114.180]:PORT ssh-ed25519 AAAA...`.
Секрети БД і JWT залишаються на VPS; GitHub для збірки їх не потребує.

Після підготовки встановити repository variable `VPS_DEPLOY_ENABLED=true`.
Перший запуск зробити вручну на main і стежити за Actions. Далі merge PR
запускатиме весь ланцюжок. Перший запуск і захист main потребують налаштувань
власником GitHub; додавання YAML саме по собі їх не вмикає.

## Порядок і відмова

Сервер не виконує git pull і не збирає код. Скрипт завантажує лише api/web/
migrate/backup заданого SHA, не оновлює Postgres чи Caddy. Конфігурація VPS
і встановлений скрипт оновлюються адміністратором окремо після review;
зміни compose не поширюються автоматично разом з образом.

Завантаження й зовнішній бекап відбуваються при працюючому застосунку.
Далі web/api зупиняються, виконуються міграції та запуск із healthcheck.
На цей час можливий 502 через Caddy. Після успіху оновлюються IMAGE_TAG у .env,
.deployed-tag і .previous-tag. .attempted-tag зберігає спробу. flock на сервері
та concurrency в Actions захищають від одночасних запусків. Перед SSH workflow
перевіряє, що SHA все ще є вершиною main; застарілий rerun відхиляється.

Якщо завантаження/бекап не пройшли, стара версія залишається працювати.
Якщо збій стався після зупинки чи міграцій, workflow червоний і потрібне
втручання адміністратора: автоматичного відкату коду/БД немає. Бекап зроблено
до зупинки записів: останні записи між snapshot і stop не входять у цей бекап.
Відновлення БД — окреме рішення з оцінкою втрати даних, не стандартний rollback.

Для відкату образів спочатку підтвердити сумісність старого коду з поточною
схемою. Потім через ubuntu використати попередній тег для api/web та
`up -d --no-deps --pull never --wait api web`, узгодивши .env і .deployed-tag.
Не запускати старі міграції як спосіб downgrade. Не видаляти попередні образи
до завершення перевірки нової версії. Системні оновлення та restore drills
залишаються окремими операціями.
