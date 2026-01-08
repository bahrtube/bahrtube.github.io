// Класс для управления видеоплеером
class VideoPlayer {
    constructor(videoId) {
        this.videoId = videoId;
        this.player = null;
        this.youtubeId = null;
        this.videoData = null;
        this.currentVolume = 100;
        this.isMuted = false;
        this.isPlaying = false;
        this.init();
    }
    
    async init() {
        console.log('Инициализация видеоплеера для видео:', this.videoId);
        
        try {
            // Загружаем информацию о видео
            await this.loadVideoInfo();
            
            // Инициализируем YouTube плеер
            this.initYouTubePlayer();
            
            // Настраиваем взаимодействия
            this.setupInteractions();
            
        } catch (error) {
            console.error('Ошибка инициализации видеоплеера:', error);
            this.showError('Ошибка загрузки видео');
        }
    }
    
    async loadVideoInfo() {
        try {
            // Проверяем наличие объекта базы данных
            if (!window.db || typeof window.db.getVideo !== 'function') {
                throw new Error('База данных не инициализирована');
            }
            
            this.videoData = await window.db.getVideo(this.videoId);
            
            if (!this.videoData) {
                throw new Error('Видео не найдено');
            }
            
            // Обновляем информацию на странице
            document.getElementById('video-title').textContent = this.videoData.title || 'Без названия';
            document.getElementById('video-views').textContent = this.formatNumber(this.videoData.views || 0) + ' просмотров';
            document.getElementById('video-date').textContent = this.formatDate(this.videoData.timestamp);
            document.getElementById('like-count').textContent = this.formatNumber(this.videoData.likes || 0);
            document.getElementById('dislike-count').textContent = this.formatNumber(this.videoData.dislikes || 0);
            document.getElementById('channel-name').textContent = this.videoData.channelName || 'Автор';
            document.getElementById('channel-subs').textContent = this.formatNumber(this.videoData.subscribers || 0) + ' подписчиков';
            document.getElementById('channel-avatar').textContent = this.videoData.channelAvatar || (this.videoData.channelName || 'А').charAt(0);
            
            // Обрабатываем описание
            const descriptionElement = document.getElementById('video-description');
            if (descriptionElement) {
                const description = this.videoData.description || 'Нет описания';
                descriptionElement.innerHTML = this.processText(description);
            }
            
            // Увеличиваем просмотры
            await window.db.updateVideo(this.videoId, { 
                views: (this.videoData.views || 0) + 1 
            });
            
            // Извлекаем YouTube ID
            this.youtubeId = this.extractYouTubeId(this.videoData.url);
            console.log('YouTube ID:', this.youtubeId);
            
        } catch (error) {
            console.error('Ошибка загрузки видео:', error);
            throw error;
        }
    }
    
    initYouTubePlayer() {
        if (!this.youtubeId) {
            this.showError('Не удалось получить видео');
            return;
        }
        
        if (window.YT && window.YT.Player) {
            this.createPlayer();
        } else {
            window.onYouTubeIframeAPIReady = () => {
                this.createPlayer();
            };
        }
    }
    
    createPlayer() {
        try {
            this.player = new YT.Player('player-container', {
                width: '100%',
                height: '500',
                videoId: this.youtubeId,
                playerVars: {
                    'autoplay': 1,
                    'controls': 1,
                    'modestbranding': 1,
                    'rel': 0,
                    'showinfo': 0
                },
                events: {
                    'onReady': (event) => this.onPlayerReady(event),
                    'onStateChange': (event) => this.onPlayerStateChange(event)
                }
            });
            
            document.getElementById('video-loading').style.display = 'none';
            
        } catch (error) {
            console.error('Ошибка создания плеера:', error);
            this.showError('Ошибка создания плеера');
        }
    }
    
    onPlayerReady(event) {
        console.log('Плеер YouTube готов');
    }
    
    onPlayerStateChange(event) {
        // Можно добавить логику при изменении состояния плеера
    }
    
    setupInteractions() {
        // Кнопка лайка
        document.getElementById('like-btn').addEventListener('click', () => this.handleLike());
        
        // Кнопка дизлайка
        document.getElementById('dislike-btn').addEventListener('click', () => this.handleDislike());
        
        // Кнопка поделиться
        document.getElementById('share-btn').addEventListener('click', () => this.handleShare());
        
        // Кнопка сохранить
        document.getElementById('save-btn').addEventListener('click', () => this.handleSave());
        
        // Кнопка подписки
        document.getElementById('subscribe-btn').addEventListener('click', () => this.handleSubscribe());
        
        // Переход на канал
        document.getElementById('channel-info-click').addEventListener('click', () => {
            if (this.videoData && this.videoData.channelId) {
                window.location.href = `channel.html?id=${this.videoData.channelId}`;
            }
        });
        
        // Проверяем, сохранено ли видео и подписан ли пользователь
        this.checkUserInteractions();
    }
    
