// Инициализация Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDEXAMPLEKEY",
    authDomain: "bahrtube.firebaseapp.com",
    databaseURL: "https://flum-2-default-rtdb.firebaseio.com",
    projectId: "bahrtube",
    storageBucket: "bahrtube.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef123456"
};

// Инициализируем Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// Объект для работы с базой данных
const db = {
    // Получение всех видео
    getAllVideos: async () => {
        try {
            console.log('Получаем видео из Firebase...');
            const snapshot = await database.ref('videos').once('value');
            const videos = snapshot.val();
            console.log('Получено видео:', videos ? Object.keys(videos).length : 0);
            return videos || {};
        } catch (error) {
            console.error('Ошибка получения видео:', error);
            return {};
        }
    },

    // Поиск видео
    searchVideos: async (query) => {
        try {
            const snapshot = await database.ref('videos').once('value');
            const videos = snapshot.val() || {};
            const results = [];
            
            Object.values(videos).forEach(video => {
                if (!video) return;
                
                const title = video.title ? video.title.toLowerCase() : '';
                const channel = video.channelName ? video.channelName.toLowerCase() : '';
                const description = video.description ? video.description.toLowerCase() : '';
                const searchQuery = query.toLowerCase();
                
                if (title.includes(searchQuery) || 
                    channel.includes(searchQuery) || 
                    description.includes(searchQuery)) {
                    results.push(video);
                }
            });
            
            return results;
        } catch (error) {
            console.error('Ошибка поиска:', error);
            return [];
        }
    },

    // Добавление видео
    addVideo: async (videoData) => {
        try {
            const user = authDB ? authDB.getCurrentUser() : null;
            
            const newVideoRef = database.ref('videos').push();
            const videoId = newVideoRef.key;
            
            const videoWithId = {
                ...videoData,
                id: videoId,
                ownerId: user ? user.id : 'anonymous',
                channelId: user ? user.id : 'anonymous',
                channelName: user ? (user.channelName || 'Аноним') : 'Аноним',
                channelAvatar: user ? (user.channelAvatar || 'А') : 'А',
                timestamp: Date.now(),
                likes: 0,
                dislikes: 0,
                views: Math.floor(Math.random() * 1000),
                subscribers: 0
            };
            
            await newVideoRef.set(videoWithId);
            console.log('Видео добавлено с ID:', videoId);
            return videoId;
        } catch (error) {
            console.error('Ошибка добавления видео:', error);
            throw error;
        }
    },

    // Обновление видео
    updateVideo: async (videoId, updates) => {
        try {
            await database.ref(`videos/${videoId}`).update(updates);
        } catch (error) {
            console.error('Ошибка обновления видео:', error);
        }
    },

    // Получение видео по ID
    getVideo: async (videoId) => {
        try {
            const snapshot = await database.ref(`videos/${videoId}`).once('value');
            return snapshot.val();
        } catch (error) {
            console.error('Ошибка получения видео:', error);
            return null;
        }
    },

    // Получение видео канала
    getChannelVideos: async (channelId) => {
        try {
            const snapshot = await database.ref('videos').orderByChild('channelId').equalTo(channelId).once('value');
            return snapshot.val() || {};
        } catch (error) {
            console.error('Ошибка получения видео канала:', error);
            return {};
        }
    }
};

// Глобальные переменные
let currentVideoId = null;

// Функция извлечения YouTube ID из ссылки
function extractYouTubeId(url) {
    if (!url) return null;
    const regExp = /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[1]) ? match[1] : null;
}

// Генерация миниатюры YouTube
function generateThumbnail(videoId) {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

// Форматирование чисел
function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + ' млн';
    if (num >= 1000) return (num / 1000).toFixed(1) + ' тыс';
    return num.toString();
}

// Форматирование даты
function formatDate(timestamp) {
    if (!timestamp) return 'Недавно';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Сегодня';
    if (diffDays === 1) return 'Вчера';
    if (diffDays < 7) return `${diffDays} дня назад`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} недели назад`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} месяца назад`;
    return `${Math.floor(diffDays / 365)} года назад`;
}

