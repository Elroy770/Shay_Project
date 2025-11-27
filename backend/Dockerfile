# Backend Dockerfile - Node 20 LTS
# Uses multi-stage build to keep final image small

FROM node:20-alpine AS builder
WORKDIR /usr/src/app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --production

# Copy source
COPY . ./

# Final image
FROM node:20-alpine
WORKDIR /usr/src/app

# Copy only production node_modules and app source
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app .

# Ensure .env (if provided) is used; do NOT bake secrets into the image
ENV NODE_ENV=production

EXPOSE 3000

# Run the app via a small startup script that waits for the DB to be ready
CMD ["node", "--experimental-specifier-resolution=node", "start.mjs"]
