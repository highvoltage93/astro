ARG POSTGRES_MAJOR=18
FROM postgres:${POSTGRES_MAJOR}-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends awscli age curl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY deploy/backup/backup.sh /opt/backup/backup.sh
COPY deploy/backup/database-ssl.py /opt/backup/database-ssl.py
USER postgres
ENTRYPOINT ["timeout", "--signal=TERM", "--kill-after=30s", "45m", "bash", "/opt/backup/backup.sh"]
