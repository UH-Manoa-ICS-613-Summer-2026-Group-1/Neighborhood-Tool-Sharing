FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
COPY ./qa/requirements-qa.txt ./qa/requirements-qa.txt
RUN pip install --no-cache-dir -r ./qa/requirements-qa.txt
COPY . .
EXPOSE 5000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000", "--reload"]