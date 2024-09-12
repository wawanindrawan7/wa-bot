import { Client, LocalAuth } from "whatsapp-web.js";
import express from "express";
import * as qrcode from "qrcode"; // Gunakan qrcode untuk menampilkan di browser
import { MessageMedia } from 'whatsapp-web.js';
import path from 'path';

const app = express();
app.use(express.json());

const client = new Client({
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
  authStrategy: new LocalAuth({
    dataPath: `${__dirname}/../session`,
  }),
});

let clientReady = false;
let qrCodeString = ''; // Untuk menyimpan QR code

// When client is ready
client.once("ready", () => {
  console.log("Client is ready!");
  clientReady = true;
  qrCodeString = ''; // Bersihkan QR code setelah siap
});

// When client receives QR Code
client.on("qr", (qr) => {
  // Simpan QR code ke dalam variabel sebagai base64
  qrcode.toDataURL(qr, (err, url) => {
    if (err) {
      console.error('Failed to generate QR code:', err);
    } else {
      qrCodeString = url; // Simpan string QR Code
    }
  });
});

// Handle client authentication failure
client.on('auth_failure', (msg) => {
  console.error('Authentication failed:', msg);
});

// Handle client disconnection
client.on('disconnected', (reason) => {
  console.error('Client disconnected:', reason);
  clientReady = false;
  client.initialize(); // Reinitialize client after disconnection
});

// Endpoint to show QR code in browser
app.get('/', (req, res) => {
  if (qrCodeString) {
    // Kirim halaman HTML dengan gambar QR code
    res.send(`
      <html>
        <body>
          <h1>Scan the QR Code to authenticate WhatsApp Web</h1>
          <img src="${qrCodeString}" alt="QR Code"/>
        </body>
      </html>
    `);
  } else if (clientReady) {
    res.send('<h1>WhatsApp client is already authenticated and ready!</h1>');
  } else {
    res.send('<h1>Waiting for QR Code...</h1>');
  }
});

// Endpoint to receive request for sending media and message
app.post('/send-media', async (req, res) => {
  if (!clientReady) {
    console.error('Client is not ready');
    return res.status(500).json({ status: 'error', message: 'Client is not ready' });
  }

  const { customer_phone, media_path, message } = req.body;

  console.log('Received media request: ', req.body);

  try {
    const chatId = `${customer_phone}@c.us`;
    const media = MessageMedia.fromFilePath(path.resolve(media_path));

    // First send the media
    await client.sendMessage(chatId, media);

    // Then send the message
    await client.sendMessage(chatId, message);

    console.log('Media and message sent successfully');
    res.json({ status: 'success', message: 'Media and message sent successfully' });
  } catch (error) {
    console.error('Failed to send media and message: ', error);
    res.status(500).json({ status: 'error', message: 'Failed to send media and message' });
  }
});

// Status endpoint for debugging
app.get('/status', (req, res) => {
  res.json({ clientReady });
});

// Initialize client
client.initialize();

// Start express server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
