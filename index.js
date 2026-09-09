const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    Browsers 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

let globalSock = null;
let latestPairingCode = "Not Generated Yet. Enter number below!";

// Web Page HTML Form (Website for Pairing Code)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>FAMOUS BATMAN X OSMANI HACKER³¹³ - Pairing Panel</title>
            <style>
                body { background: #0f172a; color: #fff; font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .card { background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); width: 100%; max-width: 400px; text-align: center; }
                h2 { color: #38bdf8; margin-bottom: 10px; font-size: 20px; }
                p { color: #94a3b8; font-size: 14px; }
                input { width: 100%; padding: 12px; margin: 15px 0; background: #0f172a; border: 1px solid #334155; color: #fff; border-radius: 6px; box-sizing: border-box; font-size: 16px; outline: none; }
                button { background: #0284c7; color: white; border: none; padding: 12px; width: 100%; border-radius: 6px; font-size: 16px; cursor: pointer; font-weight: bold; }
                button:hover { background: #0ea5e9; }
                .code-box { background: #0f172a; border: 1px dashed #38bdf8; padding: 15px; margin-top: 20px; border-radius: 6px; font-size: 18px; color: #4ade80; font-weight: bold; word-break: break-all; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>FAMOUS BATMAN X OSMANI HACKER³¹³</h2>
                <p>WhatsApp MD Bot Pairing Panel</p>
                <form action="/pair" method="POST">
                    <input type="text" name="phone" placeholder="Enter Number (e.g. 923xxxxxxxxx)" required>
                    <button type="submit">Get Pairing Code</button>
                </form>
                <div class="code-box">${latestPairingCode}</div>
            </div>
        </body>
        </html>
    `);
});

// Handle Pairing Request from Website
app.post('/pair', async (req, res) => {
    const phoneNumber = req.body.phone;
    if (!phoneNumber) {
        latestPairingCode = "Please provide a valid phone number!";
        return res.redirect('/');
    }

    if (!globalSock) {
        latestPairingCode = "Bot is starting up, please try again in 10 seconds!";
        return res.redirect('/');
    }

    try {
        let code = await globalSock.requestPairingCode(phoneNumber.trim());
        latestPairingCode = `Your Code: ${code}`;
    } catch (err) {
        latestPairingCode = "Error generating code. Try again!";
    }
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`🌐 Pairing website is running on port ${PORT}`);
});

// Start WhatsApp Bot
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
            console.log('Connection closed. Reconnecting...', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('✅ FAMOUS BATMAN X OSMANI HACKER³¹³ Bot successfully connected!');
            latestPairingCode = "Bot Connected Successfully! 🎉";
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Menu and Commands Handler
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const sender = m.key.remoteJid;
        const messageType = Object.keys(m.message)[0];
        
        let body = '';
        if (messageType === 'conversation') {
            body = m.message.conversation;
        } else if (messageType === 'extendedTextMessage') {
            body = m.message.extendedTextMessage.text;
        } else if (messageType === 'imageMessage') {
            body = m.message.imageMessage.caption || '';
        }

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
      
