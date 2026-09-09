const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    Browsers,
    delay
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

let globalSock = null;
let latestPairingCode = "Bot is already paired & running!";

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>FAMOUS BATMAN X OSMANI HACKER³¹³ - Panel</title>
            <style>
                body { background: #0f172a; color: #fff; font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .card { background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); width: 100%; max-width: 400px; text-align: center; }
                h2 { color: #38bdf8; margin-bottom: 10px; font-size: 20px; }
                p { color: #94a3b8; font-size: 14px; }
                input { width: 100%; padding: 12px; margin: 15px 0; background: #0f172a; border: 1px solid #334155; color: #fff; border-radius: 6px; box-sizing: border-box; font-size: 16px; outline: none; }
                button { background: #0284c7; color: white; border: none; padding: 12px; width: 100%; border-radius: 6px; font-size: 16px; cursor: pointer; font-weight: bold; }
                button:hover { background: #0ea5e9; }
                .code-box { background: #0f172a; border: 1px dashed #38bdf8; padding: 15px; margin-top: 20px; border-radius: 6px; font-size: 20px; color: #4ade80; font-weight: bold; word-break: break-all; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>FAMOUS BATMAN X OSMANI HACKER³¹³</h2>
                <p>WhatsApp MD Bot Active Panel</p>
                <form action="/pair" method="POST">
                    <input type="text" name="phone" placeholder="Enter Number (if re-pairing)" required>
                    <button type="submit">Get Pairing Code</button>
                </form>
                <div class="code-box">${latestPairingCode}</div>
            </div>
        </body>
        </html>
    `);
});

app.post('/pair', async (req, res) => {
    let phoneNumber = req.body.phone.replace(/[^0-9]/g, '');
    if (!phoneNumber || !globalSock) return res.redirect('/');
    try {
        await delay(3000);
        let code = await globalSock.requestPairingCode(phoneNumber);
        code = code?.match(/.{1,4}/g)?.join('-') || code;
        latestPairingCode = `${code}`;
    } catch (err) {
        latestPairingCode = "Error generating code!";
    }
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`🌐 Panel running on port ${PORT}`);
});

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.macOS('Chrome'),
        auth: state
    });

    globalSock = sock;

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                startBot();
            } else {
                if (fs.existsSync('./auth_info')) {
                    fs.rmSync('./auth_info', { recursive: true, force: true });
                }
                startBot();
            }
        } else if (connection === 'open') {
            console.log('✅ FAMOUS BATMAN X OSMANI HACKER³¹³ Bot successfully connected!');
            latestPairingCode = "CONNECTED SUCCESSFULLY! 🎉";
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const m = messages[0];
        if (!m.message) return;

        const sender = m.key.remoteJid;
        
        // Extract text body from various message types safely
        const msgType = Object.keys(m.message)[0];
        let body = '';
        
        if (msgType === 'conversation') {
            body = m.message.conversation;
        } else if (msgType === 'extendedTextMessage') {
            body = m.message.extendedTextMessage.text;
        } else if (msgType === 'imageMessage') {
            body = m.message.imageMessage.caption || '';
        } else if (msgType === 'videoMessage') {
            body = m.message.videoMessage.caption || '';
        }

        if (!body) return;
        console.log(`📩 Received message from ${sender}: ${body}`);

        const command = body.trim().toLowerCase();

        if (command === '.menu' || command === 'menu') {
            const imageUrl = 'https://cdn.phototourl.com/free/2026-09-09-ca4f120b-25cf-4e58-bb67-371225c1d24f.jpg';
            
            const menuText = `╭━━━〔 *FAMOUS BATMAN X OSMANI HACKER³¹³* 〕━━━⊷
┃ ✦ *Owner:* FAMOUS BATMAN & OSMANI HACKER³¹³
┃ ✦ *Commands:* 751+
┃ ✦ *Runtime:* Online 24/7
┃ ✦ *Prefix:* .
┃ ✦ *Mode:* Public
┃ ✦ *Version:* 7.0.0 Pro
╰──────────────────────────────────────⊷

` + "`『 CATEGORIES AVAILABLE 』`" + `
╭──────────────────────────────────────⊷
┃ ⬡ *AI Commands* (ChatGPT, Copilot, Gemini, DeepSeek, Claude...)
┃ ⬡ *Download* (TikTok, YouTube, Insta, Facebook, Mediafire...)
┃ ⬡ *Group Management* (Kick, Mute, TagAll, Promote, AntiLink...)
┃ ⬡ *Fun & Games* (Ship, Roast, 8Ball, Anime, Dp commands...)
┃ ⬡ *Audio Editors* (Bass, Nightcore, Robot, Slow, Fast...)
┃ ⬡ *Tools & Utilities* (Font styles, RemoveBG, Upscale, Remini...)
┃ ⬡ *Settings & Owner* (Sudo, AutoReact, Mode, Prefix setup...)
╰──────────────────────────────────────⊷

> *Type .help or .allcmd to explore all features.*
> *© Powered by FAMOUS BATMAN X OSMANI HACKER³¹³*`;

            try {
                await sock.sendMessage(sender, {
                    image: { url: imageUrl },
                    caption: menuText
                });
            } catch (err) {
                await sock.sendMessage(sender, { text: menuText });
            }
        }

        if (command === '.ping' || command === 'ping') {
            await sock.sendMessage(sender, { text: '⚡ Pong! FAMOUS BATMAN X OSMANI HACKER³¹³ Bot is active.' });
        }

        if (command === '.owner' || command === 'owner') {
            await sock.sendMessage(sender, { text: '👑 Official Creators:\n\n🔥 FAMOUS BATMAN X OSMANI HACKER³¹³' });
        }
    });
}

startBot();
