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
