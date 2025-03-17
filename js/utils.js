// Глобальная очередь для загрузки изображений
window.imageLoadQueue = {
    queue: [],              // Очередь изображений для загрузки
    processing: 0,          // Количество текущих загрузок
    maxConcurrent: 4,       // Максимальное количество одновременных загрузок
    retryDelay: 500,        // Задержка перед повторной попыткой в мс
    maxRetries: 3,          // Максимальное количество повторных попыток
    idleCallbacks: [],      // Список функций для вызова, когда очередь пуста

    // Добавление нового изображения в очередь
    add: function(img, fallbackSrc = '/data/images/placeholder.png') {
        if (!img || (!img.dataset.src && !img.src) || img.loadQueued) return;

        // Помечаем изображение как добавленное в очередь
        img.loadQueued = true;

        // Добавляем задачу в очередь
        this.queue.push({
            img: img,
            src: img.dataset.src || img.src,
            fallbackSrc: fallbackSrc,
            retries: 0
        });

        // Запускаем обработку очереди
        this.process();
    },

    // Обработка очереди
    process: function() {
        // Если уже достигнут лимит параллельных загрузок, выходим
        if (this.processing >= this.maxConcurrent) return;

        // Если очередь пуста, выходим
        if (this.queue.length === 0) {
            // Если нет активных загрузок, вызываем колбэки "очередь пуста"
            if (this.processing === 0) {
                this.idleCallbacks.forEach(callback => callback());
                this.idleCallbacks = [];
            }
            return;
        }

        // Получаем следующее изображение из очереди
        const task = this.queue.shift();

        // Увеличиваем счетчик активных загрузок
        this.processing++;

        // Создаем временное изображение для предзагрузки
        const tempImg = new Image();

        // Обработчик успешной загрузки
        tempImg.onload = () => {
            // Если изображение все еще присутствует в DOM
            if (document.body.contains(task.img)) {
                task.img.src = task.src;

                // Удаляем атрибут data-src, если он есть
                if (task.img.dataset.src) {
                    task.img.removeAttribute('data-src');
                }
            }

            // Уменьшаем счетчик активных загрузок
            this.processing--;

            // Продолжаем обработку очереди
            this.process();
        };

        // Обработчик ошибки
        tempImg.onerror = () => {
            // Если превышено количество попыток, используем запасное изображение
            if (task.retries >= this.maxRetries) {
                console.error(`Failed to load image after ${this.maxRetries} attempts: ${task.src}`);

                // Устанавливаем запасное изображение, если изображение все еще в DOM
                if (document.body.contains(task.img)) {
                    task.img.src = task.fallbackSrc;
                }

                // Уменьшаем счетчик активных загрузок
                this.processing--;

                // Продолжаем обработку очереди
                this.process();
                return;
            }

            // Увеличиваем счетчик попыток
            task.retries++;

            // Возвращаем задачу в очередь с задержкой
            setTimeout(() => {
                // Добавляем обратно в очередь только если изображение все еще в DOM
                if (document.body.contains(task.img)) {
                    this.queue.push(task);
                }

                // Уменьшаем счетчик активных загрузок
                this.processing--;

                // Продолжаем обработку очереди
                this.process();
            }, this.retryDelay * task.retries); // Увеличиваем задержку с каждой попыткой
        };

        // Начинаем загрузку
        tempImg.src = task.src;
    },

    // Сброс очереди (для случаев, когда нужно очистить всю очередь)
    reset: function() {
        this.queue = [];
        this.processing = 0;
    },

    // Добавление колбэка, который будет вызван, когда очередь опустеет
    onIdle: function(callback) {
        if (typeof callback === 'function') {
            if (this.queue.length === 0 && this.processing === 0) {
                // Если очередь уже пуста, вызываем сразу
                callback();
            } else {
                // Иначе добавляем в список ожидания
                this.idleCallbacks.push(callback);
            }
        }
    }
};

function renderPlaceCard(place, template, config) {
    const evaluateTemplate = new Function('place', 'config', 'return `' + template + '`');
    let html = evaluateTemplate(place, config);
    // Заменяем src на data-src для отложенной загрузки
    html = html.replace(/src="/g, 'data-src="');
    return html;
}

function loadComponent(url, elementId) {
    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load component ${url}`);
            }
            return response.text();
        })
        .then(data => {
            document.getElementById(elementId).innerHTML = data;
        })
        .catch(error => console.error(`Ошибка загрузки компонента ${elementId}:`, error));
}

// Функция для загрузки изображений с обработкой ошибок
function loadImageWithFallback(img, fallbackSrc = '/data/images/placeholder.png') {
    if (!img || (!img.dataset.src && !img.src)) return;

    // Добавляем изображение в очередь загрузки
    window.imageLoadQueue.add(img, fallbackSrc);
}
