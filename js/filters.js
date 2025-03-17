async function initFilters(config, updatePlacesList) {
    // Сохраняем конфигурацию глобально для доступа из других модулей
    window.appConfig = config;

    const filtersBlock = document.querySelector('.filters-block');
    const filtersContainer = document.querySelector('.filters');
    const filterLeft = document.querySelector('.filter-left');
    const filterRight = document.querySelector('.filter-right');

    if (!filterLeft || !filterRight || !filtersBlock || !filtersContainer) {
        console.error('Filter containers not found:', { filterLeft, filterRight, filtersBlock, filtersContainer });
        return;
    }

    // Функция для принудительного обновления видимости фильтров
    function forceFilterVisibility() {
        if (filtersBlock && filtersContainer) {
            // Принудительное отображение
            filtersBlock.style.display = 'block';
            filtersBlock.style.position = 'sticky';
            filtersBlock.style.top = '56px';
            filtersBlock.style.zIndex = '1000';
            filtersBlock.style.width = '100%';
            filtersBlock.style.left = '0';

            // Принудительное обновление слоя
            filtersBlock.style.transform = 'translateZ(0)';
        }

        const filtersMobile = document.querySelector('.filters-mobile');
        if (filtersMobile) {
            filtersMobile.style.display = 'flex';
            filtersMobile.style.position = 'sticky';
            filtersMobile.style.top = '56px';
            filtersMobile.style.zIndex = '1000';
            filtersMobile.style.width = '100%';
            filtersMobile.style.left = '0';
            filtersMobile.style.transform = 'translateZ(0)';
        }
    }

    // Улучшенная функция для загрузки иконок фильтров
    async function loadFilterIcons(filterList, filterContainer) {
        if (!filterList || filterList.length === 0) {
            console.error('Filter list is empty or undefined:', filterList);
            return [];
        }

        // Создаем фильтры с заглушками для иконок
        const filterElements = [];
        for (const filterData of filterList) {
            const filter = document.createElement('div');
            filter.classList.add('filter');
            filter.dataset.attribute = filterData.key;
            filter.title = filterData.tooltip;

            // Создаем контейнер для иконки, но не загружаем её сразу
            const icon = document.createElement('img');
            icon.alt = filterData.label;
            icon.className = 'filter-icon';
            icon.dataset.src = filterData.icon; // Используем data-src для отложенной загрузки

            const label = document.createElement('span');
            label.textContent = filterData.label;

            const count = document.createElement('span');
            count.className = 'filter-count';
            count.textContent = '0';

            filter.appendChild(icon);
            filter.appendChild(label);
            filter.appendChild(count);

            filterContainer.appendChild(filter);
            filterElements.push({ filter, icon, filterData });

            // Обработчик клика на фильтр
            filter.addEventListener('click', () => {
                // Сохраняем состояние в Map
                const isActive = filter.classList.toggle('active');
                window.filterStates.set(filterData.key, isActive);

                // Синхронизируем все фильтры с тем же ключом
                document.querySelectorAll(`.filter[data-attribute="${filterData.key}"]`).forEach(f => {
                    if (f !== filter) {
                        if (isActive) {
                            f.classList.add('active');
                        } else {
                            f.classList.remove('active');
                        }
                    }
                });

                updateFiltersInURL();
                window.updatePlacesList(); // Глобальная ссылка на функцию обновления списка
            });
        }

        // Загружаем иконки поэтапно, чтобы не перегружать сервер
        const loadIconsBatch = async (items, startIndex, batchSize) => {
            const endIndex = Math.min(startIndex + batchSize, items.length);

            // Загружаем иконки текущей партии последовательно
            for (let i = startIndex; i < endIndex; i++) {
                const { icon, filterData } = items[i];

                try {
                    // Загружаем изображение без добавления в DOM
                    const tempImg = new Image();

                    await new Promise((resolve, reject) => {
                        tempImg.onload = resolve;
                        tempImg.onerror = () => {
                            console.error(`Failed to load icon for filter ${filterData.label}: ${filterData.icon}`);
                            reject();
                        };
                        tempImg.src = filterData.icon;

                        // Добавляем таймаут для предотвращения бесконечного ожидания
                        setTimeout(reject, 5000);
                    }).then(() => {
                        // Успешно загружено - устанавливаем src для реальной иконки
                        icon.src = filterData.icon;
                    }).catch(() => {
                        // При ошибке используем заглушку
                        icon.src = '/data/images/placeholder.png';
                    });

                    // Небольшая пауза между загрузками в одной партии
                    await new Promise(resolve => setTimeout(resolve, 50));

                } catch (error) {
                    console.error('Error loading icon:', error);
                    icon.src = '/data/images/placeholder.png';
                }
            }

            // Если остались элементы для загрузки, запускаем следующую партию
            if (endIndex < items.length) {
                setTimeout(() => {
                    loadIconsBatch(items, endIndex, batchSize);
                }, 100); // Пауза между партиями
            }
        };

        // Запускаем загрузку первой партии иконок (по 5 за раз)
        loadIconsBatch(filterElements, 0, 5);

        return filterElements.map(item => item.filter);
    }

    // Используем Map для хранения состояния фильтров
    const filterStates = new Map();
    window.filterStates = filterStates;

    // Создаём десктопные фильтры в правильном порядке
    const leftFilters = await loadFilterIcons(config.filters.leftFilters, filterLeft);
    const rightFilters = await loadFilterIcons(config.filters.rightFilters, filterRight);

    // Добавляем кнопку сброса внутрь .filters после filter-right
    const resetButton = document.createElement('span');
    resetButton.classList.add('filter-reset', 'desktop-reset');
    const resetIcon = document.createElement('img');
    resetIcon.src = 'data/images/reset.svg';
    resetIcon.alt = 'Reset';
    resetIcon.className = 'filter-icon';
    resetButton.appendChild(resetIcon);
    filtersContainer.appendChild(resetButton);

    // Мобильная логика
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    let mobileResetButton;

    if (isMobile) {
        const filtersMobile = document.querySelector('.filters-mobile');
        if (!filtersMobile) {
            console.error('Filters-mobile container not found');
            return;
        }

        filtersContainer.style.display = 'none'; // Скрываем десктопные фильтры
        filtersMobile.style.display = 'flex'; // Показываем мобильные

        // Создаём и добавляем элементы в нужном порядке
        const mobileLeft = document.createElement('div');
        mobileLeft.classList.add('filter-left');
        filtersMobile.appendChild(mobileLeft);
        const mobileLeftFilters = await loadFilterIcons(config.filters.leftFilters.slice(0, 2), mobileLeft); // Левые фильтры

        const moreButton = document.createElement('span');
        moreButton.classList.add('more-filters-btn');
        const moreIcon = document.createElement('img');
        moreIcon.src = 'data/images/more.svg'; // Иконка для More
        moreIcon.alt = 'More';
        moreIcon.className = 'filter-icon';
        moreButton.appendChild(moreIcon);
        moreButton.appendChild(document.createTextNode(' More')); // Текст с пробелом
        filtersMobile.appendChild(moreButton); // Кнопка More

        const mobileRight = document.createElement('div');
        mobileRight.classList.add('filter-right');
        filtersMobile.appendChild(mobileRight);
        const mobileRightFilters = await loadFilterIcons(config.filters.rightFilters.slice(0, 3), mobileRight); // Правые фильтры

        mobileResetButton = document.createElement('span');
        mobileResetButton.classList.add('filter-reset', 'mobile-reset');
        const mobileResetIcon = document.createElement('img');
        mobileResetIcon.src = 'data/images/reset.svg'; // Иконка для Reset
        mobileResetIcon.alt = 'Reset';
        mobileResetIcon.className = 'filter-icon';
        mobileResetButton.appendChild(mobileResetIcon);
        filtersMobile.appendChild(mobileResetButton); // Кнопка Reset

        // Создаём попап
        const popup = document.createElement('div');
        popup.classList.add('filter-popup');
        popup.innerHTML = `
            <div class="popup-content">
                <div class="popup-left"></div>
                <div class="popup-right"></div>
                <button class="popup-close">OK</button>
            </div>
        `;
        document.body.appendChild(popup);

        // Копируем оставшиеся фильтры в попап
        const popupLeft = popup.querySelector('.popup-left');
        const popupRight = popup.querySelector('.popup-right');
        const popupLeftFilters = await loadFilterIcons(config.filters.leftFilters.slice(2), popupLeft); // Остальные из left
        const popupRightFilters = await loadFilterIcons(config.filters.rightFilters.slice(3), popupRight); // Остальные из right

        // Обработчик клика по "More"
        moreButton.addEventListener('click', () => {
            popup.classList.add('active');
        });

        // Обработчик закрытия попапа
        popup.querySelector('.popup-close').addEventListener('click', () => {
            popup.classList.remove('active');
        });

        // Предотвращаем закрытие попапа при клике на его содержимое
        popup.querySelector('.popup-content').addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Закрываем попап при клике вне содержимого
        popup.addEventListener('click', () => {
            popup.classList.remove('active');
        });
    }

    // Применяем фильтры из URL и обновляем счётчики после создания всех фильтров
    applyFiltersFromURL(() => {
        updatePlacesList(); // Вызываем после применения фильтров из URL
    });

    // Принудительное обновление видимости фильтров
    forceFilterVisibility();

    // Добавляем обработчики событий для обновления видимости
    window.addEventListener('resize', forceFilterVisibility);
    window.addEventListener('orientationchange', () => {
        setTimeout(forceFilterVisibility, 100);
    });

    // Функция для обновления URL на основе активных фильтров
    function updateFiltersInURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const activeFilters = Array.from(document.querySelectorAll('.filter.active'))
            .map(filter => filter.dataset.attribute)
            // Удаляем дубликаты
            .filter((value, index, self) => self.indexOf(value) === index);

        if (activeFilters.length) {
            urlParams.set('filter', activeFilters.join(','));
        } else {
            urlParams.delete('filter');
        }

        // Преобразуем URLSearchParams в строку и обновляем историю
        const queryString = urlParams.toString();
        const url = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
        window.history.pushState({}, '', url);
    }

    // Функция для применения фильтров из URL
    function applyFiltersFromURL(callback) {
        const urlParams = new URLSearchParams(window.location.search);
        const filtersFromURL = urlParams.get('filter');

        // Сначала сбрасываем все фильтры
        document.querySelectorAll('.filter.active').forEach(filter => {
            filter.classList.remove('active');
            filterStates.set(filter.dataset.attribute, false);
        });

        if (filtersFromURL) {
            const filterArray = filtersFromURL.split(',');
            const allFilters = document.querySelectorAll('.filter');

            allFilters.forEach(filter => {
                const isActive = filterArray.includes(filter.dataset.attribute);
                if (isActive) {
                    filter.classList.add('active');
                    filterStates.set(filter.dataset.attribute, true);
                }
            });
        }

        if (callback) callback();
    }

    // Функция сброса фильтров
    function resetAllFilters() {
        document.querySelectorAll('.filter.active').forEach(filter => {
            filter.classList.remove('active');
            filterStates.set(filter.dataset.attribute, false);
        });

        updateFiltersInURL();
        resetMap();
        updatePlacesList(); // Обновляем счётчики
    }

    // Обработчик кнопки сброса на десктопе
    resetButton.addEventListener('click', resetAllFilters);

    // Обработчик кнопки сброса на мобильном
    if (mobileResetButton) {
        mobileResetButton.addEventListener('click', resetAllFilters);
    }

    // Функция для сброса карты (используем mapSettings)
    function resetMap() {
        if (window.map && config.mapSettings) {
            const initialLat = config.mapSettings.center[0] || 45.25;
            const initialLng = config.mapSettings.center[1] || 19.84;
            const initialZoom = config.mapSettings.initialZoom || 13;

            window.map.setView([initialLat, initialLng], initialZoom);
            window.map.closePopup();

            // Если есть активный маркер, сбрасываем его иконку
            if (window.activeMarker) {
                window.activeMarker.setIcon(createDefaultIcon(config));
                window.activeMarker = null;
            }
        }
    }

    // Вызываем adjustPlacesListPosition для проверки рендеринга
    adjustPlacesListPosition();

    // Возвращаем Map с состояниями фильтров для использования в других модулях
    return filterStates;
}

