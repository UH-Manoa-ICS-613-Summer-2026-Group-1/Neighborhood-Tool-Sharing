"""Run this file to generate a new secret key"""
import secrets

print(secrets.token_urlsafe(32))
