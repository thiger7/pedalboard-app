## Base stage with dependencies
FROM python:3.14-slim AS base

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY lib/ ./lib/
COPY api/ ./api/
COPY worker/ ./worker/
COPY main.py .
COPY lambda_function.py .

## Development stage
FROM base AS development

RUN apt-get update && apt-get install -y \
    libsndfile1 \
    libatomic1 \
    && rm -rf /var/lib/apt/lists/*

COPY api/ ./api/
COPY main.py .

RUN mkdir -p /app/audio/input /app/audio/output

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

## Lambda stage
FROM public.ecr.aws/lambda/python:3.14 AS lambda

# Install required system libraries for Pedalboard
RUN dnf install -y libatomic libsndfile && dnf clean all

COPY --from=base /usr/local/lib/python3.14/site-packages /var/lang/lib/python3.14/site-packages
COPY --from=base /app/lib ${LAMBDA_TASK_ROOT}/lib
COPY --from=base /app/api ${LAMBDA_TASK_ROOT}/api
COPY --from=base /app/worker ${LAMBDA_TASK_ROOT}/worker
COPY --from=base /app/main.py ${LAMBDA_TASK_ROOT}/
COPY --from=base /app/lambda_function.py ${LAMBDA_TASK_ROOT}/

CMD ["lambda_function.handler"]
