# Frontend Dockerfile - serve static files with nginx
FROM nginx:alpine

# Remove default nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy frontend files
COPY . /usr/share/nginx/html

# נשמור את התבנית בצד
COPY config.template.json /config.template.json

# Expose default nginx port
EXPOSE 80

# בזמן ריצה: נחליף את $API_URL בקובץ אמיתי
CMD sh -c 'envsubst < /config.template.json > /usr/share/nginx/html/config.json && nginx -g "daemon off;"'
