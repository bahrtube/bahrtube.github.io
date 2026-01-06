// Firebase Configuration
const firebaseConfig = {
    databaseURL: "https://flum-2-default-rtdb.firebaseio.com"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

let currentUser = null;
let currentVideoId = null;
let userLiked = false;
let userDisliked = false;
let userSubscribed = false;

// Database Functions
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
            subscribers: 0,
            channelId: currentUser ? currentUser.uid : 'anonymous',
            userId: currentUser ? currentUser.uid : 'anonymous'
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
    },

    getUser: async (userId) => {
        const snapshot = await database.ref(`users/${userId}`).once('value');
        return snapshot.val();
    },

    createUser: async (userId, userData) => {
        await database.ref(`users/${userId}`).set({
            ...userData,
            uid: userId,
            createdAt: Date.now(),
            subscriptions: {}
        });
    },

    updateUser: async (userId, updates) => {
        await database.ref(`users/${userId}`).update(updates);
    },

    searchVideos: async (query) => {
        const snapshot = await database.ref('videos').once('value');
        const videos = snapshot.val() || {};
        
        return Object.values(videos).filter(video => 
            video.title.toLowerCase().includes(query.toLowerCase()) ||
            video.channelName.toLowerCase().includes(query.toLowerCase())
        );
    },

    getChannelVideos: async (channelId) => {
        const snapshot = await database.ref('videos').once('value');
        const videos = snapshot.val() || {};
        
        return Object.values(videos).filter(video => 
            video.channelId === channelId
        );
    }
};

// Authentication Functions
async function registerUser(email, password, name) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        await db.createUser(user.uid, {
            email: email,
            name: name,
            avatar: name.charAt(0).toUpperCase()
        });
        
        updateUI();
        return user;
    } catch (error) {
        throw error;
    }
}

async function loginUser(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        updateUI();
        return userCredential.user;
    } catch (error) {
        throw error;
    }
}

async function logoutUser() {
    try {
        await auth.signOut();
        updateUI();
    } catch (error) {
        console.error('Error logging out:', error);
    }
}

function updateUI() {
    const user = auth.currentUser;
    const authBtn = document.getElementById('auth-btn');
    const userDropdown = document.getElementById('user-dropdown');
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('user-email');
    const userAvatar = document.getElementById('user-avatar');

    if (user) {
        currentUser = user;
        
        db.getUser(user.uid).then(userData => {
            if (userData) {
                userName.textContent = userData.name || user.email.split('@')[0];
                userEmail.textContent = user.email;
                userAvatar.textContent = userData.avatar || user.email.charAt(0).toUpperCase();
            }
        });
        
        if (authBtn) {
            authBtn.innerHTML = '<i class="fas fa-user"></i><span>Аккаунт</span>';
        }
    } else {
        currentUser = null;
        
        if (userName) userName.textContent = 'Гость';
        if (userEmail) userEmail.textContent = 'Войдите в аккаунт';
        if (userAvatar) userAvatar.textContent = 'Г';
        if (authBtn) authBtn.innerHTML = '<i class="fas fa-user"></i><span>Войти</span>';
        
        if (userDropdown) {
            userDropdown.classList.remove('active');
        }
    }
}

