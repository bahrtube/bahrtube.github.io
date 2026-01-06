const firebaseConfig = {
    databaseURL: "https://flum-2-default-rtdb.firebaseio.com"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

let currentUser = null;
let currentVideoId = null;

const db = {
    // Пользователи
    getUser: async (userId) => {
        const snapshot = await database.ref(`users/${userId}`).once('value');
        return snapshot.val();
    },

    createUser: async (userId, userData) => {
        await database.ref(`users/${userId}`).set({
            ...userData,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            subscribers: 0,
            videos: 0,
            views: 0
        });
    },

    updateUser: async (userId, updates) => {
        await database.ref(`users/${userId}`).update(updates);
    },

    // Видео
    getAllVideos: async () => {
        const snapshot = await database.ref('videos').once('value');
        return snapshot.val() || {};
    },

    getVideo: async (videoId) => {
        const snapshot = await database.ref(`videos/${videoId}`).once('value');
        return snapshot.val();
    },

    addVideo: async (userId, videoData) => {
        const newVideoRef = database.ref('videos').push();
        const videoId = newVideoRef.key;
        
        const videoWithId = {
            ...videoData,
            id: videoId,
            userId: userId,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            likes: 0,
            dislikes: 0,
            views: 0,
            comments: 0
        };
        
        await newVideoRef.set(videoWithId);
        
        await db.updateUser(userId, {
            videos: firebase.database.ServerValue.increment(1)
        });
        
        return videoId;
    },

    updateVideo: async (videoId, updates) => {
        await database.ref(`videos/${videoId}`).update(updates);
    },

    getUserVideos: async (userId) => {
        const snapshot = await database.ref('videos').orderByChild('userId').equalTo(userId).once('value');
        return snapshot.val() || {};
    },

    // Подписки
    subscribe: async (subscriberId, channelId) => {
        await database.ref(`subscriptions/${subscriberId}/${channelId}`).set(true);
        await database.ref(`users/${channelId}/subscribers`).transaction(current => (current || 0) + 1);
    },

    unsubscribe: async (subscriberId, channelId) => {
        await database.ref(`subscriptions/${subscriberId}/${channelId}`).remove();
        await database.ref(`users/${channelId}/subscribers`).transaction(current => Math.max(0, (current || 0) - 1));
    },

    isSubscribed: async (subscriberId, channelId) => {
        const snapshot = await database.ref(`subscriptions/${subscriberId}/${channelId}`).once('value');
        return snapshot.exists();
    },

    getSubscriptions: async (userId) => {
        const snapshot = await database.ref(`subscriptions/${userId}`).once('value');
        return snapshot.val() || {};
    },

    // Комментарии
    addComment: async (videoId, userId, commentText) => {
        const newCommentRef = database.ref(`comments/${videoId}`).push();
        const commentId = newCommentRef.key;
        
        const comment = {
            id: commentId,
            userId: userId,
            text: commentText,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            likes: 0
        };
        
        await newCommentRef.set(comment);
        
        await database.ref(`videos/${videoId}/comments`).transaction(current => (current || 0) + 1);
        
        return commentId;
    },

    getComments: async (videoId) => {
        const snapshot = await database.ref(`comments/${videoId}`).once('value');
        return snapshot.val() || {};
    },

    likeComment: async (videoId, commentId, userId) => {
        await database.ref(`commentLikes/${commentId}/${userId}`).set(true);
        await database.ref(`comments/${videoId}/${commentId}/likes`).transaction(current => (current || 0) + 1);
    },

    // Лайки видео
    likeVideo: async (videoId, userId) => {
        await database.ref(`videoLikes/${videoId}/${userId}`).set(true);
        await database.ref(`videos/${videoId}/likes`).transaction(current => (current || 0) + 1);
    },

    unlikeVideo: async (videoId, userId) => {
        await database.ref(`videoLikes/${videoId}/${userId}`).remove();
        await database.ref(`videos/${videoId}/likes`).transaction(current => Math.max(0, (current || 0) - 1));
    },

    isLiked: async (videoId, userId) => {
        const snapshot = await database.ref(`videoLikes/${videoId}/${userId}`).once('value');
        return snapshot.exists();
    }
};

function extractYouTubeId(url) {
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
                    ${user?.avatar || user?.name?.charAt(0) || 'А'}
                </div>
                <div class="video-details">
                    <h3>${video.title}</h3>
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
        
        const videoCards = await Promise.all(sortedVideos.map(async (video) => {
            const user = video.userId ? await db.getUser(video.userId) : null;
            return createVideoCard(video, user);
        }));
        
        videoGrid.innerHTML = videoCards.join('');
        
    } catch (error) {
        console.error('Error loading videos:', error);
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
        
        const user = await db.getUser(video.userId);
        const youTubeId = extractYouTubeId(video.url);
        
        document.getElementById('video-title').textContent = video.title || 'Без названия';
        document.getElementById('video-views').textContent = formatNumber(video.views || 0) + ' просмотров';
        document.getElementById('video-date').textContent = formatDate(video.timestamp);
        document.getElementById('like-count').textContent = formatNumber(video.likes || 0);
        document.getElementById('dislike-count').textContent = formatNumber(video.dislikes || 0);
        document.getElementById('channel-name').textContent = user?.name || 'Автор';
        document.getElementById('channel-subs').textContent = formatNumber(user?.subscribers || 0) + ' подписчиков';
        document.getElementById('channel-avatar').textContent = user?.avatar || (user?.name?.charAt(0) || 'А');
        document.getElementById('channel-avatar').onclick = () => window.location.href = `channel.html?id=${video.userId}`;
        document.getElementById('video-description').textContent = video.description || 'Нет описания';
        
        const player = document.getElementById('video-player');
        if (youTubeId && player) {
            player.innerHTML = `
                <iframe 
                    width="100%" 
                    height="100%" 
                    src="https://www.youtube.com/embed/${youTubeId}?autoplay=1" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
                </iframe>
            `;
        }
        
        await db.updateVideo(videoId, { views: (video.views || 0) + 1 });
        
        await loadRecommendations(videoId);
        await loadComments(videoId);
        setupVideoInteractions(video.userId);
        
    } catch (error) {
        console.error('Error loading video:', error);
    }
}

