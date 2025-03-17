function initMap(config) {
    // Создаем карту с дополнительными опциями для улучшенной отзывчивости
    const map = L.map('map', {
        center: config.mapSettings.center,
        zoom: config.mapSettings.initialZoom,
        scrollWheelZoom: true,
        closePopupOnClick: true,
        tap: true, // Включаем нативную поддержку тач-событий
        attributionControl: false, // Отключаем стандартный контрол атрибуции
        zoomControl: false // Отключаем стандартный контрол зума
    });

    // Добавляем тайл-слой с дополнительными настройками
    L.tileLayer(config.mapSettings.tileLayer.url, {
        attribution: config.mapSettings.tileLayer.attribution,
        subdomains: config.mapSettings.tileLayer.subdomains,
        maxZoom: config.mapSettings.maxZoom,
        minZoom: config.mapSettings.initialZoom - 2, // Устанавливаем минимальный зум
        preferCanvas: true // Использование canvas для рендеринга
    }).addTo(map);

    // Добавляем собственный контрол атрибуции с фиксированным позиционированием
    L.control.attribution({
        position: 'bottomright',
        prefix: false
    }).addTo(map);

    // Добавляем обработчик клика по карте для закрытия всех попапов
    map.on('click', () => {
        map.closePopup();
    });

    // Улучшенная функция обновления размера карты
    function updateMapSize() {
        // Принудительное обновление размера с небольшой задержкой
        setTimeout(() => {
            map.invalidateSize({
                debounceMoveend: true,
                pan: false
            });
        }, 100);
    }

    // Обработчики для принудительного обновления размера
    window.addEventListener('resize', updateMapSize);
    window.addEventListener('orientationchange', updateMapSize);

    // Принудительное обновление размера при загрузке
    document.addEventListener('DOMContentLoaded', () => {
        // Несколько последовательных вызовов для надежности
        updateMapSize();
        setTimeout(updateMapSize, 100);
        setTimeout(updateMapSize, 500);
    });

    // Фикс для iOS и мобильных устройств
    function fixMobileMapRendering() {
        // Принудительное обновление слоя
        map.getContainer().style.transform = 'translateZ(0)';

        // Дополнительные стили для контейнера карты
        const mapContainer = map.getContainer();
        mapContainer.style.position = 'absolute';
        mapContainer.style.top = '0';
        mapContainer.style.left = '0';
        mapContainer.style.width = '100%';
        mapContainer.style.height = '100%';
    }

    // Применяем фикс для мобильных устройств
    fixMobileMapRendering();

    // Периодическое обновление размера для надежности
    const intervalId = setInterval(() => {
        updateMapSize();
    }, 1000);

    // Очищаем интервал при закрытии страницы
    window.addEventListener('beforeunload', () => {
        clearInterval(intervalId);
    });

    return map;
}

function createMarkers(config) {
    return L.markerClusterGroup({
        iconCreateFunction: function(cluster) {
            return L.divIcon({
                html: config.mapSettings.clusterSettings.clusterIconTemplate.replace('${cluster.getChildCount()}', cluster.getChildCount()),
                className: 'marker-cluster',
                iconSize: [30, 30]
            });
        },
        disableClusteringAtZoom: config.mapSettings.clusterSettings.disableClusteringAtZoom,
        spiderfyOnMaxZoom: false,
        maxClusterRadius: config.mapSettings.clusterSettings.maxClusterRadius,
        zoomToBoundsOnClick: false
    });
}

function createDefaultIcon(config) {
    return L.divIcon({
        className: config.markerSettings.defaultIcon.className,
        iconSize: config.markerSettings.defaultIcon.iconSize,
        iconAnchor: config.markerSettings.defaultIcon.iconAnchor
    });
}

function createCustomIcon(config) {
    return L.divIcon({
        className: config.markerSettings.customIcon.className,
        iconSize: config.markerSettings.customIcon.iconSize,
        iconAnchor: config.markerSettings.customIcon.iconAnchor,
        popupAnchor: config.markerSettings.customIcon.popupAnchor
    });
}

function setupClusterInteraction(markers, map) {
    // Сохраняем ссылку на активный маркер в глобальной области
    window.activeMarker = null;

    markers.on('clusterclick', function (event) {
        const cluster = event.layer;
        const childMarkers = cluster.getAllChildMarkers();

        if (childMarkers.length === 1) {
            // Если в кластере один маркер, имитируем клик по нему
            const marker = childMarkers[0];

            // Закрываем существующий попап если есть
            if (window.activeMarker && window.activeMarker !== marker) {
                window.activeMarker.fireEvent('popupclose');
                window.activeMarker.setIcon(createDefaultIcon(window.appConfig));
                if (window.activeMarker._popup) {
                    window.activeMarker.closePopup();
                }
            }

            marker.fireEvent('click');
            return;
        }

        // Для кластеров с несколькими маркерами - просто зумим до 16
        map.setView(cluster.getLatLng(), 16, { animate: true });
    });

    // Обновляем кластеры при изменении зума
    map.on('zoomend', () => {
        // Просто обновляем кластеры, не добавляя никаких эффектов
        markers.refreshClusters();
    });
}

// Упрощенная функция обновления кластеров
function refreshClustersSafely(map, markers) {
    // Просто обновляем кластеры
    markers.refreshClusters();

    // Обновляем карту
    map.invalidateSize();
}
