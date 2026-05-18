from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Report
from ..schemas import ReportCreate, ReportResponse
from ..auth import get_current_user

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def create_report(
    data: ReportCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.target_type not in ("comment", "chat_message"):
        raise HTTPException(status_code=400, detail="Invalid target type")
    existing = db.query(Report).filter(
        Report.reporter_id == user.id,
        Report.target_type == data.target_type,
        Report.target_id == data.target_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already reported")
    report = Report(
        reporter_id=user.id,
        target_type=data.target_type,
        target_id=data.target_id,
        reason=data.reason,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report
