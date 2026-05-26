FROM node:20-alpine

# Set node environment
ENV NODE_ENV=production

WORKDIR /app

# Create a non-root group and user with safe UID/GID
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy package descriptors
COPY package*.json ./

# Install only production dependencies cleanly
RUN npm ci --omit=dev

# Copy source code, setting ownership to our non-root user
COPY --chown=appuser:appgroup . .

# Switch to non-root execution
USER appuser

EXPOSE 3000

CMD ["node", "server.js"]
