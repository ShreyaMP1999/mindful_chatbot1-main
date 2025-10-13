from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import openai
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import re
import json
from collections import defaultdict

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Initialize OpenAI client
openai.api_key = os.environ['OPENAI_API_KEY']
client = openai.OpenAI(api_key=os.environ['OPENAI_API_KEY'])

# Initialize sentiment analyzer
sentiment_analyzer = SentimentIntensityAnalyzer()

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="Mental Health Chatbot API")

# Add session middleware
app.add_middleware(SessionMiddleware, secret_key="mental-health-chatbot-secret-key-2024")

# Create API router
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer(auto_error=False)

# Crisis keywords for detection
CRISIS_KEYWORDS = [
    "suicide", "kill myself", "end my life", "want to die", "harm myself", 
    "self harm", "cut myself", "overdose", "not worth living", "better off dead",
    "hopeless", "can't go on", "give up", "end it all", "hurt myself"
]

CRISIS_PHRASES = [
    "i want to die", "i'm going to kill myself", "life isn't worth living",
    "i can't take it anymore", "nobody would miss me", "i'm done with life"
]

# Resource recommendations
MENTAL_HEALTH_RESOURCES = {
    "crisis": [
        {
            "name": "National Suicide Prevention Lifeline",
            "phone": "988",
            "description": "24/7 crisis support and suicide prevention"
        },
        {
            "name": "Crisis Text Line",
            "phone": "Text HOME to 741741",
            "description": "24/7 crisis support via text"
        },
        {
            "name": "International Association for Suicide Prevention",
            "website": "https://www.iasp.info/resources/Crisis_Centres/",
            "description": "Global crisis centers directory"
        }
    ],
    "general": [
        {
            "name": "Mental Health America",
            "website": "https://www.mhanational.org/finding-help",
            "description": "Mental health resources and support"
        },
        {
            "name": "NAMI (National Alliance on Mental Illness)",
            "website": "https://www.nami.org/help",
            "description": "Mental health education and support"
        },
        {
            "name": "Psychology Today Therapist Finder",
            "website": "https://www.psychologytoday.com/us/therapists",
            "description": "Find therapists and mental health professionals"
        }
    ],
    "coping_strategies": [
        {
            "name": "Box Breathing",
            "description": "Breathe in for 4, hold for 4, out for 4, hold for 4. Repeat 4 times.",
            "category": "anxiety"
        },
        {
            "name": "5-4-3-2-1 Grounding",
            "description": "Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste.",
            "category": "anxiety"
        },
        {
            "name": "Progressive Muscle Relaxation",
            "description": "Tense and relax each muscle group from toes to head.",
            "category": "stress"
        },
        {
            "name": "Thought Reframing",
            "description": "Challenge negative thoughts by asking: Is this realistic? What would I tell a friend?",
            "category": "depression"
        }
    ]
}

# Pydantic Models
class UserSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nickname: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_activity: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    settings: Dict[str, Any] = Field(default_factory=dict)

class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    content: str
    is_user: bool
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    sentiment_score: Optional[float] = None
    sentiment_label: Optional[str] = None
    crisis_detected: bool = False

class MoodEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    mood_score: int = Field(..., ge=1, le=5)
    note: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    message: str
    session_id: str
    crisis_detected: bool = False
    sentiment: Optional[Dict[str, Any]] = None
    resources: Optional[List[Dict[str, Any]]] = None

class MoodRequest(BaseModel):
    mood_score: int = Field(..., ge=1, le=5)
    note: Optional[str] = None
    session_id: str

class SessionRequest(BaseModel):
    nickname: Optional[str] = None

# Helper functions
def analyze_sentiment(text: str) -> Dict[str, Any]:
    """Analyze sentiment using VADER"""
    scores = sentiment_analyzer.polarity_scores(text)
    
    # Determine label based on compound score
    compound = scores['compound']
    if compound >= 0.05:
        label = "positive"
    elif compound <= -0.05:
        label = "negative"
    else:
        label = "neutral"
    
    # Additional emotional state detection
    emotional_state = "neutral"
    if compound <= -0.5:
        emotional_state = "very_negative"
    elif compound <= -0.2:
        emotional_state = "negative" 
    elif compound >= 0.5:
        emotional_state = "very_positive"
    elif compound >= 0.2:
        emotional_state = "positive"
    
    return {
        "compound": compound,
        "positive": scores['pos'],
        "negative": scores['neg'], 
        "neutral": scores['neu'],
        "label": label,
        "emotional_state": emotional_state
    }

def detect_crisis(text: str) -> bool:
    """Detect crisis situations using keywords and phrases"""
    text_lower = text.lower()
    
    # Check for direct keywords
    for keyword in CRISIS_KEYWORDS:
        if keyword in text_lower:
            return True
    
    # Check for crisis phrases
    for phrase in CRISIS_PHRASES:
        if phrase in text_lower:
            return True
    
    # Check for patterns using regex
    crisis_patterns = [
        r'\bi\s+want\s+to\s+die\b',
        r'\bkill\s+myself\b',
        r'\bcommit\s+suicide\b',
        r'\bend\s+my\s+life\b'
    ]
    
    for pattern in crisis_patterns:
        if re.search(pattern, text_lower):
            return True
    
    return False

