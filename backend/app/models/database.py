import os
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker

from app.config import settings

os.makedirs("data", exist_ok=True)
engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


class Photo(Base):
    __tablename__ = "photos"

    id = Column(String, primary_key=True)
    session_id = Column(String, index=True)
    original_path = Column(String, nullable=False)
    resized_path = Column(String, nullable=False)
    status = Column(String, default="processing")  # processing, ready, failed
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    tryon_jobs = relationship("TryOnJob", back_populates="photo")
    outfits = relationship("Outfit", back_populates="photo")


class Garment(Base):
    __tablename__ = "garments"

    id = Column(String, primary_key=True)
    session_id = Column(String, index=True, default="default")
    name = Column(String, nullable=False)
    brand = Column(String, default="")
    category = Column(String, nullable=False)  # upper_body, lower_body, dresses, shoes, accessories
    # When category == "accessories": sunglasses|hat|watch|belt|tie|scarf|other.
    accessory_type = Column(String, default="")
    source = Column(String, default="manual")  # scraper, search, manual
    original_url = Column(String, default="")
    processed_path = Column(String, default="")
    metadata_json = Column(Text, default="{}")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    tryon_jobs = relationship("TryOnJob", back_populates="garment")


class TryOnJob(Base):
    __tablename__ = "tryon_jobs"

    id = Column(String, primary_key=True)
    photo_id = Column(String, ForeignKey("photos.id"), nullable=False)
    garment_id = Column(String, ForeignKey("garments.id"), nullable=False)
    status = Column(String, default="queued")  # queued, processing, complete, failed
    result_path = Column(String, default="")
    error = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

    photo = relationship("Photo", back_populates="tryon_jobs")
    garment = relationship("Garment", back_populates="tryon_jobs")


class Outfit(Base):
    __tablename__ = "outfits"

    id = Column(String, primary_key=True)
    session_id = Column(String, index=True, default="default")
    share_id = Column(String, unique=True, index=True)
    photo_id = Column(String, ForeignKey("photos.id"), nullable=False)
    name = Column(String, default="")
    is_saved = Column(Integer, default=0)  # 0/1 flag; 1 = appears in /lookbook
    status = Column(String, default="queued")  # queued, processing, complete, failed
    result_path = Column(String, default="")
    error = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

    photo = relationship("Photo", back_populates="outfits")
    items = relationship("OutfitGarment", back_populates="outfit", order_by="OutfitGarment.order")


class OutfitGarment(Base):
    __tablename__ = "outfit_garments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    outfit_id = Column(String, ForeignKey("outfits.id"), nullable=False)
    garment_id = Column(String, ForeignKey("garments.id"), nullable=False)
    order = Column(Integer, default=0)
    # Redundant with Garment.accessory_type but lets us freeze the accessory
    # sub-type at the moment the outfit was saved.
    accessory_type = Column(String, default="")

    outfit = relationship("Outfit", back_populates="items")
    garment = relationship("Garment")


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