    async handleLike() {
        const user = window.authDB ? window.authDB.getCurrentUser() : null;
        if (!user) {
            showNotification('Для оценки видео необходимо войти в аккаунт', 'error');
            return;
        }
        
        try {
            const newLikes = (this.videoData.likes || 0) + 1;
            await window.db.updateVideo(this.videoId, { likes: newLikes });
            
            this.videoData.likes = newLikes;
            document.getElementById('like-count').textContent = this.formatNumber(newLikes);
            
            showNotification('Лайк добавлен', 'success');
            
        } catch (error) {
            console.error('Ошибка лайка:', error);
            showNotification('Ошибка оценки видео', 'error');
        }
    }
    
    async handleDislike() {
        const user = window.authDB ? window.authDB.getCurrentUser() : null;
        if (!user) {
            showNotification('Для оценки видео необходимо войти в аккаунт', 'error');
            return;
        }
        
        try {
            const newDislikes = (this.videoData.dislikes || 0) + 1;
            await window.db.updateVideo(this.videoId, { dislikes: newDislikes });
            
            this.videoData.dislikes = newDislikes;
            document.getElementById('dislike-count').textContent = this.formatNumber(newDislikes);
            
            showNotification('Дизлайк добавлен', 'info');
            
        } catch (error) {
            console.error('Ошибка дизлайка:', error);
            showNotification('Ошибка оценки видео', 'error');
        }
    }
    
    async handleShare() {
        const videoUrl = window.location.href;
        
        try {
            await navigator.clipboard.writeText(videoUrl);
            showNotification('Ссылка скопирована в буфер обмена', 'success');
        } catch (error) {
            // Fallback
            const textArea = document.createElement('textarea');
            textArea.value = videoUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showNotification('Ссылка скопирована в буфер обмена', 'success');
        }
    }
    
    async handleSave() {
        const user = window.authDB ? window.authDB.getCurrentUser() : null;
        if (!user) {
            showNotification('Для сохранения видео необходимо войти в аккаунт', 'error');
            return;
        }
        
        try {
            const savedVideos = user.savedVideos || [];
            
            if (savedVideos.includes(this.videoId)) {
                // Убираем из сохраненных
                const newSavedVideos = savedVideos.filter(id => id !== this.videoId);
                await window.authDB.updateUser(user.id, { savedVideos: newSavedVideos });
                
                document.getElementById('save-btn').innerHTML = '<i class="fas fa-plus"></i> Сохранить';
                showNotification('Видео удалено из сохраненных', 'success');
            } else {
                // Добавляем в сохраненные
                savedVideos.push(this.videoId);
                await window.authDB.updateUser(user.id, { savedVideos: savedVideos });
                
                document.getElementById('save-btn').innerHTML = '<i class="fas fa-check"></i> Сохранено';
                showNotification('Видео добавлено в сохраненные', 'success');
            }
            
        } catch (error) {
            console.error('Ошибка сохранения видео:', error);
            showNotification('Ошибка сохранения видео', 'error');
        }
    }
    
