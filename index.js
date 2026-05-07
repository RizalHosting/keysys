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

// =====================================
// DISCORD BOT
// =====================================

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// =====================================
// WEBHOOK LOGGER
// =====================================

const WEBHOOK_URL = process.env.WEBHOOK_URL;

async function sendWebhook(title, description, color = 65280) {

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
                        color: color,
                        timestamp: new Date()
                    }
                ]
            })
        });

    } catch (err) {

        console.log(err);

    }
}

// =====================================
// MONGODB
// =====================================

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

// =====================================
// DATABASE SCHEMA
// =====================================

const keySchema = new mongoose.Schema({

    key: String,

    type: String,

    ownerId: String,

    expiresAt: Number,

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

// =====================================
// RANDOM KEY
// =====================================

function createRandomKey() {

    return Math.random()
        .toString(36)
        .substring(2, 10)
        .toUpperCase();
}

// =====================================
// READY EVENT
// =====================================

client.once("ready", async () => {

    console.log(`Logged in as ${client.user.tag}`);

    const commands = [

        // /gen
        new SlashCommandBuilder()
            .setName("gen")
            .setDescription("Generate a key")
            .addStringOption(option =>
                option.setName("type")
                    .setDescription("week/month/lifetime")
                    .setRequired(true)
                    .addChoices(
                        { name: "week", value: "week" },
                        { name: "month", value: "month" },
                        { name: "lifetime", value: "lifetime" }
                    )
            ),

        // /keyinfo
        new SlashCommandBuilder()
            .setName("keyinfo")
            .setDescription("View key info")
            .addStringOption(option =>
                option.setName("key")
                    .setDescription("Your key")
                    .setRequired(true)
            )

    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: "10" })
        .setToken(process.env.DISCORD_TOKEN);

    try {

        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );

        console.log("Slash commands registered");

    } catch (err) {

        console.log(err);

    }
});

// =====================================
// INTERACTIONS
// =====================================

client.on("interactionCreate", async interaction => {

    // =================================
    // SLASH COMMANDS
    // =================================

    if (interaction.isChatInputCommand()) {

        // /gen
        if (interaction.commandName === "gen") {

            const type = interaction.options.getString("type");

            const key = createRandomKey();

            let expiresAt = 0;

            if (type === "week") {

                expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);

            } else if (type === "month") {

                expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);

            }

            await Key.create({

                key: key,
                type: type,
                ownerId: interaction.user.id,
                expiresAt: expiresAt,
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

Key: ${key}
Type: ${type}

Lua:
getgenv().vex_key = "${key}"`,

                components: [row],
                ephemeral: true

            });

            await sendWebhook(
                "🔑 Key Generated",
                `User: <@${interaction.user.id}>
Key: ${key}
Type: ${type}`
            );
        }

        // /keyinfo
        if (interaction.commandName === "keyinfo") {

            const key = interaction.options.getString("key");

            const data = await Key.findOne({ key: key });

            if (!data) {

                return interaction.reply({
                    content: "❌ Invalid key",
                    ephemeral: true
                });

            }

            if (data.ownerId !== interaction.user.id) {

                return interaction.reply({
                    content: "❌ You do not own this key",
                    ephemeral: true
                });

            }

            let expiryText = "Never";

            if (data.expiresAt !== 0) {

                expiryText = new Date(data.expiresAt).toLocaleString();

            }

            return interaction.reply({

                content:
`🔑 Key Info

Key: ${data.key}
Type: ${data.type}

Executions: ${data.totalExecutions}

HWID Locked: ${data.hwid ? "Yes" : "No"}
Account Locked: ${data.userId ? "Yes" : "No"}

Expires: ${expiryText}`,

                ephemeral: true

            });
        }
    }

    // =================================
    // BUTTONS
    // =================================

    if (interaction.isButton()) {

        if (interaction.customId.startsWith("reset_")) {

            const key = interaction.customId.replace("reset_", "");

            const data = await Key.findOne({ key: key });

            if (!data) {

                return interaction.reply({
                    content: "❌ Invalid key",
                    ephemeral: true
                });

            }

            // OWNER CHECK
            if (data.ownerId !== interaction.user.id) {

                return interaction.reply({
                    content: "❌ You do not own this key",
                    ephemeral: true
                });

            }

            // RESET HWID
            data.hwid = null;
            data.userId = null;

            await data.save();

            await sendWebhook(
                "♻️ HWID Reset",
                `User: <@${interaction.user.id}>
Key: ${key}`
            );

            return interaction.reply({
                content: "✅ HWID Reset Successful",
                ephemeral: true
            });
        }
    }
});

// =====================================
// ROBLOX API
// =====================================

app.get("/", (req, res) => {

    res.send("Key System Online");

});

app.post("/check", async (req, res) => {

    const { key, hwid, userId } = req.body;

    const data = await Key.findOne({ key: key });

    // INVALID KEY
    if (!data) {

        await sendWebhook(
            "❌ Invalid Key Attempt",
            `Key: ${key}
HWID: ${hwid}
UserId: ${userId}`,
            16711680
        );

        return res.json({
            status: "INVALID_KEY"
        });
    }

    // EXPIRED
    if (
        data.expiresAt !== 0 &&
        Date.now() > data.expiresAt
    ) {

        return res.json({
            status: "EXPIRED"
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

        await sendWebhook(
            "🚫 Device Mismatch",
            `Key: ${key}
Attempted HWID: ${hwid}
Stored HWID: ${data.hwid}`,
            16753920
        );

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

    // EXECUTION LOG
    data.totalExecutions += 1;

    await data.save();

    await sendWebhook(
        "✅ Script Executed",
        `Key: ${key}
Roblox UserId: ${userId}
Executions: ${data.totalExecutions}`
    );

    return res.json({
        status: "VALID"
    });
});

// =====================================
// START API
// =====================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`API running on ${PORT}`);

});

// =====================================
// LOGIN
// =====================================

client.login(process.env.DISCORD_TOKEN);
