const puppeteer = require('puppeteer'),
      EventEmitter = require('events'),
      axios = require('axios'),
      dogegarden = axios.create({ baseURL: 'https://api.dogegarden.net/v1' });

let page;
const getPage = (args = ['--mute-audio', '--start-maximized'], puppeteerOptions = {}) => new Promise(async (resolve, reject) => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: false,
    args,
    ...puppeteerOptions
  });
  resolve(await browser.newPage());
});

class User extends Object {
  constructor({ id, displayName, username, room, followers, following, bio }) {
    super();
    this.id = id;
    this.displayName = displayName;
    this.username = username;
    this.profileURL = `https://dogehouse.tv/u/${username}`;
    this.room = room;
    this.followers = followers;
    this.following = following;
    this.bio = bio;
  }
}

class ClientUser extends User {
  constructor(data) {
    super(data);
  }
}

class Client extends EventEmitter {
  constructor({ room, token, refresh }) {
    super();
    this.room = room;
    this._token = token;
    this._refresh = refresh;
  }

  async init(...initData) {
    page = await getPage(...initData);
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(`https://dogehouse.tv`);
    await page.exposeFunction('newMessage', async (message) => {
      message.author = new User(message.author);
      const say = async (msg) => await this.sendMessage(msg, {
        message
      });
      Object.defineProperty(say, 'say', {
        configurable: true,
      });
      message.room.send = say;
      message.say = say;
      const reply = async (msg) => await this.whisper(message.author.username, msg, message);
      Object.defineProperty(reply, 'reply', {
        configurable: true,
      });
      message.author.send = message.reply = reply;
      this.emit('message', message);
    });
    await page.evaluate((token, refreshToken) => {
      localStorage.setItem('@toum/token', token);
      localStorage.setItem('@toum/refresh-token', refreshToken);
    }, this._token, this._refresh);
    await page.goto('https://dogehouse.tv/dash');
    await page.waitForSelector('#main > div:nth-child(3) > div.flex.flex-1.flex-col.overflow-y-auto > div:nth-child(1) > div');
    await page.exposeFunction('registerClientData', (data) => {
      this.user = new ClientUser(data);
    });
    await page.evaluate(() => {
      const [displayName, username, followerText, followingText, ...bio] = document.querySelector('#main > div:nth-child(3) > div.flex.flex-1.flex-col.overflow-y-auto > div:nth-child(1) > div').innerText.split('\n');
      const followers = followerText.replace(/\D/g, '');
      const following = followingText.replace(/\D/g, '');
      followers.fetched = false;
      followers.following = false;
      registerClientData({
        displayName,
        username: username.replace('@', ''),
        followers: new Array((isNaN(followers) ? 0 : parseInt(followers)) || 0),
        following: new Array((isNaN(following) ? 0 : parseInt(following)) || 0),
        bio: bio.join('\n')
      });
    });
    await page.goto(`https://dogehouse.tv/room/${this.room}`);
    await page.waitForSelector('.w-full.h-full.mt-auto');
    await page.evaluate((roomID, User) => {
      const chatEl = document.querySelector('.w-full.h-full.mt-auto');
      let oldMessageCache = [], messageCache = [];
      const updateMessageCache = (mutations, observer) => {
        oldMessageCache = messageCache;
        messageCache = [];
        const callback = () => {
          const lastMessage = messageCache[messageCache.length - 1];
          if (oldMessageCache[oldMessageCache.length - 1] !== lastMessage) {
            newMessage(lastMessage);
          }
        }
        for (let i in chatEl.children) {
          const messageEl = chatEl.children[i];
          if (!messageEl.innerHTML) return;
          let username, content, type = 'message';
          if (messageEl.children[0].children[0].innerText === 'Whisper') {
            const [userEl,, contentEl] = messageEl.children[0].children[1].children[0].children;
            username = userEl.innerText;
            content = contentEl.innerHTML.trim();
            type = 'whisper'
          } else {
            const [userEl,, contentEl] = messageEl.children[0].children[0].children[0].children;
            username = userEl.innerText;
            content = contentEl.innerHTML.trim();
          }
          messageCache.push({
            type,
            room: {
              id: roomID
            },
            author: {
              username
            },
            content
          });
          if (i == chatEl.children.length - 1) callback();
        }
      }
      updateMessageCache();
      MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
      const observer = new MutationObserver(updateMessageCache);
      observer.observe(chatEl, { childList: true, subtree: true });
    }, this.room, User);
    this.emit('ready');
  }

  async sendMessage(message, context = {}) {
    const sleep = (ms) => new Promise((resolve, reject) => {
      setTimeout(resolve, ms);
    });
    if (
        (
          (this?.user?.id && context?.message?.author?.id) &&
          (this?.user?.id === context?.message?.author?.id)
        ) ||
        (
          (this?.user?.username && context?.message?.author?.username) && 
          (this?.user?.username === context?.message?.author?.username)
        )
      )
      {
       await sleep(1500);
     }
    try {
      await page.focus('[placeholder="Send a Message"]');
      await page.keyboard.down('Shift');
      await page.keyboard.press('Home');
      await page.keyboard.up('Shift');
      await page.keyboard.press('Backspace');
      await page.type('[placeholder="Send a Message"]', message);
      await page.keyboard.press('Enter');
      return true;
    } catch (e) {
      return new Error(e);
    }
  }

  async whisper(username, message, context = {}) {
    if (this?.user?.username && username === this?.user?.username) return setTimeout(() => this.sendMessage(message), 1000);
    try {
      await page.focus('[placeholder="Send a Message"]');
      await page.keyboard.down('Shift'); 
      await page.keyboard.press('Home');
      await page.keyboard.up('Shift');
      await page.keyboard.press('Backspace');
      await page.type('[placeholder="Send a Message"]', `#@${username}`);
      await page.keyboard.press('Tab');
      await page.type('[placeholder="Send a Message"]', message);
      await page.keyboard.press('Enter');
      return true;
    } catch (e) {
      return new Error(e);
    }
  }
}

module.exports = {
  Client
}
