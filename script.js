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
            const snapshot = await database.ref('videos').once('value');
            return snapshot.val() || {};
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
                subscribers: user ? (user.subscribers || 0) : 0
            };
            
            await newVideoRef.set(videoWithId);
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
            return true;
        } catch (error) {
            console.error('Ошибка обновления видео:', error);
            return false;
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
    },

    // Получение комментариев видео
    getVideoComments: async (videoId) => {
        try {
            const snapshot = await database.ref(`comments/${videoId}`).once('value');
            return snapshot.val() || {};
        } catch (error) {
            console.error('Ошибка получения комментариев:', error);
            return {};
        }
    },

    // Добавление комментария
    addComment: async (videoId, commentData) => {
        try {
            const commentRef = database.ref(`comments/${videoId}`).push();
            const commentId = commentRef.key;
            
            const commentWithId = {
                ...commentData,
                id: commentId,
                timestamp: Date.now(),
                likes: 0,
                dislikes: 0
            };
            
            await commentRef.set(commentWithId);
            return commentId;
        } catch (error) {
            console.error('Ошибка добавления комментария:', error);
            throw error;
        }
    },

    // Обновление комментария
    updateComment: async (videoId, commentId, updates) => {
        try {
            await database.ref(`comments/${videoId}/${commentId}`).update(updates);
            return true;
        } catch (error) {
            console.error('Ошибка обновления комментария:', error);
            return false;
        }
    }
};

// Глобальные переменные
let currentVideoId = null;
let currentVideoData = null;
let userLiked = false;
let userDisliked = false;
let userSubscribed = false;
let userSaved = false;

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
    if (!num && num !== 0) return '0';
    num = parseInt(num);
    if (isNaN(num)) return '0';
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

