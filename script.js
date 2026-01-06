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

// Нормальное открытие видео без зеленого экрана
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

async function loadVideoPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('id');
    
    if (!videoId) {
        window.location.href = 'index.html';
        return;
    }
    
    currentVideoId = videoId;
    
    try {
        const video = await db.getVideo(videoId);
        
        if (!video) {
            window.location.href = 'index.html';
            return;
        }
        
        const youTubeId = extractYouTubeId(video.url);
        
        document.getElementById('video-title').textContent = video.title || 'Без названия';
        document.getElementById('video-views').textContent = formatNumber(video.views || 0) + ' просмотров';
        document.getElementById('video-date').textContent = formatDate(video.timestamp);
        document.getElementById('like-count').textContent = formatNumber(video.likes || 0);
        document.getElementById('dislike-count').textContent = formatNumber(video.dislikes || 0);
        document.getElementById('channel-name').textContent = video.channelName || 'Автор';
        document.getElementById('channel-subs').textContent = formatNumber(video.subscribers || 0) + ' подписчиков';
        document.getElementById('channel-avatar').textContent = video.channelAvatar || (video.channelName || 'А').charAt(0);
        document.getElementById('video-description').textContent = video.description || 'Нет описания';
        
        const player = document.getElementById('video-player');
        if (youTubeId && player) {
            // Используем YouTube iframe с embed для России
            // Добавляем параметр origin для обхода ограничений
            const embedUrl = `https://www.youtube.com/embed/${youTubeId}?autoplay=1&rel=0&modestbranding=1&origin=${window.location.origin}`;
            
            player.innerHTML = `
                <iframe 
                    width="100%" 
                    height="100%" 
                    src="${embedUrl}" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen
                    loading="lazy">
                </iframe>
            `;
            
            // Fallback если iframe не загружается
            setTimeout(() => {
                const iframe = player.querySelector('iframe');
                if (!iframe || !iframe.contentWindow) {
                    loadYouTubeFallback(youTubeId, player);
                }
            }, 3000);
            
        } else if (player) {
            player.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #000; color: #fff; border-radius: 12px;">
                    <div style="text-align: center;">
                        <h3 style="margin-bottom: 12px;">Ошибка загрузки видео</h3>
                        <p style="color: #B0B0B0;">Неверная ссылка на YouTube</p>
                    </div>
                </div>
            `;
        }
        
        // Увеличиваем просмотры
        await db.updateVideo(videoId, { views: (video.views || 0) + 1 });
        
        // Загружаем рекомендации
        await loadRecommendations(videoId);
        
        // Настраиваем интерактивные элементы
        setupVideoInteractions();
        
        // Добавляем эффект загрузки
        document.querySelector('.video-page').style.opacity = '0';
        setTimeout(() => {
            document.querySelector('.video-page').style.transition = 'opacity 0.4s ease';
            document.querySelector('.video-page').style.opacity = '1';
        }, 100);
        
    } catch (error) {
        console.error('Error loading video:', error);
        const player = document.getElementById('video-player');
        if (player) {
            player.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; background: #1E1E1E; color: #fff; border-radius: 12px; padding: 20px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #f44336; margin-bottom: 20px;"></i>
                    <h3 style="margin-bottom: 12px;">Оши��ка загрузки</h3>
                    <p style="color: #B0B0B0; text-align: center; margin-bottom: 24px;">Попробуйте обновить страницу или выбрать другое видео</p>
                    <button onclick="window.history.back()" style="padding: 12px 24px; background-color: #2E7D32; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        Назад
                    </button>
                </div>
            `;
        }
    }
}

function loadYouTubeFallback(youTubeId, playerElement) {
    // Fallback через YouTube-nocookie.com
    const fallbackUrl = `https://www.youtube-nocookie.com/embed/${youTubeId}?autoplay=1`;
    
    playerElement.innerHTML = `
        <iframe 
            width="100%" 
            height="100%" 
            src="${fallbackUrl}" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen>
        </iframe>
        <div style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
            Используется резервный плеер
        </div>
    `;
}

