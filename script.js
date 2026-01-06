// Инициализация Firebase
const firebaseConfig = {
    databaseURL: "https://flum-2-default-rtdb.firebaseio.com"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Простые функции для работы с базой
const db = {
    getAllVideos: async () => {
        try {
            const snapshot = await database.ref('videos').once('value');
            return snapshot.val() || {};
        } catch (error) {
            console.error("Ошибка загрузки видео:", error);
            return {};
        }
    },

    addVideo: async (videoData) => {
        try {
            const newVideoRef = database.ref('videos').push();
            const videoId = newVideoRef.key;
            
            const videoWithId = {
                ...videoData,
                id: videoId,
                timestamp: Date.now(),
                likes: 0,
                dislikes: 0,
                views: 0
            };
            
            await newVideoRef.set(videoWithId);
            return videoId;
        } catch (error) {
            console.error("Ошибка добавления видео:", error);
            throw error;
        }
    },

    getVideo: async (videoId) => {
        try {
            const snapshot = await database.ref(`videos/${videoId}`).once('value');
            return snapshot.val();
        } catch (error) {
            console.error("Ошибка загрузки видео:", error);
            return null;
        }
    },

    updateVideo: async (videoId, updates) => {
        try {
            await database.ref(`videos/${videoId}`).update(updates);
        } catch (error) {
            console.error("Ошибка обновления видео:", error);
        }
    }
};

// Вспомогательные функции
function extractYouTubeId(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function generateThumbnail(videoId) {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + ' млн';
    if (num >= 1000) return (num / 1000).toFixed(1) + ' тыс';
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

// Загрузка главной страницы
async function loadHomePage() {
    try {
        const videos = await db.getAllVideos();
        const videoGrid = document.getElementById('video-grid');
        
        if (!videoGrid) return;
        
        if (!videos || Object.keys(videos).length === 0) {
            videoGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                    <h3>Нет загруженных видео</h3>
                    <p>Будьте первым, кто загрузит видео!</p>
                    <button onclick="window.location.href='upload.html'" style="margin-top: 16px; padding: 12px 24px; background-color: #065fd4; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        Загрузить видео
                    </button>
                </div>
            `;
            return;
        }
        
        const videoArray = Object.values(videos);
        const sortedVideos = videoArray.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        const videoCards = sortedVideos.map(video => {
            const youTubeId = extractYouTubeId(video.url);
            
            return `
                <div class="video-card" onclick="window.location.href='video.html?id=${video.id}'">
                    <div class="video-thumbnail">
                        <img src="${generateThumbnail(youTubeId)}" alt="${video.title}" onerror="this.src='https://via.placeholder.com/320x180/252525/ffffff?text=No+Preview'">
                        <div class="video-thumbnail-overlay">8:15</div>
                    </div>
                    <div class="video-info">
                        <div class="channel-avatar-small">${video.channelAvatar || video.channelName?.charAt(0) || 'А'}</div>
                        <div class="video-details">
                            <h3>${video.title || 'Без названия'}</h3>
                            <div class="channel-name">${video.channelName || 'Автор'}</div>
                            <div class="video-stats">
                                <span>${formatNumber(video.views || 0)} просмотров</span>
                                <span>•</span>
                                <span>${formatDate(video.timestamp)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        videoGrid.innerHTML = videoCards.join('');
        
    } catch (error) {
        console.error('Ошибка загрузки видео:', error);
    }
}

// Загрузка страницы видео
async function loadVideoPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('id');
    
    if (!videoId) {
        window.location.href = 'index.html';
        return;
    }
    
    try {
        const video = await db.getVideo(videoId);
        
        if (!video) {
            window.location.href = 'index.html';
            return;
        }
        
        const youTubeId = extractYouTubeId(video.url);
        
        // Обновляем информацию о видео
        document.getElementById('video-title').textContent = video.title || 'Без названия';
        document.getElementById('video-views').textContent = formatNumber(video.views || 0) + ' просмотров';
        document.getElementById('video-date').textContent = formatDate(video.timestamp);
        document.getElementById('like-count').textContent = formatNumber(video.likes || 0);
        document.getElementById('dislike-count').textContent = formatNumber(video.dislikes || 0);
        document.getElementById('channel-name').textContent = video.channelName || 'Автор';
        document.getElementById('channel-avatar').textContent = video.channelAvatar || video.channelName?.charAt(0) || 'А';
        document.getElementById('video-description').textContent = video.description || 'Нет описания';
        
        // Загружаем YouTube видео
        const player = document.getElementById('video-player');
        if (youTubeId && player) {
            player.innerHTML = `
                <iframe 
                    width="100%" 
                    height="100%" 
                    src="https://www.youtube.com/embed/${youTubeId}" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
                </iframe>
            `;
        }
        
        // Увеличиваем счетчик просмотров
        await db.updateVideo(videoId, { views: (video.views || 0) + 1 });
        
        // Загружаем рекомендации
        await loadRecommendations(videoId);
        
    } catch (error) {
        console.error('Ошибка загрузки видео:', error);
    }
}

// Загрузка рекомендаций
async function loadRecommendations(currentVideoId) {
    try {
        const videos = await db.getAllVideos();
        const recommendationsList = document.getElementById('recommendations-list');
        
        if (!recommendationsList) return;
        
        if (!videos || Object.keys(videos).length === 0) {
            recommendationsList.innerHTML = '<p style="color: #aaa; padding: 20px;">Нет рекомендаций</p>';
            return;
        }
        
        const videoArray = Object.values(videos);
        const recommendations = videoArray
            .filter(video => video && video.id !== currentVideoId)
            .sort(() => Math.random() - 0.5)
            .slice(0, 5);
        
        if (recommendations.length === 0) {
            recommendationsList.innerHTML = '<p style="color: #aaa; padding: 20px;">Нет рекомендаций</p>';
            return;
        }
        
        const recommendationCards = recommendations.map(video => {
            const youTubeId = extractYouTubeId(video.url);
            
            return `
                <div class="recommendation-card" onclick="window.location.href='video.html?id=${video.id}'">
                    <div class="recommendation-thumbnail">
                        <img src="${generateThumbnail(youTubeId)}" alt="${video.title}" onerror="this.src='https://via.placeholder.com/168x94/252525/ffffff?text=No+Preview'">
                    </div>
                    <div class="recommendation-info">
                        <h4>${video.title || 'Без названия'}</h4>
                        <div class="recommendation-channel">${video.channelName || 'Автор'}</div>
                        <div class="recommendation-stats">
                            <span>${formatNumber(video.views || 0)} просмотров</span>
                            <span>•</span>
                            <span>${formatDate(video.timestamp)}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        recommendationsList.innerHTML = recommendationCards.join('');
            
    } catch (error) {
        console.error('Ошибка загрузки рекомендаций:', error);
    }
}

// Настройка загрузки видео
function setupUploadForm() {
    const uploadBtn = document.getElementById('upload-submit-btn');
    
    if (uploadBtn) {
        uploadBtn.addEventListener('click', async () => {
            const url = document.getElementById('video-url').value.trim();
            const title = document.getElementById('video-title').value.trim();
            const description = document.getElementById('video-description').value.trim();
            const channelName = document.getElementById('channel-name').value.trim();
            const channelAvatar = document.getElementById('channel-avatar').value.trim().charAt(0);
            
            if (!url || !title || !channelName) {
                alert('Пожалуйста, заполните все обязательные поля');
                return;
            }
            
            const youTubeId = extractYouTubeId(url);
            if (!youTubeId) {
                alert('Некорректная ссылка на YouTube видео');
                return;
            }
            
            const videoData = {
                url,
                title,
                description,
                channelName,
                channelAvatar: channelAvatar || channelName.charAt(0),
                timestamp: Date.now()
            };
            
            try {
                const videoId = await db.addVideo(videoData);
                alert('Видео успешно загружено!');
                window.location.href = `video.html?id=${videoId}`;
            } catch (error) {
                console.error('Ошибка загрузки видео:', error);
                alert('Ошибка при загрузке видео');
            }
        });
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log("Страница загружена");
    
    // Определяем, какую страницу загружать
    const path = window.location.pathname;
    
    if (path.includes('index.html') || path === '/' || (path.includes('.html') === false && path.includes('/') === false)) {
        console.log("Загружаем главную страницу");
        loadHomePage();
    }
    
    if (path.includes('video.html')) {
        console.log("Загружаем страницу видео");
        loadVideoPage();
    }
    
    if (path.includes('upload.html')) {
        console.log("Настраиваем форму загрузки");
        setupUploadForm();
    }
    
    // Настройка поиска
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    
    if (searchInput && searchButton) {
        searchButton.addEventListener('click', () => {
            const query = searchInput.value.trim();
            if (query) {
                alert('Поиск: ' + query + ' (функция поиска в разработке)');
            }
        });
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchButton.click();
            }
        });
    }
    
    // Настройка меню
    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.style.display = sidebar.style.display === 'none' ? 'block' : 'none';
            }
        });
    }
});
