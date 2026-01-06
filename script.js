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
        <div class="video-card" onclick="openVideoWithAnimation('${video.id}')">
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
        <div class="recommendation-card" onclick="openVideoWithAnimation('${video.id}')">
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

// Анимация открытия видео
function openVideoWithAnimation(videoId) {
    const videoCard = event.currentTarget;
    
    // Создаем эффект расширения
    const rect = videoCard.getBoundingClientRect();
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: ${rect.top}px;
        left: ${rect.left}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        background: #2E7D32;
        border-radius: 12px;
        z-index: 9999;
        animation: expandVideo 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    `;
    
    document.body.appendChild(overlay);
    
    // Анимация расширения
    setTimeout(() => {
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: #2E7D32;
            z-index: 9999;
            animation: fadeToPage 0.3s ease forwards;
        `;
    }, 600);
    
    // Переход на страницу видео
    setTimeout(() => {
        window.location.href = `video.html?id=${videoId}`;
    }, 900);
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
                    <button onclick="animateUploadButton()" style="padding: 14px 32px; background-color: #2E7D32; color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 16px; transition: all 0.3s;">
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
            videoGrid.innerHTML = Object.values(videos)
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
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
            // Пытаемся использовать разные прокси
            const proxies = [
                `https://piped.video/embed/${youTubeId}`,
                `https://yewtu.be/embed/${youTubeId}`,
                `https://vid.puffyan.us/embed/${youTubeId}`
            ];
            
            player.innerHTML = `
                <iframe 
                    width="100%" 
                    height="100%" 
                    src="${proxies[0]}" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen
                    loading="lazy">
                </iframe>
            `;
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
                    <h3 style="margin-bottom: 12px;">Ошибка загрузки</h3>
                    <p style="color: #B0B0B0; text-align: center; margin-bottom: 24px;">Попробуйте обновить страницу или выбрать другое видео</p>
                    <button onclick="window.history.back()" style="padding: 12px 24px; background-color: #2E7D32; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        Назад
                    </button>
                </div>
            `;
        }
    }
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
        
        const videoArray = Object.values(videos);
        const recommendations = videoArray
            .filter(video => video && video.id !== currentVideoId)
            .sort(() => Math.random() - 0.5)
            .slice(0, 5);
        
        if (recommendations.length === 0) {
            recommendationsList.innerHTML = '<p style="color: #B0B0B0; text-align: center; padding: 20px;">Нет рекомендаций</p>';
            return;
        }
        
        recommendationsList.innerHTML = recommendations
            .map(video => createRecommendationCard(video))
            .join('');
            
    } catch (error) {
        console.error('Error loading recommendations:', error);
    }
}

function animateLikeButton() {
    const likeBtn = document.getElementById('like-btn');
    if (likeBtn) {
        likeBtn.style.transform = 'scale(1.1)';
        setTimeout(() => {
            likeBtn.style.transform = 'scale(1)';
        }, 200);
    }
}

function animateDislikeButton() {
    const dislikeBtn = document.getElementById('dislike-btn');
    if (dislikeBtn) {
        dislikeBtn.style.transform = 'scale(1.1)';
        setTimeout(() => {
            dislikeBtn.style.transform = 'scale(1)';
        }, 200);
    }
}

function animateSubscribeButton() {
    const subscribeBtn = document.getElementById('subscribe-btn');
    if (subscribeBtn) {
        subscribeBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            subscribeBtn.style.transform = 'scale(1)';
        }, 200);
    }
}

function setupVideoInteractions() {
    const likeBtn = document.getElementById('like-btn');
    const dislikeBtn = document.getElementById('dislike-btn');
    const subscribeBtn = document.getElementById('subscribe-btn');
    
    // Анимация ripple эффекта
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
    
    if (likeBtn) {
        likeBtn.addEventListener('click', async (e) => {
            createRipple(e);
            animateLikeButton();
            
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
            animateDislikeButton();
            
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
            animateSubscribeButton();
            
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

// Мобильная навигация
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
            <a href="#" class="mobile-nav-item" onclick="showMobileTrending()">
                <i class="fas fa-fire"></i>
                <span>В тренде</span>
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
        
        // Добавляем мобильный поиск в header
        const header = document.querySelector('.header');
        const searchBar = document.querySelector('.search-bar');
        
        if (searchBar && header) {
            const mobileSearch = document.createElement('div');
            mobileSearch.className = 'mobile-search-bar';
            mobileSearch.innerHTML = `
                <input type="text" placeholder="Поиск видео..." id="mobile-search-input">
                <button id="mobile-search-button"><i class="fas fa-search"></i></button>
            `;
            
            // Находим header-right и вставляем перед ним
            const headerRight = document.querySelector('.header-right');
            if (headerRight) {
                header.insertBefore(mobileSearch, headerRight);
            }
            
            // Обработка мобильного поиска
            const mobileSearchInput = document.getElementById('mobile-search-input');
            const mobileSearchButton = document.getElementById('mobile-search-button');
            
            if (mobileSearchButton) {
                mobileSearchButton.addEventListener('click', () => {
                    const query = mobileSearchInput ? mobileSearchInput.value.trim() : '';
                    if (query) {
                        showNotification('Поиск: ' + query + ' (функция поиска в разработке)', 'info');
                    }
                });
            }
            
            if (mobileSearchInput) {
                mobileSearchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        mobileSearchButton.click();
                    }
                });
            }
        }
        
        // Добавляем стили для уведомлений
        const style = document.createElement('style');
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #1E1E1E;
                color: white;
                padding: 16px 20px;
                border-radius: 12px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 9999;
                transform: translateX(100%);
                opacity: 0;
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s;
                border-left: 4px solid #2E7D32;
                max-width: 350px;
            }
            
            .notification.show {
                transform: translateX(0);
                opacity: 1;
            }
            
            .notification-success {
                border-left-color: #2E7D32;
            }
            
            .notification-error {
                border-left-color: #f44336;
            }
            
            .notification i {
                font-size: 20px;
            }
            
            .notification-success i {
                color: #2E7D32;
            }
            
            .notification-error i {
                color: #f44336;
            }
            
            .ripple {
                position: absolute;
                border-radius: 50%;
                background: rgba(46, 125, 50, 0.4);
                transform: scale(0);
                animation: ripple-animation 0.6s linear;
            }
            
            @keyframes ripple-animation {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
            
            @keyframes expandVideo {
                0% {
                    transform: scale(1);
                    border-radius: 12px;
                }
                100% {
                    transform: scale(1.05);
                    border-radius: 16px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
                }
            }
            
            @keyframes fadeToPage {
                0% {
                    opacity: 1;
                }
                100% {
                    opacity: 0;
                    visibility: hidden;
                }
            }
            
            .upload-success-animation {
                animation: uploadSuccess 0.5s ease;
            }
            
            @keyframes uploadSuccess {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }
}

function showMobileTrending() {
    showNotification('Раздел "В тренде" в разработке', 'info');
}

function showMobileProfile() {
    showNotification('Вход в аккаунт в разработке', 'info');
}

function animateUploadButton() {
    const button = event?.target || document.querySelector('button[onclick*="upload.html"]');
    if (button) {
        button.classList.add('upload-success-animation');
        setTimeout(() => {
            button.classList.remove('upload-success-animation');
            window.location.href = 'upload.html';
        }, 500);
    } else {
        window.location.href = 'upload.html';
    }
}

// Основная инициализация
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация страниц
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        loadHomePage();
    }
    
    if (window.location.pathname.includes('video.html')) {
        loadVideoPage();
    }
    
    if (window.location.pathname.includes('upload.html')) {
        setupUploadForm();
    }
    
    // Поиск
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    
    if (searchInput && searchButton) {
        searchButton.addEventListener('click', () => {
            const query = searchInput.value.trim();
            if (query) {
                showNotification('Поиск: ' + query + ' (функция поиска в разработке)', 'info');
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
    window.addEventListener('resize', () => {
        setupMobileNavigation();
        
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');
        
        if (window.innerWidth <= 768) {
            if (sidebar) sidebar.classList.add('closed');
            if (mainContent) mainContent.classList.add('sidebar-hidden');
        } else {
            if (sidebar) sidebar.classList.remove('closed');
            if (mainContent) mainContent.classList.remove('sidebar-hidden');
            
            // Удаляем мобильную навигацию на десктопе
            const mobileNav = document.querySelector('.mobile-bottom-nav');
            if (mobileNav) mobileNav.remove();
            
            const mobileSearch = document.querySelector('.mobile-search-bar');
            if (mobileSearch) mobileSearch.remove();
        }
    });
    
    // Запускаем адаптацию при загрузке
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        
        // Плавное появление контента
        document.body.style.opacity = '0';
        setTimeout(() => {
            document.body.style.transition = 'opacity 0.3s ease';
            document.body.style.opacity = '1';
        }, 100);
    }, 100);
    
    // Добавляем глобальные функции
    window.openVideoWithAnimation = openVideoWithAnimation;
    window.animateUploadButton = animateUploadButton;
    window.showMobileTrending = showMobileTrending;
    window.showMobileProfile = showMobileProfile;
});
