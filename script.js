// ==== FIREBASE ИНИЦИАЛИЗАЦИЯ ====
const firebaseConfig = {
    databaseURL: "https://flum-2-default-rtdb.firebaseio.com"
};

// Инициализируем Firebase
try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
} catch (error) {
    console.log("Firebase уже инициализирован");
}

const database = firebase.database();
const auth = firebase.auth();

// ==== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====
let currentUser = null;
let currentVideoId = null;

// ==== ДАТАБЕЙС ФУНКЦИИ ====
const db = {
    // Пользователи
    getUser: async (userId) => {
        try {
            const snapshot = await database.ref(`users/${userId}`).once('value');
            return snapshot.val();
        } catch (error) {
            console.error("Error getting user:", error);
            return null;
        }
    },

    createUser: async (userId, userData) => {
        try {
            await database.ref(`users/${userId}`).set({
                ...userData,
                createdAt: Date.now(),
                subscribers: 0,
                videos: 0,
                views: 0
            });
        } catch (error) {
            console.error("Error creating user:", error);
        }
    },

    updateUser: async (userId, updates) => {
        try {
            await database.ref(`users/${userId}`).update(updates);
        } catch (error) {
            console.error("Error updating user:", error);
        }
    },

    // Видео
    getAllVideos: async () => {
        try {
            const snapshot = await database.ref('videos').once('value');
            return snapshot.val() || {};
        } catch (error) {
            console.error("Error getting videos:", error);
            return {};
        }
    },

    getVideo: async (videoId) => {
        try {
            const snapshot = await database.ref(`videos/${videoId}`).once('value');
            return snapshot.val();
        } catch (error) {
            console.error("Error getting video:", error);
            return null;
        }
    },

    addVideo: async (userId, videoData) => {
        try {
            const newVideoRef = database.ref('videos').push();
            const videoId = newVideoRef.key;
            
            const videoWithId = {
                ...videoData,
                id: videoId,
                userId: userId,
                timestamp: Date.now(),
                likes: 0,
                dislikes: 0,
                views: 0,
                comments: 0
            };
            
            await newVideoRef.set(videoWithId);
            
            // Обновляем счетчик видео у пользователя
            const user = await db.getUser(userId);
            if (user) {
                await db.updateUser(userId, {
                    videos: (user.videos || 0) + 1
                });
            }
            
            return videoId;
        } catch (error) {
            console.error("Error adding video:", error);
            throw error;
        }
    },

    updateVideo: async (videoId, updates) => {
        try {
            await database.ref(`videos/${videoId}`).update(updates);
        } catch (error) {
            console.error("Error updating video:", error);
        }
    },

    getUserVideos: async (userId) => {
        try {
            const snapshot = await database.ref('videos').orderByChild('userId').equalTo(userId).once('value');
            return snapshot.val() || {};
        } catch (error) {
            console.error("Error getting user videos:", error);
            return {};
        }
    },

    // Подписки
    subscribe: async (subscriberId, channelId) => {
        try {
            await database.ref(`subscriptions/${subscriberId}/${channelId}`).set(true);
            const user = await db.getUser(channelId);
            if (user) {
                await db.updateUser(channelId, {
                    subscribers: (user.subscribers || 0) + 1
                });
            }
        } catch (error) {
            console.error("Error subscribing:", error);
        }
    },

    unsubscribe: async (subscriberId, channelId) => {
        try {
            await database.ref(`subscriptions/${subscriberId}/${channelId}`).remove();
            const user = await db.getUser(channelId);
            if (user && user.subscribers > 0) {
                await db.updateUser(channelId, {
                    subscribers: Math.max(0, (user.subscribers || 0) - 1)
                });
            }
        } catch (error) {
            console.error("Error unsubscribing:", error);
        }
    },

    isSubscribed: async (subscriberId, channelId) => {
        try {
            const snapshot = await database.ref(`subscriptions/${subscriberId}/${channelId}`).once('value');
            return snapshot.exists();
        } catch (error) {
            console.error("Error checking subscription:", error);
            return false;
        }
    },

    getSubscriptions: async (userId) => {
        try {
            const snapshot = await database.ref(`subscriptions/${userId}`).once('value');
            return snapshot.val() || {};
        } catch (error) {
            console.error("Error getting subscriptions:", error);
            return {};
        }
    },

    // Комментарии
    addComment: async (videoId, userId, commentText) => {
        try {
            const newCommentRef = database.ref(`comments/${videoId}`).push();
            const commentId = newCommentRef.key;
            
            const comment = {
                id: commentId,
                userId: userId,
                text: commentText,
                timestamp: Date.now(),
                likes: 0
            };
            
            await newCommentRef.set(comment);
            
            // Обновляем счетчик комментариев у видео
            const video = await db.getVideo(videoId);
            if (video) {
                await db.updateVideo(videoId, {
                    comments: (video.comments || 0) + 1
                });
            }
            
            return commentId;
        } catch (error) {
            console.error("Error adding comment:", error);
            throw error;
        }
    },

    getComments: async (videoId) => {
        try {
            const snapshot = await database.ref(`comments/${videoId}`).once('value');
            return snapshot.val() || {};
        } catch (error) {
            console.error("Error getting comments:", error);
            return {};
        }
    },

    likeComment: async (videoId, commentId, userId) => {
        try {
            await database.ref(`commentLikes/${commentId}/${userId}`).set(true);
            await database.ref(`comments/${videoId}/${commentId}/likes`).transaction(current => (current || 0) + 1);
        } catch (error) {
            console.error("Error liking comment:", error);
        }
    },

    // Лайки видео
    likeVideo: async (videoId, userId) => {
        try {
            await database.ref(`videoLikes/${videoId}/${userId}`).set(true);
            await database.ref(`videos/${videoId}/likes`).transaction(current => (current || 0) + 1);
        } catch (error) {
            console.error("Error liking video:", error);
        }
    },

    unlikeVideo: async (videoId, userId) => {
        try {
            await database.ref(`videoLikes/${videoId}/${userId}`).remove();
            await database.ref(`videos/${videoId}/likes`).transaction(current => Math.max(0, (current || 0) - 1));
        } catch (error) {
            console.error("Error unliking video:", error);
        }
    },

    isLiked: async (videoId, userId) => {
        try {
            const snapshot = await database.ref(`videoLikes/${videoId}/${userId}`).once('value');
            return snapshot.exists();
        } catch (error) {
            console.error("Error checking like:", error);
            return false;
        }
    }
};

