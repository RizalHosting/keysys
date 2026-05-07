```js
const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");
const mongoose = require("mongoose");

const app = express();

app.use(express.json());

// ========================
// BOT
// ========================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ========================
// WEBHOOK
// ========================

const WEBHOOK_URL = process.env.WEBHOOK_URL;

async function sendWebhook(title, description) {

    if (!WEBHOOK_URL) return;

    try {

        await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                embeds: [
                    {
                        title,
                        description,
                        color: 65280
                    }
                ]
            })
        });

    } catch (err) {

        console.log(err);

    }
}

// ========================
// MONGODB
// ========================

mongoose.connect(process.env.MONGO_URI)

.then(() => {

    console.log("MongoDB Connected");

})

.catch((err) => {

    console.log(err);

});

// ========================
// DATABASE
// ========================

const keySchema = new mongoose.Schema({

    key: String,

    ownerId: String,

    hwid: {
        type: String,
        default: null
    },

    userId: {
        type: String,
        default: null
    },

    totalExecutions: {
        type: Number,
        default: 0
    },

    createdAt: Number

});

const Key = mongoose.model("Key", keySchema);

// ========================
// RANDOM KEY
// ========================

function generateKey() {

    return Math.random()
        .toString(36)
        .substring(2, 12)
        .toUpperCase();

}

// ========================
// READY
// ========================

client.once("ready", () => {

    console.log(`Logged in as ${client.user.tag}`);

});

// ========================
// COMMANDS
// ========================

client.on("messageCreate", async (message) => {

    if (message.author.bot) return;

    // ====================
    // !PING
    // ====================

    if (message.content === "!ping") {

        return message.reply("🏓 Pong!");

    }

    // ====================
    // !GEN
    // ====================

    if (message.content === "!gen") {

        try {

            const key = generateKey();

            await Key.create({

                key,

                ownerId: message.author.id,

                createdAt: Date.now()

            });

            await message.reply(
`🔑 Key Generated

${key}

Use:
getgenv().vex_key = "${key}"`
            );

            await sendWebhook(
                "🔑 Key Generated",
                `User: ${message.author.tag}
Key: ${key}`
            );

        } catch (err) {

            console.log(err);

            message.reply("❌ Error generating key");

        }

    }

    // ====================
    // !RESET
    // ====================

    if (message.content.startsWith("!reset ")) {

        try {

            const args = message.content.split(" ");

            const key = args[1];

            const data = await Key.findOne({
                key
            });

            if (!data) {

                return message.reply("❌ Invalid key");

            }

            if (data.ownerId !== message.author.id) {

                return message.reply("❌ You do not own this key");

            }

            data.hwid = null;
            data.userId = null;

            await data.save();

            await message.reply("✅ HWID Reset Successful");

            await sendWebhook(
                "♻️ HWID Reset",
                `User: ${message.author.tag}
Key: ${key}`
            );

        } catch (err) {

            console.log(err);

            message.reply("❌ Error resetting HWID");

        }

    }

    // ====================
    // !KEYINFO
    // ====================

    if (message.content.startsWith("!keyinfo ")) {

        try {

            const args = message.content.split(" ");

            const key = args[1];

            const data = await Key.findOne({
                key
            });

            if (!data) {

                return message.reply("❌ Invalid key");

            }

            if (data.ownerId !== message.author.id) {

                return message.reply("❌ You do not own this key");

            }

            message.reply(
`🔑 Key Info

Key: ${data.key}

Executions: ${data.totalExecutions}

HWID Locked:
${data.hwid ? "Yes" : "No"}

Account Locked:
${data.userId ? "Yes" : "No"}`
            );

        } catch (err) {

            console.log(err);

            message.reply("❌ Error");

        }

    }

});

// ========================
// API
// ========================

app.get("/", (req, res) => {

    res.send("Key System Online");

});

// ========================
// CHECK KEY
// ========================

app.post("/check", async (req, res) => {

    try {

        const { key, hwid, userId } = req.body;

        const data = await Key.findOne({
            key
        });

        // INVALID
        if (!data) {

            return res.json({
                status: "INVALID_KEY"
            });

        }

        // FIRST LOCK
        if (!data.hwid) {

            data.hwid = hwid;

            data.userId = userId;

            await data.save();

        }

        // DEVICE LOCK
        if (data.hwid !== hwid) {

            return res.json({
                status: "DEVICE_LOCKED"
            });

        }

        // ACCOUNT LOCK
        if (data.userId !== userId) {

            return res.json({
                status: "ACCOUNT_MISMATCH"
            });

        }

        // EXECUTION
        data.totalExecutions += 1;

        await data.save();

        await sendWebhook(
            "✅ Script Executed",
            `Key: ${key}
UserId: ${userId}
Executions: ${data.totalExecutions}`
        );

        return res.json({
            status: "VALID"
        });

    } catch (err) {

        console.log(err);

        return res.json({
            status: "ERROR"
        });

    }

});

// ========================
// START
// ========================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`API running on ${PORT}`);

});

// ========================
// LOGIN
// ========================

client.login(process.env.DISCORD_TOKEN);
```