// Создание карточки видео
function createVideoCard(video) {
    if (!video || !video.id) return '';
    
    const youTubeId = extractYouTubeId(video.url);
    const thumbnail = youTubeId ? generateThumbnail(youTubeId) : 'https://via.placeholder.com/320x180/252525/ffffff?text=No+Preview';
    
    return `
        <div class="video-card" onclick="openVideo('${video.id}')">
            <div class="video-thumbnail">
                <img src="${thumbnail}" alt="${video.title || 'Без названия'}" 
                     onerror="this.src='https://via.placeholder.com/320x180/252525/ffffff?text=No+Preview'">
                <div class="video-thumbnail-overlay">8:15</div>
            </div>
            <div class="video-info">
                <div class="video-details">
                    <h3>${video.title || 'Без названия'}</h3>
                    <div class="channel-name">${video.channelName || 'Неизвестный автор'}</div>
                    <div class="video-stats">
                        <span>${formatNumber(video.views || 0)} просмотров</span>
                        <span>•</span>
                        <span>${formatDate(video.timestamp)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Создание карточки рекомендации
function createRecommendationCard(video) {
    if (!video || !video.id) return '';
    
    const youTubeId = extractYouTubeId(video.url);
    const thumbnail = youTubeId ? generateThumbnail(youTubeId) : 'https://via.placeholder.com/168x94/252525/ffffff?text=No+Preview';
    
    return `
        <div class="recommendation-card" onclick="openVideo('${video.id}')">
            <div class="recommendation-thumbnail">
                <img src="${thumbnail}" alt="${video.title || 'Без названия'}" 
                     onerror="this.src='https://via.placeholder.com/168x94/252525/ffffff?text=No+Preview'">
            </div>
            <div class="recommendation-info">
                <h4>${video.title || 'Без названия'}</h4>
                <div class="recommendation-channel">${video.channelName || 'Неизвестный автор'}</div>
                <div class="recommendation-stats">
                    <span>${formatNumber(video.views || 0)} просмотров</span>
                    <span>•</span>
                    <span>${formatDate(video.timestamp)}</span>
                </div>
            </div>
        </div>
    `;
}

// Открытие видео
function openVideo(videoId) {
    window.location.href = `video.html?id=${videoId}`;
}

// УЛУЧШЕННАЯ ЗАГРУЗКА ГЛАВНОЙ СТРАНИЦЫ С РАНДОМНЫМИ РЕКОМЕНДАЦИЯМИ
async function loadHomePage() {
    console.log('Загружаем главную страницу...');
    const videoGrid = document.getElementById('video-grid');
    
    if (!videoGrid) {
        console.error('Не найден элемент video-grid');
        return;
    }
    
    try {
        // Показываем скелетоны загрузки
        videoGrid.innerHTML = `
            <div class="skeleton" style="height: 250px; border-radius: 12px;"></div>
            <div class="skeleton" style="height: 250px; border-radius: 12px;"></div>
            <div class="skeleton" style="height: 250px; border-radius: 12px;"></div>
            <div class="skeleton" style="height: 250px; border-radius: 12px;"></div>
            <div class="skeleton" style="height: 250px; border-radius: 12px;"></div>
            <div class="skeleton" style="height: 250px; border-radius: 12px;"></div>
        `;
        
        // Получаем все видео
        const videos = await db.getAllVideos();
        console.log('Видео получены:', Object.keys(videos).length);
        
        // Если нет видео, показываем сообщение
        if (!videos || Object.keys(videos).length === 0) {
            videoGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                    <i class="fas fa-video-slash" style="font-size: 48px; color: #666; margin-bottom: 20px;"></i>
                    <h3 style="margin-bottom: 16px; color: #fff;">Нет загруженных видео</h3>
                    <p style="color: #B0B0B0; margin-bottom: 24px;">Будьте первым, кто загрузит видео!</p>
                    <button onclick="checkUploadAccess()" style="padding: 14px 32px; background-color: #2E7D32; color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 16px; transition: all 0.3s;">
                        Загрузить видео
                    </button>
                </div>
            `;
            return;
        }
        
        // Преобразуем объект в массив
        const videoArray = Object.values(videos).filter(v => v && v.id);
        console.log('Массив видео:', videoArray.length);
        
        // УЛУЧШЕННЫЕ РЕКОМЕНДАЦИИ - СЛУЧАЙНОЕ ПЕРЕМЕШИВАНИЕ
        let recommendations = [...videoArray];
        
        // 1. Перемешиваем все видео
        recommendations.sort(() => Math.random() - 0.5);
        
        // 2. Добавляем вес популярным видео (больше просмотров = больше шансов)
        recommendations.sort((a, b) => {
            const viewsA = a.views || 0;
            const viewsB = b.views || 0;
            const randomA = Math.random() * (viewsA / 1000);
            const randomB = Math.random() * (viewsB / 1000);
            return randomB - randomA;
        });
        
        // 3. Добавляем вес новым видео (новые = больше шансов)
        recommendations.sort((a, b) => {
            const timeA = a.timestamp || 0;
            const timeB = b.timestamp || 0;
            const ageA = Date.now() - timeA;
            const ageB = Date.now() - timeB;
            const weightA = Math.random() * (1 / (ageA / 10000000 + 1));
            const weightB = Math.random() * (1 / (ageB / 10000000 + 1));
            return weightB - weightA;
        });
        
        // 4. Финальное перемешивание
        recommendations.sort(() => Math.random() - 0.5);
        
        // Ограничиваем количество рекомендаций
        recommendations = recommendations.slice(0, 12);
        
        // Отображаем видео
        videoGrid.innerHTML = recommendations
            .map(video => createVideoCard(video))
            .join('');
            
        console.log('Видео отображены:', recommendations.length);
        
    } catch (error) {
        console.error('Ошибка загрузки видео:', error);
        videoGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #f44336;">
                <h3>Ошибка загрузки видео</h3>
                <p>${error.message}</p>
                <button onclick="location.reload()" style="margin-top: 16px; padding: 12px 24px; background-color: #2E7D32; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Попробовать снова
                </button>
            </div>
        `;
    }
}

// УЛУЧШЕННЫЕ РЕКОМЕНДАЦИИ ДЛЯ СТРАНИЦЫ ВИДЕО
async function loadRecommendations(currentVideoId) {
    console.log('Загружаем рекомендации для видео:', currentVideoId);
    const recommendationsList = document.getElementById('recommendations-list');
    
    if (!recommendationsList) {
        console.error('Не найден элемент recommendations-list');
        return;
    }
    
    try {
        // Получаем все видео
        const videos = await db.getAllVideos();
        if (!videos || Object.keys(videos).length === 0) {
            recommendationsList.innerHTML = '<p style="color: #B0B0B0; text-align: center; padding: 20px;">Нет рекомендаций</p>';
            return;
        }
        
        // Преобразуем в массив и фильтруем текущее видео
        const videoArray = Object.values(videos).filter(v => v && v.id && v.id !== currentVideoId);
        
        if (videoArray.length === 0) {
            recommendationsList.innerHTML = '<p style="color: #B0B0B0; text-align: center; padding: 20px;">Нет рекомендаций</p>';
            return;
        }
        
        // Получаем текущее видео
        const currentVideo = await db.getVideo(currentVideoId);
        const currentChannelId = currentVideo?.channelId;
        
        // УЛУЧШЕННЫЙ АЛГОРИТМ РЕКОМЕНДАЦИЙ
        let recommendations = [];
        
        // 1. Видео от того же автора (30% шанс на попадание)
        if (currentChannelId && Math.random() < 0.3) {
            const sameChannelVideos = videoArray.filter(v => v.channelId === currentChannelId);
            if (sameChannelVideos.length > 0) {
                const randomSame = sameChannelVideos[Math.floor(Math.random() * sameChannelVideos.length)];
                recommendations.push(randomSame);
            }
        }
        
        // 2. Популярные видео (40% шанс)
        if (Math.random() < 0.4) {
            const popularVideos = [...videoArray]
                .sort((a, b) => (b.views || 0) - (a.views || 0))
                .slice(0, 5);
            if (popularVideos.length > 0) {
                const randomPopular = popularVideos[Math.floor(Math.random() * popularVideos.length)];
                if (!recommendations.find(r => r.id === randomPopular.id)) {
                    recommendations.push(randomPopular);
                }
            }
        }
        
        // 3. Новые видео (30% шанс)
        if (Math.random() < 0.3) {
            const newVideos = [...videoArray]
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                .slice(0, 5);
            if (newVideos.length > 0) {
                const randomNew = newVideos[Math.floor(Math.random() * newVideos.length)];
                if (!recommendations.find(r => r.id === randomNew.id)) {
                    recommendations.push(randomNew);
                }
            }
        }
        
        // 4. Случайные видео (заполняем оставшиеся места)
        const remainingSlots = 8 - recommendations.length;
        if (remainingSlots > 0) {
            const randomVideos = [...videoArray]
                .sort(() => Math.random() - 0.5)
                .filter(v => !recommendations.find(r => r.id === v.id))
                .slice(0, remainingSlots);
            recommendations.push(...randomVideos);
        }
        
        // Финальное перемешивание
        recommendations.sort(() => Math.random() - 0.5);
        
        // Отображаем рекомендации
        recommendationsList.innerHTML = recommendations
            .map(video => createRecommendationCard(video))
            .join('');
            
        console.log('Рекомендации отображены:', recommendations.length);
        
    } catch (error) {
        console.error('Ошибка загрузки рекомендаций:', error);
        recommendationsList.innerHTML = '<p style="color: #B0B0B0; text-align: center; padding: 20px;">Ошибка загрузки рекомендаций</p>';
    }
}

// Поиск видео
async function performSearch(query) {
    console.log('Выполняем поиск:', query);
    
    if (!query.trim()) {
        showNotification('Введите поисковый запрос', 'info');
        return;
    }
    
    try {
        showNotification('Идет поиск...', 'info');
        const results = await db.searchVideos(query);
        
        if (results.length === 0) {
            showNotification('Ничего не найдено', 'info');
            return;
        }
        
        // Если мы на главной странице, показываем результаты
        if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
            const videoGrid = document.getElementById('video-grid');
            if (videoGrid) {
                videoGrid.innerHTML = results
                    .map(video => createVideoCard(video))
                    .join('');
                
                showNotification(`Найдено ${results.length} видео`, 'success');
            }
        } else {
            // Если не на главной, переходим на главную с поиском
            window.location.href = `index.html?search=${encodeURIComponent(query)}`;
        }
        
    } catch (error) {
        console.error('Ошибка поиска:', error);
        showNotification('Ошибка поиска', 'error');
    }
}

// Показать уведомление
function showNotification(message, type = 'info') {
    console.log('Уведомление:', message, type);
    
    // Удаляем старые уведомления
    const oldNotification = document.querySelector('.notification');
    if (oldNotification) oldNotification.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    
    notification.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Анимация появления
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Автоудаление через 3 секунды
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Мобильный поиск
function showMobileSearch() {
    console.log('Показываем мобильный поиск');
    
    // Удаляем старый модал
    const oldModal = document.querySelector('.mobile-search-modal');
    if (oldModal) oldModal.remove();
    
    // Создаем модальное окно поиска
    const modal = document.createElement('div');
    modal.className = 'mobile-search-modal';
    modal.innerHTML = `
        <div class="search-modal-overlay"></div>
        <div class="search-modal-content">
            <div class="search-modal-header">
                <h3>Поиск видео</h3>
                <button class="close-search-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="search-modal-body">
                <div class="mobile-search-input-container">
                    <input type="text" id="mobile-search-input" placeholder="Введите запрос..." autofocus>
                    <button id="mobile-search-button">
                        <i class="fas fa-search"></i>
                    </button>
                </div>
                <div class="search-suggestions">
                    <p>Популярные запросы:</p>
                    <div class="suggestion-tags">
                        <span class="suggestion-tag" onclick="searchFromSuggestion('музыка')">Музыка</span>
                        <span class="suggestion-tag" onclick="searchFromSuggestion('игры')">Игры</span>
                        <span class="suggestion-tag" onclick="searchFromSuggestion('обучение')">Обучение</span>
                        <span class="suggestion-tag" onclick="searchFromSuggestion('спорт')">Спорт</span>
                        <span class="suggestion-tag" onclick="searchFromSuggestion('технологии')">Технологии</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Обработчики событий
    const closeBtn = modal.querySelector('.close-search-btn');
    const overlay = modal.querySelector('.search-modal-overlay');
    const searchInput = modal.querySelector('#mobile-search-input');
    const searchButton = modal.querySelector('#mobile-search-button');
    
    // Закрытие модалки
    function closeModal() {
        modal.classList.add('closing');
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 300);
    }
    
    if (closeBtn) closeBtn.onclick = closeModal;
    if (overlay) overlay.onclick = closeModal;
    
    // Поиск
    if (searchButton) {
        searchButton.onclick = () => {
            const query = searchInput.value.trim();
            if (query) {
                performSearch(query);
                closeModal();
            }
        };
    }
    
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                if (query) {
                    performSearch(query);
                    closeModal();
                }
            }
        });
    }
}

