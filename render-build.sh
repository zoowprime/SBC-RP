#!/usr/bin/env bash
set -e

# 1) Mets à jour l’index des paquets
apt-get update

# 2) Installe les libs nécessaires à node-canvas
apt-get install -y --no-install-recommends \
  libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

# 3) Installe tes dépendances NPM depuis package-lock.json
npm ci