async function loadRecommendations(currentVideoId) {
    try {
        const videos = await db.getAllVideos();
        const recommendationsList = document.getElementById('recommendations-list');
        
        if (!recommendationsList) return;
        
        if (!videos) {
            recommendationsList.innerHTML = '<p style="color: #B0B0B0; text-align: center; padding: 20px;">Нет рекомендаций</p>';
            return;
        }
        
        const videoArray = Object.values(videos).filter(v => v && v.id !== currentVideoId);
        
        if (videoArray.length === 0) {
            recommendationsList.innerHTML = '<p style="color: #B0B0B0; text-align: center; padding: 20px;">Нет рекомендаций</p>';
            return;
        }
        
        // Улучшенная система рекомендаций:
        // 1. Случайные видео
        // 2. Видео от того же автора (приоритет)
        // 3. Самые новые видео
        
        const currentVideo = await db.getVideo(currentVideoId);
        const currentChannel = currentVideo?.channelName;
        
        // Видео от того же автора
        const sameChannelVideos = videoArray.filter(v => v.channelName === currentChannel);
        
        // Случайные видео
        const randomVideos = [...videoArray]
            .sort(() => Math.random() - 0.5)
            .slice(0, Math.min(5, videoArray.length));
        
        // Смешиваем: сначала от того же автора, потом случайные
        let recommendations = [];
        if (sameChannelVideos.length > 0) {
            recommendations = [...sameChannelVideos.slice(0, 2), ...randomVideos.slice(0, 3)];
        } else {
            recommendations = randomVideos.slice(0, 5);
        }
        
        // Убираем дубликаты
        recommendations = recommendations.filter((v, i, a) => 
            a.findIndex(v2 => v2.id === v.id) === i
        ).slice(0, 5);
        
        if (recommendations.length === 0) {
            recommendationsList.innerHTML = '<p style="color: #B0B0B0; text-align: center; padding: 20px;">Нет рекомендаций</p>';
            return;
        }
        
        recommendationsList.innerHTML = recommendations
            .map(video => createRecommendationCard(video))
            .join('');
            
    } catch (error) {
        console.error('Error loading recommendations:', error);
        recommendationsList.innerHTML = '<p style="color: #B0B0B0; text-align: center; padding: 20px;">Ошибка загрузки рекомендаций</p>';
    }
}

// Анимации кнопок
function animateButton(button) {
    if (button) {
        button.style.transform = 'scale(0.95)';
        setTimeout(() => {
            button.style.transform = 'scale(1)';
        }, 200);
    }
}

