// Упрощенная система аутентификации (без Firebase Auth, только база данных)

// Проверяем наличие Firebase
if (typeof firebase === 'undefined') {
    console.error('Firebase не загружен');
} else {
    console.log('Firebase доступен');
}

// Объект для работы с аутентификацией
const authDB = {
    // Получение текущего пользователя из localStorage
    getCurrentUser: () => {
        try {
            const userStr = localStorage.getItem('currentUser');
            return userStr ? JSON.parse(userStr) : null;
        } catch (error) {
            console.error('Ошибка получения пользователя:', error);
            return null;
        }
    },

    // Регистрация нового пользователя
    registerUser: async (userData) => {
        try {
            // Проверяем, существует ли пользователь
            const snapshot = await database.ref('users').orderByChild('email').equalTo(userData.email).once('value');
            if (snapshot.exists()) {
                return { success: false, error: 'Пользователь с таким email уже существует' };
            }
            
            // Создаем нового пользователя
            const userRef = database.ref('users').push();
            const userId = userRef.key;
            
            const userWithId = {
                ...userData,
                id: userId,
                createdAt: Date.now(),
                channelCreated: false,
                subscriptions: [],
                videos: []
            };
            
            await userRef.set(userWithId);
            
            // Сохраняем в localStorage
            localStorage.setItem('currentUser', JSON.stringify(userWithId));
            
            return { success: true, user: userWithId };
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            return { success: false, error: error.message };
        }
    },

    // Авторизация пользователя
    loginUser: async (email, password) => {
        try {
            const snapshot = await database.ref('users').orderByChild('email').equalTo(email).once('value');
            
            if (!snapshot.exists()) {
                return { success: false, error: 'Пользователь не найден' };
            }
            
            const users = snapshot.val();
            const userId = Object.keys(users)[0];
            const user = users[userId];
            
            // Внимание: В реальном приложении пароли должны быть захешированы!
            // Здесь для простоты сравниваем напрямую
            if (user.password !== password) {
                return { success: false, error: 'Неверный пароль' };
            }
            
            // Сохраняем в localStorage
            localStorage.setItem('currentUser', JSON.stringify(user));
            
            return { success: true, user: user };
        } catch (error) {
            console.error('Ошибка входа:', error);
            return { success: false, error: error.message };
        }
    },

    // Создание канала
    createChannel: async (userId, channelData) => {
        try {
            // Обновляем информацию о пользователе
            await database.ref(`users/${userId}`).update({
                channelCreated: true,
                channelName: channelData.name,
                channelDescription: channelData.description,
                channelAvatar: channelData.avatar,
                subscribers: 0
            });
            
            // Обновляем пользователя в localStorage
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            currentUser.channelCreated = true;
            currentUser.channelName = channelData.name;
            currentUser.channelDescription = channelData.description;
            currentUser.channelAvatar = channelData.avatar;
            currentUser.subscribers = 0;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            return { success: true };
        } catch (error) {
            console.error('Ошибка создания канала:', error);
            return { success: false, error: error.message };
        }
    },

    // Выход из аккаунта
    logout: () => {
        localStorage.removeItem('currentUser');
        return { success: true };
    },

    // Обновление пользователя
    updateUser: async (userId, updates) => {
        try {
            await database.ref(`users/${userId}`).update(updates);
            
            // Обновляем в localStorage
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            Object.assign(currentUser, updates);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            return { success: true };
        } catch (error) {
            console.error('Ошибка обновления пользователя:', error);
            return { success: false, error: error.message };
        }
    },

    // Подписка на канал
    subscribeToChannel: async (channelId, userId) => {
        try {
            const currentUser = authDB.getCurrentUser();
            if (!currentUser) return { success: false, error: 'Пользователь не авторизован' };
            
            // Получаем канал
            const snapshot = await database.ref(`users/${channelId}`).once('value');
            const channel = snapshot.val();
            
            if (!channel) return { success: false, error: 'Канал не найден' };
            
            // Проверяем, не подписан ли уже
            const userSubscriptions = currentUser.subscriptions || [];
            if (userSubscriptions.includes(channelId)) {
                return { success: false, error: 'Вы уже подписаны на этот канал' };
            }
            
            // Добавляем подписку
            const newSubscriptions = [...userSubscriptions, channelId];
            await authDB.updateUser(currentUser.id, { subscriptions: newSubscriptions });
            
            // Увеличиваем счетчик подписчиков
            const currentSubs = channel.subscribers || 0;
            await database.ref(`users/${channelId}`).update({
                subscribers: currentSubs + 1
            });
            
            return { success: true };
        } catch (error) {
            console.error('Ошибка подписки:', error);
            return { success: false, error: error.message };
        }
    },

    // Отписка от канала
    unsubscribeFromChannel: async (channelId, userId) => {
        try {
            const currentUser = authDB.getCurrentUser();
            if (!currentUser) return { success: false, error: 'Пользователь не авторизован' };
            
            const userSubscriptions = currentUser.subscriptions || [];
            if (!userSubscriptions.includes(channelId)) {
                return { success: false, error: 'Вы не подписаны на этот канал' };
            }
            
            // Убираем подписку
            const newSubscriptions = userSubscriptions.filter(id => id !== channelId);
            await authDB.updateUser(currentUser.id, { subscriptions: newSubscriptions });
            
            // Уменьшаем счетчик подписчиков
            const snapshot = await database.ref(`users/${channelId}`).once('value');
            const channel = snapshot.val();
            if (channel) {
                const currentSubs = channel.subscribers || 0;
                await database.ref(`users/${channelId}`).update({
                    subscribers: Math.max(currentSubs - 1, 0)
                });
            }
            
            return { success: true };
        } catch (error) {
            console.error('Ошибка отписки:', error);
            return { success: false, error: error.message };
        }
    },

    // Получение канала по ID
    getChannelById: async (channelId) => {
        try {
            const snapshot = await database.ref(`users/${channelId}`).once('value');
            const user = snapshot.val();
            
            if (!user || !user.channelCreated) {
                return null;
            }
            
            return {
                id: user.id,
                name: user.channelName,
                avatar: user.channelAvatar,
                description: user.channelDescription,
                subscribers: user.subscribers || 0,
                ownerId: user.id
            };
        } catch (error) {
            console.error('Ошибка получения канала:', error);
            return null;
        }
    },

    // Получение всех каналов
    getAllChannels: async () => {
        try {
            const snapshot = await database.ref('users').once('value');
            const users = snapshot.val() || {};
            
            const channels = [];
            Object.values(users).forEach(user => {
                if (user.channelCreated && user.channelName) {
                    channels.push({
                        id: user.id,
                        name: user.channelName,
                        avatar: user.channelAvatar,
                        description: user.channelDescription,
                        subscribers: user.subscribers || 0,
                        ownerId: user.id
                    });
                }
            });
            
            return channels;
        } catch (error) {
            console.error('Ошибка получения каналов:', error);
            return [];
        }
    }
};

