# 💻 Production Virtual Machine (VM) & Deployment (`/vm`)

This directory documents the production infrastructure, server setup, PM2 process management, and SSH deployment commands for **FindMyDonor™**.

---

## 🖥️ Server Specifications

| Attribute | Details |
|---|---|
| **Host Domain** | [findmydonor.online](https://findmydonor.online) |
| **VM IP Address** | `145.241.154.187` |
| **OS** | Ubuntu 22.04 LTS (Oracle Cloud Infrastructure) |
| **User** | `ubuntu` |
| **SSH Key Path** | `.ssh-key/ssh-key-2026-07-11.key` |
| **App Directory** | `/home/ubuntu/findmydonor` |

---

## ⚙️ PM2 Process Architecture (`ecosystem.config.cjs`)

The production VM runs 2 isolated PM2 Node.js processes:

```javascript
module.exports = {
  apps: [
    {
      name: "findmydonor-backend",
      script: "./dist/server.cjs",
      env: { NODE_ENV: "production", PORT: 5000 }
    },
    {
      name: "findmydonor-admin",
      script: "./dist/admin-server.cjs",
      env: { NODE_ENV: "production", PORT: 5001 }
    }
  ]
};
```

---

## 🛠️ Operational Commands (SSH)

### 1. SSH Into Server
```bash
ssh -i .ssh-key/ssh-key-2026-07-11.key ubuntu@145.241.154.187
```

### 2. Deploy Code & Reload PM2
```bash
# Upload updated code via SCP
scp -i .ssh-key/ssh-key-2026-07-11.key server.ts ubuntu@145.241.154.187:/home/ubuntu/findmydonor/

# Rebuild and reload PM2 on VM
ssh -i .ssh-key/ssh-key-2026-07-11.key ubuntu@145.241.154.187 "cd /home/ubuntu/findmydonor && npm run build && pm2 reload ecosystem.config.cjs --update-env"
```

### 3. Check Live Logs
```bash
# View backend error logs
ssh -i .ssh-key/ssh-key-2026-07-11.key ubuntu@145.241.154.187 "pm2 logs findmydonor-backend --err --lines 100 --nostream"
```
