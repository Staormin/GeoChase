FROM node:26.8.2-bookworm
WORKDIR /app
RUN npm install --global npm@12.0.2
COPY package.json package-lock.json ./
RUN HUSKY=0 npm ci && npx playwright install --with-deps chromium
COPY . .