// Поиск из предложения
function searchFromSuggestion(query) {
    performSearch(query);
    const modal = document.querySelector('.mobile-search-modal');
    if (modal) modal.remove();
}

// Переход к загрузке
function goToUpload() {
    console.log('Переход к загрузке видео');
    if (typeof checkUploadAccess === 'function') {
        checkUploadAccess();
    } else {
        window.location.href = 'upload.html';
    }
}

// Проверка доступа к загрузке
function checkUploadAccess() {
    console.log('Проверка доступа к загрузке');
    
    // Если нет системы аутентификации, просто переходим
    if (typeof authDB === 'undefined' || typeof authDB.getCurrentUser === 'undefined') {
        window.location.href = 'upload.html';
        return true;
    }
    
    const user = authDB.getCurrentUser();
    
    if (!user) {
        // Показываем модалку входа
        if (typeof showAuthModal === 'function') {
            showAuthModal('login');
            showNotification('Для загрузки видео необходимо войти в аккаунт', 'info');
        } else {
            window.location.href = 'upload.html';
        }
        return false;
    }
    
    if (!user.channelCreated) {
        // Показываем создание канала
        if (typeof showChannelCreationModal === 'function') {
            showChannelCreationModal();
            return false;
        }
    }
    
    window.location.href = 'upload.html';
    return true;
}

