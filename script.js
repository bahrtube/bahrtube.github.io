// Инициализация Firebase
const firebaseConfig = {
    databaseURL: "https://flum-2-default-rtdb.firebaseio.com"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const db = {
    getAllVideos: async () => {
        const snapshot = await database.ref('videos').once('value');
        return snapshot.val() || {};
    },

    searchVideos: async (query) => {
        const snapshot = await database.ref('videos').once('value');
        const videos = snapshot.val() || {};
        
        const searchTerms = query.toLowerCase().split(' ');
        const results = [];
        
        Object.values(videos).forEach(video => {
            if (!video) return;
            
            const title = video.title ? video.title.toLowerCase() : '';
            const channel = video.channelName ? video.channelName.toLowerCase() : '';
            const description = video.description ? video.description.toLowerCase() : '';
            
            let score = 0;
            
            searchTerms.forEach(term => {
                if (title.includes(term)) score += 5;
                if (channel.includes(term)) score += 3;
                if (description.includes(term)) score += 1;
            });
            
            if (score > 0) {
                results.push({ video, score });
            }
        });
        
        return results
            .sort((a, b) => b.score - a.score)
            .map(item => item.video);
    },

    addVideo: async (videoData) => {
        const newVideoRef = database.ref('videos').push();
        const videoId = newVideoRef.key;
        
        const videoWithId = {
            ...videoData,
            id: videoId,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            likes: 0,
            dislikes: 0,
            views: 0,
            subscribers: 0
        };
        
        await newVideoRef.set(videoWithId);
        return videoId;
    },

    updateVideo: async (videoId, updates) => {
        await database.ref(`videos/${videoId}`).update(updates);
    },

    getVideo: async (videoId) => {
        const snapshot = await database.ref(`videos/${videoId}`).once('value');
        return snapshot.val();
    }
};

let currentVideoId = null;
let userLiked = false;
let userDisliked = false;
let userSubscribed = false;

function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function generateThumbnail(videoId) {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + ' млн';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + ' тыс';
    }
    return num.toString();
}

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