// Ripple эффект
function createRipple(event) {
    const button = event.currentTarget;
    const circle = document.createElement("span");
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - button.getBoundingClientRect().left - radius}px`;
    circle.style.top = `${event.clientY - button.getBoundingClientRect().top - radius}px`;
    circle.classList.add("ripple");

    const ripple = button.getElementsByClassName("ripple")[0];
    if (ripple) ripple.remove();

    button.appendChild(circle);
}

function setupVideoInteractions() {
    const likeBtn = document.getElementById('like-btn');
    const dislikeBtn = document.getElementById('dislike-btn');
    const subscribeBtn = document.getElementById('subscribe-btn');
    
    if (likeBtn) {
        likeBtn.addEventListener('click', async (e) => {
            createRipple(e);
            animateButton(likeBtn);
            
            if (!currentVideoId) return;
            
            try {
                const video = await db.getVideo(currentVideoId);
                if (!video) return;
                
                let newLikes = video.likes || 0;
                
                if (userLiked) {
                    newLikes--;
                    likeBtn.classList.remove('liked');
                    likeBtn.innerHTML = '<i class="far fa-thumbs-up"></i><span>' + formatNumber(newLikes) + '</span>';
                } else {
                    newLikes++;
                    likeBtn.classList.add('liked');
                    likeBtn.innerHTML = '<i class="fas fa-thumbs-up"></i><span>' + formatNumber(newLikes) + '</span>';
                    
                    if (userDisliked) {
                        userDisliked = false;
                        const newDislikes = Math.max(0, (video.dislikes || 0) - 1);
                        dislikeBtn.classList.remove('disliked');
                        dislikeBtn.innerHTML = '<i class="far fa-thumbs-down"></i><span>' + formatNumber(newDislikes) + '</span>';
                        await db.updateVideo(currentVideoId, { dislikes: newDislikes });
                    }
                }
                
                userLiked = !userLiked;
                await db.updateVideo(currentVideoId, { likes: newLikes });
                document.getElementById('like-count').textContent = formatNumber(newLikes);
                
            } catch (error) {
                console.error('Error updating like:', error);
            }
        });
    }
    
    if (dislikeBtn) {
        dislikeBtn.addEventListener('click', async (e) => {
            createRipple(e);
            animateButton(dislikeBtn);
            
            if (!currentVideoId) return;
            
            try {
                const video = await db.getVideo(currentVideoId);
                if (!video) return;
                
                let newDislikes = video.dislikes || 0;
                
                if (userDisliked) {
                    newDislikes--;
                    dislikeBtn.classList.remove('disliked');
                    dislikeBtn.innerHTML = '<i class="far fa-thumbs-down"></i><span>' + formatNumber(newDislikes) + '</span>';
                } else {
                    newDislikes++;
                    dislikeBtn.classList.add('disliked');
                    dislikeBtn.innerHTML = '<i class="fas fa-thumbs-down"></i><span>' + formatNumber(newDislikes) + '</span>';
                    
                    if (userLiked) {
                        userLiked = false;
                        const newLikes = Math.max(0, (video.likes || 0) - 1);
                        likeBtn.classList.remove('liked');
                        likeBtn.innerHTML = '<i class="far fa-thumbs-up"></i><span>' + formatNumber(newLikes) + '</span>';
                        await db.updateVideo(currentVideoId, { likes: newLikes });
                    }
                }
                
                userDisliked = !userDisliked;
                await db.updateVideo(currentVideoId, { dislikes: newDislikes });
                document.getElementById('dislike-count').textContent = formatNumber(newDislikes);
                
            } catch (error) {
                console.error('Error updating dislike:', error);
            }
        });
    }
    
    if (subscribeBtn) {
        subscribeBtn.addEventListener('click', async (e) => {
            createRipple(e);
            animateButton(subscribeBtn);
            
            if (!currentVideoId) return;
            
            try {
                const video = await db.getVideo(currentVideoId);
                if (!video) return;
                
                let newSubscribers = video.subscribers || 0;
                
                if (userSubscribed) {
                    newSubscribers--;
                    subscribeBtn.innerHTML = '<i class="fas fa-bell"></i> Подписаться';
                    subscribeBtn.classList.remove('subscribed');
                } else {
                    newSubscribers++;
                    subscribeBtn.innerHTML = '<i class="fas fa-bell-slash"></i> Вы подписаны';
                    subscribeBtn.classList.add('subscribed');
                }
                
                userSubscribed = !userSubscribed;
                await db.updateVideo(currentVideoId, { subscribers: newSubscribers });
                document.getElementById('channel-subs').textContent = formatNumber(newSubscribers) + ' подписчиков';
                
            } catch (error) {
                console.error('Error updating subscription:', error);
            }
        });
    }
    
    // Добавляем ripple эффект ко всем кнопкам действий
    const actionButtons = document.querySelectorAll('.video-action-btn, .subscribe-btn, .auth-btn, .upload-btn');
    actionButtons.forEach(button => {
        button.addEventListener('click', createRipple);
    });
}

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
                showNotification('Пожалуйста, заполните все обязательные поля', 'error');
                return;
            }
            
            const youTubeId = extractYouTubeId(url);
            if (!youTubeId) {
                showNotification('Некорректная ссылка на YouTube видео', 'error');
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
                // Анимация загрузки
                uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка...';
                uploadBtn.disabled = true;
                
                const videoId = await db.addVideo(videoData);
                console.log('Video uploaded with ID:', videoId);
                
                showNotification('Видео успешно загружено!', 'success');
                
                // Анимация успеха
                uploadBtn.innerHTML = '<i class="fas fa-check"></i> Успешно!';
                uploadBtn.style.backgroundColor = '#2E7D32';
                
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            } catch (error) {
                console.error('Error uploading video:', error);
                uploadBtn.innerHTML = 'Опубликовать';
                uploadBtn.disabled = false;
                showNotification('Ошибка при загрузке видео: ' + error.message, 'error');
            }
        });
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

// Мобильная навигация и поиск
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
            <a href="#" class="mobile-nav-item" onclick="showMobileProfile()">
                <i class="fas fa-user"></i>
                <span>Профиль</span>
            </a>
        `;
        
        document.body.appendChild(mobileNav);
        
        // Удаляем обычный поиск из header на мобильных
        const searchBar = document.querySelector('.search-bar');
        if (searchBar) searchBar.style.display = 'none';
        
        // Добавляем кнопку поиска в header для мобильных
        const header = document.querySelector('.header');
        if (header && !document.querySelector('.mobile-search-btn')) {
            const mobileSearchBtn = document.createElement('button');
            mobileSearchBtn.className = 'mobile-search-btn';
            mobileSearchBtn.innerHTML = '<i class="fas fa-search"></i>';
            mobileSearchBtn.onclick = showMobileSearch;
            
            // Вставляем перед кнопкой "Войти"
            const authBtn = document.querySelector('.auth-btn');
            if (authBtn && authBtn.parentNode) {
                authBtn.parentNode.insertBefore(mobileSearchBtn, authBtn);
            }
        }
    } else {
        // На десктопе показываем обычный поиск
        const searchBar = document.querySelector('.search-bar');
        if (searchBar) searchBar.style.display = 'flex';
        
        // Удаляем мобильные элементы
        const mobileNav = document.querySelector('.mobile-bottom-nav');
        if (mobileNav) mobileNav.remove();
        
        const mobileSearchBtn = document.querySelector('.mobile-search-btn');
        if (mobileSearchBtn) mobileSearchBtn.remove();
        
        const searchModal = document.querySelector('.mobile-search-modal');
        if (searchModal) searchModal.remove();
    }
}

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

