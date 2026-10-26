# Deployment (Ubuntu VPS + Nginx + PM2)

## 1. Server Setup

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git nginx curl

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2
sudo npm install -g pm2
```

## 2. App Setup

```bash
git clone https://github.com/Intellijohn-Labs/vijayagiri_employee_panel.git
cd vijayagiri_employee_panel

npm install
npm run build

pm2 start npm --name "yamaha-portal" -- start
```

Auto-restart on reboot (run the command `pm2 startup` prints, then save):

```bash
pm2 startup
pm2 save
```

## 3. Nginx & Domain

Replace `your-domain.com` with your domain (point its DNS A record to the VPS IP first).

```bash
sudo nano /etc/nginx/sites-available/yamaha-portal
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/yamaha-portal /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Free SSL (Let's Encrypt):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 4. Update the App

```bash
cd ~/vijayagiri_employee_panel
git pull origin main && npm install && npm run build && pm2 restart yamaha-portal
```