// Инициализация мобильной навигации
function setupMobileNavigation() {
    if (window.innerWidth <= 768) {
        // Проверяем, нет ли уже мобильной навигации
        if (document.querySelector('.mobile-bottom-nav')) return;
        
        // Создаем мобильную нижнюю панель навигации
        const mobileNav = document.createElement('div');
        mobileNav.className = 'mobile-bottom-nav';
        
        // Определяем активную страницу
        const isIndex = window.location.pathname.includes('index.html') || window.location.pathname === '/';
        const isVideo = window.location.pathname.includes('video.html');
        const isUpload = window.location.pathname.includes('upload.html');
        const user = authDB ? authDB.getCurrentUser() : null;
        
        mobileNav.innerHTML = `
            <a href="index.html" class="mobile-nav-item ${isIndex ? 'active' : ''}">
                <i class="fas fa-home"></i>
                <span>Главная</span>
            </a>
            <a href="#" class="mobile-nav-item" onclick="showMobileSearch()">
                <i class="fas fa-search"></i>
                <span>Поиск</span>
            </a>
            <a href="#" class="mobile-nav-item" onclick="checkUploadAccess()">
                <i class="fas fa-upload"></i>
                <span>Загрузить</span>
            </a>
            <a href="#" class="mobile-nav-item" onclick="${user ? 'showUserMenu(event)' : 'showAuthModal(\'login\')'}">
                <i class="fas fa-user"></i>
                <span>${user ? 'Профиль' : 'Войти'}</span>
            </a>
        `;
        
        document.body.appendChild(mobileNav);
        
        // Удаляем обычный поиск из header на мобильных
        const searchBar = document.querySelector('.search-bar');
        if (searchBar) searchBar.style.display = 'none';
        
        // Показываем кнопку поиска
        const mobileSearchBtn = document.querySelector('.mobile-search-btn');
        if (mobileSearchBtn) mobileSearchBtn.style.display = 'flex';
    } else {
        // На десктопе показываем обычный поиск
        const searchBar = document.querySelector('.search-bar');
        if (searchBar) searchBar.style.display = 'flex';
        
        // Удаляем мобильные элементы
        const mobileNav = document.querySelector('.mobile-bottom-nav');
        if (mobileNav) mobileNav.remove();
        
        const mobileSearchBtn = document.querySelector('.mobile-search-btn');
        if (mobileSearchBtn) mobileSearchBtn.style.display = 'none';
    }
}