async function loadComments(videoId) {
    try {
        const comments = await db.getComments(videoId);
        const commentsList = document.getElementById('comments-list');
        
        if (!commentsList) return;
        
        if (!comments || Object.keys(comments).length === 0) {
            commentsList.innerHTML = '<p style="color: #aaa; text-align: center; padding: 20px;">Нет комментариев</p>';
            return;
        }
        
        const commentArray = Object.values(comments);
        const sortedComments = commentArray.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        const commentItems = await Promise.all(sortedComments.map(async (comment) => {
            const user = await db.getUser(comment.userId);
            return `
                <div class="comment">
                    <div class="comment-avatar" onclick="window.location.href='channel.html?id=${comment.userId}'">
                        ${user?.avatar || user?.name?.charAt(0) || 'А'}
                    </div>
                    <div class="comment-content">
                        <div class="comment-header">
                            <span class="comment-author" onclick="window.location.href='channel.html?id=${comment.userId}'">
                                ${user?.name || 'Пользователь'}
                            </span>
                            <span class="comment-time">${formatDate(comment.timestamp)}</span>
                        </div>
                        <div class="comment-text">${comment.text}</div>
                        <div class="comment-actions">
                            <button class="comment-action">
                                <i class="far fa-thumbs-up"></i> ${comment.likes || 0}
                            </button>
                            <button class="comment-action">Ответить</button>
                        </div>
                    </div>
                </div>
            `;
        }));
        
        commentsList.innerHTML = commentItems.join('');
        document.getElementById('comments-count').textContent = `${commentArray.length} комментариев`;
        
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

async function setupVideoInteractions(channelId) {
    const likeBtn = document.getElementById('like-btn');
    const dislikeBtn = document.getElementById('dislike-btn');
    const subscribeBtn = document.getElementById('subscribe-btn');
    const commentForm = document.getElementById('comment-form');
    
    if (likeBtn && currentUser) {
        const isLiked = await db.isLiked(currentVideoId, currentUser.uid);
        if (isLiked) {
            likeBtn.classList.add('liked');
            likeBtn.innerHTML = '<i class="fas fa-thumbs-up"></i><span>' + formatNumber((await db.getVideo(currentVideoId)).likes || 0) + '</span>';
        }
        
        likeBtn.addEventListener('click', async () => {
            if (!currentUser) {
                showAuthModal();
                return;
            }
            
            try {
                const isLiked = await db.isLiked(currentVideoId, currentUser.uid);
                if (isLiked) {
                    await db.unlikeVideo(currentVideoId, currentUser.uid);
                    likeBtn.classList.remove('liked');
                } else {
                    await db.likeVideo(currentVideoId, currentUser.uid);
                    likeBtn.classList.add('liked');
                }
                
                const video = await db.getVideo(currentVideoId);
                document.getElementById('like-count').textContent = formatNumber(video.likes || 0);
                
            } catch (error) {
                console.error('Error updating like:', error);
            }
        });
    }
    
    if (subscribeBtn && currentUser && channelId !== currentUser.uid) {
        const isSubscribed = await db.isSubscribed(currentUser.uid, channelId);
        
        if (isSubscribed) {
            subscribeBtn.innerHTML = '<i class="fas fa-bell-slash"></i> Вы подписаны';
            subscribeBtn.classList.add('subscribed');
        }
        
        subscribeBtn.addEventListener('click', async () => {
            if (!currentUser) {
                showAuthModal();
                return;
            }
            
            try {
                const isSubscribed = await db.isSubscribed(currentUser.uid, channelId);
                
                if (isSubscribed) {
                    await db.unsubscribe(currentUser.uid, channelId);
                    subscribeBtn.innerHTML = '<i class="fas fa-bell"></i> Подписаться';
                    subscribeBtn.classList.remove('subscribed');
                } else {
                    await db.subscribe(currentUser.uid, channelId);
                    subscribeBtn.innerHTML = '<i class="fas fa-bell-slash"></i> Вы подписаны';
                    subscribeBtn.classList.add('subscribed');
                }
                
                const user = await db.getUser(channelId);
                document.getElementById('channel-subs').textContent = formatNumber(user.subscribers || 0) + ' подписчиков';
                
            } catch (error) {
                console.error('Error updating subscription:', error);
            }
        });
    }
    
    if (commentForm && currentUser) {
        commentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const commentInput = document.getElementById('comment-input');
            const commentText = commentInput.value.trim();
            
            if (!commentText) return;
            
            try {
                await db.addComment(currentVideoId, currentUser.uid, commentText);
                commentInput.value = '';
                await loadComments(currentVideoId);
            } catch (error) {
                console.error('Error adding comment:', error);
            }
        });
    }
}