// Модальное окно авторизации
function showAuthModal(mode = 'login') {
    console.log('Показываем модалку авторизации:', mode);
    
    // Удаляем старый модал
    const oldModal = document.querySelector('.auth-modal');
    if (oldModal) oldModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'auth-modal';
    
    if (mode === 'login') {
        modal.innerHTML = `
            <div class="auth-modal-overlay"></div>
            <div class="auth-modal-content">
                <div class="auth-modal-header">
                    <h3>Вход в аккаунт</h3>
                    <button class="close-auth-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="auth-modal-body">
                    <div class="auth-form">
                        <div class="form-group">
                            <label for="login-email">Email</label>
                            <input type="email" id="login-email" placeholder="your@email.com" value="test@test.com">
                        </div>
                        <div class="form-group">
                            <label for="login-password">Пароль</label>
                            <input type="password" id="login-password" placeholder="Ваш пароль" value="123456">
                        </div>
                        <button class="auth-submit-btn" id="login-submit-btn">
                            <i class="fas fa-sign-in-alt"></i> Войти
                        </button>
                        <div class="auth-divider">
                            <span>или</span>
                        </div>
                        <button class="auth-switch-btn" id="switch-to-register">
                            Создать новый аккаунт
                        </button>
                    </div>
                </div>
            </div>
        `;
    } else {
        modal.innerHTML = `
            <div class="auth-modal-overlay"></div>
            <div class="auth-modal-content">
                <div class="auth-modal-header">
                    <h3>Регистрация</h3>
                    <button class="close-auth-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="auth-modal-body">
                    <div class="auth-form">
                        <div class="form-group">
                            <label for="register-name">Имя</label>
                            <input type="text" id="register-name" placeholder="Ваше имя">
                        </div>
                        <div class="form-group">
                            <label for="register-email">Email</label>
                            <input type="email" id="register-email" placeholder="your@email.com">
                        </div>
                        <div class="form-group">
                            <label for="register-password">Пароль</label>
                            <input type="password" id="register-password" placeholder="Не менее 6 символов">
                        </div>
                        <div class="form-group">
                            <label for="register-confirm-password">Подтвердите пароль</label>
                            <input type="password" id="register-confirm-password" placeholder="Повторите пароль">
                        </div>
                        <button class="auth-submit-btn" id="register-submit-btn">
                            <i class="fas fa-user-plus"></i> Зарегистрироваться
                        </button>
                        <div class="auth-divider">
                            <span>или</span>
                        </div>
                        <button class="auth-switch-btn" id="switch-to-login">
                            Уже есть аккаунт? Войти
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    document.body.appendChild(modal);
    
    // Обработчики событий
    const closeBtn = modal.querySelector('.close-auth-btn');
    const overlay = modal.querySelector('.auth-modal-overlay');
    
    function closeModal() {
        modal.classList.add('closing');
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 300);
    }
    
    if (closeBtn) closeBtn.onclick = closeModal;
    if (overlay) overlay.onclick = closeModal;
    
    // Переключение между логином и регистрацией
    const switchBtn = modal.querySelector(mode === 'login' ? '#switch-to-register' : '#switch-to-login');
    if (switchBtn) {
        switchBtn.onclick = () => {
            closeModal();
            setTimeout(() => showAuthModal(mode === 'login' ? 'register' : 'login'), 300);
        };
    }
    
    // Обработка отправки формы
    if (mode === 'login') {
        const submitBtn = modal.querySelector('#login-submit-btn');
        const emailInput = modal.querySelector('#login-email');
        const passwordInput = modal.querySelector('#login-password');
        
        submitBtn.onclick = async () => {
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();
            
            if (!email || !password) {
                showNotification('Заполните все поля', 'error');
                return;
            }
            
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Вход...';
            submitBtn.disabled = true;
            
            const result = await authDB.loginUser(email, password);
            
            if (result.success) {
                showNotification('Успешный вход!', 'success');
                closeModal();
                updateAuthUI();
            } else {
                showNotification(result.error, 'error');
                submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Войти';
                submitBtn.disabled = false;
            }
        };
    } else {
        const submitBtn = modal.querySelector('#register-submit-btn');
        const nameInput = modal.querySelector('#register-name');
        const emailInput = modal.querySelector('#register-email');
        const passwordInput = modal.querySelector('#register-password');
        const confirmPasswordInput = modal.querySelector('#register-confirm-password');
        
        submitBtn.onclick = async () => {
            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();
            const confirmPassword = confirmPasswordInput.value.trim();
            
            if (!name || !email || !password || !confirmPassword) {
                showNotification('Заполните все поля', 'error');
                return;
            }
            
            if (password.length < 6) {
                showNotification('Пароль должен содержать минимум 6 символов', 'error');
                return;
            }
            
            if (password !== confirmPassword) {
                showNotification('Пароли не совпадают', 'error');
                return;
            }
            
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Регистрация...';
            submitBtn.disabled = true;
            
            const result = await authDB.registerUser({
                name: name,
                email: email,
                password: password,
                createdAt: Date.now()
            });
            
            if (result.success) {
                showNotification('Аккаунт успешно создан!', 'success');
                closeModal();
                updateAuthUI();
            } else {
                showNotification(result.error, 'error');
                submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Зарегистрироваться';
                submitBtn.disabled = false;
            }
        };
    }
}

// Модальное окно создания канала
function showChannelCreationModal() {
    console.log('Показываем создание канала');
    
    const user = authDB.getCurrentUser();
    if (!user || user.channelCreated) return;
    
    // Удаляем старый модал
    const oldModal = document.querySelector('.channel-modal');
    if (oldModal) oldModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'channel-modal';
    
    modal.innerHTML = `
        <div class="channel-modal-overlay"></div>
        <div class="channel-modal-content">
            <div class="channel-modal-header">
                <h3>Создание канала</h3>
                <p>Прежде чем загружать видео, создайте свой канал</p>
            </div>
            <div class="channel-modal-body">
                <div class="channel-form">
                    <div class="form-group">
                        <label for="channel-name">Название канала</label>
                        <input type="text" id="channel-name" placeholder="Мой YouTube канал" value="${user.name || ''} Канал">
                    </div>
                    <div class="form-group">
                        <label for="channel-description">Описание канала</label>
                        <textarea id="channel-description" rows="3" placeholder="Расскажите о своем канале">Привет! Я создатель этого канала.</textarea>
                    </div>
                    <div class="form-group">
                        <label for="channel-avatar">Аватар (первая буква)</label>
                        <input type="text" id="channel-avatar" maxlength="1" value="${user.name ? user.name.charAt(0).toUpperCase() : 'У'}" placeholder="У">
                    </div>
                    <div class="channel-form-actions">
                        <button class="channel-cancel-btn" id="channel-cancel-btn">
                            Позже
                        </button>
                        <button class="channel-submit-btn" id="channel-submit-btn">
                            Создать канал
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Обработчики событий
    const cancelBtn = modal.querySelector('#channel-cancel-btn');
    const submitBtn = modal.querySelector('#channel-submit-btn');
    
    function closeModal() {
        modal.classList.add('closing');
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 300);
    }
    
    if (cancelBtn) cancelBtn.onclick = closeModal;
    
    if (submitBtn) {
        submitBtn.onclick = async () => {
            const name = modal.querySelector('#channel-name').value.trim();
            const description = modal.querySelector('#channel-description').value.trim();
            const avatar = modal.querySelector('#channel-avatar').value.trim().toUpperCase() || 'У';
            
            if (!name) {
                showNotification('Введите название канала', 'error');
                return;
            }
            
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Создание...';
            submitBtn.disabled = true;
            
            const result = await authDB.createChannel(user.id, {
                name: name,
                description: description,
                avatar: avatar
            });
            
            if (result.success) {
                showNotification('Канал успешно создан!', 'success');
                closeModal();
                updateAuthUI();
            } else {
                showNotification(result.error, 'error');
                submitBtn.innerHTML = 'Создать канал';
                submitBtn.disabled = false;
            }
        };
    }
}

