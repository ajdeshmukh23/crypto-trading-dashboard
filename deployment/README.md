# Deployment Configuration

Docker and deployment configurations for the Crypto Trading Platform.

## 📦 Files

### docker-compose.yml
Development environment with hot reload and debugging features.

### docker-compose.prod.yml
Production-optimized configuration with:
- Multi-stage builds
- Nginx reverse proxy
- Optimized images
- Security hardening

### Dockerfile.frontend
Frontend container configuration for development.

### Dockerfile.frontend.prod
Production frontend with:
- Multi-stage build
- Nginx serving
- Optimized bundle

## 🚀 Quick Start

### Development
```bash
docker-compose up -d
```

### Production
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 🔧 Services

### PostgreSQL Database
- Image: postgres:15-alpine
- Port: 5432
- Persistent volume for data
- Health checks enabled

### Backend API
- Node.js application
- Port: 3001
- Auto-restart on file changes
- Connected to PostgreSQL

### Frontend
- React application
- Port: 3000
- Hot reload enabled
- Connected to backend API

## 📊 Monitoring

View logs:
```bash
docker-compose logs -f [service-name]
```

Check status:
```bash
docker-compose ps
```

## 🔄 Common Commands

```bash
# Rebuild images
docker-compose build

# Restart services
docker-compose restart

# Stop and remove
docker-compose down

# Remove with volumes
docker-compose down -v

# Scale service
docker-compose up -d --scale backend=3
```

## 🌐 Network

All services communicate on the `crypto-network` bridge network.

## 💾 Volumes

- `postgres_data`: Database persistence
- `node_modules`: Dependency caching

## 🔐 Security Notes

For production:
1. Change default passwords
2. Use environment files
3. Enable SSL/TLS
4. Implement rate limiting
5. Add authentication

## 🚨 Troubleshooting

### Database Connection Issues
```bash
docker-compose logs postgres
docker exec -it crypto-db psql -U crypto_user -d crypto_dashboard
```

### Frontend Not Loading
Check API URL configuration and CORS settings.

### Performance Issues
Monitor with:
```bash
docker stats
```