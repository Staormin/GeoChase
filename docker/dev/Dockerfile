# ---- Dependencies ----
FROM node:25-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

# ---- Development ----
FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["npx", "vite", "--host", "0.0.0.0"]

# ---- Build ----
FROM deps AS build
COPY . .
RUN npx vite build --base /
