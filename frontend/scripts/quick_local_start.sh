#!/usr/bin/env bash
set -euo pipefail

parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
# change to the frontend directory
cd "${parent_path}/.."

echo "installing required npm packages for the frontend"
# install required npm packages
npm install

echo "running npm frontend server"
# run NPM server
npm run dev
4