```js
const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const express = require("express");
const mongoose = require("mongoose");

const app = express();

app.use(express.json());

// =========================
// BOT
// =========================

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// =========================
// WEBHOOK
// =========================

const WEBHOOK_URL = process.env.WEBHOOK_URL;

async function logWebhook(title, description) {

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
                        title: title,
                        description: description,
                        color: 65280
                    }
                ]
            })
        });

    } catch (err) {

        console.log(err);

    }
}

// =========================
// MONGODB
// =========================

mongoose.connect(process.env.MONGO_URI)

.then(() => {

    console.log("MongoDB Connected");

})

.catch(err => {

    console.log(err);

});

// =========================
// DATABASE
// =========================

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

    createdAt: Number

});

const Key = mongoose.model("Key", keySchema);

// =========================
// RANDOM KEY
// =========================

function randomKey() {

    return Math.random()
        .toString(36)
        .substring(2, 10)
        .toUpperCase();
}

// =========================
// READY
// =========================

client.once("ready", async () => {

    console.log(`Logged in as ${client.user.tag}`);

    const commands = [

        new SlashCommandBuilder()
            .setName("gen")
            .setDescription("Generate key")

    ].map(cmd => cmd.toJSON());

    const rest = new REST({
        version: "10"
    }).setToken(process.env.DISCORD_TOKEN);

    await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
    );

    console.log("Slash commands registered");

});

// =========================
// COMMANDS
// =========================

client.on("interactionCreate", async interaction => {

    // =====================
    // /gen
    // =====================

    if (interaction.isChatInputCommand()) {

        if (interaction.commandName === "gen") {

            const key = randomKey();

            await Key.create({

                key: key,

                ownerId: interaction.user.id,

                createdAt: Date.now()

            });

            const row = new ActionRowBuilder()

                .addComponents(

                    new ButtonBuilder()

                        .setCustomId(`reset_${key}`)

                        .setLabel("Reset HWID")

                        .setStyle(ButtonStyle.Secondary)

                );

            await interaction.reply({

                content:
`🔑 Key Generated

${key}`,

                components: [row],

                ephemeral: true

            });

            await logWebhook(
                "Key Generated",
                `User: <@${interaction.user.id}>
Key: ${key}`
            );
        }
    }

    // =====================
    // RESET BUTTON
    // =====================

    if (interaction.isButton()) {

        if (interaction.customId.startsWith("reset_")) {

            const key = interaction.customId.replace("reset_", "");

            const data = await Key.findOne({
                key: key
            });

            if (!data) {

                return interaction.reply({

                    content: "Invalid Key",

                    ephemeral: true

                });

            }

            // OWNER CHECK
            if (data.ownerId !== interaction.user.id) {

                return interaction.reply({

                    content: "You do not own this key",

                    ephemeral: true

                });

            }

            // RESET
            data.hwid = null;
            data.userId = null;

            await data.save();

            await interaction.reply({

                content: "✅ HWID Reset Successful",

                ephemeral: true

            });

            await logWebhook(
                "HWID Reset",
                `User: <@${interaction.user.id}>
Key: ${key}`
            );
        }
    }
});

// =========================
// API
// =========================

app.get("/", (req, res) => {

    res.send("Online");

});

// =========================
// CHECK
// =========================

app.post("/check", async (req, res) => {

    const { key, hwid, userId } = req.body;

    const data = await Key.findOne({
        key: key
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

    // HWID LOCK
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

    await logWebhook(
        "Script Executed",
        `Key: ${key}
UserId: ${userId}`
    );

    return res.json({
        status: "VALID"
    });

});

// =========================
// START
// =========================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`API running on ${PORT}`);

});

// =========================
// LOGIN
// =========================

client.login(process.env.DISCORD_TOKEN);
```