    async handleSubscribe() {
        const user = window.authDB ? window.authDB.getCurrentUser() : null;
        if (!user) {
            showNotification('Для подписки необходимо войти в аккаунт', 'error');
            return;
        }
        
        if (!this.videoData || !this.videoData.channelId) {
            showNotification('Ошибка подписки: канал не найден', 'error');
            return;
        }
        
        try {
            const userSubscriptions = user.subscriptions || [];
            
            if (userSubscriptions.includes(this.videoData.channelId)) {
                // Отписываемся
                const result = await window.authDB.unsubscribeFromChannel(this.videoData.channelId, user.id);
                if (result.success) {
                    document.getElementById('subscribe-btn').innerHTML = '<i class="fas fa-bell"></i> Подписаться';
                    document.getElementById('subscribe-btn').className = 'subscribe-btn';
                    
                    this.videoData.subscribers = Math.max((this.videoData.subscribers || 0) - 1, 0);
                    document.getElementById('channel-subs').textContent = this.formatNumber(this.videoData.subscribers) + ' подписчиков';
                    
                    showNotification('Вы отписались от канала', 'success');
                }
            } else {
                // Подписываемся
                const result = await window.authDB.subscribeToChannel(this.videoData.channelId, user.id);
                if (result.success) {
                    document.getElementById('subscribe-btn').innerHTML = '<i class="fas fa-check"></i> Вы подписаны';
                    document.getElementById('subscribe-btn').className = 'subscribe-btn subscribed';
                    
                    this.videoData.subscribers = (this.videoData.subscribers || 0) + 1;
                    document.getElementById('channel-subs').textContent = this.formatNumber(this.videoData.subscribers) + ' подписчиков';
                    
                    showNotification('Вы подписались на канал!', 'success');
                    
                    // Обновляем подписки в сайдбаре
                    if (typeof loadUserSubscriptions === 'function') {
                        loadUserSubscriptions();
                    }
                }
            }
            
        } catch (error) {
            console.error('Ошибка подписки:', error);
            showNotification('Ошибка подписки', 'error');
        }
    }
    
    async checkUserInteractions() {
        const user = window.authDB ? window.authDB.getCurrentUser() : null;
        if (!user) return;
        
        // Проверяем подписку
        const userSubscriptions = user.subscriptions || [];
        const isSubscribed = userSubscriptions.includes(this.videoData?.channelId);
        
        if (isSubscribed) {
            document.getElementById('subscribe-btn').innerHTML = '<i class="fas fa-check"></i> Вы подписаны';
            document.getElementById('subscribe-btn').className = 'subscribe-btn subscribed';
        }
        
        // Проверяем сохраненное видео
        const savedVideos = user.savedVideos || [];
        const isSaved = savedVideos.includes(this.videoId);
        
        if (isSaved) {
            document.getElementById('save-btn').innerHTML = '<i class="fas fa-check"></i> Сохранено';
        }
    }
    
    showError(message) {
        document.getElementById('video-loading').innerHTML = `
            <div style="text-align: center; color: #f44336; padding: 40px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px;"></i>
                <h3 style="margin-bottom: 12px;">${message}</h3>
                <button onclick="window.history.back()" style="padding: 10px 20px; background-color: #2E7D32; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Назад
                </button>
            </div>
        `;
    }
    
    seekTo(seconds) {
        if (this.player && typeof this.player.seekTo === 'function') {
            this.player.seekTo(seconds, true);
        }
    }
    
    processText(text) {
        if (!text) return '';
        
        // Экранируем HTML
        let processed = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        
        // Обрабатываем ссылки
        processed = this.processLinks(processed);
        
        // Обрабатываем таймкоды
        processed = this.processTimestamps(processed);
        
        // Обрабатываем переносы строк
        processed = processed.replace(/\n/g, '<br>');
        
        return processed;
    }
    
    processLinks(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, (url) => {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-link">${url}</a>`;
        });
    }
    
    processTimestamps(text) {
        const timestampRegex = /(\b\d{1,2}:)?\d{1,2}:\d{2}\b/g;
        return text.replace(timestampRegex, (timestamp) => {
            const seconds = this.timestampToSeconds(timestamp);
            if (seconds !== null) {
                return `<span class="timestamp-link" data-timestamp="${seconds}">${timestamp}</span>`;
            }
            return timestamp;
        });
    }
    
    timestampToSeconds(timestamp) {
        const parts = timestamp.split(':').map(Number);
        
        if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
        
        return null;
    }
    
    extractYouTubeId(url) {
        if (!url) return null;
        
        try {
            const patterns = [
                /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
                /youtube\.com\/embed\/([^&\n?#]+)/,
                /youtube\.com\/v\/([^&\n?#]+)/
            ];
            
            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match && match[1]) {
                    return match[1];
                }
            }
            
            return null;
        } catch (error) {
            console.error('Ошибка извлечения YouTube ID:', error);
            return null;
        }
    }
    
    formatNumber(num) {
        if (!num) return '0';
        
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        }
        return num.toString();
    }
    
    formatDate(timestamp) {
        if (!timestamp) return 'Неизвестно';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Сегодня';
        if (diffDays === 1) return 'Вчера';
        if (diffDays < 7) return `${diffDays} дней назад`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} недель назад`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} месяцев назад`;
        
        return `${Math.floor(diffDays / 365)} лет назад`;
    }
}
