from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ProfileData(BaseModel):
    name: str = ''
    grade: str = ''
    school: str = ''
    favorite_subject: str = ''
    dream_job: str = ''
    hobbies: str = ''


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = ''


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = 'bearer'


class StudentInput(BaseModel):
    math_score: Optional[float] = Field(None, alias='math score')
    reading_score: Optional[float] = Field(None, alias='reading score')
    writing_score: Optional[float] = Field(None, alias='writing score')
    internal_test_1: Optional[float] = Field(None, alias='Internal Test 1 (out of 40)')
    internal_test_2: Optional[float] = Field(None, alias='Internal Test 2 (out of 40)')
    assignment_score: Optional[float] = Field(None, alias='Assignment Score (out of 10)')
    attendance: Optional[float] = Field(None, alias='Attendance (%)')
    study_hours: Optional[float] = Field(None, alias='Daily Study Hours')
    model_config = ConfigDict(populate_by_name=True, extra='allow')


class ProgressCreate(BaseModel):
    math_score: Optional[float] = None
    reading_score: Optional[float] = None
    writing_score: Optional[float] = None
    internal_test_1: Optional[float] = None
    internal_test_2: Optional[float] = None
    assignment_score: Optional[float] = None
    attendance: Optional[float] = None
    study_hours: Optional[float] = None
    risk_level: str
    pass_probability: float
    fail_probability: Optional[float] = None
    total_predicted_marks: float


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class TestRequest(BaseModel):
    difficulty: str
    test_type: str
    learning_context: str = ''


class TestResultCreate(BaseModel):
    test_type: str
    difficulty: str
    score: int
    total_marks: int
    wrong_answers: List[str] = []


class TestAnalysisRequest(BaseModel):
    score: int
    total_marks: int
    wrong_answers: List[str] = []


class QuizSubmission(BaseModel):
    question: str
    student_answer: str


class ActivityTrackRequest(BaseModel):
    action: str = Field(min_length=1, max_length=50)
    page: Optional[str] = Field(None, max_length=120)
    metadata: dict = Field(default_factory=dict)