function showMobileTrending() {
    showNotification('Раздел "В тренде" в разработке', 'info');
}

function showMobileProfile() {
    showNotification('Вход в аккаунт в разработке', 'info');
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
    
    if (window.location.pathname.includes('video.html')) {
        loadVideoPage();
    }
    
    if (window.location.pathname.includes('upload.html')) {
        setupUploadForm();
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
                
                // Анимация значка меню
                const icon = menuToggle.querySelector('i');
                if (icon) {
                    if (sidebar.classList.contains('closed')) {
                        icon.classList.remove('fa-times');
                        icon.classList.add('fa-bars');
                    } else {
                        icon.classList.remove('fa-bars');
                        icon.classList.add('fa-times');
                    }
                }
            }
        });
    }
    
    // Закрытие меню при клике вне его
    document.addEventListener('click', (event) => {
        const sidebar = document.querySelector('.sidebar');
        const menuToggle = document.querySelector('.menu-toggle');
        
        if (sidebar && menuToggle && 
            !sidebar.contains(event.target) && 
            !menuToggle.contains(event.target) &&
            !sidebar.classList.contains('closed')) {
            sidebar.classList.add('closed');
            
            const icon = menuToggle.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        }
    });
    
    // Инициализация мобильной навигации
    setupMobileNavigation();
    
    // Адаптация при изменении размера окна
    window.addEventListener('resize', setupMobileNavigation);
    
    // Запускаем адаптацию при загрузке
    setTimeout(() => {
        setupMobileNavigation();
        
        // Плавное появление контента
        document.body.style.opacity = '0';
        setTimeout(() => {
            document.body.style.transition = 'opacity 0.3s ease';
            document.body.style.opacity = '1';
        }, 100);
    }, 100);
    
    // Добавляем глобальные функции
    window.openVideo = openVideo;
    window.goToUpload = goToUpload;
    window.showMobileSearch = showMobileSearch;
    window.showMobileTrending = showMobileTrending;
    window.showMobileProfile = showMobileProfile;
    window.performSearch = performSearch;
    window.searchFromSuggestion = searchFromSuggestion;
});
