FROM mongo:6.0

# Copy initialization script into entrypoint directory to auto-seed on startup
COPY init-mongo.js /docker-entrypoint-initdb.d/init-mongo.js

EXPOSE 27017

CMD ["mongod"]
