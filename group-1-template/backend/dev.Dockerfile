# This Dockerfile is for local development puproses and gets called in the docker-compose.yml

FROM python:3.12.7-slim-bookworm
#From python images : py version number - slim variant - debian/linux distro base

# Faster/cleaner Python logs + no .pyc
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Set workdir to /usr/src, the code is mapped in app, but we might have other things we want like cache
WORKDIR /usr/src

# Install deps separately so this layer is cached
COPY requirements.txt /tmp/requirements.txt
RUN pip install --upgrade pip && pip install -r /tmp/requirements.txt

# make /app importable without PYTHONPATH hacks
ENV PYTHONPATH=/app

# set up the entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# run it!  (/usr/local/bin is part of the default $PATH on (most) Linux, so we can call it without explicit paths)
ENTRYPOINT ["entrypoint.sh"]

