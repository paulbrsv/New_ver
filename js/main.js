document.addEventListener('DOMContentLoaded', () => {
    // Получаем ссылку на прелоадер
    const preloader = document.querySelector('.preloader');

    // Глобальный обработчик ошибок для отладки
    window.addEventListener('error', (event) => {
        console.error('Global error caught:', event.error);
    });

    // Сразу инициализируем глобальную очередь для изображений
    if (!window.imageLoadQueue) {
        // Код для инициализации очереди будет внутри utils.js
        console.log('Image queue initialized');
    }

    // Глобальная переменная для хранения состояния фильтров
    window.filterStates = new Map();

    // Инициализируем базовые компоненты
    Promise.all([
        loadComponent('components/header.html', 'header')
    ])
    .then(() => {
        // Настраиваем мобильное меню
        const burger = document.querySelector('.burger');
        const navLinks = document.querySelector('.nav-links');
        if (burger && navLinks) {
            burger.addEventListener('click', () => {
                navLinks.classList.toggle('active');
            });

            // Закрываем меню при клике вне его
            document.addEventListener('click', (e) => {
                if (navLinks.classList.contains('active') &&
                    !navLinks.contains(e.target) &&
                    !burger.contains(e.target)) {
                    navLinks.classList.remove('active');
                }
            });
        }

        // Загружаем конфигурацию и инициализируем приложение
        const citySelect = document.querySelector('#city-select');
        if (citySelect) {
            fetch('data/config.json')
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to load config: ${response.status} ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(config => {
                    // Сохраняем конфигурацию глобально
                    window.appConfig = config;

                    // Настраиваем селектор городов (делаем последовательно для ограничения нагрузки)
                    const setupCityOptions = (cities, index = 0) => {
                        if (index >= cities.length) return Promise.resolve();

                        const city = cities[index];
                        const option = document.createElement('option');
                        option.textContent = city.name;
                        if (city.disabled) {
                            option.disabled = true;
                        }
                        citySelect.appendChild(option);

                        return new Promise(resolve => setTimeout(() => {
                            resolve(setupCityOptions(cities, index + 1));
                        }, 10));
                    };

                    // Настраиваем навигационные ссылки последовательно
                    const setupNavLinks = (links, container, index = 0) => {
                        if (!container || index >= links.length) return Promise.resolve();

                        const link = links[index];
                        const a = document.createElement('a');
                        a.href = link.href;
                        a.textContent = link.label;
                        container.appendChild(a);

                        return new Promise(resolve => setTimeout(() => {
                            resolve(setupNavLinks(links, container, index + 1));
                        }, 10));
                    };

                    // Последовательная инициализация компонентов с небольшими задержками
                    setupCityOptions(config.content.cities)
                        .then(() => {
                            const navLinksContainer = document.querySelector('#nav-links');
                            return setupNavLinks(config.content.navLinks, navLinksContainer);
                        })
                        .then(() => {
                            // Настраиваем футер если он есть
                            const footerContent = document.querySelector('#footer-content');
                            if (footerContent) {
                                footerContent.textContent = config.content.footerText;
                            }

                            console.log('UI components initialized');

                            // Инициализируем карту с задержкой
                            return new Promise(resolve => {
                                setTimeout(() => {
                                    console.log('Initializing map...');
                                    window.map = initMap(config);
                                    resolve();
                                }, 100);
                            });
                        })
                        .then(() => {
                            // Создаем маркеры и иконки
                            const markers = createMarkers(config);
                            const defaultIcon = createDefaultIcon(config);
                            const customIcon = createCustomIcon(config);

                            // Добавляем слой маркеров на карту
                            window.map.addLayer(markers);

                            // Настраиваем обработку кластеров
                            setupClusterInteraction(markers, window.map);

                            // Загружаем данные о местах с небольшой задержкой
                            return new Promise(resolve => {
                                setTimeout(() => {
                                    console.log('Loading places data...');
                                    fetch('data/places.json')
                                        .then(response => {
                                            if (!response.ok) {
                                                throw new Error(`Failed to load places: ${response.status} ${response.statusText}`);
                                            }
                                            return response.json();
                                        })
                                        .then(places => {
                                            resolve({ places, markers, defaultIcon, customIcon });
                                        })
                                        .catch(error => {
                                            console.error('Error loading places:', error);
                                            resolve({ places: [], markers, defaultIcon, customIcon });
                                        });
                                }, 200);
                            });
                        })
                        .then(({ places, markers, defaultIcon, customIcon }) => {
                            console.log('Places loaded:', places.length);

                            // Инициализируем список мест с задержкой
                            return new Promise(resolve => {
                                setTimeout(() => {
                                    // Сохраняем функцию обновления списка глобально
                                    window.updatePlacesList = initPlaces(config, places, window.map, markers, defaultIcon, customIcon);
                                    resolve({ places, markers });
                                }, 200);
                            });
                        })
                        .then(({ places, markers }) => {
                            // Инициализируем фильтры с задержкой
                            return new Promise(resolve => {
                                setTimeout(() => {
                                    initFilters(config, window.updatePlacesList)
                                        .then(() => {
                                            console.log('Filters initialized');
                                            resolve({ places, markers });
                                        })
                                        .catch(error => {
                                            console.error('Error initializing filters:', error);
                                            resolve({ places, markers });
                                        });
                                }, 300);
                            });
                        })
                        .then(({ places, markers }) => {
                            // Настраиваем позицию списка мест
                            adjustPlacesListPosition();

                            // Обработка URL-параметров с задержкой
                            setTimeout(() => {
                                const urlParams = new URLSearchParams(window.location.search);
                                const placeParam = urlParams.get('place');

                                if (placeParam) {
                                    console.log('Opening place from URL:', placeParam);
                                    // Находим место по ID или имени
                                    const place = places.find(p =>
                                        p.id === placeParam ||
                                        p.name.toLowerCase() === placeParam.toLowerCase());

                                    if (place) {
                                        // Центрируем карту на месте
                                        window.map.setView([place.lat, place.lng], 16);

                                        // Находим маркер
                                        let targetMarker;
                                        markers.eachLayer(marker => {
                                            if (marker.placeData &&
                                                marker.placeData.name === place.name) {
                                                targetMarker = marker;
                                            }
                                        });

                                        // Открываем попап для этого места
                                        if (targetMarker) {
                                            setTimeout(() => {
                                                targetMarker.fireEvent('click');
                                            }, 500);
                                        }
                                    }
                                }

                                // Скрываем прелоадер после завершения всей инициализации
                                if (preloader) {
                                    preloader.classList.add('fade-out');
                                    setTimeout(() => {
                                        preloader.style.display = 'none';
                                    }, 500);
                                }
                            }, 500);
                        })
                        .catch(error => {
                            console.error('Error in initialization chain:', error);

                            // Скрываем прелоадер даже при ошибке
                            if (preloader) {
                                preloader.classList.add('fade-out');
                                setTimeout(() => {
                                    preloader.style.display = 'none';
                                }, 500);
                            }
                        });
                })
                .catch(error => {
                    console.error('Error loading config:', error);

                    // Скрываем прелоадер при ошибке
                    if (preloader) {
                        preloader.classList.add('fade-out');
                        setTimeout(() => {
                            preloader.style.display = 'none';
                        }, 500);
                    }
                });
        }
    })
    .catch(error => {
        console.error('Error loading components:', error);

        // Скрываем прелоадер при ошибке
        if (preloader) {
            preloader.classList.add('fade-out');
            setTimeout(() => {
                preloader.style.display = 'none';
            }, 500);
        }
    });

    // Initialize the nearby button for mobile
const nearbyBtn = document.querySelector('.nearby-btn');
if (nearbyBtn) {
    // Optionally set text from config if available
    if (window.appConfig && window.appConfig.content && window.appConfig.content.buttonLabels && window.appConfig.content.buttonLabels.showNearby) {
        nearbyBtn.textContent = window.appConfig.content.buttonLabels.showNearby;
    } else {
        nearbyBtn.textContent = "Show nearby";
    }

    // Add click handler for location request
    nearbyBtn.addEventListener('click', () => {
        // Show loading indicator on the button
        const originalText = nearbyBtn.textContent;
        nearbyBtn.textContent = "Loading...";
        nearbyBtn.disabled = true;

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    const userLat = position.coords.latitude;
                    const userLng = position.coords.longitude;

                    console.log('Got user location:', userLat, userLng);

                    // Center map on user location and zoom in
                    if (window.map) {
                        window.map.setView([userLat, userLng], 16, { animate: true });
                    }

                    // Reset button
                    nearbyBtn.textContent = originalText;
                    nearbyBtn.disabled = false;
                },
                error => {
                    console.error('Geolocation error:', error);

                    // Show error message based on the error code
                    let errorMessage = "Unable to access your location.";

                    if (error.code === 1) {
                        errorMessage = "Location access denied. Please check your browser settings.";
                    } else if (error.code === 2) {
                        errorMessage = "Location unavailable. Please try again.";
                    } else if (error.code === 3) {
                        errorMessage = "Location request timed out. Please try again.";
                    }

                    alert(errorMessage);

                    // Reset button
                    nearbyBtn.textContent = originalText;
                    nearbyBtn.disabled = false;
                },
                {
                    // Options for geolocation request
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            alert('Geolocation is not supported by your browser.');
            nearbyBtn.textContent = originalText;
            nearbyBtn.disabled = false;
        }
    });
}

    // Резервный таймаут для скрытия прелоадера в случае непредвиденных проблем
    setTimeout(() => {
        if (preloader && !preloader.classList.contains('fade-out')) {
            console.warn('Forcing preloader hide after timeout');
            preloader.classList.add('fade-out');
            setTimeout(() => {
                preloader.style.display = 'none';
            }, 500);
        }
    }, 10000); // 10 секунд максимальное время загрузки
});
