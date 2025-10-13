import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { 
  Send, 
  MessageCircle, 
  Heart, 
  Shield, 
  TrendingUp, 
  BookOpen, 
  Phone, 
  AlertTriangle,
  Settings,
  Trash2,
  User,
  Smile,
  Frown,
  Meh,
  ChevronDown,
  X,
  BarChart3,
  Calendar,
  Wind,
  Focus,
  Activity
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from './components/ui/avatar';
import { Separator } from './components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './components/ui/dialog';
import { Alert, AlertDescription } from './components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Slider } from './components/ui/slider';
import { Textarea } from './components/ui/textarea';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Coping strategies data
const COPING_STRATEGIES = [
  {
    id: 1,
    name: "Box Breathing",
    description: "A calming breathing technique",
    instructions: "Breathe in for 4 counts, hold for 4, breathe out for 4, hold for 4. Repeat 4 times.",
    category: "anxiety",
    icon: Wind,
    duration: "2 minutes"
  },
  {
    id: 2,
    name: "5-4-3-2-1 Grounding",
    description: "Grounding technique for anxiety",
    instructions: "Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste.",
    category: "anxiety", 
    icon: Focus,
    duration: "3 minutes"
  },
  {
    id: 3,
    name: "Progressive Muscle Relaxation",
    description: "Release physical tension",
    instructions: "Starting with your toes, tense each muscle group for 5 seconds, then relax. Work your way up to your head.",
    category: "stress",
    icon: Activity,
    duration: "10 minutes"
  },
  {
    id: 4,
    name: "Thought Reframing",
    description: "Challenge negative thoughts",
    instructions: "When you notice a negative thought, ask: Is this realistic? What evidence do I have? What would I tell a friend?",
    category: "depression",
    icon: Activity,
    duration: "5 minutes"
  }
];

function App() {
  // State management
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [nickname, setNickname] = useState('');
  const [showNicknameDialog, setShowNicknameDialog] = useState(true);
  const [crisisDetected, setCrisisDetected] = useState(false);
  const [showCrisisModal, setShowCrisisModal] = useState(false);
  const [currentMood, setCurrentMood] = useState([3]);
  const [moodNote, setMoodNote] = useState('');
  const [moodHistory, setMoodHistory] = useState([]);
  const [sentimentTrends, setSentimentTrends] = useState([]);
  const [resources, setResources] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [showPanicHelp, setShowPanicHelp] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Initialize session
  useEffect(() => {
    if (!sessionId) {
      createSession();
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load resources
  useEffect(() => {
    loadResources();
  }, []);

  // Load data when session changes
  useEffect(() => {
    if (sessionId) {
      loadChatHistory();
      loadMoodHistory();
      loadSentimentTrends();
    }
  }, [sessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const createSession = async () => {
    try {
      const response = await axios.post(`${API}/session`, {
        nickname: nickname || null
      });
      setSessionId(response.data.id);
      localStorage.setItem('mental_health_session_id', response.data.id);
    } catch (error) {
      console.error('Error creating session:', error);
      toast.error('Failed to create session');
    }
  };

  const loadChatHistory = async () => {
    if (!sessionId) return;
    
    try {
      const response = await axios.get(`${API}/chat/${sessionId}/history`);
      setMessages(response.data);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const loadMoodHistory = async () => {
    if (!sessionId) return;
    
    try {
      const response = await axios.get(`${API}/mood/${sessionId}/history`);
      setMoodHistory(response.data);
    } catch (error) {
      console.error('Error loading mood history:', error);
    }
  };

  const loadSentimentTrends = async () => {
    if (!sessionId) return;
    
    try {
      const response = await axios.get(`${API}/sentiment/${sessionId}/trends`);
      setSentimentTrends(response.data.trends || []);
    } catch (error) {
      console.error('Error loading sentiment trends:', error);
    }
  };

  const loadResources = async () => {
    try {
      const response = await axios.get(`${API}/resources`);
      setResources(response.data);
    } catch (error) {
      console.error('Error loading resources:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const messageText = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      const response = await axios.post(`${API}/chat`, {
        message: messageText,
        session_id: sessionId
      });

      // Add user message
      const userMessage = {
        id: uuidv4(),
        content: messageText,
        is_user: true,
        timestamp: new Date().toISOString()
      };

      // Add AI response
      const aiMessage = {
        id: uuidv4(),
        content: response.data.message,
        is_user: false,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, userMessage, aiMessage]);

      // Handle crisis detection
      if (response.data.crisis_detected) {
        setCrisisDetected(true);
        setShowCrisisModal(true);
      }

      // Update session ID if new
      if (response.data.session_id && response.data.session_id !== sessionId) {
        setSessionId(response.data.session_id);
        localStorage.setItem('mental_health_session_id', response.data.session_id);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  const logMood = async () => {
    if (!sessionId) return;

    try {
      await axios.post(`${API}/mood`, {
        mood_score: currentMood[0],
        note: moodNote,
        session_id: sessionId
      });

      setMoodNote('');
      await loadMoodHistory();
      toast.success('Mood logged successfully');
      
    } catch (error) {
      console.error('Error logging mood:', error);
      toast.error('Failed to log mood');
    }
  };

  const deleteAllData = async () => {
    if (!sessionId) return;

    try {
      await axios.delete(`${API}/session/${sessionId}/data`);
      
      // Reset local state
      setMessages([]);
      setMoodHistory([]);
      setSentimentTrends([]);
      setSessionId(null);
      localStorage.removeItem('mental_health_session_id');
      
      // Create new session
      await createSession();
      toast.success('All data deleted successfully');
      
    } catch (error) {
      console.error('Error deleting data:', error);
      toast.error('Failed to delete data');
    }
  };

  const getMoodEmoji = (score) => {
    if (score <= 1) return { icon: Frown, color: 'text-red-500', label: 'Very Sad' };
    if (score <= 2) return { icon: Frown, color: 'text-orange-500', label: 'Sad' };
    if (score <= 3) return { icon: Meh, color: 'text-yellow-500', label: 'Neutral' };
    if (score <= 4) return { icon: Smile, color: 'text-green-500', label: 'Happy' };
    return { icon: Smile, color: 'text-emerald-500', label: 'Very Happy' };
  };

  const getSentimentColor = (sentiment) => {
    if (sentiment <= -0.5) return 'bg-red-500';
    if (sentiment <= -0.1) return 'bg-orange-500';
    if (sentiment >= 0.5) return 'bg-emerald-500';
    if (sentiment >= 0.1) return 'bg-green-500';
    return 'bg-gray-400';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleNicknameSubmit = () => {
    setShowNicknameDialog(false);
    if (nickname) {
      createSession();
    }
  };

  // Render components
  const CrisisModal = () => (
    <Dialog open={showCrisisModal} onOpenChange={setShowCrisisModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Immediate Support Available
          </DialogTitle>
          <DialogDescription>
            I'm concerned about you and want to make sure you get the support you need right away.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              If you're having thoughts of self-harm, please reach out for immediate help.
            </AlertDescription>
          </Alert>
          
          {resources?.crisis && (
            <div className="space-y-3">
              {resources.crisis.map((resource, index) => (
                <div key={index} className="p-3 border rounded-lg bg-white">
                  <h4 className="font-semibold text-gray-900">{resource.name}</h4>
                  {resource.phone && (
                    <p className="text-lg font-mono text-blue-600">{resource.phone}</p>
                  )}
                  <p className="text-sm text-gray-600">{resource.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => setShowCrisisModal(false)} variant="outline">
            I understand
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const PanicHelpButton = () => (
    <Button
      onClick={() => setShowPanicHelp(!showPanicHelp)}
      className="fixed bottom-20 right-4 z-50 bg-red-500 hover:bg-red-600 text-white rounded-full p-3 shadow-lg"
      size="lg"
    >
      <Shield className="h-5 w-5" />
    </Button>
  );

  const PanicHelpPanel = () => showPanicHelp && (
    <div className="fixed bottom-32 right-4 z-50 w-80 bg-white border border-red-200 rounded-lg shadow-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-red-600 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Immediate Help
        </h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setShowPanicHelp(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {resources?.crisis && (
        <div className="space-y-2">
          {resources.crisis.slice(0, 2).map((resource, index) => (
            <div key={index} className="p-2 bg-red-50 rounded border-l-4 border-red-400">
              <p className="font-medium text-sm">{resource.name}</p>
              {resource.phone && (
                <p className="text-lg font-mono text-red-600">{resource.phone}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50">
      {/* Crisis Detection Banner */}
      {crisisDetected && (
        <div className="bg-red-500 text-white p-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <span>Crisis support resources are available. Please reach out for help.</span>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => setShowCrisisModal(true)}
              className="ml-2"
            >
              View Resources
            </Button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="container mx-auto p-4 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-teal-100 p-3 rounded-full">
                <MessageCircle className="h-6 w-6 text-teal-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">MindfulChat</h1>
                <p className="text-gray-600">Your compassionate mental health companion</p>
              </div>
            </div>
            
            {nickname && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="h-4 w-4" />
                <span>{nickname}</span>
              </div>
            )}
          </div>
          
          {/* Disclaimer */}
          <Alert className="mt-4 border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              This chatbot provides peer support and is not a replacement for professional mental health care. 
              If you're experiencing a mental health emergency, please contact a crisis helpline immediately.
            </AlertDescription>
          </Alert>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Chat Section */}
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="chat" className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="mood" className="flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Mood
                </TabsTrigger>
                <TabsTrigger value="insights" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Insights
                </TabsTrigger>
                <TabsTrigger value="tools" className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Tools
                </TabsTrigger>
              </TabsList>

              {/* Chat Tab */}
              <TabsContent value="chat">
                <Card className="h-[600px] flex flex-col bg-white/80 backdrop-blur-sm border-slate-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Chat Support</CardTitle>
                        <CardDescription>Share what's on your mind</CardDescription>
                      </div>
                      {isTyping && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                          </div>
                          <span>Typing...</span>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="flex-1 flex flex-col p-4">
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                      {messages.length === 0 && (
                        <div className="text-center text-gray-500 mt-8">
                          <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <p>Hi there! I'm here to listen and support you.</p>
                          <p className="text-sm mt-2">Feel free to share what's on your mind.</p>
                        </div>
                      )}
                      
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.is_user ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`flex items-start gap-3 max-w-[80%] ${message.is_user ? 'flex-row-reverse' : 'flex-row'}`}>
                            <Avatar className="w-8 h-8 flex-shrink-0">
                              {message.is_user ? (
                                <AvatarFallback className="bg-teal-100 text-teal-600">
                                  {nickname ? nickname[0].toUpperCase() : 'U'}
                                </AvatarFallback>
                              ) : (
                                <AvatarFallback className="bg-blue-100 text-blue-600">
                                  AI
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div
                              className={`p-3 rounded-lg ${
                                message.is_user
                                  ? 'bg-teal-600 text-white rounded-br-sm'
                                  : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                              }`}
                            >
                              <p className="text-sm leading-relaxed">{message.content}</p>
                              <p className={`text-xs mt-1 ${
                                message.is_user ? 'text-teal-100' : 'text-gray-500'
                              }`}>
                                {new Date(message.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Message Input */}
                    <form onSubmit={sendMessage} className="mt-4">
                      <div className="flex gap-2">
                        <Input
                          ref={inputRef}
                          value={inputMessage}
                          onChange={(e) => setInputMessage(e.target.value)}
                          placeholder="Type your message..."
                          disabled={isLoading}
                          className="flex-1"
                        />
                        <Button type="submit" disabled={isLoading || !inputMessage.trim()}>
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Mood Tab */}
              <TabsContent value="mood">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Log Your Mood</CardTitle>
                      <CardDescription>Track how you're feeling today</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div>
                        <label className="text-sm font-medium mb-3 block">How are you feeling? (1-5)</label>
                        <Slider
                          value={currentMood}
                          onValueChange={setCurrentMood}
                          max={5}
                          min={1}
                          step={1}
                          className="mb-4"
                        />
                        <div className="flex justify-between text-sm text-gray-500">
                          <span>Very Sad</span>
                          <span>Sad</span>
                          <span>Neutral</span>
                          <span>Happy</span>
                          <span>Very Happy</span>
                        </div>
                        <div className="text-center mt-3">
                          {(() => {
                            const { icon: Icon, color, label } = getMoodEmoji(currentMood[0]);
                            return (
                              <div className="flex items-center justify-center gap-2">
                                <Icon className={`h-8 w-8 ${color}`} />
                                <span className="text-lg font-medium">{label}</span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium mb-2 block">Optional note</label>
                        <Textarea
                          value={moodNote}
                          onChange={(e) => setMoodNote(e.target.value)}
                          placeholder="What's contributing to this mood?"
                          rows={3}
                        />
                      </div>
                      
                      <Button onClick={logMood} className="w-full">
                        Log Mood
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Mood History */}
                  {moodHistory.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Mood History</CardTitle>
                        <CardDescription>Your mood over the last 7 days</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={moodHistory}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="timestamp" 
                              tickFormatter={(value) => new Date(value).toLocaleDateString()}
                            />
                            <YAxis domain={[1, 5]} />
                            <Tooltip 
                              labelFormatter={(value) => new Date(value).toLocaleDateString()}
                              formatter={(value) => [value, 'Mood Score']}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="mood_score" 
                              stroke="#0ea5a5" 
                              strokeWidth={3}
                              dot={{ fill: '#0ea5a5', strokeWidth: 2, r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              {/* Insights Tab */}
              <TabsContent value="insights">
                <div className="space-y-6">
                  {sentimentTrends.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Sentiment Trends</CardTitle>
                        <CardDescription>Your emotional patterns over time</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={sentimentTrends}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="date" 
                              tickFormatter={(value) => new Date(value).toLocaleDateString()}
                            />
                            <YAxis domain={[-1, 1]} />
                            <Tooltip 
                              labelFormatter={(value) => new Date(value).toLocaleDateString()}
                              formatter={(value) => [value.toFixed(2), 'Sentiment Score']}
                            />
                            <Bar 
                              dataKey="avg_sentiment" 
                              fill="#0ea5a5"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                        
                        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                          <div className="p-3 bg-green-50 rounded-lg">
                            <p className="text-sm text-gray-600">Positive Days</p>
                            <p className="text-lg font-semibold text-green-600">
                              {sentimentTrends.filter(t => t.avg_sentiment > 0.1).length}
                            </p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600">Neutral Days</p>
                            <p className="text-lg font-semibold text-gray-600">
                              {sentimentTrends.filter(t => t.avg_sentiment >= -0.1 && t.avg_sentiment <= 0.1).length}
                            </p>
                          </div>
                          <div className="p-3 bg-orange-50 rounded-lg">
                            <p className="text-sm text-gray-600">Challenging Days</p>
                            <p className="text-lg font-semibold text-orange-600">
                              {sentimentTrends.filter(t => t.avg_sentiment < -0.1).length}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle>Weekly Summary</CardTitle>
                      <CardDescription>Your mental health journey this week</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-blue-50 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageCircle className="h-5 w-5 text-blue-600" />
                              <span className="font-medium">Messages</span>
                            </div>
                            <p className="text-2xl font-bold text-blue-600">{messages.length}</p>
                            <p className="text-sm text-gray-600">conversations</p>
                          </div>
                          <div className="p-4 bg-purple-50 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Heart className="h-5 w-5 text-purple-600" />
                              <span className="font-medium">Mood Logs</span>
                            </div>
                            <p className="text-2xl font-bold text-purple-600">{moodHistory.length}</p>
                            <p className="text-sm text-gray-600">entries</p>
                          </div>
                        </div>
                        
                        {moodHistory.length > 0 && (
                          <div className="p-4 bg-green-50 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <TrendingUp className="h-5 w-5 text-green-600" />
                              <span className="font-medium">Average Mood</span>
                            </div>
                            <p className="text-2xl font-bold text-green-600">
                              {(moodHistory.reduce((sum, entry) => sum + entry.mood_score, 0) / moodHistory.length).toFixed(1)}
                            </p>
                            <p className="text-sm text-gray-600">out of 5</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tools Tab */}
              <TabsContent value="tools">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Coping Strategies</CardTitle>
                      <CardDescription>Evidence-based techniques to help you feel better</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4">
                        {COPING_STRATEGIES.map((strategy) => {
                          const Icon = strategy.icon;
                          return (
                            <div key={strategy.id} className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                              <div className="flex items-start gap-3">
                                <div className="bg-teal-100 p-2 rounded-lg">
                                  <Icon className="h-5 w-5 text-teal-600" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold">{strategy.name}</h3>
                                    <Badge variant="secondary" className="text-xs">
                                      {strategy.duration}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-gray-600 mb-2">{strategy.description}</p>
                                  <p className="text-sm text-gray-800">{strategy.instructions}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Resources Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Resources
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {resources?.crisis && (
                  <div>
                    <h4 className="font-semibold text-red-600 mb-2">Crisis Support</h4>
                    <div className="space-y-2">
                      {resources.crisis.slice(0, 2).map((resource, index) => (
                        <div key={index} className="p-2 bg-red-50 rounded border-l-4 border-red-400">
                          <p className="font-medium text-sm">{resource.name}</p>
                          {resource.phone && (
                            <p className="text-sm font-mono text-red-600">{resource.phone}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {resources?.general && (
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">General Support</h4>
                    <div className="space-y-2">
                      {resources.general.slice(0, 2).map((resource, index) => (
                        <div key={index} className="p-2 bg-blue-50 rounded">
                          <p className="font-medium text-sm">{resource.name}</p>
                          <p className="text-xs text-gray-600">{resource.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Settings Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Nickname</label>
                  <Input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Enter your nickname"
                  />
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium text-red-600 mb-2">Data Management</h4>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="w-full">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete All Data
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete All Data</DialogTitle>
                        <DialogDescription>
                          This will permanently delete all your messages, mood logs, and session data. 
                          This action cannot be undone.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline">Cancel</Button>
                        <Button variant="destructive" onClick={deleteAllData}>
                          Delete Everything
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Floating Action Buttons */}
      <PanicHelpButton />
      <PanicHelpPanel />

      {/* Modals */}
      <CrisisModal />

      {/* Nickname Dialog */}
      <Dialog open={showNicknameDialog} onOpenChange={setShowNicknameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Welcome to MindfulChat</DialogTitle>
            <DialogDescription>
              Would you like to set a nickname? This is optional and helps personalize your experience.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter a nickname (optional)"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleNicknameSubmit}>
              Skip
            </Button>
            <Button onClick={handleNicknameSubmit}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;