// Загрузка главной страницы с улучшенными рекомендациями
async function loadHomePage() {
    const videoGrid = document.getElementById('video-grid');
    
    if (!videoGrid) return;
    
    try {
        videoGrid.innerHTML = `
            <div class="skeleton" style="height: 250px; border-radius: 12px;"></div>
            <div class="skeleton" style="height: 250px; border-radius: 12px;"></div>
            <div class="skeleton" style="height: 250px; border-radius: 12px;"></div>
            <div class="skeleton" style="height: 250px; border-radius: 12px;"></div>
        `;
        
        const videos = await db.getAllVideos();
        
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
        
        const videoArray = Object.values(videos).filter(v => v && v.id);
        
        // УЛУЧШЕННЫЕ РЕКОМЕНДАЦИИ С УЧЕТОМ ПРЕДПОЧТЕНИЙ
        let recommendations = [];
        const user = authDB ? authDB.getCurrentUser() : null;
        
        // 1. Получаем предпочтения пользователя
        const userSubscriptions = user ? (user.subscriptions || []) : [];
        const userReactions = user ? (user.reactions || {}) : {};
        const userSavedVideos = user ? (user.savedVideos || []) : [];
        
        // 2. Присваиваем баллы видео
        const scoredVideos = videoArray.map(video => {
            let score = 0;
            
            // Базовые баллы
            score += (video.views || 0) / 100; // За просмотры
            
            // Новизна видео
            const videoAge = Date.now() - (video.timestamp || Date.now());
            const daysOld = videoAge / (1000 * 60 * 60 * 24);
            if (daysOld < 1) score += 50;
            else if (daysOld < 7) score += 30;
            else if (daysOld < 30) score += 10;
            
            // Предпочтения пользователя
            if (user) {
                // Видео от подписанных авторов
                if (userSubscriptions.includes(video.channelId)) {
                    score += 100;
                }
                
                // Видео, которые пользователь лайкнул
                if (userReactions[video.id] === 'liked') {
                    score += 80;
                }
                
                // Видео, которые пользователь сохранил
                if (userSavedVideos.includes(video.id)) {
                    score += 60;
                }
                
                // Видео от авторов, чьи видео пользователь лайкал
                // (дополнительная логика может быть добавлена)
            }
            
            // Рандомный элемент для разнообразия
            score += Math.random() * 40;
            
            return { video, score };
        });
        
        // 3. Сортируем по баллам
        scoredVideos.sort((a, b) => b.score - a.score);
        
        // 4. Берем топ видео
        const topVideos = scoredVideos.slice(0, 15).map(item => item.video);
        
        // 5. Перемешиваем для разнообразия
        for (let i = topVideos.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [topVideos[i], topVideos[j]] = [topVideos[j], topVideos[i]];
        }
        
        recommendations = topVideos.slice(0, 12);
        
        // Отображаем видео
        videoGrid.innerHTML = recommendations
            .map(video => createVideoCard(video))
            .join('');
            
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
    const recommendationsList = document.getElementById('recommendations-list');
    
    if (!recommendationsList) return;
    
    try {
        const videos = await db.getAllVideos();
        if (!videos || Object.keys(videos).length === 0) {
            recommendationsList.innerHTML = '<p style="color: #B0B0B0; text-align: center; padding: 20px;">Нет рекомендаций</p>';
            return;
        }
        
        const videoArray = Object.values(videos).filter(v => v && v.id && v.id !== currentVideoId);
        
        if (videoArray.length === 0) {
            recommendationsList.innerHTML = '<p style="color: #B0B0B0; text-align: center; padding: 20px;">Нет рекомендаций</p>';
            return;
        }
        
        // Получаем текущее видео и пользователя
        const currentVideo = await db.getVideo(currentVideoId);
        const currentChannelId = currentVideo?.channelId;
        const user = authDB ? authDB.getCurrentUser() : null;
        
        // УЛУЧШЕННЫЙ АЛГОРИТМ РЕКОМЕНДАЦИЙ
        let recommendations = [];
        const scoredVideos = [];
        
        // Присваиваем баллы каждому видео
        videoArray.forEach(video => {
            let score = 0;
            
            // 1. Видео от того же автора (+50 баллов)
            if (currentChannelId && video.channelId === currentChannelId) {
                score += 50;
            }
            
            // 2. Популярные видео (+1 балл за каждые 100 просмотров)
            score += Math.floor((video.views || 0) / 100);
            
            // 3. Новые видео
            const videoAge = Date.now() - (video.timestamp || Date.now());
            const daysOld = videoAge / (1000 * 60 * 60 * 24);
            if (daysOld < 7) score += 10;
            if (daysOld < 1) score += 20;
            
            // 4. УЧЕТ ПРЕДПОЧТЕНИЙ ПОЛЬЗОВАТЕЛЯ
            if (user) {
                // Видео от авторов, на которых подписан пользователь
                const userSubscriptions = user.subscriptions || [];
                if (userSubscriptions.includes(video.channelId)) {
                    score += 100;
                }
                
                // Видео, которые пользователь лайкнул
                const userReactions = user.reactions || {};
                if (userReactions[video.id] === 'liked') {
                    score += 80;
                }
                
                // Видео, которые пользователь сохранил
                const userSavedVideos = user.savedVideos || [];
                if (userSavedVideos.includes(video.id)) {
                    score += 60;
                }
            }
            
            // 5. Рандомный элемент
            score += Math.random() * 30;
            
            scoredVideos.push({ video, score });
        });
        
        // Сортируем по баллам
        scoredVideos.sort((a, b) => b.score - a.score);
        
        // Берем топ-8 видео
        const topVideos = scoredVideos.slice(0, 12).map(item => item.video);
        
        // Перемешиваем для разнообразия
        const shuffled = [...topVideos];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        recommendations = shuffled.slice(0, 8);
        
        // Отображаем рекомендации
        recommendationsList.innerHTML = recommendations
            .map(video => createRecommendationCard(video))
            .join('');
            
    } catch (error) {
        console.error('Ошибка загрузки рекомендаций:', error);
        recommendationsList.innerHTML = '<p style="color: #B0B0B0; text-align: center; padding: 20px;">Ошибка загрузки рекомендаций</p>';
    }
}

// Обработка лайков/дизлайков видео
async function handleVideoLike(videoId, action) {
    try {
        const video = await db.getVideo(videoId);
        if (!video) return false;
        
        const user = authDB ? authDB.getCurrentUser() : null;
        if (!user) {
            showNotification('Для оценки видео необходимо войти в аккаунт', 'error');
            return false;
        }
        
        // Обновляем счетчики видео
        if (action === 'like') {
            const currentLikes = video.likes || 0;
            await db.updateVideo(videoId, { likes: currentLikes + 1 });
            
            // Если был дизлайк, убираем его
            if (userDisliked) {
                const currentDislikes = video.dislikes || 0;
                await db.updateVideo(videoId, { dislikes: Math.max(currentDislikes - 1, 0) });
                userDisliked = false;
            }
            userLiked = true;
            
        } else if (action === 'dislike') {
            const currentDislikes = video.dislikes || 0;
            await db.updateVideo(videoId, { dislikes: currentDislikes + 1 });
            
            // Если был лайк, убираем его
            if (userLiked) {
                const currentLikes = video.likes || 0;
                await db.updateVideo(videoId, { likes: Math.max(currentLikes - 1, 0) });
                userLiked = false;
            }
            userDisliked = true;
        }
        
        // Сохраняем реакцию пользователя
        const userReactions = user.reactions || {};
        userReactions[videoId] = action === 'like' ? 'liked' : 'disliked';
        await authDB.updateUser(user.id, { reactions: userReactions });
        
        return true;
        
    } catch (error) {
        console.error('Ошибка обработки оценки:', error);
        return false;
    }
}

// Обработка подписки
async function handleSubscribe(channelId) {
    try {
        const user = authDB ? authDB.getCurrentUser() : null;
        if (!user) {
            showNotification('Для подписки необходимо войти в аккаунт', 'error');
            return false;
        }
        
        if (userSubscribed) {
            // Отписываемся
            const result = await authDB.unsubscribeFromChannel(channelId, user.id);
            if (result.success) {
                userSubscribed = false;
                return true;
            }
        } else {
            // Подписываемся
            const result = await authDB.subscribeToChannel(channelId, user.id);
            if (result.success) {
                userSubscribed = true;
                return true;
            }
        }
        
        return false;
        
    } catch (error) {
        console.error('Ошибка подписки:', error);
        return false;
    }
}

// Обработка сохранения видео
async function handleSaveVideo(videoId) {
    try {
        const user = authDB ? authDB.getCurrentUser() : null;
        if (!user) {
            showNotification('Для сохранения видео необходимо войти в аккаунт', 'error');
            return false;
        }
        
        const savedVideos = user.savedVideos || [];
        
        if (userSaved) {
            // Удаляем из сохраненных
            const newSavedVideos = savedVideos.filter(id => id !== videoId);
            await authDB.updateUser(user.id, { savedVideos: newSavedVideos });
            userSaved = false;
        } else {
            // Добавляем в сохраненные
            if (!savedVideos.includes(videoId)) {
                savedVideos.push(videoId);
                await authDB.updateUser(user.id, { savedVideos: savedVideos });
            }
            userSaved = true;
        }
        
        return true;
        
    } catch (error) {
        console.error('Ошибка сохранения видео:', error);
        return false;
    }
}

// Копирование ссылки
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        // Fallback для старых браузеров
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
    }
}