function createVideoCard(video) {
    const youTubeId = extractYouTubeId(video.url);
    
    return `
        <div class="video-card" onclick="openVideo('${video.id}')">
            <div class="video-thumbnail">
                <img src="${generateThumbnail(youTubeId)}" alt="${video.title}" onerror="this.src='https://via.placeholder.com/320x180/252525/ffffff?text=No+Preview'">
                <div class="video-thumbnail-overlay">8:15</div>
            </div>
            <div class="video-info">
                <div class="video-details">
                    <h3>${video.title}</h3>
                    <div class="channel-name">${video.channelName}</div>
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

function createRecommendationCard(video) {
    const youTubeId = extractYouTubeId(video.url);
    
    return `
        <div class="recommendation-card" onclick="openVideo('${video.id}')">
            <div class="recommendation-thumbnail">
                <img src="${generateThumbnail(youTubeId)}" alt="${video.title}" onerror="this.src='https://via.placeholder.com/168x94/252525/ffffff?text=No+Preview'">
            </div>
            <div class="recommendation-info">
                <h4>${video.title}</h4>
                <div class="recommendation-channel">${video.channelName}</div>
                <div class="recommendation-stats">
                    <span>${formatNumber(video.views || 0)} просмотров</span>
                    <span>•</span>
                    <span>${formatDate(video.timestamp)}</span>
                </div>
            </div>
        </div>
    `;
}

function openVideo(videoId) {
    window.location.href = `video.html?id=${videoId}`;
}

async function loadHomePage() {
    try {
        const videos = await db.getAllVideos();
        const videoGrid = document.getElementById('video-grid');
        
        if (!videoGrid) return;
        
        if (!videos || Object.keys(videos).length === 0) {
            videoGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                    <h3 style="margin-bottom: 16px; color: #fff;">Нет загруженных видео</h3>
                    <p style="color: #B0B0B0; margin-bottom: 24px;">Будьте первым, кто загрузит видео!</p>
                    <button onclick="goToUpload()" style="padding: 14px 32px; background-color: #2E7D32; color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 16px; transition: all 0.3s;">
                        Загрузить видео
                    </button>
                </div>
            `;
            return;
        }
        
        // Создаем скелетоны для эффекта загрузки
        videoGrid.innerHTML = `
            <div class="skeleton" style="height: 250px; border-radius: 12px;"></div>
            <div class="skeleton" style="height: 250px; border-radius: 12px;"></div>
            <div class="skeleton" style="height: 250px; border-radius: 12px;"></div>
            <div class="skeleton" style="height: 250px; border-radius: 12px;"></div>
        `;
        
        // Загружаем видео с задержкой для плавного появления
        setTimeout(() => {
            const videoArray = Object.values(videos);
            const sortedVideos = videoArray.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            
            videoGrid.innerHTML = sortedVideos
                .map(video => createVideoCard(video))
                .join('');
        }, 600);
        
    } catch (error) {
        console.error('Error loading videos:', error);
        document.getElementById('video-grid').innerHTML = `
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

// УЛУЧШЕННАЯ СИСТЕМА РЕКОМЕНДАЦИЙ
async function loadRecommendations(currentVideoId) {
    try {
        const videos = await db.getAllVideos();
        const recommendationsList = document.getElementById('recommendations-list');
        
        if (!recommendationsList) return;
        
        if (!videos || Object.keys(videos).length === 0) {
            recommendationsList.innerHTML = '<p style="color: #B0B0B0; text-align: center; padding: 20px;">Нет рекомендаций</p>';
            return;
        }
        
        const videoArray = Object.values(videos).filter(v => v && v.id !== currentVideoId);
        
        if (videoArray.length === 0) {
            recommendationsList.innerHTML = '<p style="color: #B0B0B0; text-align: center; padding: 20px;">Нет рекомендаций</p>';
            return;
        }
        
        // Получаем текущее видео
        const currentVideo = await db.getVideo(currentVideoId);
        const currentChannel = currentVideo?.channelName;
        
        // УЛУЧШЕННЫЙ АЛГОРИТМ:
        // 1. Создаем веса для разных типов видео
        const recommendations = [];
        
        // Видео от того же автора (высокий приоритет)
        const sameChannelVideos = videoArray.filter(v => v.channelName === currentChannel);
        if (sameChannelVideos.length > 0) {
            // Берем рандомно 1-2 видео от того же автора
            const randomSameChannel = [...sameChannelVideos]
                .sort(() => Math.random() - 0.5)
                .slice(0, Math.min(2, sameChannelVideos.length));
            recommendations.push(...randomSameChannel);
        }
        
        // Популярные видео (средний приоритет)
        const popularVideos = [...videoArray]
            .sort((a, b) => (b.views || 0) - (a.views || 0))
            .slice(0, 10); // Берем топ-10 популярных
        
        // Случайные видео (низкий приоритет)
        const randomVideos = [...videoArray]
            .sort(() => Math.random() - 0.5);
        
        // Смешиваем рекомендации
        const maxRecommendations = 10;
        let remainingSlots = maxRecommendations - recommendations.length;
        
        // Добавляем популярные видео
        if (remainingSlots > 0) {
            const popularSelection = popularVideos
                .filter(v => !recommendations.find(r => r.id === v.id))
                .slice(0, Math.ceil(remainingSlots / 2));
            recommendations.push(...popularSelection);
            remainingSlots = maxRecommendations - recommendations.length;
        }
        
        // Добавляем случайные видео
        if (remainingSlots > 0) {
            const randomSelection = randomVideos
                .filter(v => !recommendations.find(r => r.id === v.id))
                .slice(0, remainingSlots);
            recommendations.push(...randomSelection);
        }
        
        // Перемешиваем финальный список для разнообразия
        const shuffledRecommendations = [...recommendations]
            .sort(() => Math.random() - 0.5)
            .slice(0, 8); // Ограничиваем 8 рекомендациями
        
        if (shuffledRecommendations.length === 0) {
            recommendationsList.innerHTML = '<p style="color: #B0B0B0; text-align: center; padding: 20px;">Нет рекомендаций</p>';
            return;
        }
        
        recommendationsList.innerHTML = shuffledRecommendations
            .map(video => createRecommendationCard(video))
            .join('');
            
    } catch (error) {
        console.error('Error loading recommendations:', error);
        const recommendationsList = document.getElementById('recommendations-list');
        if (recommendationsList) {
            recommendationsList.innerHTML = '<p style="color: #B0B0B0; text-align: center; padding: 20px;">Ошибка загрузки рекомендаций</p>';
        }
    }
}

// Поиск видео
async function performSearch(query) {
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
        console.error('Search error:', error);
        showNotification('Ошибка поиска', 'error');
    }
}

function showNotification(message, type = 'info') {
    // Удаляем старые уведомления
    const oldNotification = document.querySelector('.notification');
    if (oldNotification) oldNotification.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Анимация появления
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Автоудаление
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Мобильный поиск
function showMobileSearch() {
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
        setTimeout(() => modal.remove(), 300);
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

function searchFromSuggestion(query) {
    performSearch(query);
    const modal = document.querySelector('.mobile-search-modal');
    if (modal) modal.remove();
}

function goToUpload() {
    window.location.href = 'upload.html';
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
        
        mobileNav.innerHTML = `
            <a href="index.html" class="mobile-nav-item ${isIndex ? 'active' : ''}">
                <i class="fas fa-home"></i>
                <span>Главная</span>
            </a>
            <a href="#" class="mobile-nav-item" onclick="showMobileSearch()">
                <i class="fas fa-search"></i>
                <span>Поиск</span>
            </a>
            <a href="upload.html" class="mobile-nav-item ${isUpload ? 'active' : ''}">
                <i class="fas fa-upload"></i>
                <span>Загрузить</span>
            </a>
            <a href="#" class="mobile-nav-item" onclick="showNotification('Вход в аккаунт в разработке', 'info')">
                <i class="fas fa-user"></i>
                <span>Профиль</span>
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

// Основная инициализация
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация страниц
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        // Проверяем поисковый запрос в URL
        const urlParams = new URLSearchParams(window.location.search);
        const searchQuery = urlParams.get('search');
        
        if (searchQuery) {
            // Выполняем поиск если есть запрос
            performSearch(searchQuery);
        } else {
            loadHomePage();
        }
    }
    
    // Поиск для десктопа
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
    
    // Мобильное меню
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
});
