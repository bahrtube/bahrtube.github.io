// proxy-checker.js
const PROXY_SERVERS = [
  {
    name: "Invidious Riverside",
    embedUrl: "https://inv.riverside.rocks/embed/{id}",
    directUrl: "https://inv.riverside.rocks/watch?v={id}"
  },
  {
    name: "yewtu.be",
    embedUrl: "https://yewtu.be/embed/{id}",
    directUrl: "https://yewtu.be/watch?v={id}"
  },
  {
    name: "Piped",
    embedUrl: "https://piped.video/embed/{id}",
    directUrl: "https://piped.video/watch?v={id}"
  },
  {
    name: "vid.puffyan.us",
    embedUrl: "https://vid.puffyan.us/embed/{id}",
    directUrl: "https://vid.puffyan.us/watch?v={id}"
  }
];

async function testProxy(proxy) {
  try {
    const testUrl = proxy.embedUrl.replace('{id}', 'dQw4w9WgXcQ'); // Rick Astley test video
    const response = await fetch(testUrl, { 
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache'
    });
    return { ...proxy, working: true };
  } catch (error) {
    return { ...proxy, working: false };
  }
}

async function getBestProxy() {
  for (const proxy of PROXY_SERVERS) {
    const result = await testProxy(proxy);
    if (result.working) {
      console.log(`Using proxy: ${result.name}`);
      return result;
    }
  }
  
  // Fallback to the first proxy
  console.log("All proxies failed, using fallback");
  return { ...PROXY_SERVERS[0], working: false };
}

// Использование в script.js:
// async function getYouTubeProxyUrl(videoId) {
//   const bestProxy = await getBestProxy();
//   return bestProxy.embedUrl.replace('{id}', videoId);
// }