// Инициализация меню
function initMenu() {
    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.classList.toggle('closed');
            }
        });
    }
}

// Основная инициализация при загрузке страницы
function initPage() {
    console.log('Инициализация страницы...');
    
    // Проверяем URL параметры для поиска
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('search');
    
    if (searchQuery) {
        // Выполняем поиск если есть запрос
        performSearch(searchQuery);
    }
    
    // Настройка поиска для десктопа
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    
    if (searchInput && searchButton) {
        searchButton.addEventListener('click', () => {
            const query = searchInput.value.trim();
            if (query) {
                performSearch(query);
            }
        });
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchButton.click();
            }
        });
    }
    
    // Инициализация меню
    initMenu();
    
    // Инициализация мобильной навигации
    setupMobileNavigation();
    
    // Адаптация при изменении размера окна
    window.addEventListener('resize', setupMobileNavigation);
    
    // Плавное появление контента
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.3s ease';
        document.body.style.opacity = '1';
    }, 100);
    
    // Добавляем глобальные функции
    window.openVideo = openVideo;
    window.goToUpload = goToUpload;
    window.showMobileSearch = showMobileSearch;
    window.performSearch = performSearch;
    window.searchFromSuggestion = searchFromSuggestion;
    window.showNotification = showNotification;
    window.loadRecommendations = loadRecommendations;
    window.checkUploadAccess = checkUploadAccess;
    
    console.log('Страница инициализирована');
}

// Запускаем инициализацию при загрузке DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
} else {
    initPage();
}

// Экспортируем функции для использования в других файлах
window.db = db;
window.extractYouTubeId = extractYouTubeId;
window.formatNumber = formatNumber;
window.formatDate = formatDate;