// Video Functions
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
    const duration = '8:15'; // Можно получить из YouTube API
    
    return `
        <div class="video-card" onclick="window.location.href='video.html?id=${video.id}'">
            <div class="video-thumbnail">
                <img src="${generateThumbnail(youTubeId)}" alt="${video.title}" onerror="this.src='https://via.placeholder.com/320x180/252525/ffffff?text=No+Preview'">
                <div class="video-duration">${duration}</div>
            </div>
            <div class="video-info">
                <h3>${video.title}</h3>
                <div class="video-meta">
                    <span>${formatNumber(video.views || 0)} просмотров</span>
                    <span>${formatDate(video.timestamp)}</span>
                </div>
                <div class="channel-info">
                    <div class="channel-avatar">${video.channelAvatar || video.channelName.charAt(0)}</div>
                    <div class="channel-details">
                        <h4>${video.channelName}</h4>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function createRecommendationCard(video) {
    const youTubeId = extractYouTubeId(video.url);
    
    return `
        <div class="video-card" onclick="window.location.href='video.html?id=${video.id}'">
            <div class="video-thumbnail">
                <img src="${generateThumbnail(youTubeId)}" alt="${video.title}" onerror="this.src='https://via.placeholder.com/320x180/252525/ffffff?text=No+Preview'">
            </div>
            <div class="video-info">
                <h3>${video.title}</h3>
                <div class="channel-info">
                    <div class="channel-details">
                        <h4>${video.channelName}</h4>
                        <span>${formatNumber(video.views || 0)} просмотров • ${formatDate(video.timestamp)}</span>
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
                <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                    <h3 style="margin-bottom: 16px; color: #fff;">Нет загруженных видео</h3>
                    <p style="color: #aaa; margin-bottom: 24px;">Будьте первым, кто загрузит видео!</p>
                    <button onclick="window.location.href='upload.html'" class="banner-btn">
                        <i class="fas fa-upload"></i>
                        <span>Загрузить видео</span>
                    </button>
                </div>
            `;
            return;
        }
        
        videoGrid.innerHTML = Object.values(videos)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
            .map(video => createVideoCard(video))
            .join('');
            
    } catch (error) {
        console.error('Error loading videos:', error);
        if (document.getElementById('video-grid')) {
            document.getElementById('video-grid').innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #ff4444;">
                    <h3>Ошибка загрузки видео</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
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
        } else if (player) {
            player.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #000; color: #fff;">
                    <div style="text-align: center;">
                        <h3>Ошибка загрузки видео</h3>
                        <p>Неверная ссылка на YouTube</p>
                    </div>
                </div>
            `;
        }
        
        await db.updateVideo(videoId, { views: (video.views || 0) + 1 });
        
        await loadRecommendations(videoId);
        
        setupVideoInteractions();
        
    } catch (error) {
        console.error('Error loading video:', error);
    }
}

async function loadRecommendations(currentVideoId) {
    try {
        const videos = await db.getAllVideos();
        const recommendationsList = document.getElementById('recommendations-list');
        
        if (!recommendationsList) return;
        
        if (!videos) {
            recommendationsList.innerHTML = '<p style="color: #aaa; padding: 20px; text-align: center;">Нет рекомендаций</p>';
            return;
        }
        
        const videoArray = Object.values(videos);
        const recommendations = videoArray
            .filter(video => video && video.id !== currentVideoId)
            .sort(() => Math.random() - 0.5)
            .slice(0, 5);
        
        if (recommendations.length === 0) {
            recommendationsList.innerHTML = '<p style="color: #aaa; padding: 20px; text-align: center;">Нет рекомендаций</p>';
            return;
        }
        
        recommendationsList.innerHTML = recommendations
            .map(video => createRecommendationCard(video))
            .join('');
            
    } catch (error) {
        console.error('Error loading recommendations:', error);
    }
}

