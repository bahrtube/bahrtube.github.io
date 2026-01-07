// Система аутентификации
const authDB = {
    // Получение текущего пользователя
    getCurrentUser: () => {
        try {
            const userStr = localStorage.getItem('currentUser');
            return userStr ? JSON.parse(userStr) : null;
        } catch (error) {
            console.error('Ошибка получения пользователя:', error);
            return null;
        }
    },

    // Регистрация
    registerUser: async (userData) => {
        try {
            const snapshot = await database.ref('users').orderByChild('email').equalTo(userData.email).once('value');
            if (snapshot.exists()) {
                return { success: false, error: 'Пользователь с таким email уже существует' };
            }
            
            const userRef = database.ref('users').push();
            const userId = userRef.key;
            
            const userWithId = {
                ...userData,
                id: userId,
                createdAt: Date.now(),
                channelCreated: false,
                subscriptions: [],
                videos: [],
                savedVideos: [],
                reactions: {}
            };
            
            await userRef.set(userWithId);
            
            localStorage.setItem('currentUser', JSON.stringify(userWithId));
            
            return { success: true, user: userWithId };
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            return { success: false, error: error.message };
        }
    },

    // Авторизация
    loginUser: async (email, password) => {
        try {
            const snapshot = await database.ref('users').orderByChild('email').equalTo(email).once('value');
            
            if (!snapshot.exists()) {
                return { success: false, error: 'Пользователь не найден' };
            }
            
            const users = snapshot.val();
            const userId = Object.keys(users)[0];
            const user = users[userId];
            
            if (user.password !== password) {
                return { success: false, error: 'Неверный пароль' };
            }
            
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
            await database.ref(`users/${userId}`).update({
                channelCreated: true,
                channelName: channelData.name,
                channelDescription: channelData.description,
                channelAvatar: channelData.avatar,
                subscribers: 0
            });
            
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

    // Выход
    logout: () => {
        localStorage.removeItem('currentUser');
        return { success: true };
    },

    // Обновление пользователя
    updateUser: async (userId, updates) => {
        try {
            await database.ref(`users/${userId}`).update(updates);
            
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            Object.assign(currentUser, updates);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            return { success: true };
        } catch (error) {
            console.error('Ошибка обновления пользователя:', error);
            return { success: false, error: error.message };
        }
    },

    // Подписка
    subscribeToChannel: async (channelId, userId) => {
        try {
            const currentUser = authDB.getCurrentUser();
            if (!currentUser) return { success: false, error: 'Пользователь не авторизован' };
            
            const snapshot = await database.ref(`users/${channelId}`).once('value');
            const channel = snapshot.val();
            
            if (!channel) return { success: false, error: 'Канал не найден' };
            
            const userSubscriptions = currentUser.subscriptions || [];
            if (userSubscriptions.includes(channelId)) {
                return { success: false, error: 'Вы уже подписаны на этот канал' };
            }
            
            const newSubscriptions = [...userSubscriptions, channelId];
            await authDB.updateUser(currentUser.id, { subscriptions: newSubscriptions });
            
            const currentSubs = channel.sub