async def generate_ai_response(message: str, session_id: str, crisis_detected: bool = False) -> str:
    """Generate AI response using OpenAI GPT-4o-mini"""
    try:
        # Get recent conversation context
        recent_messages = await db.messages.find(
            {"session_id": session_id}
        ).sort("timestamp", -1).limit(6).to_list(length=None)
        
        # Build conversation context
        context_messages = []
        
        # System prompt with safety guidelines
        system_prompt = """You are a compassionate mental health support chatbot. Your role is to:

1. Provide empathetic, supportive responses
2. Encourage users to seek professional help when appropriate
3. Never provide medical diagnoses or specific medical advice
4. Offer coping strategies and emotional support
5. Be mindful of crisis situations and respond appropriately

IMPORTANT SAFETY RULES:
- Always include disclaimers about not being a replacement for professional help
- For any crisis situations, provide immediate support resources
- Focus on validation, empathy, and gentle guidance
- Use warm, supportive language
- Keep responses concise but meaningful (2-3 sentences typically)

Remember: You are NOT a licensed therapist. You provide peer support and encourage professional help."""

        if crisis_detected:
            system_prompt += "\n\nIMPORTANT: The user may be in crisis. Prioritize immediate safety and provide crisis resources. Be extra supportive and encourage immediate professional help."

        context_messages.append({"role": "system", "content": system_prompt})
        
        # Add recent conversation history (reversed to chronological order)
        for msg in reversed(recent_messages):
            role = "user" if msg["is_user"] else "assistant"
            context_messages.append({"role": role, "content": msg["content"]})
        
        # Add current message
        context_messages.append({"role": "user", "content": message})
        
        # Generate response
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=context_messages,
            max_tokens=200,
            temperature=0.7
        )
        
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        logging.error(f"Error generating AI response: {e}")
        if crisis_detected:
            return "I'm here to listen and support you. Please reach out to a crisis helpline immediately if you're having thoughts of self-harm. You can call 988 (Suicide Prevention Lifeline) or text HOME to 741741. Your life has value and there are people who want to help."
        return "I'm here to support you, though I'm having trouble generating a response right now. Remember that it's always okay to reach out to a mental health professional if you need additional support."

# API Routes
@api_router.post("/session", response_model=UserSession)
async def create_session(request: SessionRequest):
    """Create a new user session"""
    session = UserSession(nickname=request.nickname)
    session_dict = session.dict()
    session_dict['created_at'] = session_dict['created_at'].isoformat()
    session_dict['last_activity'] = session_dict['last_activity'].isoformat()
    
    await db.sessions.insert_one(session_dict)
    return session

@api_router.get("/session/{session_id}", response_model=UserSession)
async def get_session(session_id: str):
    """Get session details"""
    session = await db.sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Convert ISO strings back to datetime
    session['created_at'] = datetime.fromisoformat(session['created_at'])
    session['last_activity'] = datetime.fromisoformat(session['last_activity'])
    
    return UserSession(**session)

