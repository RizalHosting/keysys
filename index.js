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

// ======================================
// DISCORD BOT
// ======================================

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// ======================================
// WEBHOOK LOGGER
// ======================================

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
                        title,
                        description,
                        color,
                        timestamp: new Date()
                    }
                ]
            })
        });

    } catch (err) {

        console.log(err);

    }
}

// ======================================
// MONGODB
// ======================================

mongoose.connect(process.env.MONGO_URI)

.then(() => {

    console.log("MongoDB Connected");

})

.catch((err) => {

    console.log(err);

});

// ======================================
// DATABASE
// ======================================

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

// ======================================
// RANDOM KEY
// ======================================

function generateKey() {

    return Math.random()
        .toString(36)
        .substring(2, 12)
        .toUpperCase();

}

// ======================================
// READY
// ======================================

client.once("ready", async () => {

    console.log(`Logged in as ${client.user.tag}`);

    const commands = [

        // =========================
        // /gen
        // =========================

        new SlashCommandBuilder()
            .setName("gen")
            .setDescription("Generate a key"),

        // =========================
        // /keyinfo
        // =========================

        new SlashCommandBuilder()
            .setName("keyinfo")
            .setDescription("Check your key info")
            .addStringOption(option =>
                option.setName("key")
                    .setDescription("Your key")
                    .setRequired(true)
            )

    ].map(cmd => cmd.toJSON());

    const rest = new REST({
        version: "10"
    }).setToken(process.env.DISCORD_TOKEN);

    try {

        await rest.put(
            Routes.applicationCommands(client.user.id),
            {
                body: commands
            }
        );

        console.log("Slash commands registered");

    } catch (err) {

        console.log(err);

    }

});

// ======================================
// COMMANDS
// ======================================

client.on("interactionCreate", async (interaction) => {

    // ==================================
    // SLASH COMMANDS
    // ==================================

    if (interaction.isChatInputCommand()) {

        // ==================================
        // /GEN
        // ==================================

        if (interaction.commandName === "gen") {

            await interaction.deferReply({
                ephemeral: true
            });

            try {

                const key = generateKey();

                await Key.create({

                    key,

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

                await interaction.editReply({

                    content:
`🔑 Key Generated

Key:
${key}

Use:
getgenv().vex_key = "${key}"`,

                    components: [row]

                });

                await sendWebhook(
                    "🔑 Key Generated",
                    `User: <@${interaction.user.id}>
Key: ${key}`
                );

            } catch (err) {

                console.log(err);

                await interaction.editReply({

                    content: "❌ Error generating key"

                });

            }
        }

        // ==================================
        // /KEYINFO
        // ==================================

        if (interaction.commandName === "keyinfo") {

            await interaction.deferReply({
                ephemeral: true
            });

            try {

                const key = interaction.options.getString("key");

                const data = await Key.findOne({
                    key
                });

                if (!data) {

                    return interaction.editReply({

                        content: "❌ Invalid key"

                    });

                }

                if (data.ownerId !== interaction.user.id) {

                    return interaction.editReply({

                        content: "❌ You do not own this key"

                    });

                }

                await interaction.editReply({

                    content:
`🔑 Key Info

Key: ${data.key}

Executions: ${data.totalExecutions}

HWID Locked:
${data.hwid ? "Yes" : "No"}

Roblox Account Locked:
${data.userId ? "Yes" : "No"}

Created:
${new Date(data.createdAt).toLocaleString()}`

                });

            } catch (err) {

                console.log(err);

                await interaction.editReply({

                    content: "❌ Error"

                });

            }
        }
    }

    // ==================================
    // BUTTONS
    // ==================================

    if (interaction.isButton()) {

        if (interaction.customId.startsWith("reset_")) {

            await interaction.deferReply({
                ephemeral: true
            });

            try {

                const key = interaction.customId.replace("reset_", "");

                const data = await Key.findOne({
                    key
                });

                if (!data) {

                    return interaction.editReply({

                        content: "❌ Invalid key"

                    });

                }

                if (data.ownerId !== interaction.user.id) {

                    return interaction.editReply({

                        content: "❌ You do not own this key"

                    });

                }

                data.hwid = null;

                data.userId = null;

                await data.save();

                await interaction.editReply({

                    content: "✅ HWID Reset Successful"

                });

                await sendWebhook(
                    "♻️ HWID Reset",
                    `User: <@${interaction.user.id}>
Key: ${key}`
                );

            } catch (err) {

                console.log(err);

                await interaction.editReply({

                    content: "❌ Failed to reset HWID"

                });

            }
        }
    }

});

// ======================================
// API
// ======================================

app.get("/", (req, res) => {

    res.send("Key System Online");

});

// ======================================
// CHECK KEY
// ======================================

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

// ======================================
// START API
// ======================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`API running on ${PORT}`);

});

// ======================================
// LOGIN
// ======================================

client.login(process.env.DISCORD_TOKEN);
