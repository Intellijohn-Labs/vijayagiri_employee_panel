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

## 2. PostgreSQL Database Setup

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

Create the database and user:

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE vijayagiri_db;
CREATE USER yamaha_admin WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE vijayagiri_db TO yamaha_admin;
\c vijayagiri_db
GRANT ALL ON SCHEMA public TO yamaha_admin;
\q
```

Create `.env.production` in the project root (after cloning in step 3) from the template:

```bash
cp .env.example .env.production
nano .env.production
```

Replace `YOUR_SECURE_PASSWORD` with the database password above, and `YOUR_32_CHAR_SECRET_KEY` with a generated secret (`openssl rand -base64 32`). The app runs on **port 3006**.

If the app uses an ORM, run migrations after `npm install` (before `npm run build`):

```bash
npx prisma migrate deploy   # Prisma
npm run db:push             # Drizzle
```

> This project does not currently include Prisma or Drizzle, so skip the migration step until one is added.

## 3. App Setup

```bash
git clone https://github.com/Intellijohn-Labs/vijayagiri_employee_panel.git
cd vijayagiri_employee_panel

npm install
npm run build

PORT=3006 HOSTNAME=0.0.0.0 pm2 start npm --name "yamaha-portal" -- start
```

Auto-restart on reboot (run the command `pm2 startup` prints, then save):

```bash
pm2 startup
pm2 save
```

## 4. Nginx & Domain

Point the DNS A record for `portal.vijayagiriyamaha.com` (or your own domain, if different) to the VPS IP first.

```bash
sudo nano /etc/nginx/sites-available/yamaha-portal
```

```nginx
server {
    listen 80;
    server_name portal.vijayagiriyamaha.com;

    location / {
        proxy_pass http://localhost:3006;
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
sudo certbot --nginx -d portal.vijayagiriyamaha.com
```

## 5. Update the App

```bash
cd ~/vijayagiri_employee_panel
git pull origin main && npm install && npm run build && pm2 restart yamaha-portal
```
