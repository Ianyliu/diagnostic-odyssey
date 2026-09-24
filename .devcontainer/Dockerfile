FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:1-22-bookworm

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libcurl4-openssl-dev \
        libfontconfig1-dev \
        libssl-dev \
        libxml2-dev \
        r-base \
        r-base-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspaces/diagnostic-odyssey