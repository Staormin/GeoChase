# ---- Dependencies ----
FROM node:26.8.2-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --global npm@12.0.2 && HUSKY=0 npm ci

# ---- Development ----
FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["npx", "vite", "--host", "0.0.0.0"]

# ---- Build ----
FROM deps AS build
COPY . .
RUN npx vite build --base /
