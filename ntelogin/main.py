from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI

from .settings import settings
from .utils.logger import logger, setup_logging


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None]:
    logger.success(f"nte-login 启动，监听 http://{settings.host}:{settings.port}")
    if not settings.shared_secret:
        logger.warning("SHARED_SECRET 未设置，跨服务调用不会校验签名")
    yield


def create_app() -> FastAPI:
    setup_logging(settings.log_level)
    app = FastAPI(title="nte-login", version="0.1.0", lifespan=lifespan)

    from .routers import router

    app.include_router(router)
    return app


app = create_app()


def main() -> None:
    uvicorn.run(app, host=settings.host, port=settings.port, log_level=settings.log_level.lower())


if __name__ == "__main__":
    main()
