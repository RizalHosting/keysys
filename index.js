const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");

const app = express();
app.use(express.json());

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 🔑 in-memory key storage (temporary)
const keys = {};

// 🔹 generate key
function generateKey(type) {
    const key = Math.random().toString(36).substring(2, 10);

    let expiresAt = 0;

    if (type === "week") {
        expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    } else if (type === "month") {
        expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    }

    keys[key] = {
        expiresAt,
        hwid: null,
        userId: null
    };

    return key;
}

// 🤖 Discord command
client.on("messageCreate", (msg) => {
    if (!msg.content.startsWith("!gen")) return;

    const type = msg.content.split(" ")[1];

    if (!["week", "month", "lifetime"].includes(type)) {
        return msg.reply("Use: !gen week / month / lifetime");
    }

    const key = generateKey(type);

    msg.reply(`Your key: ${key}`);
});

// 🌐 API endpoint (Roblox will call this)
app.post("/check", (req, res) => {
    const { key, hwid, userId } = req.body;
    const data = keys[key];

    if (!data) return res.json({ status: "INVALID_KEY" });

    if (data.expiresAt !== 0 && Date.now() > data.expiresAt) {
        return res.json({ status: "EXPIRED" });
    }

    // 🔒 lock to first device + account
    if (!data.hwid) {
        data.hwid = hwid;
        data.userId = userId;
    }

    if (data.hwid !== hwid) {
        return res.json({ status: "DEVICE_LOCKED" });
    }

    if (data.userId !== userId) {
        return res.json({ status: "ACCOUNT_MISMATCH" });
    }

    res.json({ status: "VALID" });
});

// 🔌 port fix for Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API running on port " + PORT));

// 🤖 login bot (IMPORTANT: uses env variable)
client.login(process.env.TOKEN);
