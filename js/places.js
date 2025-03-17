function initPlaces(config, places, map, markers, defaultIcon, customIcon) {
    const placesList = document.querySelector('.places-list');
    const showListBtn = document.querySelector('.show-list-btn');
    const closeBtn = document.querySelector('.close-btn');
    const mapPopupMobile = document.querySelector('.map-popup-mobile');
    let activeMarker = null;

    // Сохраняем ссылку на активный маркер глобально
    window.activeMarker = null;

    showListBtn.textContent = config.content.buttonLabels.showList;
    closeBtn.textContent = config.content.buttonLabels.close;

    showListBtn.addEventListener('click', () => {
        placesList.classList.add('active');
        if (window.innerWidth <= 768 && mapPopupMobile.classList.contains('active')) {
            mapPopupMobile.classList.remove('active');
            mapPopupMobile.style.display = 'none';
            resetActiveMarker();
        }
    });

    closeBtn.addEventListener('click', () => {
        placesList.classList.remove('active');
    });

    // Функция для сброса активного маркера
    function resetActiveMarker() {
        if (activeMarker) {
            activeMarker.setIcon(defaultIcon);
            activeMarker = null;
            window.activeMarker = null;
        }
    }

    // Настраиваем IntersectionObserver для ленивой загрузки
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;

                // Добавляем класс для анимации появления
                element.classList.add('visible');

                // Обрабатываем все изображения в видимом элементе по одному, с приоритизацией
                const images = Array.from(element.querySelectorAll('img[data-src]'));

                // Начинаем с первого изображения, остальные добавятся в очередь
                if (images.length > 0) {
                    loadImageWithFallback(images[0]);

                    // Добавляем остальные изображения в очередь с небольшой задержкой
                    if (images.length > 1) {
                        setTimeout(() => {
                            images.slice(1).forEach(img => {
                                loadImageWithFallback(img);
                            });
                        }, 100);
                    }
                }

                // Прекращаем наблюдение за этим элементом
                observer.unobserve(element);
            }
        });
    }, {
        root: null,
        rootMargin: '100px', // Увеличиваем область предзагрузки для лучшего UX
        threshold: 0.1
    });

    // Функция для создания и привязки попапа к маркеру
    function createMarkerPopup(marker, place) {
        const popupContent = document.createElement('div');
        popupContent.classList.add('place-card-popup-container');
        popupContent.innerHTML = `
            <div class="place-card">
                ${renderPlaceCard(place, config.templates.placeCardPopup, config)}
            </div>
        `;

        // НЕ загружаем изображения сразу - они будут загружены только при открытии попапа

        // Привязываем попап к маркеру с отложенной загрузкой изображений
        marker.bindPopup(popupContent, {
            maxWidth: 500,
            className: 'place-popup',
            closeButton: true,
            autoClose: true,
            closeOnClick: false
        });

        // Загружаем изображения только при открытии попапа
        marker.on('popupopen', () => {
            const popupImages = popupContent.querySelectorAll('img[data-src]');
            popupImages.forEach(img => {
                loadImageWithFallback(img);
            });
        });

        return popupContent;
    }

    // Обработчик клика по маркеру
    function handleMarkerClick(marker, place) {
        console.log('Marker clicked:', place.name);

        if (activeMarker && activeMarker !== marker) {
            // Сбрасываем предыдущий активный маркер
            activeMarker.setIcon(defaultIcon);
            if (window.innerWidth > 768) {
                activeMarker.closePopup();
            } else {
                mapPopupMobile.classList.remove('active');
                mapPopupMobile.style.display = 'none';
            }
        }

        // Устанавливаем новый активный маркер
        marker.setIcon(customIcon);
        activeMarker = marker;
        window.activeMarker = marker;

        // Центрируем карту на маркере
        map.setView(marker.getLatLng(), 16, { animate: true });

        // Показываем информацию о месте
        if (window.innerWidth <= 768) {
            // Мобильный попап
            showMobilePopup(place, marker);
        } else {
            // Десктопный попап
            setTimeout(() => {
                marker.openPopup();
            }, 300);
        }
    }

    // Функция для показа мобильного попапа
    function showMobilePopup(place, marker) {
        const popupContent = renderPlaceCard(place, config.templates.placeCardPopup, config);

        mapPopupMobile.innerHTML = `
            <div class="place-card">
                ${popupContent}
                <button class="close-btn-mobile">×</button>
            </div>
        `;

        // Отображаем попап
        mapPopupMobile.classList.add('active');
        mapPopupMobile.style.display = 'flex';

        // Загружаем изображения ПОСЛЕ отображения попапа
        setTimeout(() => {
            const mobileImages = mapPopupMobile.querySelectorAll('img[data-src]');
            mobileImages.forEach(img => {
                loadImageWithFallback(img);
            });
        }, 50);

        // Добавляем обработчик для кнопки закрытия
        const closeBtn = mapPopupMobile.querySelector('.close-btn-mobile');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Предотвращаем всплытие клика
                mapPopupMobile.classList.remove('active');
                mapPopupMobile.style.display = 'none';
                resetActiveMarker();
            });
        }

        // Предотвращаем закрытие попапа при клике на его содержимое
        const placeCard = mapPopupMobile.querySelector('.place-card');
        if (placeCard) {
            placeCard.addEventListener('click', (e) => {
                e.stopPropagation(); // Предотвращаем всплытие клика
            });
        }

        // Закрываем попап при клике вне содержимого
        mapPopupMobile.addEventListener('click', () => {
            mapPopupMobile.classList.remove('active');
            mapPopupMobile.style.display = 'none';
            resetActiveMarker();
        }, { once: true });
    }

    // Основная функция обновления списка мест
    function updatePlacesList() {
        console.log('Updating places list...');

        // Очищаем список и маркеры
        placesList.innerHTML = '';
        markers.clearLayers();

        // Очищаем очередь изображений при обновлении списка
        if (window.imageLoadQueue) {
            window.imageLoadQueue.reset();
        }

        // Сбрасываем активный маркер
        resetActiveMarker();

        // Получаем активные фильтры
        const activeFilters = Array.from(document.querySelectorAll('.filter.active'))
            .map(filter => filter.dataset.attribute)
            .filter((value, index, self) => self.indexOf(value) === index); // Удаляем дубликаты

        console.log('Active filters:', activeFilters);

        // Фильтруем места по активным фильтрам
        const filteredPlaces = activeFilters.length === 0
            ? places
            : places.filter(place =>
                activeFilters.every(filter => place.attributes.includes(filter))
            );

        console.log('Filtered places count:', filteredPlaces.length);

        // Обновляем счетчики фильтров
        document.querySelectorAll('.filter').forEach(filter => {
            const filterKey = filter.dataset.attribute;
            const countElement = filter.querySelector('.filter-count');
            if (countElement) {
                const count = places.filter(place =>
                    place.attributes.includes(filterKey) &&
                    (activeFilters.length === 0 ||
                     activeFilters.filter(f => f !== filterKey) // Исключаем текущий фильтр
                                  .every(f => place.attributes.includes(f)))
                ).length;
                countElement.textContent = count;
            }
        });

        // Создаем элементы списка и маркеры с задержкой
        const createPlaceCards = (startIndex, batchSize) => {
            const endIndex = Math.min(startIndex + batchSize, filteredPlaces.length);

            for (let i = startIndex; i < endIndex; i++) {
                const place = filteredPlaces[i];

                // Создаем карточку места
                const placeCard = document.createElement('div');
                placeCard.classList.add('place-card');
                placeCard.dataset.index = i;
                placeCard.innerHTML = renderPlaceCard(place, config.templates.placeCardList, config);
                placesList.appendChild(placeCard);

                // Наблюдаем за карточкой для ленивой загрузки
                observer.observe(placeCard);

                // Создаем маркер
                const marker = L.marker([place.lat, place.lng], { icon: defaultIcon });
                marker.dataIndex = i;
                marker.placeData = place; // Сохраняем данные места в маркере
                markers.addLayer(marker);

                // Создаем попап для десктопной версии
                if (window.innerWidth > 768) {
                    createMarkerPopup(marker, place);

                    // Обработчик закрытия попапа
                    marker.on('popupclose', () => {
                        if (activeMarker === marker) {
                            marker.setIcon(defaultIcon);
                            activeMarker = null;
                            window.activeMarker = null;
                        }
                    });
                }

                // Обработчик клика по маркеру
                marker.on('click', (e) => {
                    e.originalEvent.stopPropagation();
                    handleMarkerClick(marker, place);
                });

                // Обработчик клика по карточке места
                placeCard.addEventListener('click', () => {
                    console.log('Place card clicked:', place.name);

                    // Находим маркер, соответствующий карточке
                    const selectedIndex = parseInt(placeCard.dataset.index);
                    const selectedMarker = markers.getLayers().find(m => m.dataIndex === selectedIndex);

                    if (!selectedMarker) {
                        console.error('Marker not found for place:', place.name);
                        return;
                    }

                    if (window.innerWidth > 768) {
                        // Десктопная версия
                        if (activeMarker && activeMarker !== selectedMarker) {
                            activeMarker.setIcon(defaultIcon);
                            activeMarker.closePopup();
                        }

                        selectedMarker.setIcon(customIcon);
                        activeMarker = selectedMarker;
                        window.activeMarker = selectedMarker;

                        map.setView(selectedMarker.getLatLng(), 16, { animate: true });

                        setTimeout(() => {
                            selectedMarker.openPopup();
                        }, 300);
                    } else {
                        // Мобильная версия
                        placesList.classList.remove('active'); // Скрываем список

                        if (activeMarker && activeMarker !== selectedMarker) {
                            activeMarker.setIcon(defaultIcon);
                        }

                        selectedMarker.setIcon(customIcon);
                        activeMarker = selectedMarker;
                        window.activeMarker = selectedMarker;

                        map.setView(selectedMarker.getLatLng(), 16, { animate: true });
                        showMobilePopup(place, selectedMarker);
                    }
                });
            }

            // Если есть еще места для обработки, создаем следующую партию с задержкой
            if (endIndex < filteredPlaces.length) {
                setTimeout(() => {
                    createPlaceCards(endIndex, batchSize);
                }, 50); // Небольшая задержка между партиями
            }
        };

        // Начинаем с первой партии (20 карточек)
        createPlaceCards(0, 20);

        // Настраиваем обработку кластеров
        markers.on('clusterclick', (a) => {
            console.log('Cluster clicked, child count:', a.layer.getChildCount());
            const childMarkers = a.layer.getAllChildMarkers();

            if (childMarkers.length === 1) {
                // Если в кластере только один маркер
                const marker = childMarkers[0];
                console.log('Single marker in cluster:', marker.dataIndex);

                if (activeMarker && activeMarker !== marker) {
                    activeMarker.setIcon(defaultIcon);
                    if (window.innerWidth > 768) {
                        activeMarker.closePopup();
                    } else {
                        mapPopupMobile.classList.remove('active');
                        mapPopupMobile.style.display = 'none';
                    }
                }

                // Вызываем событие клика на маркере
                marker.fireEvent('click');
            } else {
                // Просто зумим карту до 16, без spiderfy и прочих эффектов
                map.setView(a.layer.getLatLng(), 16, { animate: true });
            }
        });

        // Глобальный обработчик для мобильного попапа
        mapPopupMobile.addEventListener('click', function(e) {
            // Проверяем, был ли клик по кнопке закрытия
            if (e.target.classList.contains('close-btn-mobile')) {
                e.stopPropagation();
                mapPopupMobile.classList.remove('active');
                mapPopupMobile.style.display = 'none';
                resetActiveMarker();
            }
        });

        // Обновляем позицию списка мест
        adjustPlacesListPosition();
    }

    // Инициализация списка мест
    updatePlacesList();

    // Обработчик изменения размера окна
    window.addEventListener('resize', () => {
        const wasDesktop = window.innerWidth > 768;

        // Обновляем список при изменении режима отображения
        setTimeout(() => {
            const isDesktop = window.innerWidth > 768;
            if (wasDesktop !== isDesktop) {
                console.log('Display mode changed, updating places list...');
                updatePlacesList();
            } else {
                // Просто перенастраиваем позицию списка
                adjustPlacesListPosition();
            }
        }, 100);
    });

    return updatePlacesList;
}
