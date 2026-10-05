FROM postgres:18-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends awscli age curl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY deploy/backup/backup.sh /opt/backup/backup.sh
USER postgres
ENTRYPOINT ["timeout", "--signal=TERM", "--kill-after=30s", "45m", "bash", "/opt/backup/backup.sh"]
