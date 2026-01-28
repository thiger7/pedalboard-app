from mangum import Mangum

from main import app

# Lambda handler using Mangum to wrap FastAPI
handler = Mangum(app, lifespan="off")
