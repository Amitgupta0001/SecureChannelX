# ✅ Windows Compatibility - PowerShell Scripts

All bash scripts now have PowerShell equivalents for Windows users!

---

## 📋 Available PowerShell Scripts

### 1. **deploy.ps1** - Main Deployment Script
Complete deployment automation with all features.

**Usage:**
```powershell
.\deploy.ps1 start      # Start all services
.\deploy.ps1 stop       # Stop all services  
.\deploy.ps1 restart    # Restart all services
.\deploy.ps1 update     # Update and restart
.\deploy.ps1 backup     # Backup database
.\deploy.ps1 logs       # View logs
.\deploy.ps1 health     # Run health checks
.\deploy.ps1 help       # Show help
```

### 2. **setup-env.ps1** - Interactive Environment Setup ✨ NEW
Guided environment configuration with secure password input.

**Usage:**
```powershell
.\setup-env.ps1
```

**Features:**
- Auto-generates secrets
- Interactive password input (masked)
- Configures database credentials
- Optional email setup
- Production/development mode selection

### 3. **backup-db.ps1** - Database Backup
Automated MongoDB backup with retention.

**Usage:**
```powershell
.\backup-db.ps1
```

**Features:**
- Creates compressed backups
- Keeps last 7 days
- Optional S3 upload
- Shows backup size

### 4. **restore-db.ps1** - Database Restore
Restore from backup file.

**Usage:**
```powershell
.\restore-db.ps1 backups\securechannelx_backup_20241203_112814.gz
```

**Lists available backups if no file specified**

---

## 🚀 Quick Start for Windows

### First-Time Setup

```powershell
# 1. Setup environment (interactive)
.\setup-env.ps1

# 2. Review configuration
notepad .env

# 3. Start all services
.\deploy.ps1 start

# 4. Check health
.\deploy.ps1 health
```

### Access Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/api/health

---

## 🔧 Script Features

### ✅ All Scripts Include:
- **Error Handling**: Proper error messages
- **Color Output**: Easy-to-read colored messages
- **Logging**: Actions logged to deployment.log
- **Validation**: Pre-flight checks before operations
- **Safety**: Confirmation prompts for destructive actions

### 🎨 Color Coding:
- 🟢 **Green**: Success messages
- 🔴 **Red**: Error messages
- 🟡 **Yellow**: Warning messages
- 🔵 **Cyan**: Information messages

---

## 📝 Notes for Windows Users

### Execution Policy

If you get an execution policy error, run:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Docker Desktop Required

Make sure Docker Desktop is:
- ✅ Installed
- ✅ Running
- ✅ WSL2 enabled (recommended)

### Git Bash Alternative

If you prefer using Git Bash, the original `.sh` scripts work with:
- Git Bash
- WSL (Windows Subsystem for Linux)
- Cygwin

---

## 🆚 Bash vs PowerShell

### Use PowerShell (.ps1) if:
- ✅ You're on Windows
- ✅ You prefer native Windows tools
- ✅ You want interactive setup

### Use Bash (.sh) if:
- ✅ You're on Linux/macOS
- ✅ You use Git Bash/WSL
- ✅ You're deploying to Linux servers

**Both script sets have identical functionality!**

---

## 📊 Script Comparison

| Feature | Bash | PowerShell |
|---------|------|------------|
| Deployment | deploy.sh | deploy.ps1 |
| Environment Setup | - | **setup-env.ps1** ✨ |
| Backup | backup-db.sh | backup-db.ps1 |
| Restore | restore-db.sh | restore-db.ps1 |
| SSL Setup | setup-ssl.sh | (Use Let's Encrypt directly) |

---

## 🎯 Recommended Workflow

### Development on Windows

1. **Initial Setup**: Run `.\setup-env.ps1`
2. **Start Development**: Run `.\deploy.ps1 start`
3. **View Logs**: Run `.\deploy.ps1 logs`
4. **Create Backups**: Run `.\backup-db.ps1`
5. **Monitor Health**: Run `.\deploy.ps1 health`

### Production Deployment

1. **Configure Environment**: Edit `.env` manually or use `setup-env.ps1`
2. **Deploy**: `.\deploy.ps1 start`
3. **Verify**: `.\deploy.ps1 health`
4. **Schedule Backups**: Use Windows Task Scheduler with `backup-db.ps1`

---

## ⚙️ Automated Backups (Windows Task Scheduler)

### Create Scheduled Backup

1. Open **Task Scheduler**
2. Create Basic Task
3. **Trigger**: Daily at 2:00 AM
4. **Action**: Start a program
5. **Program**: `powershell.exe`
6. **Arguments**: `-File "C:\path\to\SecureChannelX\backup-db.ps1"`
7. **Start in**: `C:\path\to\SecureChannelX`

---

## 🐛 Troubleshooting

### "Cannot run scripts"
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### "Docker not found"
- Install Docker Desktop
- Restart PowerShell

### "Permission denied"
- Run PowerShell as Administrator
- Or adjust execution policy

### ".env file not found"
Run `.\setup-env.ps1` to create it

---

## 📚 Additional Resources

- **Quick Start**: `docs\QUICKSTART.md`
- **Full Deployment**: `docs\PRODUCTION_DEPLOYMENT.md`
- **Checklist**: `docs\PRODUCTION_CHECKLIST.md`

---

**🎉 Windows users now have full native PowerShell support!**

All operations can be performed natively on Windows without needing WSL or Git Bash.