// Обновление UI аутентификации
function updateAuthUI() {
    console.log('Обновляем UI аутентификации');
    
    const user = authDB.getCurrentUser();
    const authBtn = document.getElementById('auth-btn');
    
    if (!authBtn) {
        console.log('Кнопка auth-btn не найдена');
        return;
    }
    
    if (user) {
        // Показываем имя пользователя
        const avatar = user.channelAvatar || (user.name ? user.name.charAt(0).toUpperCase() : 'П');
        authBtn.innerHTML = `
            <div class="user-avatar-small">${avatar}</div>
            <span>${user.name || 'Пользователь'}</span>
        `;
        
        // Добавляем обработчик для выпадающего меню
        authBtn.onclick = showUserMenu;
    } else {
        authBtn.innerHTML = '<i class="fas fa-user"></i> <span>Войти</span>';
        authBtn.onclick = () => showAuthModal('login');
    }
}

// Меню пользователя
function showUserMenu(e) {
    if (e) e.stopPropagation();
    
    console.log('Показываем меню пользователя');
    
    // Удаляем старое меню
    const oldMenu = document.querySelector('.user-dropdown-menu');
    if (oldMenu) oldMenu.remove();
    
    const user = authDB.getCurrentUser();
    if (!user) return;
    
    const authBtn = document.getElementById('auth-btn');
    const rect = authBtn.getBoundingClientRect();
    
    const menu = document.createElement('div');
    menu.className = 'user-dropdown-menu';
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
    
    menu.innerHTML = `
        <div class="user-menu-header">
            <div class="user-menu-avatar">${user.channelAvatar || (user.name ? user.name.charAt(0).toUpperCase() : 'П')}</div>
            <div class="user-menu-info">
                <h4>${user.name || 'Пользователь'}</h4>
                <span>${user.email || ''}</span>
            </div>
        </div>
        <div class="user-menu-divider"></div>
        <button class="user-menu-item" onclick="window.location.href='channel.html?id=${user.id}'">
            <i class="fas fa-user-circle"></i> Мой канал
        </button>
        <button class="user-menu-item" onclick="showNotification('В разработке', 'info')">
            <i class="fas fa-video"></i> Мои видео
        </button>
        <button class="user-menu-item" onclick="showNotification('В разработке', 'info')">
            <i class="fas fa-cog"></i> Настройки
        </button>
        <div class="user-menu-divider"></div>
        <button class="user-menu-item logout-btn">
            <i class="fas fa-sign-out-alt"></i> Выйти
        </button>
    `;
    
    document.body.appendChild(menu);
    
    // Обработчик выхода
    const logoutBtn = menu.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            authDB.logout();
            showNotification('Вы вышли из аккаунта', 'success');
            menu.remove();
            updateAuthUI();
        };
    }
    
    // Закрытие меню при клике вне его
    setTimeout(() => {
        const closeMenuHandler = (event) => {
            if (!menu.contains(event.target) && event.target !== authBtn) {
                menu.remove();
                document.removeEventListener('click', closeMenuHandler);
            }
        };
        document.addEventListener('click', closeMenuHandler);
    }, 10);
}

