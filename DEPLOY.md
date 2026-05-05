[Unit]
Description=WORK Protocol v4 API Server
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/work-protocol-v4
Environment=DATABASE_URL=postgresql://work:<password>@localhost:5432/work_protocol_v4
Environment=PORT=3100
Environment=WORK_PROTOCOL_FEE_BPS=300
ExecStart=/usr/bin/node apps/api/src/server.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