// ==== УТИЛИТНЫЕ ФУНКЦИИ ====
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
    if (!num && num !== 0) return '0';
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

// ==== ФУНКЦИИ ДЛЯ АВТОРИЗАЦИИ ====
function showAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function hideAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function showMessage(text, type) {
    const messageEl = document.getElementById('auth-message');
    if (messageEl) {
        messageEl.textContent = text;
        messageEl.style.color = type === 'error' ? '#ff4444' : '#44ff44';
        messageEl.style.display = 'block';
        
        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 3000);
    }
}

function updateUserUI(user) {
    const userMenu = document.getElementById('user-menu');
    if (!userMenu) return;
    
    if (user) {
        currentUser = user;
        
        userMenu.innerHTML = `
            <div class="user-avatar" id="user-avatar-btn">
                ${user.email ? user.email.charAt(0).toUpperCase() : 'А'}
            </div>
            <div class="user-dropdown" id="user-dropdown">
                <div class="user-dropdown-item" onclick="window.location.href='profile.html'">
                    <i class="fas fa-user"></i> Мой канал
                </div>
                <div class="user-dropdown-item" onclick="window.location.href='upload.html'">
                    <i class="fas fa-upload"></i> Загрузить видео
                </div>
                <div class="user-dropdown-divider"></div>
                <div class="user-dropdown-item" onclick="logout()">
                    <i class="fas fa-sign-out-alt"></i> Выйти
                </div>
            </div>
        `;
        
        const avatarBtn = document.getElementById('user-avatar-btn');
        if (avatarBtn) {
            avatarBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = document.getElementById('user-dropdown');
                if (dropdown) {
                    dropdown.classList.toggle('active');
                }
            });
        }
        
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('user-dropdown');
            if (dropdown && !e.target.closest('.user-menu')) {
                dropdown.classList.remove('active');
            }
        });
        
    } else {
        currentUser = null;
        userMenu.innerHTML = `
            <button class="auth-btn" id="auth-btn">
                <i class="fas fa-user"></i> Войти
            </button>
        `;
        const authBtn = document.getElementById('auth-btn');
        if (authBtn) {
            authBtn.addEventListener('click', showAuthModal);
        }
    }
}