// Загрузка подписок пользователя
async function loadUserSubscriptions() {
    console.log('Загружаем подписки пользователя');
    
    const user = authDB.getCurrentUser();
    const subscriptionsList = document.getElementById('subscriptions-list');
    
    if (!subscriptionsList || !user) return;
    
    try {
        // Получаем все каналы
        const channels = await authDB.getAllChannels();
        
        // Фильтруем подписки пользователя
        const userSubscriptions = user.subscriptions || [];
        const subscriptionChannels = channels.filter(channel => 
            userSubscriptions.includes(channel.id)
        );
        
        if (subscriptionChannels.length === 0) {
            subscriptionsList.innerHTML = `
                <div class="no-subscriptions">
                    <p>Нет подписок</p>
                    <small>Нажмите на кнопку подписки на каналах</small>
                </div>
            `;
            return;
        }
        
        // Создаем список подписок
        subscriptionsList.innerHTML = subscriptionChannels.map(channel => `
            <div class="subscription-item" onclick="window.location.href='channel.html?id=${channel.id}'">
                <div class="subscription-avatar">${channel.avatar || channel.name.charAt(0)}</div>
                <span>${channel.name}</span>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Ошибка загрузки подписок:', error);
        subscriptionsList.innerHTML = '<p style="color: #B0B0B0; padding: 10px;">Ошибка загрузки подписок</p>';
    }
}

// Проверка авторизации при загрузке страницы
function checkAuthOnLoad() {
    console.log('Проверка авторизации при загрузке');
    
    const user = authDB.getCurrentUser();
    
    // Обновляем UI
    updateAuthUI();
    
    // Если пользователь авторизован, загружаем подписки
    if (user && typeof loadUserSubscriptions === 'function') {
        loadUserSubscriptions();
    }
    
    // Если на странице загрузки видео, проверяем канал
    if (window.location.pathname.includes('upload.html') && user && !user.channelCreated) {
        showChannelCreationModal();
        return false;
    }
    
    // Если не авторизован и на странице загрузки, показываем авторизацию
    if (window.location.pathname.includes('upload.html') && !user) {
        setTimeout(() => {
            showAuthModal('login');
            showNotification('Для загрузки видео необходимо войти в аккаунт', 'info');
        }, 500);
        return false;
    }
    
    return true;
}

// Экспортируем функции для использования в других файлах
window.authDB = authDB;
window.showAuthModal = showAuthModal;
window.showChannelCreationModal = showChannelCreationModal;
window.updateAuthUI = updateAuthUI;
window.showUserMenu = showUserMenu;
window.loadUserSubscriptions = loadUserSubscriptions;
window.checkAuthOnLoad = checkAuthOnLoad;
