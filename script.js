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
        <div class="video-card" onclick="window.location.href='video.html?id=${video.id}'">
            <div class="video-thumbnail">
                <img src="${generateThumbnail(youTubeId)}" alt="${video.title}">
                <div class="video-thumbnail-overlay">8:15</div>
            </div>
            <div class="video-info">
                <div class="channel-avatar-small">${video.channelAvatar || video.channelName.charAt(0)}</div>
                <div class="video-details">
                    <h3>${video.title}</h3>
                    <div class="channel-name">${video.channelName}</div>
                    <div class="video-stats">
                        <span>${formatNumber(video.views)} просмотров</span>
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
        <div class="recommendation-card" onclick="window.location.href='video.html?id=${video.id}'">
            <div class="recommendation-thumbnail">
                <img src="${generateThumbnail(youTubeId)}" alt="${video.title}">
            </div>
            <div class="recommendation-info">
                <h4>${video.title}</h4>
                <div class="recommendation-channel">${video.channelName}</div>
                <div class="recommendation-stats">
                    <span>${formatNumber(video.views)} просмотров</span>
                    <span>•</span>
                    <span>${formatDate(video.timestamp)}</span>
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
        
        if (Object.keys(videos).length === 0) {
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
        
        videoGrid.innerHTML = Object.values(videos)
            .sort((a, b) => b.timestamp - a.timestamp)
            .map(video => createVideoCard(video))
            .join('');
            
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
        
        const youTubeId = extractYouTubeId(video.url);
        
        document.getElementById('video-title').textContent = video.title;
        document.getElementById('video-views').textContent = formatNumber(video.views) + ' просмотров';
        document.getElementById('video-date').textContent = formatDate(video.timestamp);
        document.getElementById('like-count').textContent = formatNumber(video.likes);
        document.getElementById('dislike-count').textContent = formatNumber(video.dislikes);
        document.getElementById('channel-name').textContent = video.channelName;
        document.getElementById('channel-subs').textContent = formatNumber(video.subscribers) + ' подписчиков';
        document.getElementById('channel-avatar').textContent = video.channelAvatar || video.channelName.charAt(0);
        document.getElementById('video-description').textContent = video.description;
        
        const player = document.getElementById('video-player');
        if (youTubeId) {
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
        
        const recommendations = Object.values(videos)
            .filter(video => video.id !== currentVideoId)
            .sort(() => Math.random() - 0.5)
            .slice(0, 5);
        
        if (recommendations.length === 0) {
            recommendationsList.innerHTML = '<p>Нет рекомендаций</p>';
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
                        await db.updateVideo(currentVideoId, {