function showAuthModal() {
    document.getElementById('auth-modal').style.display = 'block';
}

function hideAuthModal() {
    document.getElementById('auth-modal').style.display = 'none';
}

function updateUserUI(user) {
    const userMenu = document.getElementById('user-menu');
    const authBtn = document.getElementById('auth-btn');
    
    if (user) {
        currentUser = user;
        
        userMenu.innerHTML = `
            <div class="user-avatar" id="user-avatar-btn">
                ${user.email.charAt(0).toUpperCase()}
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
        
        document.getElementById('user-avatar-btn').addEventListener('click', () => {
            document.getElementById('user-dropdown').classList.toggle('active');
        });
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-menu')) {
                document.getElementById('user-dropdown').classList.remove('active');
            }
        });
        
    } else {
        currentUser = null;
        userMenu.innerHTML = `
            <button class="auth-btn" id="auth-btn">
                <i class="fas fa-user"></i> Войти
            </button>
        `;
        document.getElementById('auth-btn').addEventListener('click', showAuthModal);
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
        currentUser = null;
        updateUserUI(null);
        showMessage('Вы вышли из аккаунта', 'success');
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

function showMessage(text, type) {
    const messageEl = document.getElementById('auth-message');
    messageEl.textContent = text;
    messageEl.style.color = type === 'error' ? '#ff4444' : '#44ff44';
    messageEl.style.display = 'block';
    
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 3000);
}

function checkAuthBeforeUpload() {
    if (!currentUser) {
        showAuthModal();
    } else {
        window.location.href = 'upload.html';
    }
}

auth.onAuthStateChanged((user) => {
    updateUserUI(user);
});

document.addEventListener('DOMContentLoaded', function() {
    const closeModal = document.querySelector('.close-modal');
    if (closeModal) {
        closeModal.addEventListener('click', hideAuthModal);
    }
    
    window.addEventListener('click', (e) => {
        if (e.target.id === 'auth-modal') {
            hideAuthModal();
        }
    });
    
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            if (email && password) {
                login(email, password);
            }
        });
    }
    
    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            const email = document.getElementById('auth-email').value;
            const password = document.getElementById('auth-password').value;
            if (email && password) {
                register(email, password);
            }
        });
    }
    
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        loadHomePage();
    }
    
    if (window.location.pathname.includes('video.html')) {
        loadVideoPage();
    }
});
