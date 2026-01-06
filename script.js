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
    <div class="video-card" onclick="window.location.href='video.html?id=${video.id}'">
      <div class="video-thumbnail">
        <img src="${generateThumbnail(youTubeId)}" alt="${video.title}" onerror="this.src='https://via.placeholder.com/320x180/252525/ffffff?text=No+Preview'">
        <div class="video-thumbnail-overlay">8:15</div>
      </div>
      <div class="video-info">
        <div class="channel-avatar-small">${video.channelAvatar || video.channelName.charAt(0)}</div>
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
    <div class="recommendation-card" onclick="window.location.href='video.html?id=${video.id}'">
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
    
    videoGrid.innerHTML = Object.values(videos)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .map(video => createVideoCard(video))
      .join('');
      
  } catch (error) {
    console.error('Error loading videos:', error);
    document.getElementById('video-grid').innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #ff4444;">
        <h3>Ошибка загрузки видео</h3>
        <p>${error.message}</p>
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
      recommendationsList.innerHTML = '<p style="color: #aaa;">Нет рекомендаций</p>';
      return;
    }
    
    const videoArray = Object.values(videos);
    const recommendations = videoArray
      .filter(video => video && video.id !== currentVideoId)
      .sort(() => Math.random() - 0.5)
      .slice(0, 5);
    
    if (recommendations.length === 0) {
      recommendationsList.innerHTML = '<p style="color: #aaa;">Нет рекомендаций</p>';
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
        channelAvatar: channelAvatar || channelName.charAt(0),
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

document.addEventListener('DOMContentLoaded', function() {
  if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
    loadHomePage();
  }
  
  if (window.location.pathname.includes('upload.html')) {
    setupUploadForm();
  }
  
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