async function login(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        let userData = await db.getUser(user.uid);
        if (!userData) {
            userData = {
                name: email.split('@')[0],
                email: email,
                avatar: email.charAt(0).toUpperCase()
            };
            await db.createUser(user.uid, userData);
        }
        
        updateUserUI(user);
        hideAuthModal();
        showMessage('Успешный вход!', 'success');
        
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

async function register(email, password) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        const userData = {
            name: email.split('@')[0],
            email: email,
            avatar: email.charAt(0).toUpperCase()
        };
        
        await db.createUser(user.uid, userData);
        updateUserUI(user);
        hideAuthModal();
        showMessage('Регистрация успешна!', 'success');
        
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

async function logout() {
    try {
        await auth.signOut();
        updateUserUI(null);
        showMessage('Вы вышли из аккаунта', 'success');
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

// ==== ПРОВЕРКА АВТОРИЗАЦИИ ПЕРЕД ЗАГРУЗКОЙ ====
function checkAuthBeforeUpload() {
    if (!currentUser) {
        showAuthModal();
        return false;
    } else {
        window.location.href = 'upload.html';
        return true;
    }
}

// ==== ВИДЕО ФУНКЦИИ ====
function createVideoCard(video, user) {
    const youTubeId = extractYouTubeId(video.url);
    
    return `
        <div class="video-card" onclick="window.location.href='video.html?id=${video.id}'">
            <div class="video-thumbnail">
                <img src="${generateThumbnail(youTubeId)}" alt="${video.title}" onerror="this.src='https://via.placeholder.com/320x180/252525/ffffff?text=No+Preview'">
                <div class="video-thumbnail-overlay">8:15</div>
            </div>
            <div class="video-info">
                <div class="channel-avatar-small" onclick="event.stopPropagation(); window.location.href='channel.html?id=${video.userId}'">
                    ${user?.avatar || (user?.name?.charAt(0) || 'А')}
                </div>
                <div class="video-details">
                    <h3>${video.title || 'Без названия'}</h3>
                    <div class="channel-name" onclick="event.stopPropagation(); window.location.href='channel.html?id=${video.userId}'">
                        ${user?.name || 'Автор'}
                    </div>
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
                    <button onclick="checkAuthBeforeUpload()" style="margin-top: 16px; padding: 12px 24px; background-color: #065fd4; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        Загрузить видео
                    </button>
                </div>
            `;
            return;
        }
        
        const videoArray = Object.values(videos);
        const sortedVideos = videoArray.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        const videoCards = [];
        for (const video of sortedVideos) {
            const user = await db.getUser(video.userId);
            videoCards.push(createVideoCard(video, user));
        }
        
        videoGrid.innerHTML = videoCards.join('');
        
    } catch (error) {
        console.error('Error loading videos:', error);
    }
}

// ==== ИНИЦИАЛИЗАЦИЯ ====
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM загружен, инициализация...");
    
    // Слушатель состояния авторизации
    auth.onAuthStateChanged((user) => {
        console.log("Auth state changed:", user);
        updateUserUI(user);
    });
    
    // Закрытие модального окна
    const closeModal = document.querySelector('.close-modal');
    if (closeModal) {
        closeModal.addEventListener('click', hideAuthModal);
    }
    
    // Клик вне модального окна
    window.addEventListener('click', (e) => {
        if (e.target.id === 'auth-modal') {
            hideAuthModal();
        }
    });
    
    // Кнопки авторизации
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            if (email && password) {
                login(email, password);
            } else {
                showMessage('Заполните все поля', 'error');
            }
        });
    }
    
    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            if (email && password) {
                register(email, password);
            } else {
                showMessage('Заполните все поля', 'error');
            }
        });
    }
    
    // Загрузка главной страницы
    const path = window.location.pathname;
    if (path.includes('index.html') || path === '/' || (path.includes('.html') === false && path.includes('/') === false)) {
        console.log("Загрузка главной страницы...");
        loadHomePage();
    }
    
    // Поиск
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
    
    // Меню
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

// ==== ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ HTML ====
window.extractYouTubeId = extractYouTubeId;
window.generateThumbnail = generateThumbnail;
window.formatNumber = formatNumber;
window.formatDate = formatDate;
window.showAuthModal = showAuthModal;
window.checkAuthBeforeUpload = checkAuthBeforeUpload;
window.logout = logout;
window.db = db;
