const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server);

  // WhatsApp Client Setup
  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  let qrCodeData = null;
  let connectionStatus = 'DISCONNECTED';

  client.on('qr', (qr) => {
    qrCodeData = qr;
    connectionStatus = 'QR_READY';
    io.emit('whatsapp-status', { status: connectionStatus, qr: qrCodeData });
  });

  client.on('ready', () => {
    qrCodeData = null;
    connectionStatus = 'CONNECTED';
    io.emit('whatsapp-status', { status: connectionStatus });
    console.log('WhatsApp Client is ready!');
  });

  client.on('disconnected', (reason) => {
    qrCodeData = null;
    connectionStatus = 'DISCONNECTED';
    io.emit('whatsapp-status', { status: connectionStatus });
    console.log('WhatsApp Client was disconnected', reason);
    // Restart client
    client.initialize();
  });

  client.initialize();

  // Socket.io Setup
  io.on('connection', (socket) => {
    console.log('Client connected to Socket.io');
    
    // Send initial status
    socket.emit('whatsapp-status', { status: connectionStatus, qr: qrCodeData });

    socket.on('disconnect', () => {
      console.log('Client disconnected from Socket.io');
    });

    socket.on('logout-whatsapp', async () => {
      try {
        await client.logout();
        connectionStatus = 'DISCONNECTED';
        io.emit('whatsapp-status', { status: connectionStatus });
      } catch (error) {
        console.error('Error logging out:', error);
      }
    });

    // Handle Reminder Queue
    socket.on('start-reminders', async (data) => {
      const { participants, messageTemplate } = data;
      
      if (connectionStatus !== 'CONNECTED') {
        socket.emit('reminder-error', 'WhatsApp is not connected!');
        return;
      }

      socket.emit('reminder-progress', { status: 'STARTED', total: participants.length, sent: 0 });

      let sentCount = 0;
      for (const participant of participants) {
        // Format phone number (assuming India +91 if not specified)
        let phone = participant.phone.replace(/\D/g, '');
        if (phone.startsWith('0') && phone.length === 11) {
          phone = phone.substring(1);
        }
        if (phone.length === 10) {
          phone = `91${phone}`; // Add country code
        }
        
        const personalizedMsg = messageTemplate
          .replace('[Name]', participant.name || 'Participant')
          .replace('[Designation]', participant.designation || 'Member');

        try {
          // Verify if the number is registered on WhatsApp
          console.log(`Checking WhatsApp registration for phone: ${phone}`);
          const numberIdObj = await client.getNumberId(phone);
          console.log(`Result from getNumberId:`, numberIdObj);

          if (!numberIdObj) {
            console.error(`Number not registered on WhatsApp: ${phone}`);
            socket.emit('reminder-error', `Skipped ${participant.name} - Number not on WhatsApp`);
            continue; // Skip sending, no delay needed
          }
          
          const numberId = numberIdObj._serialized;
          console.log(`Attempting to send message to: ${numberId}`);
          const msgResponse = await client.sendMessage(numberId, personalizedMsg);
          console.log(`Message send response:`, msgResponse?.id?._serialized);
          
          sentCount++;
          socket.emit('reminder-progress', { status: 'SENDING', total: participants.length, sent: sentCount, current: participant.name });
          
          // Add a delay between 15 and 30 seconds
          if (sentCount < participants.length) {
            const delay = Math.floor(Math.random() * (30000 - 15000 + 1) + 15000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (error) {
          console.error(`Failed to send to ${phone}:`, error);
          socket.emit('reminder-error', `Failed to send to ${participant.name}`);
        }
      }

      socket.emit('reminder-progress', { status: 'COMPLETED', total: participants.length, sent: sentCount });
    });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});
