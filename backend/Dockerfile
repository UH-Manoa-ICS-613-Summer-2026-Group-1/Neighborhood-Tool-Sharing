FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
COPY ./qa/requirements-qa.txt ./qa/requirements-qa.txt
RUN pip install --no-cache-dir -r ./qa/requirements-qa.txt
COPY . .
# Set up the entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 5000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000"]