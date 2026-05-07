const {

app.post("/check", async (req, res) => {

    const { key, hwid, userId } = req.body;

    const data = await Key.findOne({ key });

    // INVALID
    if (!data) {
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
        return res.json({
            status: "DEVICE_LOCKED"
        });
    }

    // ROBLOX ACCOUNT LOCK
    if (data.userId !== userId) {
        return res.json({
            status: "ACCOUNT_MISMATCH"
        });
    }

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
