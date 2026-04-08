FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx mono-fastcgi-server4 ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

COPY nginx.default.conf /etc/nginx/sites-available/default
COPY start-web.sh /start-web.sh
RUN ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default \
    && chmod +x /start-web.sh

WORKDIR /app

EXPOSE 80 443

CMD ["/start-web.sh"]
