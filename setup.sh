#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Shopify Insights Platform - Quick Start${NC}\n"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
  exit 1
fi

# Start PostgreSQL
echo -e "${YELLOW}📦 Starting PostgreSQL database...${NC}"
docker-compose up db -d

# Wait for database to be ready
echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
sleep 5

# Run backend setup
echo -e "${YELLOW}🔧 Setting up backend...${NC}"
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
cd ..

# Run frontend setup
echo -e "${YELLOW}🎨 Setting up frontend...${NC}"
cd frontend
npm install
cd ..

echo -e "\n${GREEN}✅ Setup complete!${NC}\n"
echo -e "To start the application:"
echo -e "  1. Start backend: ${YELLOW}cd backend && npm run dev${NC}"
echo -e "  2. Start frontend: ${YELLOW}cd frontend && npm run dev${NC}"
echo -e "\nOr use Docker: ${YELLOW}docker-compose up${NC}"
echo -e "\n${GREEN}Demo credentials: admin@demo.com / password123${NC}"
