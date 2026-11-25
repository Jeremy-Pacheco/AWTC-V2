/**
 * Server entry point (`node index.js`): loads the Express app from app.js and
 * starts the HTTP/HTTPS servers and Socket.IO.
 */
const path = require("path");
const app = require("./app");
const db = require("./models");

// The schema is managed only by migrations (`pnpm migrate`); sync() is not
// used because it could create tables that differ from them (BUG-02).
db.sequelize
  .authenticate()
  .then(() => console.log("Database connection OK"))
  .catch((err) => console.error("DB Error:", err.message));

const PORT = process.env.PORT || 8080;
const HTTPS_PORT = process.env.HTTPS_PORT || 8443;
const USE_HTTPS = process.env.USE_HTTPS === 'true';
// Behind nginx set HOST=127.0.0.1 so ports 8080/8443 are not reachable from
// outside (SEC-23); hosts like Render need the default 0.0.0.0.
const HOST = process.env.HOST || '0.0.0.0';

// Create HTTP or HTTPS server
const http = require('http');
const https = require('https');
const fs = require('fs');

let server;

if (USE_HTTPS) {
  // Try to load SSL certificates
  const sslKeyPath = path.join(__dirname, 'ssl', 'key.pem');
  const sslCertPath = path.join(__dirname, 'ssl', 'cert.pem');
  
  if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
    const httpsOptions = {
      key: fs.readFileSync(sslKeyPath),
      cert: fs.readFileSync(sslCertPath)
    };
    
    // Create HTTPS server
    const httpsServer = https.createServer(httpsOptions, app);
    
    // Create HTTP server (without redirect, serve the app directly)
    const httpServer = http.createServer(app);
    
    // Initialize Socket.IO on HTTPS server (primary)
    const { initializeSocketIO } = require('./config/socket');
    initializeSocketIO(httpsServer);
    
    // Start both servers
    httpServer.listen(PORT, HOST, () => {
      console.log(`🌐 HTTP server running on http://localhost:${PORT}`);
    });
    
    httpsServer.listen(HTTPS_PORT, HOST, () => {
      console.log(`🔐 HTTPS server running on https://localhost:${HTTPS_PORT}`);
      console.log(`📚 Swagger docs available at https://localhost:${HTTPS_PORT}/api-docs`);
      console.log(`💬 WebSocket server initialized for messaging`);
    });
    
    console.log('✅ Dual mode: Both HTTP and HTTPS servers running');
    console.log('   - HTTP (for push notifications): http://localhost:8080');
    console.log('   - HTTPS (for secure features): https://localhost:8443');
    
  } else {
    console.warn('⚠️  SSL certificates not found. Run: node scripts/generate-ssl-cert.js');
    console.warn('   Falling back to HTTP mode...');
    
    server = http.createServer(app);
    
    // Initialize Socket.IO
    const { initializeSocketIO } = require('./config/socket');
    initializeSocketIO(server);
    
    server.listen(PORT, HOST, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
      console.log(`WebSocket server initialized for messaging`);
    });
  }
} else {
  server = http.createServer(app);
  
  // Initialize Socket.IO
  const { initializeSocketIO } = require('./config/socket');
  initializeSocketIO(server);
  
  server.listen(PORT, HOST, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
    console.log(`WebSocket server initialized for messaging`);
  });
}