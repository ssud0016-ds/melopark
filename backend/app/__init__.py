import os
from flask import Flask
from flask_cors import CORS


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-change-me")

    # Allow the React dev server to call this API
    CORS(app, origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","))

    # Register route blueprints
    from app.routes.sensors import sensors_bp
    from app.routes.bays import bays_bp
    from app.routes.restrictions import restrictions_bp
    from app.routes.health import health_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(sensors_bp, url_prefix="/api/sensors")
    app.register_blueprint(bays_bp, url_prefix="/api/bays")
    app.register_blueprint(restrictions_bp, url_prefix="/api/restrictions")

    return app
