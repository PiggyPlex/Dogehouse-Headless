require('dotenv').config();

const Dogehouse = require('../src'),
client = new Dogehouse.Client({
  room: procecss.env.DOGEHOUSE_ROOM,
  token: process.env.DOGEHOUSE_TOKEN,
  refreshToken: process.env.DOGEHOUSE_REFRESH_TOKEN
}),
axios = require('axios');

const prefix = process.env.PREFIX;

client.on('ready', () => {
  console.log('Ready!', client.user.displayName);
});

client.on('message', async (message) => {
  if (message.type !== 'message') return;
  if (!message.content.startsWith(prefix)) return;
  const parts = message.content.split(' ');
  const args = parts.splice(1);
  const command = parts[0].slice(prefix.length);
  if (command === 'ping') message.say('pong');
  if (command === 'foo') message.say('bar');
  if (command === 'say') {
    message.say(`${message.author.username} asked me to say \`${args.join(' ')}\`.`);
  }
  if (command === 'bored') {
    const { data } = await axios.get('https://www.boredapi.com/api/activity');
    message.reply(data.activity);
  }
  if (command === 'joke') {
    const category = args[0] ? ['any', 'misc', 'programming', 'dark', 'pun', 'spooky', 'christmas'].includes(args[0].toLowerCase()) ? args[0] : 'any' : 'any';
    const { data: { setup, delivery, joke } } = await axios.get(`https://v2.jokeapi.dev/joke/${category}`);
    if (joke) message.say(joke);
    if (setup) {
      message.say(setup);
      setTimeout(() => message.say(delivery), 1500);
    }
  }
  if (command === 'tableflip') message.say('(╯°□°）╯︵ ┻━┻');
  if (command === 'shrug') message.say('¯\\_(ツ)_/¯');
});

client.init();