function setupVideoInteractions() {
    const likeBtn = document.getElementById('like-btn');
    const dislikeBtn = document.getElementById('dislike-btn');
    const subscribeBtn = document.getElementById('subscribe-btn');
    
    if (likeBtn) {
        likeBtn.addEventListener('click', async () => {
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
        dislikeBtn.addEventListener('click', async () => {
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
        subscribeBtn.addEventListener('click', async () => {
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
                channelAvatar: channelAvatar || channelName.charAt(0).toUpperCase(),
                timestamp: Date.now()
            };
            
            try {
                const videoId = await db.addVideo(videoData);
                console.log('Video uploaded with ID:', videoId);
                alert('Видео успешно загружено!');
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Error uploading video:', error);
                alert('Ошибка при загрузке видео: ' + error.message);
            }
        });
    }
}

// Search Functionality
async function performSearch(query) {
    if (!query.trim()) return;
    
    try {
        const results = await db.searchVideos(query);
        
        if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
            const videoGrid = document.getElementById('video-grid');
            if (videoGrid) {
                if (results.length === 0) {
                    videoGrid.innerHTML = `
                        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                            <h3 style="margin-bottom: 16px; color: #fff;">Ничего не найдено</h3>
                            <p style="color: #aaa;">Попробуйте другой запрос</p>
                        </div>
                    `;
                } else {
                    videoGrid.innerHTML = results
                        .map(video => createVideoCard(video))
                        .join('');
                }
            }
        } else {
            window.location.href = `search.html?q=${encodeURIComponent(query)}`;
        }
    } catch (error) {
        console.error('Error searching:', error);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Initialize auth state
    auth.onAuthStateChanged((user) => {
        updateUI();
    });
    
    // Load appropriate page
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        loadHomePage();
    }
    
    if (window.location.pathname.includes('video.html')) {
        loadVideoPage();
    }
    
    if (window.location.pathname.includes('upload.html')) {
        setupUploadForm();
    }
    
    // Search functionality
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const searchSuggestions = document.getElementById('search-suggestions');
    
    if (searchInput && searchButton) {
        let searchTimeout;
        
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            const query = searchInput.value.trim();
            
            if (query.length > 0) {
                searchTimeout = setTimeout(async () => {
                    try {
                        const results = await db.searchVideos(query);
                        if (searchSuggestions) {
                            if (results.length > 0) {
                                searchSuggestions.innerHTML = results.slice(0, 5).map(video => `
                                    <div class="suggestion-item" onclick="performSearch('${video.title.replace(/'/g, "\\'")}')">
                                        <i class="fas fa-video"></i>
                                        <span>${video.title}</span>
                                    </div>
                                `).join('');
                                searchSuggestions.classList.add('active');
                            } else {
                                searchSuggestions.classList.remove('active');
                            }
                        }
                    } catch (error) {
                        console.error('Error getting suggestions:', error);
                    }
                }, 300);
            } else if (searchSuggestions) {
                searchSuggestions.classList.remove('active');
            }
        });
        
        searchButton.addEventListener('click', () => {
            const query = searchInput.value.trim();
            if (query) {
                performSearch(query);
                if (searchSuggestions) {
                    searchSuggestions.classList.remove('active');
                }
            }
        });
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                if (query) {
                    performSearch(query);
                    if (searchSuggestions) {
                        searchSuggestions.classList.remove('active');
                    }
                }
            }
        });
        
        // Close suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (searchSuggestions && !searchSuggestions.contains(e.target) && e.target !== searchInput) {
                searchSuggestions.classList.remove('active');
            }
        });
    }
    
    // Menu toggle
    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.classList.toggle('active');
            }
        });
    }
    
    // User menu toggle
    const authBtn = document.getElementById('auth-btn');
    const userMenu = document.getElementById('user-menu');
    const userDropdown = document.getElementById('user-dropdown');
    
    if (authBtn && userDropdown) {
        authBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            if (auth.currentUser) {
                userDropdown.classList.toggle('active');
            } else {
                document.getElementById('auth-modal').classList.add('active');
            }
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        if (userDropdown) {
            userDropdown.classList.remove('active');
        }
    });
    
    // Auth modal
    const authModal = document.getElementById('auth-modal');
    const closeModalBtn = document.querySelector('.close-modal');
    const authTabs = document.querySelectorAll('.auth-tab');
    const authForms = document.querySelectorAll('.auth-form');
    
    if (authModal) {
        // Close modal
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                authModal.classList.remove('active');
            });
        }
        
        // Close modal on outside click
        authModal.addEventListener('click', (e) => {
            if (e.target === authModal) {
                authModal.classList.remove('active');
            }
        });
        
        // Tab switching
        authTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                
                authTabs.forEach(t => t.classList.remove('active'));
                authForms.forEach(form => form.classList.remove('active'));
                
                tab.classList.add('active');
                document.getElementById(`${tabName}-form`).classList.add('active');
            });
        });
        
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const email = document.getElementById('login-email').value;
                const password = document.getElementById('login-password').value;
                
                try {
                    await loginUser(email, password);
                    authModal.classList.remove('active');
                    loginForm.reset();
                } catch (error) {
                    alert('Ошибка входа: ' + error.message);
                }
            });
        }
        
        // Register form
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const name = document.getElementById('register-name').value;
                const email = document.getElementById('register-email').value;
                const password = document.getElementById('register-password').value;
                const confirm = document.getElementById('register-confirm').value;
                
                if (password !== confirm) {
                    alert('Пароли не совпадают');
                    return;
                }
                
                if (password.length < 6) {
                    alert('Пароль должен содержать минимум 6 символов');
                    return;
                }
                
                try {
                    await registerUser(email, password, name);
                    authModal.classList.remove('active');
                    registerForm.reset();
                    
                    // Switch to login tab
                    authTabs.forEach(t => t.classList.remove('active'));
                    authForms.forEach(form => form.classList.remove('active'));
                    document.querySelector('[data-tab="login"]').classList.add('active');
                    document.getElementById('login-form').classList.add('active');
                } catch (error) {
                    alert('Ошибка регистрации: ' + error.message);
                }
            });
        }
    }
    
    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            logoutUser();
        });
    }
});