@api_router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Handle chat messages"""
    try:
        session_id = request.session_id
        if not session_id:
            # Create new session if none provided
            session = UserSession()
            session_dict = session.dict()
            session_dict['created_at'] = session_dict['created_at'].isoformat()
            session_dict['last_activity'] = session_dict['last_activity'].isoformat()
            await db.sessions.insert_one(session_dict)
            session_id = session.id
        
        # Analyze sentiment and detect crisis
        sentiment = analyze_sentiment(request.message)
        crisis_detected = detect_crisis(request.message)
        
        # Save user message
        user_message = ChatMessage(
            session_id=session_id,
            content=request.message,
            is_user=True,
            sentiment_score=sentiment["compound"],
            sentiment_label=sentiment["label"],
            crisis_detected=crisis_detected
        )
        
        user_msg_dict = user_message.dict()
        user_msg_dict['timestamp'] = user_msg_dict['timestamp'].isoformat()
        await db.messages.insert_one(user_msg_dict)
        
        # Generate AI response
        ai_response = await generate_ai_response(request.message, session_id, crisis_detected)
        
        # Save AI response
        ai_message = ChatMessage(
            session_id=session_id,
            content=ai_response,
            is_user=False
        )
        
        ai_msg_dict = ai_message.dict()
        ai_msg_dict['timestamp'] = ai_msg_dict['timestamp'].isoformat()
        await db.messages.insert_one(ai_msg_dict)
        
        # Update session activity
        await db.sessions.update_one(
            {"id": session_id},
            {"$set": {"last_activity": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Prepare response
        response = ChatResponse(
            message=ai_response,
            session_id=session_id,
            crisis_detected=crisis_detected,
            sentiment=sentiment
        )
        
        # Add resources if crisis detected
        if crisis_detected:
            response.resources = MENTAL_HEALTH_RESOURCES["crisis"]
        
        return response
        
    except Exception as e:
        logging.error(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@api_router.get("/chat/{session_id}/history", response_model=List[ChatMessage])
async def get_chat_history(session_id: str, limit: int = 50):
    """Get chat history for a session"""
    messages = await db.messages.find(
        {"session_id": session_id}
    ).sort("timestamp", -1).limit(limit).to_list(length=None)
    
    # Convert timestamps back
    for msg in messages:
        msg['timestamp'] = datetime.fromisoformat(msg['timestamp'])
    
    return [ChatMessage(**msg) for msg in reversed(messages)]

@api_router.post("/mood", response_model=MoodEntry)
async def log_mood(request: MoodRequest):
    """Log a mood entry"""
    mood_entry = MoodEntry(
        session_id=request.session_id,
        mood_score=request.mood_score,
        note=request.note
    )
    
    mood_dict = mood_entry.dict()
    mood_dict['timestamp'] = mood_dict['timestamp'].isoformat()
    await db.mood_entries.insert_one(mood_dict)
    
    return mood_entry

@api_router.get("/mood/{session_id}/history")
async def get_mood_history(session_id: str, days: int = 7):
    """Get mood history for analysis"""
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    mood_entries = await db.mood_entries.find({
        "session_id": session_id,
        "timestamp": {"$gte": start_date.isoformat()}
    }).sort("timestamp", 1).to_list(length=None)
    
    # Convert timestamps
    for entry in mood_entries:
        entry['timestamp'] = datetime.fromisoformat(entry['timestamp'])
    
    return [MoodEntry(**entry) for entry in mood_entries]

@api_router.get("/sentiment/{session_id}/trends")
async def get_sentiment_trends(session_id: str, days: int = 7):
    """Get sentiment trends analysis"""
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    messages = await db.messages.find({
        "session_id": session_id,
        "is_user": True,
        "sentiment_score": {"$ne": None},
        "timestamp": {"$gte": start_date.isoformat()}
    }).sort("timestamp", 1).to_list(length=None)
    
    if not messages:
        return {"trends": [], "summary": {"avg_sentiment": 0, "total_messages": 0}}
    
    # Group by day
    daily_sentiments = defaultdict(list)
    for msg in messages:
        date_key = datetime.fromisoformat(msg['timestamp']).date().isoformat()
        daily_sentiments[date_key].append(msg['sentiment_score'])
    
    # Calculate daily averages
    trends = []
    for date, scores in daily_sentiments.items():
        avg_score = sum(scores) / len(scores)
        trends.append({
            "date": date,
            "avg_sentiment": avg_score,
            "message_count": len(scores)
        })
    
    # Overall summary
    all_scores = [msg['sentiment_score'] for msg in messages]
    summary = {
        "avg_sentiment": sum(all_scores) / len(all_scores),
        "total_messages": len(messages),
        "days_analyzed": days
    }
    
    return {"trends": trends, "summary": summary}

@api_router.get("/resources")
async def get_resources():
    """Get mental health resources"""
    return MENTAL_HEALTH_RESOURCES

@api_router.delete("/session/{session_id}/data")
async def delete_user_data(session_id: str):
    """Delete all user data for a session"""
    try:
        # Delete messages
        await db.messages.delete_many({"session_id": session_id})
        
        # Delete mood entries
        await db.mood_entries.delete_many({"session_id": session_id})
        
        # Delete session
        await db.sessions.delete_one({"id": session_id})
        
        return {"message": "All user data deleted successfully"}
        
    except Exception as e:
        logging.error(f"Error deleting user data: {e}")
        raise HTTPException(status_code=500, detail="Error deleting user data")

@api_router.get("/")
async def root():
    return {"message": "Mental Health Chatbot API is running"}

# Include router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    mongo_client.close()

# Auto-cleanup old data (30 days)
@app.on_event("startup")
async def startup_cleanup():
    """Clean up old data on startup"""
    try:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=30)
        cutoff_iso = cutoff_date.isoformat()
        
        # Find old sessions
        old_sessions = await db.sessions.find({
            "last_activity": {"$lt": cutoff_iso}
        }).to_list(length=None)
        
        old_session_ids = [session["id"] for session in old_sessions]
        
        if old_session_ids:
            # Delete old messages
            await db.messages.delete_many({"session_id": {"$in": old_session_ids}})
            
            # Delete old mood entries
            await db.mood_entries.delete_many({"session_id": {"$in": old_session_ids}})
            
            # Delete old sessions
            await db.sessions.delete_many({"id": {"$in": old_session_ids}})
            
            logger.info(f"Cleaned up {len(old_session_ids)} old sessions")
        
    except Exception as e:
        logger.error(f"Error during startup cleanup: {e}")