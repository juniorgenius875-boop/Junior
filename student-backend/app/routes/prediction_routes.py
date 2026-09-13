from fastapi import APIRouter, Depends, HTTPException
from ..auth import get_current_user
from ..schemas import StudentInput
from ..services.ml_service import ml_service

router = APIRouter(prefix='/api/predictions', tags=['predictions'])


@router.post('/predict')
async def predict(payload: StudentInput, _current_user=Depends(get_current_user)):
    if not ml_service.ready:
        raise HTTPException(status_code=503, detail='ML artifacts are not loaded')
    return ml_service.predict(payload.model_dump(by_alias=True))


@router.post('/recommend')
async def recommend(payload: StudentInput, _current_user=Depends(get_current_user)):
    if not ml_service.ready:
        raise HTTPException(status_code=503, detail='ML artifacts are not loaded')
    return ml_service.recommend(payload.model_dump(by_alias=True))
