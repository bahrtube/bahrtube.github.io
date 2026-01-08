// Класс для работы с комментариями
class CommentsManager {
    constructor(videoId) {
        this.videoId = videoId;
        this.comments = [];
        this.currentUser = window.authDB ? window.authDB.getCurrentUser() : null;
        this.init();
    }
    
    async init() {
        console.log('Инициализация менеджера комментариев для видео:', this.videoId);
        await this.loadComments();
        this.setupEventListeners();
        this.updateCommentForm();
    }
    
    async loadComments() {
        try {
            if (!window.database) {
                console.error('Firebase не инициализирован');
                return;
            }
            
            const snapshot = await database.ref(`comments/${this.videoId}`).once('value');
            const commentsData = snapshot.val() || {};
            
            // Преобразуем объект в массив и сортируем по времени
            this.comments = Object.values(commentsData).sort((a, b) => 
                (b.timestamp || 0) - (a.timestamp || 0)
            );
            
            this.renderComments();
            
        } catch (error) {
            console.error('Ошибка загрузки комментариев:', error);
        }
    }
    
    setupEventListeners() {
        const submitBtn = document.getElementById('submit-comment-btn');
        const cancelBtn = document.getElementById('cancel-comment-btn');
        const commentInput = document.getElementById('comment-input');
        const sortSelect = document.getElementById('comments-sort');
        
        if (submitBtn && commentInput) {
            submitBtn.onclick = () => this.addComment();
            
            commentInput.addEventListener('input', () => {
                submitBtn.disabled = commentInput.value.trim().length === 0;
            });
            
            commentInput.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                    this.addComment();
                }
            });
        }
        
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                commentInput.value = '';
                commentInput.style.height = 'auto';
                submitBtn.disabled = true;
            };
        }
        
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortComments(e.target.value);
            });
        }
        
        // Автоматическое изменение высоты textarea
        if (commentInput) {
            commentInput.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';
            });
        }
    }
    
    updateCommentForm() {
        const commentAvatar = document.getElementById('comment-user-avatar');
        if (this.currentUser) {
            const avatarChar = this.currentUser.name ? this.currentUser.name.charAt(0).toUpperCase() : 'В';
            commentAvatar.textContent = avatarChar;
        }
    }
    
    async addComment() {
        const commentInput = document.getElementById('comment-input');
        const commentText = commentInput.value.trim();
        
        if (!commentText) {
            if (window.showNotification) {
                showNotification('Введите текст комментария', 'error');
            }
            return;
        }
        
        if (!this.currentUser) {
            if (window.showNotification) {
                showNotification('Для комментирования необходимо войти в аккаунт', 'error');
            }
            if (window.showAuthModal) {
                showAuthModal('login');
            }
            return;
        }
        
        try {
            const commentRef = database.ref(`comments/${this.videoId}`).push();
            const commentId = commentRef.key;
            
            const commentData = {
                id: commentId,
                videoId: this.videoId,
                userId: this.currentUser.id,
                userName: this.currentUser.name || 'Аноним',
                userAvatar: this.currentUser.channelAvatar || (this.currentUser.name ? this.currentUser.name.charAt(0).toUpperCase() : 'А'),
                text: commentText,
                timestamp: Date.now(),
                likes: 0,
                dislikes: 0,
                replies: []
            };
            
            await commentRef.set(commentData);
            
            // Добавляем комментарий в массив
            this.comments.unshift(commentData);
            
            // Обновляем UI
            this.renderComments();
            
            // Очищаем поле ввода
            commentInput.value = '';
            commentInput.style.height = 'auto';
            document.getElementById('submit-comment-btn').disabled = true;
            
            // Показываем уведомление
            if (window.showNotification) {
                showNotification('Комментарий добавлен', 'success');
            }
            
        } catch (error) {
            console.error('Ошибка добавления комментария:', error);
            if (window.showNotification) {
                showNotification('Ошибка добавления комментария', 'error');
            }
        }
    }
    
    sortComments(sortBy) {
        switch(sortBy) {
            case 'newest':
                this.comments.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                break;
            case 'popular':
                this.comments.sort((a, b) => {
                    const scoreA = (a.likes || 0) - (a.dislikes || 0);
                    const scoreB = (b.likes || 0) - (b.dislikes || 0);
                    return scoreB - scoreA;
                });
                break;
        }
        
        this.renderComments();
    }
    
    renderComments() {
        const commentsList = document.getElementById('comments-list');
        if (!commentsList) return;
        
        if (this.comments.length === 0) {
            commentsList.innerHTML = `
                <div class="no-comments">
                    <i class="fas fa-comment-slash"></i>
                    <p>Пока нет комментариев</p>
                    <small>Будьте первым, кто оставит комментарий</small>
                </div>
            `;
            this.updateCommentsCount();
            return;
        }
        
        commentsList.innerHTML = this.comments.map(comment => this.createCommentHTML(comment)).join('');
        this.addCommentInteractions();
        this.makeLinksClickable();
        this.updateCommentsCount();
    }
    
    createCommentHTML(comment) {
        const timeAgo = this.formatTimeAgo(comment.timestamp);
        
        return `
            <div class="comment-item" data-id="${comment.id}">
                <div class="comment-avatar">${comment.userAvatar}</div>
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">${comment.userName}</span>
                        <span class="comment-time">${timeAgo}</span>
                    </div>
                    <div class="comment-text">${this.escapeHtml(comment.text)}</div>
                    <div class="comment-actions">
                        <button class="comment-action-btn like-btn" data-id="${comment.id}">
                            <i class="far fa-thumbs-up"></i> <span class="like-count">${comment.likes || 0}</span>
                        </button>
                        <button class="comment-action-btn dislike-btn" data-id="${comment.id}">
                            <i class="far fa-thumbs-down"></i> <span class="dislike-count">${comment.dislikes || 0}</span>
                        </button>
                        <button class="comment-action-btn reply-btn" onclick="if(window.showNotification) showNotification('Ответы на комментарии в разработке', 'info')">
                            Ответить
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    addCommentInteractions() {
        document.querySelectorAll('.comment-action-btn.like-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const commentId = e.currentTarget.dataset.id;
                this.likeComment(commentId);
            });
        });
        
        document.querySelectorAll('.comment-action-btn.dislike-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const commentId = e.currentTarget.dataset.id;
                this.dislikeComment(commentId);
            });
        });
    }
    
    async likeComment(commentId) {
        if (!this.currentUser) {
            if (window.showNotification) {
                showNotification('Для оценки комментариев необходимо войти в аккаунт', 'error');
            }
            return;
        }
        
        try {
            const commentRef = database.ref(`comments/${this.videoId}/${commentId}`);
            const snapshot = await commentRef.once('value');
            const comment = snapshot.val();
            
            if (!comment) return;
            
            const newLikes = (comment.likes || 0) + 1;
            await commentRef.update({ likes: newLikes });
            
            // Обновляем UI
            const likeCountEl = document.querySelector(`.comment-item[data-id="${commentId}"] .like-count`);
            if (likeCountEl) {
                likeCountEl.textContent = newLikes;
            }
            
        } catch (error) {
            console.error('Ошибка лайка комментария:', error);
        }
    }
    
    async dislikeComment(commentId) {
        if (!this.currentUser) {
            if (window.showNotification) {
                showNotification('Для оценки комментариев необходимо войти в аккаунт', 'error');
            }
            return;
        }
        
        try {
            const commentRef = database.ref(`comments/${this.videoId}/${commentId}`);
            const snapshot = await commentRef.once('value');
            const comment = snapshot.val();
            
            if (!comment) return;
            
            const newDislikes = (comment.dislikes || 0) + 1;
            await commentRef.update({ dislikes: newDislikes });
            
            // Обновляем UI
            const dislikeCountEl = document.querySelector(`.comment-item[data-id="${commentId}"] .dislike-count`);
            if (dislikeCountEl) {
                dislikeCountEl.textContent = newDislikes;
            }
            
        } catch (error) {
            console.error('Ошибка дизлайка комментария:', error);
        }
    }
    
    updateCommentsCount() {
        const countElement = document.getElementById('comments-count');
        if (countElement) {
            countElement.textContent = `(${this.comments.length})`;
        }
    }
    
    formatTimeAgo(timestamp) {
        if (!timestamp) return 'только что';
        
        const now = Date.now();
        const diff = now - timestamp;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        const months = Math.floor(diff / 2592000000);
        const years = Math.floor(diff / 31536000000);
        
        if (years > 0) return `${years} год${this.getPlural(years)} назад`;
        if (months > 0) return `${months} месяц${this.getPlural(months)} назад`;
        if (days > 0) return `${days} день${this.getPlural(days)} назад`;
        if (hours > 0) return `${hours} час${this.getPlural(hours)} назад`;
        if (minutes > 0) return `${minutes} минут${this.getPlural(minutes)} назад`;
        return 'только что';
    }
    
    getPlural(num) {
        const lastDigit = num % 10;
        const lastTwoDigits = num % 100;
        
        if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return 'ов';
        if (lastDigit === 1) return '';
        if (lastDigit >= 2 && lastDigit <= 4) return 'а';
        return 'ов';
    }
    
    escapeHtml(text) {
        if (!text) return '';
        
        let escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        
        escaped = this.processLinks(escaped);
        escaped = this.processTimestamps(escaped);
        escaped = escaped.replace(/\n/g, '<br>');
        
        return escaped;
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
    
    makeLinksClickable() {
        // Обработка кликов на ссылки
        document.querySelectorAll('.text-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });
        
        // Обработка кликов на таймкоды
        document.querySelectorAll('.timestamp-link').forEach(timestamp => {
            timestamp.addEventListener('click', (e) => {
                e.stopPropagation();
                const seconds = parseInt(timestamp.dataset.timestamp);
                if (window.videoPlayer && window.videoPlayer.seekTo) {
                    window.videoPlayer.seekTo(seconds);
                }
            });
        });
    }
}
