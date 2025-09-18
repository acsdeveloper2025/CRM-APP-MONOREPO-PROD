#!/bin/bash

# CRM Services Restart Script
# Restarts all CRM services with new configuration

set -e

echo "🔄 Restarting CRM Services with Static IP Configuration..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Stop existing services
print_status "Stopping existing services..."

# Stop backend
BACKEND_PID=$(pgrep -f "node.*dist/index.js" || echo "")
if [ ! -z "$BACKEND_PID" ]; then
    print_status "Stopping backend service (PID: $BACKEND_PID)"
    kill $BACKEND_PID
    sleep 2
fi

# Stop frontend
FRONTEND_PID=$(pgrep -f "vite.*CRM-FRONTEND" || echo "")
if [ ! -z "$FRONTEND_PID" ]; then
    print_status "Stopping frontend service (PID: $FRONTEND_PID)"
    kill $FRONTEND_PID
    sleep 2
fi

# Start backend service
print_status "Starting backend service..."
cd CRM-BACKEND
npm run build > /dev/null 2>&1
nohup npm start > ../backend.log 2>&1 &
BACKEND_NEW_PID=$!
print_status "Backend started (PID: $BACKEND_NEW_PID)"

# Wait for backend to be ready
print_status "Waiting for backend to be ready..."
sleep 5

# Test backend
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/health" | grep -q "200"; then
    print_status "✅ Backend is ready and responding"
else
    print_error "❌ Backend is not responding"
fi

# Start frontend service
print_status "Starting frontend service..."
cd ../CRM-FRONTEND
nohup npm run dev > ../frontend.log 2>&1 &
FRONTEND_NEW_PID=$!
print_status "Frontend started (PID: $FRONTEND_NEW_PID)"

# Wait for frontend to be ready
print_status "Waiting for frontend to be ready..."
sleep 5

# Test frontend
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:5173" | grep -q "200"; then
    print_status "✅ Frontend is ready and responding"
else
    print_error "❌ Frontend is not responding"
fi

cd ..

print_status "🎉 All services restarted successfully!"
print_status "📊 Service Status:"
echo "   Backend PID:  $BACKEND_NEW_PID (logs: backend.log)"
echo "   Frontend PID: $FRONTEND_NEW_PID (logs: frontend.log)"
echo ""
print_status "🌐 Access URLs:"
echo "   Internet:  http://PUBLIC_STATIC_IP:5173"
echo "   Local:     http://localhost:5173"
echo ""
print_status "📝 To monitor logs:"
echo "   Backend:  tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