// Обработка текста (ссылки и таймкоды)
function processText(text) {
    if (!text) return '';
    
    // Экранируем HTML
    let processed = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    
    // Обрабатываем ссылки
    processed = processed.replace(/(https?:\/\/[^\s]+)/g, (url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-link">${url}</a>`;
    });
    
    // Обрабатываем таймкоды (например: 1:23, 01:23:45)
    processed = processed.replace(/(\b\d{1,2}:)?\d{1,2}:\d{2}\b/g, (timestamp) => {
        const seconds = timestampToSeconds(timestamp);
        if (seconds !== null) {
            return `<span class="timestamp-link" data-timestamp="${seconds}">${timestamp}</span>`;
        }
        return timestamp;
    });
    
    // Обрабатываем переносы строк
    processed = processed.replace(/\n/g, '<br>');
    
    return processed;
}

// Конвертация таймкода в секунды
function timestampToSeconds(timestamp) {
    const parts = timestamp.split(':').map(Number);
    
    if (parts.length === 2) {
        // MM:SS
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
        // HH:MM:SS
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    
    return null;
}

// Показать уведомление
function showNotification(message, type = 'info') {
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
        console.error('Ошибка поиска:', error);
        showNotification('Ошибка поиска', 'error');
    }
}

// Переход к загрузке
function goToUpload() {
    if (typeof checkUploadAccess === 'function') {
        checkUploadAccess();
    } else {
        window.location.href = 'upload.html';
    }
}

// Проверка доступа к загрузке
function checkUploadAccess() {
    const user = authDB ? authDB.getCurrentUser() : null;
    
    if (!user) {
        if (typeof showAuthModal === 'function') {
            showAuthModal('login');
            showNotification('Для загрузки видео необходимо войти в аккаунт', 'info');
        } else {
            window.location.href = 'upload.html';
        }
        return false;
    }
    
    if (!user.channelCreated) {
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
        if (document.querySelector('.mobile-bottom-nav')) return;
        
        const mobileNav = document.createElement('div');
        mobileNav.className = 'mobile-bottom-nav';
        
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
        
        const searchBar = document.querySelector('.search-bar');
        if (searchBar) searchBar.style.display = 'none';
        
        const mobileSearchBtn = document.querySelector('.mobile-search-btn');
        if (mobileSearchBtn) mobileSearchBtn.style.display = 'flex';
    } else {
        const searchBar = document.querySelector('.search-bar');
        if (searchBar) searchBar.style.display = 'flex';
        
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

// Основная инициализация
function initPage() {
    // Проверяем URL параметры для поиска
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('search');
    
    if (searchQuery) {
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
    window.handleVideoLike = handleVideoLike;
    window.handleSubscribe = handleSubscribe;
    window.handleSaveVideo = handleSaveVideo;
    window.copyToClipboard = copyToClipboard;
    window.processText = processText;
    window.timestampToSeconds = timestampToSeconds;
}

// Запускаем инициализацию
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
} else {
    initPage();
}

// Экспортируем функции
window.db = db;
window.extractYouTubeId = extractYouTubeId;
window.formatNumber = formatNumber;
window.formatDate = formatDate;