function adjustPlacesListPosition() {
    const filtersBlock = document.querySelector('.filters-block');
    const placesList = document.querySelector('.places-list');
    if (filtersBlock && placesList) {
        const filtersRect = filtersBlock.getBoundingClientRect();
        const filtersHeight = filtersRect.height;
        const headerHeight = 56; // Высота шапки

        // Устанавливаем максимальную высоту с учётом шапки и фильтров (без футера)
        placesList.style.maxHeight = `calc(100vh - ${headerHeight + filtersHeight}px)`;

        // Отступ от верха должен быть 0
        placesList.style.top = '0';
    } else {
        console.warn('Filters block or places list not found for adjustment');
    }
}

// Добавляем слушатель событий для изменения размера окна
window.addEventListener('resize', () => {
    adjustPlacesListPosition();
});

// Глобальная функция для принудительного обновления видимости фильтров
window.forceFilterVisibility = function() {
    const filtersBlock = document.querySelector('.filters-block');
    const filtersMobile = document.querySelector('.filters-mobile');

    if (filtersBlock) {
        filtersBlock.style.display = 'block';
        filtersBlock.style.position = 'sticky';
        filtersBlock.style.top = '56px';
        filtersBlock.style.zIndex = '1000';
        filtersBlock.style.width = '100%';
        filtersBlock.style.left = '0';
        filtersBlock.style.transform = 'translateZ(0)';
    }

    if (filtersMobile) {
        filtersMobile.style.display = 'flex';
        filtersMobile.style.position = 'sticky';
        filtersMobile.style.top = '56px';
        filtersMobile.style.zIndex = '1000';
        filtersMobile.style.width = '100%';
        filtersMobile.style.left = '0';
        filtersMobile.style.transform = 'translateZ(0)';
    }
};
