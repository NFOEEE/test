# DigitDraw — распознавание нарисованных цифр

Веб-сайт с холстом 300×300 и нейросетью, обученной на MNIST. Нарисуйте цифру от 0 до 9 — модель распознает её.

## Быстрый старт (локально)

```bash
pip install -r requirements.txt
python train_model.py   # только если нет model/weights.json
python start_server.py
```

Откройте http://localhost:8080

## Загрузка на GitHub

1. Установите [Git](https://git-scm.com/download/win)
2. Создайте репозиторий на [github.com/new](https://github.com/new)
3. В папке проекта выполните:

```bash
git init
git add .
git commit -m "Digit recognition web app"
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/ИМЯ_РЕПО.git
git push -u origin main
```

## Открыть на другом компьютере

**Вариант A — скачать и запустить локально:**

```bash
git clone https://github.com/ВАШ_ЛОГИН/ИМЯ_РЕПО.git
cd ИМЯ_РЕПО
pip install -r requirements.txt
python start_server.py
```

**Вариант B — GitHub Pages (без установки Python):**

1. На GitHub: **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: **main**, folder: **/ (root)**
4. Сайт будет доступен по адресу: `https://ВАШ_ЛОГИН.github.io/ИМЯ_РЕПО/`

На GitHub Pages модель (`model/weights.json`) уже в репозитории — дополнительно обучать не нужно.

## Структура

| Файл | Описание |
|------|----------|
| `index.html` | Страница сайта |
| `app.js` | Рисование и распознавание |
| `style.css` | Стили |
| `model/weights.json` | Веса нейросети |
| `train_model.py` | Обучение модели (~1 мин) |
| `start_server.py` | Локальный сервер |
