# Frontend Dockerfile - serve static files with nginx
FROM nginx:alpine

# Remove default nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy frontend files
COPY . /usr/share/nginx/html

# Expose default nginx port
EXPOSE 80

# Use the default nginx command
CMD ["nginx", "-g", "daemon off;"]
