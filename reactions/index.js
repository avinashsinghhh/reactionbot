require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ChannelType,
} = require("discord.js");
const { EMOJI, WEIGHTS, BRILLIANT_CHANCE, TOXIC_WORDS } = require("./config");

// ---------- settings (which channel each server uses) ----------
const SETTINGS_FILE = path.join(__dirname, "data", "settings.json");
fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
  } catch {
    return {};
  }
}
function saveSettings() {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}
const settings = loadSettings(); // { guildId: channelId }

// ---------- slash commands ----------
const commands = [
  new SlashCommandBuilder()
    .setName("setchannel")
    .setDescription("Choose the channel where the bot reacts to messages")
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription("The channel to watch")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("clearchannel")
    .setDescription("Stop the bot from reacting in this server")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
].map((c) => c.toJSON());

// ---------- judging logic ----------
const prevInChannel = new Map(); // channelId -> { authorId, content, ts }
const prevByAuthor = new Map(); // channelId:authorId -> content

const TOXIC_RE = new RegExp(`\\b(${TOXIC_WORDS.join("|")})\\b`, "i");
const GREETING_RE =
  /^(hi+|hello+|hey+|yo+|sup|gm|gn|good (morning|evening|night|afternoon))\b/i;

function weightedRandom() {
  const entries = Object.entries(WEIGHTS);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [label, w] of entries) {
    roll -= w;
    if (roll < 0) return label;
  }
  return "good";
}

function isSpam(text, lastByAuthor) {
  return (
    text.length <= 1 || (lastByAuthor && lastByAuthor === text.toLowerCase())
  );
}

function isShouting(text) {
  const letters = text.replace(/[^a-z]/gi, "");
  const upperRatio = letters.length
    ? letters.replace(/[^A-Z]/g, "").length / letters.length
    : 0;
  return (letters.length >= 6 && upperRatio > 0.7) || /[!?]{4,}/.test(text);
}

// "Best move" = a good continuation of the conversation.
function isContinuation(msg, prev) {
  if (msg.reference && msg.reference.messageId) return true; // a reply
  if (msg.mentions.users.size > 0) return true; // talks to someone
  return Boolean(
    prev &&
    prev.authorId !== msg.author.id &&
    Date.now() - prev.ts < 2 * 60 * 1000 &&
    prev.content.includes("?"), // answering a question
  );
}

function judge(msg) {
  const text = msg.content.trim();
  if (!text) return weightedRandom(); // images/attachments only

  const prev = prevInChannel.get(msg.channel.id);
  const lastByAuthor = prevByAuthor.get(`${msg.channel.id}:${msg.author.id}`);

  if (TOXIC_RE.test(text)) return "blunder";
  if (GREETING_RE.test(text)) return "book";
  if (isSpam(text, lastByAuthor)) return "inaccuracy";
  if (isShouting(text)) return "mistake";
  if (isContinuation(msg, prev)) return text.length >= 80 ? "great" : "best";
  if (Math.random() < BRILLIANT_CHANCE) return "brilliant";

  // Couldn't decide, so pick randomly.
  return weightedRandom();
}

function remember(msg) {
  prevInChannel.set(msg.channel.id, {
    authorId: msg.author.id,
    content: msg.content,
    ts: Date.now(),
  });
  prevByAuthor.set(
    `${msg.channel.id}:${msg.author.id}`,
    msg.content.trim().toLowerCase(),
  );
}

// ---------- client ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // must also be enabled in the Developer Portal
  ],
});

client.once(Events.ClientReady, async (c) => {
  await c.application.commands.set(commands);
  console.log(`Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || !interaction.guildId) return;

  if (interaction.commandName === "setchannel") {
    const channel = interaction.options.getChannel("channel");
    settings[interaction.guildId] = channel.id;
    saveSettings();
    await interaction.reply({
      content: `Now reacting to messages in ${channel}.`,
      ephemeral: true,
    });
  }

  if (interaction.commandName === "clearchannel") {
    delete settings[interaction.guildId];
    saveSettings();
    await interaction.reply({
      content: "Stopped reacting in this server.",
      ephemeral: true,
    });
  }
});

client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot || !msg.guild) return;
  if (settings[msg.guild.id] !== msg.channel.id) return;

  const label = judge(msg);
  remember(msg);

  try {
    await msg.react(EMOJI[label]);
  } catch (err) {
    console.error(`Could not react with "${label}":`, err.message);
  }
});

client.login(process.env.DISCORD_TOKEN);
